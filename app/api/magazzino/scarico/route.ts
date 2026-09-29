import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Scarica ingredienti dal magazzino in base alle ricette vendute
async function scaricaMagazzino(saleItems: any[]) {
  for (const item of saleItems) {
    if (!item.dishId) continue;
    const dish = await prisma.dish.findUnique({
      where: { id: item.dishId },
      include: { recipes: { include: { ingredient: true } } },
    });
    if (!dish) continue;

    for (const recipe of dish.recipes) {
      const consumo = recipe.quantity * item.quantity;
      await prisma.ingredient.update({
        where: { id: recipe.ingredientId },
        data: { currentStock: { decrement: consumo } },
      });
      await prisma.movement.create({
        data: {
          ingredientId: recipe.ingredientId,
          type: "OUT",
          quantity: consumo,
          reference: `Vendita: ${dish.name}`,
          date: new Date(),
        },
      });
    }
  }
}

export async function GET() {
  const [ingredients, movements, saleItems] = await Promise.all([
    prisma.ingredient.findMany({ orderBy: { name: "asc" } }),
    prisma.movement.findMany({ orderBy: { date: "desc" }, take: 30, include: { ingredient: true } }),
    prisma.saleItem.findMany({ include: { dish: { include: { recipes: { include: { ingredient: true } } } } } }),
  ]);

  // Consumo teorico per ingrediente (da ricette × quantità venduta)
  const consumoPerIngrediente: Record<string, number> = {};
  for (const si of saleItems) {
    if (!si.dish) continue;
    for (const r of si.dish.recipes) {
      consumoPerIngrediente[r.ingredientId] = (consumoPerIngrediente[r.ingredientId] || 0) + r.quantity * si.quantity;
    }
  }

  return NextResponse.json({ ingredients, movements, consumoPerIngrediente, totalConsumo: Object.keys(consumoPerIngrediente).length });
}

export async function POST(request: Request) {
  const { saleItems } = await request.json();
  await scaricaMagazzino(saleItems);
  return NextResponse.json({ success: true, message: "Magazzino scaricato in base alle ricette" });
}