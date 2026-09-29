import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { name, vat, email, phone, address, notes } = await request.json();
  const supplier = await prisma.supplier.update({
    where: { id: params.id },
    data: { name, vat, email, phone, address, notes },
  });
  return NextResponse.json(supplier);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.supplier.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}