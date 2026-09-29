import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Aggiungi/modifica ingrediente nella ricetta di un piatto
export async function POST(request: NextRequest) {
  const { dishId, ingredientId, quantity } = await request.json();
  if (!dishId || !ingredientId || quantity == null) {
    return NextResponse.json({ error: "Dati incompleti" }, { status: 400 });
  }

  const recipe = await prisma.recipe.upsert({
    where: { dishId_ingredientId: { dishId, ingredientId } },
    create: { dishId, ingredientId, quantity: parseFloat(quantity) },
    update: { quantity: parseFloat(quantity) },
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