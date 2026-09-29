import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const config = await prisma.emailConfig.findFirst();
  if (!config) {
    return NextResponse.json({ configured: false });
  }
  return NextResponse.json({
    configured: true,
    host: config.host,
    port: config.port,
    user: config.user,
    fromName: config.fromName,
    fromEmail: config.fromEmail,
    enabled: config.enabled,
    lastTest: config.testDate,
  });
}

export async function POST(request: NextRequest) {
  const { host, port, secure, user, password, fromName, fromEmail, replyTo, enabled } = await request.json();

  if (!host || !user || !password || !fromEmail) {
    return NextResponse.json({ error: "Campi obbligatori mancanti" }, { status: 400 });
  }

  const existing = await prisma.emailConfig.findFirst();
  let config;
  if (existing) {
    config = await prisma.emailConfig.update({
      where: { id: existing.id },
      data: { host, port: parseInt(port) || 587, secure: !!secure, user, password, fromName, fromEmail, replyTo, enabled: !!enabled },
    });
  } else {
    config = await prisma.emailConfig.create({
      data: { host, port: parseInt(port) || 587, secure: !!secure, user, password, fromName, fromEmail, replyTo, enabled: !!enabled },
    });
  }

  return NextResponse.json({ success: true, config });
}