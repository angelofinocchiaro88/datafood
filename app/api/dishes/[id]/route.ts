import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// PUT: modifica piatto
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { name, price, description, categoryId, vatRate, yieldPortions, preparation } = await request.json();
  const parsedPrice = price == null ? undefined : Number(price);
  const parsedVatRate = vatRate == null ? undefined : Number(vatRate);
  const parsedYield = yieldPortions == null ? undefined : Number(yieldPortions);
  if (parsedPrice != null && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) return NextResponse.json({ error: "Il prezzo deve essere maggiore di zero" }, { status: 400 });
  if (parsedVatRate != null && ![4, 5, 10, 22].includes(parsedVatRate)) return NextResponse.json({ error: "Aliquota IVA non valida" }, { status: 400 });
  if (parsedYield != null && (!Number.isFinite(parsedYield) || parsedYield <= 0)) return NextResponse.json({ error: "La resa deve essere maggiore di zero" }, { status: 400 });
  if (categoryId) {
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) return NextResponse.json({ error: "Categoria non trovata nel ristorante selezionato" }, { status: 404 });
  }
  const dish = await prisma.dish.update({
    where: { id: params.id },
    data: { name: name?.trim(), price: parsedPrice, vatRate: parsedVatRate, yieldPortions: parsedYield, preparation, description, categoryId },
    include: { category: true, recipes: { include: { ingredient: true } } },
  });
  return NextResponse.json(dish);
}

// DELETE: elimina piatto
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.dish.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
