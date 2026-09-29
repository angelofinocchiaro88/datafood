import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  const { to, subject, text, html, template } = await request.json();

  if (!to || !subject) {
    return NextResponse.json({ error: "Destinatario e oggetto obbligatori" }, { status: 400 });
  }

  const result = await sendEmail({ to, subject, text, html, template });

  if (!result.success) {
    return NextResponse.json({ success: false, mode: result.mode, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, mode: result.mode, messageId: result.messageId });
}