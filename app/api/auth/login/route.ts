import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createUserSession, setSessionCookie, verifyPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const email = String(body.email || "").trim().toLocaleLowerCase("it-IT");
  const password = String(body.password || "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Email o password non corretti" }, { status: 401 });
  }
  const session = await createUserSession(user.id);
  const response = NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name, platformRole: user.platformRole } });
  setSessionCookie(response, session.token, session.expiresAt);
  return response;
}
