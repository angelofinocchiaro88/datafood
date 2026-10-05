import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, refreshUserSession, setSessionCookie } from "@/lib/auth";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(request);
  if (!session || session.user.platformRole !== "datafood_admin") return NextResponse.json({ error: "Solo un amministratore DATAFOOD può sospendere un ristorante" }, { status: 403 });
  try {
    if (params.id === "default") return NextResponse.json({ error: "Cannot delete default client" }, { status: 400 });
    await prisma.client.update({ where: { id: params.id }, data: { isActive: false, licenseStatus: "suspended" } });
    const refreshed = await refreshUserSession(request, session.user.id);
    const response = NextResponse.json({ success: true, status: "suspended" });
    setSessionCookie(response, refreshed.token, refreshed.expiresAt);
    return response;
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(request);
  if (!session || session.user.platformRole !== "datafood_admin") return NextResponse.json({ error: "Solo un amministratore DATAFOOD può gestire licenze e servizi" }, { status: 403 });
  const body = await request.json();
  const allowedModes = ["self_service", "managed", "hybrid"];
  const allowedStatuses = ["trial", "active", "past_due", "suspended", "expired"];
  if (body.serviceMode != null && !allowedModes.includes(body.serviceMode)) return NextResponse.json({ error: "Modalità servizio non valida" }, { status: 400 });
  if (body.licenseStatus != null && !allowedStatuses.includes(body.licenseStatus)) return NextResponse.json({ error: "Stato licenza non valido" }, { status: 400 });
  const licenseEndsAt = body.licenseEndsAt === undefined ? undefined : body.licenseEndsAt ? new Date(body.licenseEndsAt) : null;
  if (licenseEndsAt instanceof Date && Number.isNaN(licenseEndsAt.getTime())) return NextResponse.json({ error: "Data licenza non valida" }, { status: 400 });
  const licenseStartsAt = body.licenseStartsAt === undefined ? undefined : new Date(body.licenseStartsAt);
  if (licenseStartsAt instanceof Date && Number.isNaN(licenseStartsAt.getTime())) return NextResponse.json({ error: "Data inizio licenza non valida" }, { status: 400 });
  const managedServiceEnabled = body.managedServiceEnabled === undefined ? undefined : Boolean(body.managedServiceEnabled);
  if ((body.serviceMode === "self_service") && managedServiceEnabled === true) return NextResponse.json({ error: "Self-service e incarico gestito sono incompatibili" }, { status: 400 });
  try {
    const client = await prisma.client.update({ where: { id: params.id }, data: {
      ...(body.serviceMode != null ? { serviceMode: body.serviceMode } : {}),
      ...(body.licenseStatus != null ? { licenseStatus: body.licenseStatus } : {}),
      ...(body.licensePlan !== undefined ? { licensePlan: body.licensePlan || null } : {}),
      ...(licenseStartsAt !== undefined ? { licenseStartsAt } : {}),
      ...(licenseEndsAt !== undefined ? { licenseEndsAt } : {}),
      ...(managedServiceEnabled !== undefined ? { managedServiceEnabled } : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
    } });
    if (managedServiceEnabled === false || client.serviceMode === "self_service") {
      await prisma.clientMembership.updateMany({ where: { clientId: client.id, role: "datafood_operator" }, data: { managedAccess: false } });
    } else if (managedServiceEnabled === true) {
      await prisma.clientMembership.upsert({ where: { userId_clientId: { userId: session.user.id, clientId: client.id } }, create: { userId: session.user.id, clientId: client.id, role: "datafood_operator", managedAccess: true, grantedByUserId: session.user.id }, update: { role: "datafood_operator", managedAccess: true, grantedByUserId: session.user.id } });
    }
    await prisma.clientAuditLog.create({ data: { clientId: client.id, actorUserId: session.user.id, action: "client_license_service_updated", entity: "Client", entityId: client.id, source: "datafood_admin", detailsJson: JSON.stringify({ serviceMode: client.serviceMode, licenseStatus: client.licenseStatus, managedServiceEnabled: client.managedServiceEnabled }) } });
    const refreshed = await refreshUserSession(request, session.user.id);
    const response = NextResponse.json({ client });
    setSessionCookie(response, refreshed.token, refreshed.expiresAt);
    return response;
  } catch {
    return NextResponse.json({ error: "Ristorante non trovato o dati non validi" }, { status: 404 });
  }
}
