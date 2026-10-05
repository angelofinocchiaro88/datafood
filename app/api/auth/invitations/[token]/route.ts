import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/auth";

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const invitation = await prisma.userInvitation.findUnique({ where: { tokenHash: hashToken(params.token) }, include: { client: { select: { name: true, isActive: true, licenseStatus: true } } } });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date() || !invitation.client.isActive) {
    return NextResponse.json({ error: "Invito non valido o scaduto" }, { status: 404 });
  }
  return NextResponse.json({ email: invitation.email, role: invitation.role, restaurantName: invitation.client.name, expiresAt: invitation.expiresAt });
}
