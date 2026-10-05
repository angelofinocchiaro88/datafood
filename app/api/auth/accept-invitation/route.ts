import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, hashToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const token = String(body.token || "");
  const invitation = await prisma.userInvitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { client: true } });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date() || !invitation.client.isActive) {
    return NextResponse.json({ error: "Invito non valido o scaduto" }, { status: 400 });
  }
  const email = String(body.email || invitation.email).trim().toLocaleLowerCase("it-IT");
  if (email !== invitation.email.toLocaleLowerCase("it-IT")) return NextResponse.json({ error: "Email diversa da quella invitata" }, { status: 400 });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !existing.isActive) return NextResponse.json({ error: "Account sospeso: contatta l’amministratore" }, { status: 403 });
  const createdNewUser = !existing;
  const password = String(body.password || "");
  const name = String(body.name || "").trim();
  if (!existing && (!name || password.length < 12)) return NextResponse.json({ error: "Inserisci il nome e una password di almeno 12 caratteri" }, { status: 400 });
  if (invitation.role === "datafood_operator" && (!invitation.managedAccess || !invitation.client.managedServiceEnabled || !["managed", "hybrid"].includes(invitation.client.serviceMode))) {
    return NextResponse.json({ error: "L’incarico DATAFOOD non è più attivo" }, { status: 403 });
  }

  const result = await prisma.$transaction(async tx => {
    const user = existing || await tx.user.create({ data: { email, name, passwordHash: await hashPassword(password) } });
    await tx.clientMembership.upsert({
      where: { userId_clientId: { userId: user.id, clientId: invitation.clientId } },
      create: { userId: user.id, clientId: invitation.clientId, role: invitation.role, managedAccess: invitation.managedAccess, grantedByUserId: invitation.createdByUserId },
      update: { role: invitation.role, managedAccess: invitation.managedAccess, grantedByUserId: invitation.createdByUserId },
    });
    await tx.userInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    await tx.clientAuditLog.create({ data: { clientId: invitation.clientId, actorUserId: user.id, action: "invitation_accepted", entity: "UserMembership", entityId: user.id, source: invitation.role === "datafood_operator" ? "datafood_operator" : "restaurant_user" } });
    return user;
  });
  return NextResponse.json({ success: true, createdNewUser, user: { id: result.id, email: result.email, name: result.name }, clientId: invitation.clientId });
}
