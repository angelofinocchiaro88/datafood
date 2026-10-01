import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const data: any = {};
  if (body.categoryId !== undefined) data.categoryId = body.categoryId || null;
  if (body.isReconciled !== undefined) data.isReconciled = Boolean(body.isReconciled);
  if (body.description !== undefined) data.description = String(body.description);
  if (body.counterparty !== undefined) data.counterparty = String(body.counterparty);

  if (body.categoryId) {
    const category = await prisma.cashFlowCategory.findFirst({ where: { id: body.categoryId, clientId: "default" } });
    if (!category) return NextResponse.json({ error: "Categoria non trovata" }, { status: 404 });
  }

  try {
    const transaction = await prisma.cashTransaction.update({ where: { id: params.id }, data, include: { category: true, account: true } });
    return NextResponse.json({ transaction });
  } catch {
    return NextResponse.json({ error: "Movimento non trovato" }, { status: 404 });
  }
}
