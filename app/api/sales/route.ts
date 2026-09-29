import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");
  const limit = searchParams.get("limit") || "100";

  const where: Record<string, unknown> = {};

  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) (where.date as Record<string, unknown>).gte = new Date(fromDate);
    if (toDate) (where.date as Record<string, unknown>).lte = new Date(toDate);
  }

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { date: "desc" },
    take: parseInt(limit),
    include: {
      items: true,
    },
  });

  return NextResponse.json(sales);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      date,
      total,
      taxAmount = 0,
      paymentMethod = "CASH",
      coverCount = 1,
      posId,
      operatorName,
      tableNumber,
      orderNumbers,
      items = [],
    } = body;

    // Validate required fields
    if (!total || total <= 0) {
      return NextResponse.json(
        { error: "Total must be greater than 0" },
        { status: 400 }
      );
    }

    // Create sale with items
    const sale = await prisma.sale.create({
      data: {
        date: date ? new Date(date) : new Date(),
        total,
        taxAmount,
        paymentMethod,
        coverCount,
        posId,
        operatorName,
        tableNumber,
        orderNumbers,
        items: {
          create: items.map((item: {
            productName: string;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
            vatRate?: number;
            dishId?: string;
          }) => ({
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            vatRate: item.vatRate || 10,
            dishId: item.dishId,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    // Update or create daily summary
    const saleDate = new Date(sale.date);
    const dayStart = new Date(saleDate.setHours(0, 0, 0, 0));

    const existingSummary = await prisma.dailySummary.findUnique({
      where: { date: dayStart },
    });

    if (existingSummary) {
      await prisma.dailySummary.update({
        where: { id: existingSummary.id },
        data: {
          totalRevenue: existingSummary.totalRevenue + sale.total,
          totalTax: existingSummary.totalTax + sale.taxAmount,
          totalCash: sale.paymentMethod === "CASH" ? existingSummary.totalCash + sale.total : existingSummary.totalCash,
          totalCard: sale.paymentMethod === "CARD" ? existingSummary.totalCard + sale.total : existingSummary.totalCard,
          coverCount: existingSummary.coverCount + sale.coverCount,
          transactionCount: existingSummary.transactionCount + 1,
          averageTicket: (existingSummary.totalRevenue + sale.total) / (existingSummary.transactionCount + 1),
        },
      });
    } else {
      await prisma.dailySummary.create({
        data: {
          date: dayStart,
          totalRevenue: sale.total,
          totalTax: sale.taxAmount,
          totalCash: sale.paymentMethod === "CASH" ? sale.total : 0,
          totalCard: sale.paymentMethod === "CARD" ? sale.total : 0,
          coverCount: sale.coverCount,
          transactionCount: 1,
          averageTicket: sale.total,
        },
      });
    }

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error("Error creating sale:", error);
    return NextResponse.json(
      { error: "Failed to create sale" },
      { status: 500 }
    );
  }
}