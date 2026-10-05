import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordClientAudit, requireClientAccess } from "@/lib/auth";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const accessResult = await requireClientAccess(request, true);
    if ("response" in accessResult) return accessResult.response;
    const { access } = accessResult;
    await prisma.paymentSchedule.updateMany({ where: { sourceType: "supplier_invoice", sourceId: params.id }, data: { status: "cancelled" } });
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: params.id } });
    await prisma.invoice.delete({ where: { id: params.id } });
    await recordClientAudit(access, "supplier_invoice_deleted", "Invoice", params.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
