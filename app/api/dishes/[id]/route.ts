import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// PUT: modifica piatto
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { name, price, description, categoryId } = await request.json();
  const dish = await prisma.dish.update({
    where: { id: params.id },
    data: { name, price: price != null ? parseFloat(price) : undefined, description, categoryId },
    include: { category: true, recipes: { include: { ingredient: true } } },
  });
  return NextResponse.json(dish);
}

// DELETE: elimina piatto
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.dish.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}