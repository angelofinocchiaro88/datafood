import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "day"; // day, week, month

  let startDate: Date;
  const now = new Date();

  switch (period) {
    case "week":
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case "month":
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      break;
    default:
      startDate = new Date(now.setHours(0, 0, 0, 0));
  }

  const sales = await prisma.sale.findMany({
    where: { date: { gte: startDate } },
    include: { items: true },
  });

  const dailySummaries = await prisma.dailySummary.findMany({
    where: { date: { gte: startDate } },
    orderBy: { date: "desc" },
  });

  const totalRevenue = dailySummaries.reduce((sum, d) => sum + d.totalRevenue, 0);
  const totalTax = dailySummaries.reduce((sum, d) => sum + d.totalTax, 0);
  const totalCash = dailySummaries.reduce((sum, d) => sum + d.totalCash, 0);
  const totalCard = dailySummaries.reduce((sum, d) => sum + d.totalCard, 0);
  const totalCovers = dailySummaries.reduce((sum, d) => sum + d.coverCount, 0);
  const totalTransactions = dailySummaries.reduce((sum, d) => sum + d.transactionCount, 0);
  const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Top selling items
  const itemCounts: Record<string, { name: string; quantity: number; revenue: number }> = {};
  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      if (!itemCounts[item.productName]) {
        itemCounts[item.productName] = { name: item.productName, quantity: 0, revenue: 0 };
      }
      itemCounts[item.productName].quantity += item.quantity;
      itemCounts[item.productName].revenue += item.totalPrice;
    });
  });

  const topItems = Object.values(itemCounts)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return NextResponse.json({
    period,
    startDate,
    summary: {
      totalRevenue,
      totalTax,
      totalCash,
      totalCard,
      totalCovers,
      totalTransactions,
      averageTicket,
    },
    daily: dailySummaries,
    topItems,
  });
}