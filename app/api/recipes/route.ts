import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUnitFamily } from "@/lib/recipe-cost";

// Aggiungi/modifica ingrediente nella ricetta di un piatto
export async function POST(request: NextRequest) {
  const { dishId, ingredientId, quantity, unit, wastePct = 0 } = await request.json();
  const parsedQuantity = Number(quantity);
  const parsedWastePct = Number(wastePct);
  if (!dishId || !ingredientId || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    return NextResponse.json({ error: "Dati incompleti" }, { status: 400 });
  }
  if (!Number.isFinite(parsedWastePct) || parsedWastePct < 0 || parsedWastePct >= 100) {
    return NextResponse.json({ error: "Lo scarto deve essere compreso tra 0 e meno di 100%" }, { status: 400 });
  }
  const ingredient = await prisma.ingredient.findUnique({ where: { id: ingredientId }, select: { id: true, unit: true } });
  if (!ingredient) return NextResponse.json({ error: "Ingrediente non trovato" }, { status: 404 });
  if (unit?.trim() && getUnitFamily(unit) !== getUnitFamily(ingredient.unit)) {
    return NextResponse.json({ error: `Unità ricetta incompatibile con l'unità acquisto (${ingredient.unit})` }, { status: 400 });
  }

  const recipe = await prisma.recipe.upsert({
    where: { dishId_ingredientId: { dishId, ingredientId } },
    create: { dishId, ingredientId, quantity: parsedQuantity, unit: unit?.trim() || null, wastePct: parsedWastePct },
    update: { quantity: parsedQuantity, unit: unit?.trim() || null, wastePct: parsedWastePct },
    include: { ingredient: true },
  });
  return NextResponse.json(recipe);
}

// Rimuovi ingrediente dalla ricetta
export async function DELETE(request: NextRequest) {
  const { dishId, ingredientId } = await request.json();
  await prisma.recipe.deleteMany({ where: { dishId, ingredientId } });
  return NextResponse.json({ success: true });
}
