import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clearSessionCookies, getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (session) await prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  const response = NextResponse.json({ success: true });
  clearSessionCookies(response);
  return response;
}
