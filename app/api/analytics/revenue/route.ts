import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateSaleFinancials } from "@/lib/sale-financials";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "month"; // day, week, month
  const clientId = searchParams.get("clientId") || "default";

  let startDate: Date;
  const now = new Date();

  switch (period) {
    case "day":
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      break;
    case "week":
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "month":
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    default:
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
  }

  const sales = await prisma.sale.findMany({ where: { clientId, type: { not: "POS" }, date: { gte: startDate, lte: now } }, include: { items: true }, orderBy: { date: "asc" } });
  const byDate = new Map<string, any>();
  let totalRevenue = 0, netRevenue = 0, unknownNetGross = 0, totalCovers = 0;
  for (const sale of sales) {
    const date = sale.date.toISOString().slice(0, 10);
    const row = byDate.get(date) || { date, revenue: 0, grossRevenue: 0, netRevenue: 0, covers: 0, transactions: 0, averageTicket: 0 };
    const financials = calculateSaleFinancials(sale);
    row.grossRevenue += sale.total;
    row.revenue += sale.total;
    row.netRevenue += financials.knownNetRevenue;
    totalRevenue += sale.total;
    netRevenue += financials.knownNetRevenue;
    if (financials.basis === "unknown") unknownNetGross += sale.items.length ? sale.items.filter(item => item.vatRateKnown === false).reduce((sum, item) => sum + item.totalPrice, 0) : sale.total;
    if (financials.reconciliationDelta != null) unknownNetGross += Math.abs(financials.reconciliationDelta);
    row.covers += sale.coverCount;
    row.transactions++;
    row.averageTicket = row.grossRevenue / row.transactions;
    byDate.set(date, row);
    totalCovers += sale.coverCount;
  }
  const dailySummaries = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  const totalTransactions = sales.length;
  const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Calculate trend (compare to previous period)
  const periodLength = dailySummaries.length;
  const midpoint = Math.floor(periodLength / 2);
  const firstHalf = dailySummaries.slice(0, midpoint);
  const secondHalf = dailySummaries.slice(midpoint);

  const firstHalfRevenue = firstHalf.reduce((sum, d) => sum + d.grossRevenue, 0);
  const secondHalfRevenue = secondHalf.reduce((sum, d) => sum + d.grossRevenue, 0);

  const trend = firstHalfRevenue > 0
    ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100
    : 0;

  // Daily chart data
  const chartData = dailySummaries;

  return NextResponse.json({
    period,
    totalRevenue,
    netRevenue: unknownNetGross === 0 ? netRevenue : null,
    knownNetRevenue: netRevenue,
    unknownNetGross,
    netRevenueCoveragePct: totalRevenue > 0 ? (totalRevenue - unknownNetGross) / totalRevenue * 100 : null,
    totalCovers,
    totalTransactions,
    averageTicket,
    trend: parseFloat(trend.toFixed(1)),
    chartData,
  });
}
