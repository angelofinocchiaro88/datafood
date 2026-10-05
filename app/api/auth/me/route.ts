import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CLIENT_COOKIE, getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Autenticazione richiesta" }, { status: 401 });
  const clients = session.user.platformRole === "datafood_admin"
    ? await prisma.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true, serviceMode: true, licenseStatus: true, licensePlan: true, licenseStartsAt: true, licenseEndsAt: true, managedServiceEnabled: true } })
    : session.user.memberships.filter(item => item.client.isActive).map(item => ({
      id: item.client.id, name: item.client.name, role: item.role, managedAccess: item.managedAccess,
      isActive: item.client.isActive, serviceMode: item.client.serviceMode, licenseStatus: item.client.licenseStatus, licensePlan: item.client.licensePlan, licenseStartsAt: item.client.licenseStartsAt,
      licenseEndsAt: item.client.licenseEndsAt, managedServiceEnabled: item.client.managedServiceEnabled,
    }));
  const currentClientId = request.cookies.get(CLIENT_COOKIE)?.value;
  const now = new Date();
  const selectableClients = clients.filter(client => client.isActive !== false && ["trial", "active"].includes(client.licenseStatus) && client.licenseStartsAt <= now && (!client.licenseEndsAt || client.licenseEndsAt >= now));
  const activeClientId = selectableClients.some(client => client.id === currentClientId) ? currentClientId : selectableClients[0]?.id || null;
  return NextResponse.json({
    user: { id: session.user.id, email: session.user.email, name: session.user.name, platformRole: session.user.platformRole },
    clients,
    activeClientId,
  });
}
