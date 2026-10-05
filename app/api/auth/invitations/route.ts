import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, hashToken, requireClientAccess, recordClientAudit } from "@/lib/auth";

const ROLES = new Set(["owner", "manager", "accountant", "staff", "datafood_operator"]);

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Autenticazione richiesta" }, { status: 401 });
  let access: any;
  if (session.user.platformRole === "datafood_admin") {
    const clientId = request.cookies.get("df_clientId")?.value;
    const client = clientId ? await prisma.client.findFirst({ where: { id: clientId, isActive: true } }) : null;
    if (!client) return NextResponse.json({ error: "Seleziona un ristorante attivo" }, { status: 400 });
    access = { client, user: { id: session.user.id, email: session.user.email, name: session.user.name, platformRole: session.user.platformRole }, membership: { role: "datafood_admin", managedAccess: client.managedServiceEnabled }, source: "datafood_admin" };
  } else {
    const accessResult = await requireClientAccess(request, true);
    if ("response" in accessResult) return accessResult.response;
    access = accessResult.access;
  }
  const body = await request.json();
  const email = String(body.email || "").trim().toLocaleLowerCase("it-IT");
  const role = String(body.role || "staff");
  const managedAccess = body.managedAccess === true;
  if (!/^\S+@\S+\.\S+$/.test(email) || !ROLES.has(role)) return NextResponse.json({ error: "Email o ruolo non validi" }, { status: 400 });
  const platformAdmin = session.user.platformRole === "datafood_admin";
  if (!platformAdmin && !["owner", "manager"].includes(access.membership.role)) return NextResponse.json({ error: "Solo owner e manager possono invitare utenti" }, { status: 403 });
  if (role === "datafood_operator" && (!platformAdmin || !managedAccess || !access.client.managedServiceEnabled || !["managed", "hybrid"].includes(access.client.serviceMode))) {
    return NextResponse.json({ error: "L’accesso operatore DATAFOOD richiede un incarico gestito attivo" }, { status: 403 });
  }
  if (role === "owner" && access.membership.role !== "owner" && !platformAdmin) return NextResponse.json({ error: "Solo un owner o amministratore DATAFOOD può nominare un owner" }, { status: 403 });

  const rawToken = randomBytes(32).toString("base64url");
  const invitation = await prisma.userInvitation.create({
    data: { email, clientId: access.client.id, role, managedAccess, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 7 * 86400000), createdByUserId: access.user.id },
    select: { id: true, email: true, role: true, expiresAt: true },
  });
  await recordClientAudit(access, "invite_created", "UserInvitation", invitation.id, { email, role, managedAccess });
  return NextResponse.json({ ...invitation, invitationToken: rawToken, message: "Invito creato. Condividi il token una sola volta o integralo con l’invio email." }, { status: 201 });
}
