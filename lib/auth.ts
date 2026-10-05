import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "df_session";
export const CLIENT_COOKIE = "df_clientId";
const SESSION_HOURS = 12;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(digest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createUserSession(userId: string) {
  const secret = process.env.DATAFOOD_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("DATAFOOD_SESSION_SECRET deve avere almeno 32 caratteri");
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { memberships: { include: { client: true } } } });
  if (!user) throw new Error("Utente non trovato");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  const sessionId = randomBytes(18).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sid: sessionId,
    sub: user.id,
    exp: Math.floor(expiresAt.getTime() / 1000),
    platformRole: user.platformRole,
    memberships: user.memberships.map(membership => ({
      clientId: membership.clientId,
      role: membership.role,
      managedAccess: membership.managedAccess,
      serviceMode: membership.client.serviceMode,
      managedServiceEnabled: membership.client.managedServiceEnabled,
      licenseStatus: membership.client.licenseStatus,
      licenseStartsAt: membership.client.licenseStartsAt.toISOString(),
      licenseEndsAt: membership.client.licenseEndsAt?.toISOString() || null,
      clientActive: membership.client.isActive,
    })),
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  const token = `${payload}.${signature}`;
  await prisma.userSession.create({ data: { id: sessionId, userId, tokenHash: hashToken(token), expiresAt } });
  return { token, expiresAt };
}

export async function refreshUserSession(request: Request, userId: string) {
  const current = await getSession(request);
  if (current?.userId === userId && !current.revokedAt) {
    await prisma.userSession.update({ where: { id: current.id }, data: { revokedAt: new Date() } });
  }
  return createUserSession(userId);
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function setClientCookie(response: NextResponse, clientId: string) {
  response.cookies.set(CLIENT_COOKIE, clientId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set(CLIENT_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getSession(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = cookieHeader.split(";").map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!token) return null;
  const decodedToken = decodeURIComponent(token);
  if (!verifySessionToken(decodedToken)) return null;
  const session = await prisma.userSession.findUnique({ where: { tokenHash: hashToken(decodedToken) }, include: { user: { include: { memberships: { include: { client: true } } } } } });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) return null;
  return session;
}

export function verifySessionToken(token: string) {
  const secret = process.env.DATAFOOD_SESSION_SECRET;
  if (!secret || secret.length < 32) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof decoded.exp === "number" && decoded.exp * 1000 > Date.now() && typeof decoded.sub === "string" && typeof decoded.sid === "string";
  } catch { return false; }
}

export type ClientAccess = {
  user: { id: string; email: string; name: string; platformRole: string };
  client: any;
  membership: any;
  source: "restaurant_user" | "datafood_operator" | "datafood_admin";
};

export async function requireClientAccess(request: NextRequest, write = false): Promise<{ access: ClientAccess } | { response: NextResponse }> {
  const session = await getSession(request);
  if (!session) return { response: NextResponse.json({ error: "Autenticazione richiesta" }, { status: 401 }) };

  const clientId = request.cookies.get(CLIENT_COOKIE)?.value || request.headers.get("x-client-id");
  if (!clientId) return { response: NextResponse.json({ error: "Seleziona un ristorante" }, { status: 400 }) };
  const membership = session.user.memberships.find(item => item.clientId === clientId);
  const isPlatformAdmin = session.user.platformRole === "datafood_admin";
  const client = membership?.client || (isPlatformAdmin ? await prisma.client.findUnique({ where: { id: clientId } }) : null);
  if (!client || !client.isActive) return { response: NextResponse.json({ error: "Non hai accesso a questo ristorante" }, { status: 403 }) };

  const now = new Date();
  const licenseValid = ["trial", "active"].includes(client.licenseStatus) && client.licenseStartsAt <= now && (!client.licenseEndsAt || client.licenseEndsAt >= now);
  if (!licenseValid) return { response: NextResponse.json({ error: "Licenza non attiva. Contatta DATAFOOD per riattivare il servizio.", code: "LICENSE_INACTIVE" }, { status: 402 }) };

  const operator = membership?.role === "datafood_operator" || (isPlatformAdmin && !membership && write);
  const managedAccess = membership?.managedAccess === true || (isPlatformAdmin && !membership && client.managedServiceEnabled);
  if (operator && (!managedAccess || !client.managedServiceEnabled || !["managed", "hybrid"].includes(client.serviceMode))) {
    return { response: NextResponse.json({ error: "Incarico DATAFOOD non attivo per questo ristorante" }, { status: 403 }) };
  }
  if (write && operator && !managedAccess) return { response: NextResponse.json({ error: "Permesso di inserimento non concesso" }, { status: 403 }) };
  if (write && !operator && !isPlatformAdmin && !["owner", "manager", "accountant", "staff"].includes(membership?.role || "")) {
    return { response: NextResponse.json({ error: "Permesso di modifica insufficiente" }, { status: 403 }) };
  }

  return {
    access: {
      user: { id: session.user.id, email: session.user.email, name: session.user.name, platformRole: session.user.platformRole },
      client,
      membership: membership || { role: operator ? "datafood_operator" : "datafood_admin", managedAccess },
      source: operator ? "datafood_operator" : isPlatformAdmin ? "datafood_admin" : "restaurant_user",
    },
  };
}

export async function recordClientAudit(access: ClientAccess, action: string, entity: string, entityId?: string, details?: unknown, sourceOverride?: string) {
  await prisma.clientAuditLog.create({
    data: {
      clientId: access.client.id,
      actorUserId: access.user.id,
      action,
      entity,
      entityId,
      source: sourceOverride || access.source,
      detailsJson: details == null ? null : JSON.stringify(details),
    },
  });
}
