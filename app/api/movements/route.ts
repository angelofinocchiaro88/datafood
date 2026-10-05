import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordClientAudit, requireClientAccess } from "@/lib/auth";

export async function GET() {
  const movements = await prisma.movement.findMany({
    include: { ingredient: true },
    orderBy: { date: "desc" },
    take: 50,
  });
  return NextResponse.json(movements);
}

export async function POST(request: NextRequest) {
  const accessResult = await requireClientAccess(request, true);
  if ("response" in accessResult) return accessResult.response;
  const { access } = accessResult;
  const { ingredientId, type, quantity, reference } = await request.json();
  const parsedQuantity = Number(quantity);
  if (!ingredientId || !["IN", "OUT"].includes(type) || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    return NextResponse.json({ error: "Dati incompleti" }, { status: 400 });
  }
  const ingredient = await prisma.ingredient.findUnique({ where: { id: ingredientId }, select: { id: true } });
  if (!ingredient) return NextResponse.json({ error: "Materia prima non trovata nel ristorante selezionato" }, { status: 404 });
  const movement = await prisma.$transaction(async tx => {
    const created = await tx.movement.create({ data: { ingredientId, type, quantity: parsedQuantity, reference, date: new Date() }, include: { ingredient: true } });
    await tx.ingredient.update({ where: { id: ingredientId }, data: { currentStock: { increment: type === "IN" ? parsedQuantity : -parsedQuantity } } });
    return created;
  });
  await recordClientAudit(access, "stock_movement_recorded", "Movement", movement.id, { ingredientId, type, quantity: parsedQuantity, reference });
  return NextResponse.json(movement);
}
