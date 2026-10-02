import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateSaleFinancials } from "@/lib/sale-financials";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "day";
  const clientId = searchParams.get("clientId") || "default";
  const now = new Date();
  let startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  else if (period === "month") startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  else if (period !== "day") return NextResponse.json({ error: "Periodo non valido" }, { status: 400 });

  const sales = await prisma.sale.findMany({ where: { clientId, type: { not: "POS" }, date: { gte: startDate, lte: now } }, include: { items: true }, orderBy: { date: "asc" } });
  let grossRevenue = 0, netRevenue = 0, unknownNetGross = 0, totalTaxKnown = 0, totalCovers = 0;
  const dailyMap = new Map<string, any>(), itemCounts = new Map<string, any>();
  for (const sale of sales) {
    const amounts = calculateSaleFinancials(sale);
    grossRevenue += amounts.grossRevenue;
    netRevenue += amounts.knownNetRevenue;
    if (amounts.basis === "unknown") unknownNetGross += sale.items.length ? sale.items.filter(item => item.vatRateKnown === false).reduce((sum, item) => sum + item.totalPrice, 0) : sale.total;
    if (amounts.reconciliationDelta != null) unknownNetGross += Math.abs(amounts.reconciliationDelta);
    if (amounts.basis !== "unknown") totalTaxKnown += amounts.taxAmount || 0;
    totalCovers += sale.coverCount;
    const date = `${sale.date.getFullYear()}-${String(sale.date.getMonth() + 1).padStart(2, "0")}-${String(sale.date.getDate()).padStart(2, "0")}`;
    const daily = dailyMap.get(date) || { date, grossRevenue: 0, netRevenue: 0, receipts: 0, covers: 0 };
    daily.grossRevenue += sale.total;
    daily.netRevenue += amounts.knownNetRevenue;
    daily.receipts++;
    daily.covers += sale.coverCount;
    dailyMap.set(date, daily);
    for (const item of sale.items) {
      const row = itemCounts.get(item.productName) || { name: item.productName, quantity: 0, grossRevenue: 0, netRevenue: 0 };
      row.quantity += item.quantity;
      row.grossRevenue += item.totalPrice;
      if (item.vatRateKnown !== false) row.netRevenue += calculateSaleFinancials({ total: item.totalPrice, items: [item] }).knownNetRevenue;
      itemCounts.set(item.productName, row);
    }
  }
  const receipts = sales.length;
  return NextResponse.json({
    period, startDate, endDate: now,
    summary: {
      totalRevenue: grossRevenue,
      grossRevenue,
      netRevenue: receipts > 0 ? netRevenue : null,
      netRevenueCoveragePct: grossRevenue > 0 ? Math.min(100, Math.max(0, (grossRevenue - unknownNetGross) / grossRevenue * 100)) : null,
      unknownNetGross,
      totalTax: totalTaxKnown,
      totalCovers,
      totalTransactions: receipts,
      averageTicket: receipts > 0 ? grossRevenue / receipts : 0,
      averageNetTicket: receipts > 0 && unknownNetGross === 0 ? netRevenue / receipts : null,
    },
    daily: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    topItems: Array.from(itemCounts.values()).sort((a, b) => b.netRevenue - a.netRevenue).slice(0, 10),
  });
}
