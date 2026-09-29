import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";

export interface EmailMessage {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  attachments?: { filename: string; content: Buffer | string }[];
}

export interface SendResult {
  success: boolean;
  mode: "inviata" | "dry_run" | "errore";
  messageId?: string;
  error?: string;
}

// Recupera config email attiva
export async function getEmailConfig() {
  return prisma.emailConfig.findFirst({ where: { enabled: true } });
}

// Invia email: se config non c'è → dry_run (log solo)
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const config = await getEmailConfig();

  // Se non configurato → dry-run (simula invio, logga)
  if (!config) {
    await prisma.emailLog.create({
      data: {
        to: message.to,
        subject: message.subject,
        template: message.template || "generico",
        body: message.text || message.html || "",
        status: "dry_run",
      },
    });
    return { success: true, mode: "dry_run" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
    });

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: config.replyTo || undefined,
      attachments: message.attachments,
    });

    await prisma.emailLog.create({
      data: {
        to: message.to,
        subject: message.subject,
        template: message.template || "generico",
        body: message.html || message.text || "",
        status: "inviata",
      },
    });

    return { success: true, mode: "inviata", messageId: info.messageId };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Errore invio";
    await prisma.emailLog.create({
      data: { to: message.to, subject: message.subject, template: message.template || "generico", status: "errore", error: msg },
    });
    return { success: false, mode: "errore", error: msg };
  }
}

// Template ordine fornitore
export function buildOrderEmail(order: any): EmailMessage {
  const items = order.items
    .map((i: any) => `• ${i.ingredient?.name || "?"}: ${i.quantity} x €${i.unitPrice.toFixed(2)}`)
    .join("\n");

  return {
    to: order.supplier?.email || "",
    subject: `Ordine #${order.id.slice(-4)} - DATAFOOD`,
    template: "ordine",
    text: `Gentile ${order.supplier?.name || "fornitore"},\n\nVi trasmettiamo il seguente ordine:\n\n${items}\n\nTotale: €${order.total.toFixed(2)}\n\nCordiali saluti,\nDATAFOOD`,
  };
}

// Template report mensile
export function buildReportEmail(to: string, reportTitle: string, summary: string): EmailMessage {
  return {
    to,
    subject: `Report: ${reportTitle} - DATAFOOD`,
    template: "report",
    text: summary,
  };
}