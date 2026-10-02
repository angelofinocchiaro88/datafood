import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") || "default";
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");
  const requestedLimit = Number.parseInt(searchParams.get("limit") || "100", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 1000)) : 100;

  const where: Record<string, any> = { clientId, type: { not: "POS" } };

  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) where.date.gte = new Date(`${fromDate}T00:00:00`);
    if (toDate) {
      const exclusiveEnd = new Date(`${toDate}T00:00:00`);
      exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
      where.date.lt = exclusiveEnd;
    }
  }

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { date: "desc" },
    take: limit,
    include: {
      items: true,
    },
  });

  return NextResponse.json(sales);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const total = Number(body.total);
    const taxAmount = body.taxAmount == null ? 0 : Number(body.taxAmount);
    const coverCount = Number(body.coverCount ?? 1);
    const date = body.date ? new Date(body.date) : new Date();
    const items = Array.isArray(body.items) ? body.items : [];
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(taxAmount) || taxAmount < 0 || taxAmount > total || !Number.isInteger(coverCount) || coverCount < 0 || Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "Data, incasso, imposta e coperti devono essere validi" }, { status: 400 });
    }
    const normalizedItems = items.map((item: any) => ({
      productName: String(item.productName || "Prodotto non identificato"),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      vatRate: Number(item.vatRate ?? 10),
      vatRateKnown: item.vatRateKnown === true || item.vatRate != null,
      dishId: item.dishId || null,
    }));
    if (normalizedItems.some((item: any) => !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || !Number.isFinite(item.totalPrice) || item.totalPrice < 0 || !Number.isFinite(item.vatRate) || item.vatRate < 0)) {
      return NextResponse.json({ error: "Una o più righe prodotto non sono valide" }, { status: 400 });
    }

    const sale = await prisma.sale.create({
      data: {
        date,
        total,
        taxAmount,
        taxAmountKnown: body.taxAmountKnown === true || Object.prototype.hasOwnProperty.call(body, "taxAmount"),
        paymentMethod: String(body.paymentMethod || "CASH").toUpperCase(),
        coverCount,
        posId: body.posId || null,
        operatorName: body.operatorName || null,
        tableNumber: body.tableNumber || null,
        orderNumbers: body.orderNumbers || null,
        clientId: body.clientId || "default",
        type: body.type || "MANUAL",
        source: body.source || "manual",
        items: { create: normalizedItems },
      },
      include: { items: true },
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error("Error creating sale:", error);
    return NextResponse.json(
      { error: "Failed to create sale" },
      { status: 500 }
    );
  }
}
