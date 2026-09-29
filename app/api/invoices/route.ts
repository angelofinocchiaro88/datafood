import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
    const invoices = await prisma.invoice.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return NextResponse.json({ invoices, total: invoices.length });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { invoiceNumber, invoiceDate, dueDate, senderVat, senderName, recipientVat, recipientName, totalAmount, taxAmount, status, xmlContent } = await request.json();

    // Auto-link supplier by VAT
    let supplierId: string | null = null;
    if (senderVat) {
      const supplier = await prisma.supplier.findFirst({ where: { vat: senderVat } });
      if (supplier) supplierId = supplier.id;
      else {
        // Auto-create supplier
        const s = await prisma.supplier.create({ data: { name: senderName, vat: senderVat } });
        supplierId = s.id;
      }
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceDate: new Date(invoiceDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        senderVat: senderVat || "",
        senderName: senderName || "",
        recipientVat: recipientVat || "",
        recipientName: recipientName || "",
        totalAmount: totalAmount || 0,
        taxAmount: taxAmount || 0,
        status: status || "PENDING",
        xmlContent: xmlContent || null,
        supplierId,
      },
    });

    return NextResponse.json(invoice);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, status, macroArea, categoria, sottocategoria, voceDettaglio, contoGestionale } = await request.json();
    if (!id || !status) return NextResponse.json({ error: "id e status richiesti" }, { status: 400 });
    const inv = await prisma.invoice.update({
      where: { id },
      data: { status, macroArea: macroArea || null, categoria: categoria || null, sottocategoria: sottocategoria || null, voceDettaglio: voceDettaglio || null, contoGestionale: contoGestionale || null },
    });
    return NextResponse.json(inv);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}