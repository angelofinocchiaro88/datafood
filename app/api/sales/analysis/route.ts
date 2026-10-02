import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateSaleFinancials } from "@/lib/sale-financials";

export const dynamic = "force-dynamic";

type DateRange = { start: Date; end: Date; key: string; label: string; days: number };

function dayStart(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function addDays(date: Date, days: number) { const result = new Date(date); result.setDate(result.getDate() + days); return result; }
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function parseDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(year, month - 1, day);
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day ? result : null;
}

function getRange(period: string, from: string | null, to: string | null, now = new Date()): DateRange | null {
  const today = dayStart(now);
  const end = addDays(today, 1);
  let start: Date;
  let label: string;
  if (period === "custom") {
    const customFrom = parseDate(from), customTo = parseDate(to);
    if (!customFrom || !customTo || customFrom > customTo) return null;
    const customEnd = addDays(customTo, 1);
    return { start: customFrom, end: customEnd, key: period, label: "Periodo personalizzato", days: Math.max(1, Math.round((customEnd.getTime() - customFrom.getTime()) / 86400000)) };
  }
  if (period === "30d" || period === "90d") {
    const days = period === "30d" ? 30 : 90;
    start = addDays(today, -(days - 1));
    label = `Ultimi ${days} giorni`;
  } else if (period === "month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    label = "Mese corrente";
  } else if (period === "quarter") {
    start = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
    label = "Trimestre corrente";
  } else if (period === "year") {
    start = new Date(today.getFullYear(), 0, 1);
    label = "Anno corrente";
  } else return null;
  return { start, end, key: period, label, days: Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000)) };
}

function getPreviousRange(range: DateRange): DateRange {
  let start: Date, end: Date;
  if (range.key === "month") {
    start = new Date(range.start.getFullYear(), range.start.getMonth() - 1, 1);
    end = new Date(Math.min(addDays(start, range.days).getTime(), range.start.getTime()));
  } else if (range.key === "quarter") {
    start = new Date(range.start.getFullYear(), range.start.getMonth() - 3, 1);
    end = new Date(Math.min(addDays(start, range.days).getTime(), range.start.getTime()));
  } else if (range.key === "year") {
    start = new Date(range.start.getFullYear() - 1, 0, 1);
    end = new Date(Math.min(addDays(start, range.days).getTime(), range.start.getTime()));
  } else {
    end = range.start;
    start = addDays(end, -range.days);
  }
  return { start, end, key: "previous", label: "Periodo precedente", days: Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000)) };
}

function bucketDate(date: Date, granularity: string) {
  const value = dayStart(date);
  if (granularity === "month") return new Date(value.getFullYear(), value.getMonth(), 1);
  if (granularity === "week") {
    value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
    return value;
  }
  return value;
}

function summarize(sales: any[], categoryId: string, granularity: string) {
  let grossRevenue = 0, netRevenue = 0, unknownNetGross = 0, knownTax = 0, covers = 0;
  let linkedLines = 0, unlinkedLines = 0, totalLines = 0, timedReceipts = 0, reconciliationAbs = 0, reconciliationRows = 0;
  const paymentMethods = new Map<string, any>(), categories = new Map<string, any>(), dishes = new Map<string, any>();
  const sources = new Map<string, any>(), trend = new Map<string, any>(), weekdays = new Map<number, any>();
  const dayparts = new Map<string, any>([
    ["colazione", { key: "colazione", label: "Colazione", receipts: 0, grossRevenue: 0 }],
    ["pranzo", { key: "pranzo", label: "Pranzo", receipts: 0, grossRevenue: 0 }],
    ["pomeriggio", { key: "pomeriggio", label: "Pomeriggio", receipts: 0, grossRevenue: 0 }],
    ["cena", { key: "cena", label: "Cena", receipts: 0, grossRevenue: 0 }],
    ["notte", { key: "notte", label: "Notte", receipts: 0, grossRevenue: 0 }],
  ]);

  for (let day = 0; day < 7; day++) weekdays.set(day, { day, label: ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"][day], grossRevenue: 0, receipts: 0, covers: 0 });

  for (const sale of sales) {
    const selectedItems = categoryId === "all" ? sale.items : sale.items.filter((item: any) => item.dish?.categoryId === categoryId);
    if (categoryId !== "all" && selectedItems.length === 0) continue;
    const allScope = categoryId === "all";
    const financials = calculateSaleFinancials({ ...sale, items: selectedItems });
    const receiptGross = allScope ? financials.grossRevenue : selectedItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0);
    const receiptNet = financials.knownNetRevenue;
    grossRevenue += receiptGross;
    netRevenue += receiptNet;
    if (financials.basis === "unknown") {
      unknownNetGross += selectedItems.length > 0
        ? selectedItems.filter((item: any) => item.vatRateKnown === false).reduce((sum: number, item: any) => sum + item.totalPrice, 0)
        : receiptGross;
    } else knownTax += financials.taxAmount || 0;
    if (allScope && financials.reconciliationDelta != null) unknownNetGross += Math.abs(financials.reconciliationDelta);
    if (allScope) covers += sale.coverCount || 0;
    if (financials.reconciliationDelta != null) { reconciliationAbs += Math.abs(financials.reconciliationDelta); reconciliationRows++; }

    const paymentKey = sale.paymentMethod || "N/D";
    const payment = paymentMethods.get(paymentKey) || { key: paymentKey, receipts: 0, grossRevenue: 0 };
    payment.receipts++;
    payment.grossRevenue += receiptGross;
    paymentMethods.set(paymentKey, payment);

    const sourceKey = sale.source || sale.type || "Non specificata";
    const source = sources.get(sourceKey) || { key: sourceKey, receipts: 0, grossRevenue: 0 };
    source.receipts++;
    source.grossRevenue += receiptGross;
    sources.set(sourceKey, source);

    const date = new Date(sale.date);
    const bucket = bucketDate(date, granularity);
    const bucketKey = dateKey(bucket);
    const row = trend.get(bucketKey) || { date: bucketKey, grossRevenue: 0, netRevenue: 0, unknownNetGross: 0, receipts: 0, covers: 0 };
    row.grossRevenue += receiptGross;
    row.netRevenue += receiptNet;
    row.unknownNetGross += financials.basis === "unknown" ? selectedItems.length > 0 ? selectedItems.filter((item: any) => item.vatRateKnown === false).reduce((sum: number, item: any) => sum + item.totalPrice, 0) : receiptGross : 0;
    if (allScope && financials.reconciliationDelta != null) row.unknownNetGross += Math.abs(financials.reconciliationDelta);
    row.receipts++;
    if (allScope) row.covers += sale.coverCount || 0;
    trend.set(bucketKey, row);

    const weekday = weekdays.get(date.getDay())!;
    weekday.grossRevenue += receiptGross;
    weekday.receipts++;
    if (allScope) weekday.covers += sale.coverCount || 0;
    const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0;
    if (hasTime) {
      timedReceipts++;
      const hour = date.getHours();
      const key = hour >= 6 && hour < 11 ? "colazione" : hour < 15 && hour >= 11 ? "pranzo" : hour < 18 && hour >= 15 ? "pomeriggio" : hour < 23 && hour >= 18 ? "cena" : "notte";
      const slot = dayparts.get(key)!;
      slot.receipts++;
      slot.grossRevenue += receiptGross;
    }

    totalLines += selectedItems.length;
    for (const item of selectedItems) {
      const netLine = calculateSaleFinancials({ total: item.totalPrice, items: [item] }).netRevenue || 0;
      if (item.dishId && item.dish) linkedLines++;
      else unlinkedLines++;
      const categoryName = item.dish?.category?.name || "Non collegata a una categoria";
      const category = categories.get(categoryName) || { name: categoryName, quantity: 0, grossRevenue: 0, netRevenue: 0, unknownNetGross: 0, lines: 0 };
      category.quantity += item.quantity;
      category.grossRevenue += item.totalPrice;
      category.netRevenue += netLine;
      if (item.vatRateKnown === false) category.unknownNetGross += item.totalPrice;
      category.lines++;
      categories.set(categoryName, category);

      const dishKey = item.dishId || `unlinked:${item.productName}`;
      const dishName = item.dish?.name || item.productName || "Prodotto non identificato";
      const dish = dishes.get(dishKey) || { id: item.dishId || null, name: dishName, category: categoryName, quantity: 0, grossRevenue: 0, netRevenue: 0, unknownNetGross: 0, lines: 0, linked: Boolean(item.dishId && item.dish) };
      dish.quantity += item.quantity;
      dish.grossRevenue += item.totalPrice;
      dish.netRevenue += netLine;
      if (item.vatRateKnown === false) dish.unknownNetGross += item.totalPrice;
      dish.lines++;
      dishes.set(dishKey, dish);
    }
  }

  const receipts = sales.filter((sale: any) => categoryId === "all" || sale.items.some((item: any) => item.dish?.categoryId === categoryId)).length;
  const orderedTrend = Array.from(trend.values()).sort((a: any, b: any) => a.date.localeCompare(b.date));
  const payments = Array.from(paymentMethods.values()).sort((a: any, b: any) => b.grossRevenue - a.grossRevenue);
  const categoryRows = Array.from(categories.values()).sort((a: any, b: any) => b.netRevenue - a.netRevenue);
  const dishRows = Array.from(dishes.values()).sort((a: any, b: any) => b.netRevenue - a.netRevenue);
  const netCoveragePct = grossRevenue > 0 ? Math.min(100, Math.max(0, (grossRevenue - unknownNetGross) / grossRevenue * 100)) : null;

  return {
    grossRevenue, netRevenue, knownNetRevenue: netRevenue,
    unknownNetGross, knownTax, receipts, covers: categoryId === "all" ? covers : null,
    averageGrossCheck: receipts > 0 ? grossRevenue / receipts : null,
    averageNetCheck: receipts > 0 && netCoveragePct === 100 ? netRevenue / receipts : null,
    revenuePerCover: categoryId === "all" && covers > 0 && netCoveragePct === 100 ? netRevenue / covers : null,
    netCoveragePct, linkedLines, unlinkedLines, totalLines,
    linkedLineCoveragePct: totalLines > 0 ? linkedLines / totalLines * 100 : null,
    receiptsWithTime: timedReceipts, timestampCoveragePct: receipts > 0 ? timedReceipts / receipts * 100 : null,
    averageReconciliationDelta: reconciliationRows > 0 ? reconciliationAbs / reconciliationRows : null,
    paymentMethods: payments, categories: categoryRows, dishes: dishRows.slice(0, 20), sources: Array.from(sources.values()).sort((a: any, b: any) => b.receipts - a.receipts),
    trend: orderedTrend, weekdays: Array.from(weekdays.values()), dayparts: Array.from(dayparts.values()),
  };
}

function change(current: number | null, previous: number | null) {
  if (current == null || previous == null) return null;
  return { absolute: current - previous, pct: previous === 0 ? null : (current - previous) / Math.abs(previous) * 100 };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const period = params.get("period") || "90d";
  const range = getRange(period, params.get("from"), params.get("to"));
  if (!range) return NextResponse.json({ error: "Periodo o date non valide" }, { status: 400 });
  const previousRange = getPreviousRange(range);
  const requestedCategory = params.get("categoryId") || "all";
  const requestedGranularity = params.get("granularity") || (range.days <= 45 ? "day" : range.days <= 120 ? "week" : "month");
  const granularity = ["day", "week", "month"].includes(requestedGranularity) ? requestedGranularity : "day";
  const clientId = params.get("clientId") || "default";
  const [dishes, sales, previousSales] = await Promise.all([
    prisma.dish.findMany({ where: { clientId }, select: { id: true, name: true, categoryId: true, category: { select: { name: true } } }, orderBy: [{ category: { name: "asc" } }, { name: "asc" }] }),
    prisma.sale.findMany({ where: { clientId, type: { not: "POS" }, date: { gte: range.start, lt: range.end } }, include: { items: { include: { dish: { include: { category: true } } } } }, orderBy: { date: "desc" } }),
    prisma.sale.findMany({ where: { clientId, type: { not: "POS" }, date: { gte: previousRange.start, lt: previousRange.end } }, include: { items: { include: { dish: { include: { category: true } } } } } }),
  ]);
  const current = summarize(sales, requestedCategory, granularity);
  const previous = summarize(previousSales, requestedCategory, granularity);
  const categories = Array.from(new Map(dishes.map(dish => [dish.categoryId, { id: dish.categoryId, name: dish.category.name }])).values());
  const recentSales = sales.slice(0, 50).map(sale => {
    const items = requestedCategory === "all" ? sale.items : sale.items.filter(item => item.dish?.categoryId === requestedCategory);
    const financials = calculateSaleFinancials({ ...sale, items });
    return {
      id: sale.id, date: sale.date, grossRevenue: requestedCategory === "all" ? sale.total : items.reduce((sum, item) => sum + item.totalPrice, 0),
      netRevenue: financials.netRevenue, taxAmount: financials.taxAmount, netBasis: financials.basis,
      paymentMethod: sale.paymentMethod, source: sale.source || sale.type, coverCount: requestedCategory === "all" ? sale.coverCount : null,
      itemCount: items.length, items: items.map(item => ({ name: item.dish?.name || item.productName, quantity: item.quantity, dishId: item.dishId, grossAmount: item.totalPrice, category: item.dish?.category?.name || "Non collegata" })),
      reconciliationDelta: financials.reconciliationDelta,
    };
  });

  return NextResponse.json({
    clientId,
    period: { key: range.key, label: range.label, from: dateKey(range.start), to: dateKey(addDays(range.end, -1)), days: range.days },
    comparisonRange: { from: dateKey(previousRange.start), to: dateKey(addDays(previousRange.end, -1)) },
    categoryId: requestedCategory, granularity,
    categories,
    summary: current,
    previousSummary: previous,
    comparison: {
      grossRevenue: change(current.grossRevenue, previous.grossRevenue),
      netRevenue: change(current.netCoveragePct === 100 ? current.knownNetRevenue : null, previous.netCoveragePct === 100 ? previous.knownNetRevenue : null),
      receipts: change(current.receipts, previous.receipts),
      averageGrossCheck: change(current.averageGrossCheck, previous.averageGrossCheck),
      covers: change(current.covers, previous.covers),
    },
    recentSales,
  });
}
