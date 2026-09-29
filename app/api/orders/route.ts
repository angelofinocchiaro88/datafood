import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const include = request.nextUrl.searchParams.get("include") || "";
  const orders = await prisma.order.findMany({
    include: {
      supplier: true,
      items: { include: { ingredient: true } },
    },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ orders });
}

export async function POST(request: NextRequest) {
  const { supplierId, items } = await request.json();
  const total = (items as any[]).reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const order = await prisma.order.create({
    data: {
      supplierId,
      total,
      status: "DRAFT",
      items: {
        create: items.map((i: any) => ({
          ingredientId: i.ingredientId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          received: 0,
        })),
      },
    },
    include: { supplier: true, items: { include: { ingredient: true } } },
  });

  return NextResponse.json(order);
}

export async function PUT(request: NextRequest) {
  const { id, status } = await request.json();
  
  if (status === "RECEIVED") {
    // 1. Update order status
    const order = await prisma.order.update({
      where: { id },
      data: { status: "RECEIVED" },
      include: { items: { include: { ingredient: true } }, supplier: true },
    });

    // 2. Update magazzino (create movements + update stock)
    for (const item of order.items) {
      await prisma.ingredient.update({
        where: { id: item.ingredientId },
        data: { currentStock: { increment: item.quantity } },
      });
      await prisma.movement.create({
        data: {
          ingredientId: item.ingredientId,
          type: "IN",
          quantity: item.quantity,
          reference: `Ordine #${order.id.slice(-4)}`,
          date: new Date(),
        },
      });
    }

    // 3. Create invoice in Accounting (PENDING)
    await prisma.invoice.create({
      data: {
        invoiceNumber: `ORD-${order.id.slice(-4)}`,
        invoiceDate: new Date(),
        senderName: order.supplier.name,
        senderVat: order.supplier.vat || "",
        recipientVat: "",
        recipientName: "",
        totalAmount: order.total,
        taxAmount: order.total * 0.22,
        status: "PENDING",
        supplierId: order.supplierId,
      },
    });

    return NextResponse.json({ success: true, message: "Ordine ricevuto, magazzino aggiornato, fattura creata in Accounting" });
  }

  const order = await prisma.order.update({ where: { id }, data: { status } });
  return NextResponse.json(order);
}