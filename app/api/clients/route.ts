import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, refreshUserSession, setSessionCookie } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Autenticazione richiesta" }, { status: 401 });
  const clients = session.user.platformRole === "datafood_admin"
    ? await prisma.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })
    : session.user.memberships.filter(membership => membership.client.isActive).map(membership => ({ ...membership.client, membershipRole: membership.role, managedAccess: membership.managedAccess }));
  return NextResponse.json({ clients });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || session.user.platformRole !== "datafood_admin") return NextResponse.json({ error: "Solo un amministratore DATAFOOD può creare ristoranti" }, { status: 403 });
  const { name, sdiCode, pecAddress, vatNumber, address, phone, email, serviceMode = "self_service", licenseStatus = "trial", licensePlan, licenseEndsAt, managedServiceEnabled = false, ownerEmail } = await request.json();
  if (!name?.trim() || !["self_service", "managed", "hybrid"].includes(serviceMode) || !["trial", "active", "past_due", "suspended", "expired"].includes(licenseStatus)) {
    return NextResponse.json({ error: "Nome, modalità servizio o stato licenza non validi" }, { status: 400 });
  }
  if (serviceMode === "self_service" && managedServiceEnabled) return NextResponse.json({ error: "Il servizio gestito non può essere attivo in modalità self-service" }, { status: 400 });
  if (ownerEmail && !/^\S+@\S+\.\S+$/.test(String(ownerEmail).trim())) return NextResponse.json({ error: "Email owner non valida" }, { status: 400 });
  const parsedLicenseEnd = licenseEndsAt ? new Date(licenseEndsAt) : null;
  if (parsedLicenseEnd && Number.isNaN(parsedLicenseEnd.getTime())) return NextResponse.json({ error: "Scadenza licenza non valida" }, { status: 400 });
  const client = await prisma.client.create({
    data: { name: name.trim(), sdiCode, pecAddress, vatNumber, address, phone, email, serviceMode, licenseStatus, licensePlan: licensePlan || null, licenseEndsAt: parsedLicenseEnd, managedServiceEnabled },
  });
  if (managedServiceEnabled && ["managed", "hybrid"].includes(serviceMode)) {
    await prisma.clientMembership.create({ data: { userId: session.user.id, clientId: client.id, role: "datafood_operator", managedAccess: true, grantedByUserId: session.user.id } });
  }
  let ownerInvitation: string | null = null;
  if (ownerEmail) {
    const normalizedEmail = String(ownerEmail).trim().toLocaleLowerCase("it-IT");
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      await prisma.clientMembership.upsert({ where: { userId_clientId: { userId: existingUser.id, clientId: client.id } }, create: { userId: existingUser.id, clientId: client.id, role: "owner" }, update: { role: "owner" } });
    } else {
      const { randomBytes } = await import("crypto");
      const { hashToken } = await import("@/lib/auth");
      ownerInvitation = randomBytes(32).toString("base64url");
      await prisma.userInvitation.create({ data: { email: normalizedEmail, clientId: client.id, role: "owner", tokenHash: hashToken(ownerInvitation), expiresAt: new Date(Date.now() + 7 * 86400000), createdByUserId: session.user.id } });
    }
  }
  await prisma.clientAuditLog.create({ data: { clientId: client.id, actorUserId: session.user.id, action: "client_created", entity: "Client", entityId: client.id, source: "datafood_admin", detailsJson: JSON.stringify({ serviceMode, licenseStatus, managedServiceEnabled }) } });
  const refreshed = await refreshUserSession(request, session.user.id);
  const response = NextResponse.json({ client, ownerInvitation }, { status: 201 });
  setSessionCookie(response, refreshed.token, refreshed.expiresAt);
  return response;
}
