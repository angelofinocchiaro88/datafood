import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateSaleFinancials } from "@/lib/sale-financials";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") || "default";
  const fromValue = searchParams.get("from");
  const toValue = searchParams.get("to");
  const where: any = { clientId, type: { not: "POS" } };
  if (fromValue || toValue) {
    where.date = {};
    if (fromValue) where.date.gte = new Date(`${fromValue}T00:00:00`);
    if (toValue) { const end = new Date(`${toValue}T00:00:00`); end.setDate(end.getDate() + 1); where.date.lt = end; }
  }
  const sales = await prisma.sale.findMany({ where, include: { items: true }, orderBy: { date: "asc" } });
  const daily = new Map<string, any>();
  for (const sale of sales) {
    const key = `${sale.date.getFullYear()}-${String(sale.date.getMonth() + 1).padStart(2, "0")}-${String(sale.date.getDate()).padStart(2, "0")}`;
    const row = daily.get(key) || { date: new Date(sale.date.getFullYear(), sale.date.getMonth(), sale.date.getDate()), grossRevenue: 0, netRevenue: 0, unknownNetGross: 0, totalTax: 0, totalCash: 0, totalCard: 0, coverCount: 0, transactionCount: 0, averageTicket: 0 };
    const amounts = calculateSaleFinancials(sale);
    row.grossRevenue += sale.total;
    row.netRevenue += amounts.knownNetRevenue;
    if (amounts.basis === "unknown") row.unknownNetGross += sale.items.length ? sale.items.filter(item => item.vatRateKnown === false).reduce((sum, item) => sum + item.totalPrice, 0) : sale.total;
    if (amounts.reconciliationDelta != null) row.unknownNetGross += Math.abs(amounts.reconciliationDelta);
    else row.totalTax += amounts.taxAmount || 0;
    if (sale.paymentMethod === "CASH") row.totalCash += sale.total;
    if (sale.paymentMethod === "CARD") row.totalCard += sale.total;
    row.coverCount += sale.coverCount;
    row.transactionCount++;
    row.averageTicket = row.grossRevenue / row.transactionCount;
    daily.set(key, row);
  }
  return NextResponse.json(Array.from(daily.values()).sort((a, b) => a.date.getTime() - b.date.getTime()).map(row => ({ ...row, totalRevenue: row.grossRevenue, netRevenueCoveragePct: row.grossRevenue > 0 ? (row.grossRevenue - row.unknownNetGross) / row.grossRevenue * 100 : null })));
}
