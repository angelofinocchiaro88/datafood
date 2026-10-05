import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const dishes = await prisma.dish.findMany({
    include: { category: true, recipes: { include: { ingredient: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(dishes);
}

export async function POST(request: NextRequest) {
  const { name, price, description, categoryId, vatRate = 10, yieldPortions = 1, preparation } = await request.json();
  const parsedPrice = Number(price);
  const parsedVatRate = Number(vatRate);
  const parsedYield = Number(yieldPortions);
  if (!name?.trim() || !categoryId || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return NextResponse.json({ error: "Nome, categoria e prezzo valido sono obbligatori" }, { status: 400 });
  }
  if (![4, 5, 10, 22].includes(parsedVatRate) || !Number.isFinite(parsedYield) || parsedYield <= 0) {
    return NextResponse.json({ error: "Controlla aliquota IVA e porzioni prodotte" }, { status: 400 });
  }
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) return NextResponse.json({ error: "Categoria non trovata nel ristorante selezionato" }, { status: 404 });

  const dish = await prisma.dish.create({
    data: { name: name.trim(), price: parsedPrice, vatRate: parsedVatRate, yieldPortions: parsedYield, preparation, description, categoryId },
    include: { category: true, recipes: { include: { ingredient: true } } },
  });
  return NextResponse.json(dish);
}
