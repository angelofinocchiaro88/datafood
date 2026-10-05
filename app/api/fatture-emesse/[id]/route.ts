import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordClientAudit, requireClientAccess } from "@/lib/auth";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const accessResult = await requireClientAccess(request, true);
  if ("response" in accessResult) return accessResult.response;
  const { access } = accessResult;
  await prisma.paymentSchedule.updateMany({ where: { sourceType: "issued_invoice", sourceId: params.id }, data: { status: "cancelled" } });
  await prisma.fatturaEmessa.delete({ where: { id: params.id } });
  await recordClientAudit(access, "issued_invoice_deleted", "FatturaEmessa", params.id);
  return NextResponse.json({ success: true });
}
