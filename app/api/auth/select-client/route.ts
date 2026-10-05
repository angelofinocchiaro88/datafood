import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CLIENT_COOKIE, getSession, setClientCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Autenticazione richiesta" }, { status: 401 });
  const { clientId } = await request.json();
  const membership = session.user.memberships.find(item => item.clientId === clientId);
  const isPlatformAdmin = session.user.platformRole === "datafood_admin";
  const client = membership?.client;
  if ((!membership && !isPlatformAdmin) || (client && !client.isActive)) return NextResponse.json({ error: "Non hai accesso a questo ristorante" }, { status: 403 });
  if (membership?.role === "datafood_operator" && (!membership.managedAccess || !client?.managedServiceEnabled || !["managed", "hybrid"].includes(client.serviceMode))) {
    return NextResponse.json({ error: "Incarico DATAFOOD non attivo per questo ristorante" }, { status: 403 });
  }
  const selectedClient = client || (isPlatformAdmin ? await prisma.client.findFirst({ where: { id: clientId, isActive: true } }) : null);
  if (!selectedClient) return NextResponse.json({ error: "Ristorante non trovato" }, { status: 404 });
  const now = new Date();
  const licenseValid = ["trial", "active"].includes(selectedClient.licenseStatus) && selectedClient.licenseStartsAt <= now && (!selectedClient.licenseEndsAt || selectedClient.licenseEndsAt >= now);
  if (!licenseValid) return NextResponse.json({ error: "Licenza non attiva" }, { status: 402 });
  const response = NextResponse.json({ success: true, clientId: selectedClient.id, name: selectedClient.name });
  setClientCookie(response, selectedClient.id);
  return response;
}
