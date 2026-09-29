import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const ingredients = await prisma.ingredient.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(ingredients);
}

export async function POST(request: NextRequest) {
  const { name, unit, categoria = "Altro", currentStock = 0, minStock = 0, unitPrice = 0 } = await request.json();
  const parsedPrice = Number(unitPrice);
  const parsedStock = Number(currentStock);
  const parsedMinStock = Number(minStock);
  if (!name?.trim() || !unit?.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0 || !Number.isFinite(parsedStock) || parsedStock < 0 || !Number.isFinite(parsedMinStock) || parsedMinStock < 0) {
    return NextResponse.json({ error: "Nome, unità e valori numerici validi sono obbligatori" }, { status: 400 });
  }
  const ingredient = await prisma.ingredient.create({
    data: { name: name.trim(), unit: unit.trim(), categoria, currentStock: parsedStock, minStock: parsedMinStock, unitPrice: parsedPrice },
  });
  return NextResponse.json(ingredient);
}
