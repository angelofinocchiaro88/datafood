import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: params.id } });
    await prisma.invoice.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}