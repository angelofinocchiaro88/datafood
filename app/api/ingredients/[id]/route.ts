import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { name, unit, unitPrice, minStock, currentStock } = await request.json();
  const ingredient = await prisma.ingredient.update({
    where: { id: params.id },
    data: {
      name: name || undefined,
      unit: unit || undefined,
      unitPrice: unitPrice != null ? parseFloat(unitPrice) : undefined,
      minStock: minStock != null ? parseFloat(minStock) : undefined,
      currentStock: currentStock != null ? parseFloat(currentStock) : undefined,
    },
  });
  return NextResponse.json(ingredient);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.ingredient.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}