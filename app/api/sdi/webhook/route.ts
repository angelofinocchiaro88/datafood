import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    const signature = request.headers.get("x-cn-signature");

    let xmlContent: string;

    if (contentType.includes("application/xml") || contentType.includes("text/xml")) {
      xmlContent = await request.text();
    } else {
      xmlContent = await request.text();
    }

    const sdiConfig = await prisma.sdiConfig.findFirst({ where: { active: true } });

    let invoiceData: Record<string, unknown> = {};

    try {
      const { parseFatturaPA } = await import("@/lib/sdi-parser");
      invoiceData = parseFatturaPA(xmlContent);
    } catch (parseError) {
      console.error("SDI XML parse error:", parseError);
    }

    const invoiceNumber = invoiceData.invoiceNumber as string || `SDI_${Date.now()}`;
    const invoiceDateStr = invoiceData.invoiceDate as string || new Date().toISOString().split("T")[0];
    const invoiceDate = new Date(invoiceDateStr);
    const senderVat = invoiceData.senderVat as string || "UNKNOWN";
    const senderName = invoiceData.senderName as string || "Sconosciuto";
    const totalAmount = (invoiceData.totalAmount as number) || 0;
    const taxAmount = (invoiceData.taxAmount as number) || 0;

    let supplier = await prisma.supplier.findFirst({
      where: { vat: senderVat },
    });

    if (!supplier && senderVat !== "UNKNOWN") {
      supplier = await prisma.supplier.create({
        data: {
          name: senderName,
          vat: senderVat,
        },
      });
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceDate,
        senderVat,
        senderName,
        recipientVat: invoiceData.recipientVat as string || "",
        recipientName: invoiceData.recipientName as string || "",
        totalAmount,
        taxAmount,
        xmlContent,
        status: "RECEIVED",
        supplierId: supplier?.id,
      },
      include: { supplier: true, items: true },
    });

    if (invoiceData.items && Array.isArray(invoiceData.items)) {
      for (const item of invoiceData.items) {
        await prisma.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            description: item.description as string || "Voce fattura",
            quantity: item.quantity as number || 1,
            unitPrice: item.unitPrice as number || 0,
            totalPrice: item.totalPrice as number || 0,
            vatRate: item.vatRate as number || 22,
          },
        });
      }
    }

    if (sdiConfig?.pushUrl) {
      console.log(`Invoice ${invoiceNumber} stored, notification would be sent to ${sdiConfig.pushUrl}`);
    }

    return NextResponse.json({
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      message: "Fattura SDI ricevuta e memorizzata",
    });
  } catch (error) {
    console.error("SDI webhook error:", error);
    return NextResponse.json(
      { error: "Failed to process SDI invoice" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const config = await prisma.sdiConfig.findFirst({ where: { active: true } });

    if (!config) {
      return NextResponse.json({
        configured: false,
        message: "SDI non configurato. Vai su Impostazioni per configurare il ricevimento fatture.",
      });
    }

    return NextResponse.json({
      configured: true,
      recipientCode: config.recipientCode,
      pecAddress: config.pecAddress,
      pushEnabled: !!config.pushUrl,
      lastFetch: config.lastFetch,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch SDI config" }, { status: 500 });
  }
}