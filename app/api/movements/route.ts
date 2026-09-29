import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const movements = await prisma.movement.findMany({
    include: { ingredient: true },
    orderBy: { date: "desc" },
    take: 50,
  });
  return NextResponse.json(movements);
}

export async function POST(request: NextRequest) {
  const { ingredientId, type, quantity, reference } = await request.json();
  if (!ingredientId || !type || !quantity) {
    return NextResponse.json({ error: "Dati incompleti" }, { status: 400 });
  }

  const movement = await prisma.movement.create({
    data: { ingredientId, type, quantity: parseFloat(quantity), reference, date: new Date() },
    include: { ingredient: true },
  });

  // Aggiorna stock
  const delta = type === "IN" ? parseFloat(quantity) : -parseFloat(quantity);
  await prisma.ingredient.update({
    where: { id: ingredientId },
    data: { currentStock: { increment: delta } },
  });

  return NextResponse.json(movement);
}