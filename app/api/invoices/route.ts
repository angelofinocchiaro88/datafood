import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordClientAudit, requireClientAccess } from "@/lib/auth";
import { syncSupplierInvoiceSchedule } from "@/lib/financial-schedules";

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
  const accessResult = await requireClientAccess(request, true);
  if ("response" in accessResult) return accessResult.response;
  const { access } = accessResult;
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

    await syncSupplierInvoiceSchedule(invoice);
    await recordClientAudit(access, "supplier_invoice_registered", "Invoice", invoice.id, { invoiceNumber, totalAmount, status: invoice.status });
    return NextResponse.json(invoice);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const accessResult = await requireClientAccess(request, true);
  if ("response" in accessResult) return accessResult.response;
  const { access } = accessResult;
  try {
    const body = await request.json();
    const { id, status, macroArea, categoria, sottocategoria, voceDettaglio, contoGestionale, orderId } = body;
    if (!id || !status) return NextResponse.json({ error: "id e status richiesti" }, { status: 400 });
    const current = await prisma.invoice.findUnique({ where: { id }, select: { id: true, supplierId: true } });
    if (!current) return NextResponse.json({ error: "Fattura non trovata" }, { status: 404 });
    if (orderId) {
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, supplierId: true } });
      if (!order || order.status !== "RECEIVED" || !current.supplierId || order.supplierId !== current.supplierId) return NextResponse.json({ error: "Collega solo un ordine ricevuto dello stesso fornitore" }, { status: 400 });
    }
    const inv = await prisma.invoice.update({
      where: { id },
      data: { status, macroArea: macroArea || null, categoria: categoria || null, sottocategoria: sottocategoria || null, voceDettaglio: voceDettaglio || null, contoGestionale: contoGestionale || null, ...(Object.prototype.hasOwnProperty.call(body, "orderId") ? { orderId: orderId || null } : {}) },
    });
    await syncSupplierInvoiceSchedule(inv);
    await recordClientAudit(access, status === "RECEIVED" || status === "PROCESSED" ? "supplier_invoice_approved" : "supplier_invoice_updated", "Invoice", inv.id, { status, macroArea, contoGestionale });
    return NextResponse.json(inv);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
