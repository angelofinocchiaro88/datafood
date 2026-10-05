import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateRecipeCost, getContributionMargin, getNetSellingPrice } from "@/lib/recipe-cost";
import { calcRicavoNettoRiga, calcVariazione } from "@/lib/metrics";
import { calculateSaleFinancials } from "@/lib/sale-financials";

export const dynamic = "force-dynamic";

type Range = { start: Date; end: Date; label: string; key: string; days: number };

function dayStart(value: Date) { return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
function addDays(value: Date, amount: number) { const result = new Date(value); result.setDate(result.getDate() + amount); return result; }
function dateKey(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }
function parseDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(year, month - 1, day);
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day ? result : null;
}

function getRange(period: string, from: string | null, to: string | null, now = new Date()): Range | null {
  const today = dayStart(now);
  const end = addDays(today, 1);
  let start: Date;
  let label: string;
  if (period === "custom") {
    const customStart = parseDate(from);
    const customEnd = parseDate(to);
    if (!customStart || !customEnd || customStart > customEnd) return null;
    start = customStart;
    const customRangeEnd = addDays(customEnd, 1);
    return { start, end: customRangeEnd, label: "Periodo personalizzato", key: period, days: Math.max(1, Math.round((customRangeEnd.getTime() - start.getTime()) / 86400000)) };
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
  return { start, end, label, key: period, days: Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000)) };
}

function getPreviousRange(current: Range): Range {
  let start: Date;
  let end: Date;
  if (current.key === "month") {
    start = new Date(current.start.getFullYear(), current.start.getMonth() - 1, 1);
    end = new Date(Math.min(addDays(start, current.days).getTime(), current.start.getTime()));
  } else if (current.key === "quarter") {
    start = new Date(current.start.getFullYear(), current.start.getMonth() - 3, 1);
    end = new Date(Math.min(addDays(start, current.days).getTime(), current.start.getTime()));
  } else if (current.key === "year") {
    start = new Date(current.start.getFullYear() - 1, 0, 1);
    end = new Date(Math.min(addDays(start, current.days).getTime(), current.start.getTime()));
  } else {
    end = current.start;
    start = addDays(end, -current.days);
  }
  return { start, end, label: "Periodo precedente", key: "previous", days: Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000)) };
}

const DAYPARTS = [
  { key: "colazione", label: "Colazione", start: 6, end: 11 },
  { key: "pranzo", label: "Pranzo", start: 11, end: 15 },
  { key: "pomeriggio", label: "Pomeriggio", start: 15, end: 18 },
  { key: "cena", label: "Cena", start: 18, end: 23 },
  { key: "notte", label: "Notte", start: 23, end: 6 },
];
const WEEKDAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

function getDaypart(hour: number) {
  return DAYPARTS.find(part => part.key === "notte" ? hour >= part.start || hour < part.end : hour >= part.start && hour < part.end)?.key || "notte";
}

function summarizeSales(sales: any[], dishes: any[], categoryId: string) {
  const dishIds = new Set(dishes.map(dish => dish.id));
  const dishData = new Map<string, any>();
  const categories = new Map<string, any>();
  const dayparts = new Map<string, any>(DAYPARTS.map(part => [part.key, { key: part.key, label: part.label, revenue: 0, contribution: 0, covers: 0, receipts: 0, units: 0 }]));
  const weekdays = new Map<number, any>(WEEKDAYS.map((label, day) => [day, { day, label, revenue: 0, covers: 0, receipts: 0, contribution: 0 }]));
  const monthly = new Map<string, any>();
  let revenue = 0, grossRevenue = 0, unknownNetGross = 0, unverifiedReceipts = 0, foodRevenue = 0, beverageRevenue = 0, cogs = 0, costedRevenue = 0, contribution = 0, covers = 0, receipts = 0;
  let linkedLines = 0, unlinkedLines = 0, missingRecipeLines = 0, unverifiedVatLines = 0, timedReceipts = 0, fallbackReceipts = 0;

  for (const dish of dishes) {
    dishData.set(dish.id, {
      id: dish.id,
      name: dish.name,
      category: dish.category?.name || "Senza categoria",
      categoryId: dish.categoryId,
      listPrice: dish.price,
      vatRate: dish.vatRate,
      recipeCost: calculateRecipeCost(dish).costPerPortion,
      recipeComplete: calculateRecipeCost(dish).complete,
      units: 0,
      revenue: 0,
      grossRevenue: 0,
      vatWeighted: 0,
      contribution: 0,
      costedRevenue: 0,
    });
  }

  for (const sale of sales) {
    const inScope = sale.items.filter((item: any) => categoryId === "all" ? true : item.dish?.categoryId === categoryId);
    const matchedItems = inScope.filter((item: any) => item.dishId && dishIds.has(item.dishId));
    const looseItems = inScope.filter((item: any) => !item.dishId || !dishIds.has(item.dishId));
    const isWholeMenu = categoryId === "all";
    if (inScope.length === 0 && sale.items.length > 0) continue;

    const lineRevenue = inScope.filter((item: any) => item.vatRateKnown !== false).reduce((sum: number, item: any) => sum + calcRicavoNettoRiga(item.totalPrice, item.vatRate), 0);
    const headerFinancials = calculateSaleFinancials(sale);
    if (isWholeMenu && headerFinancials.reconciliationDelta != null) unknownNetGross += Math.abs(headerFinancials.reconciliationDelta);
    const fallbackRevenue = isWholeMenu && sale.items.length === 0 ? headerFinancials.netRevenue || 0 : 0;
    const receiptRevenue = lineRevenue + fallbackRevenue;
    const receiptGross = isWholeMenu ? sale.total : inScope.reduce((sum: number, item: any) => sum + item.totalPrice, 0);
    if (isWholeMenu && sale.items.length === 0 && headerFinancials.netRevenue == null) {
      unknownNetGross += sale.total;
      unverifiedReceipts++;
    }
    const unknownVatLines = inScope.filter((item: any) => item.vatRateKnown === false);
    if (unknownVatLines.length > 0) {
      unknownNetGross += unknownVatLines.reduce((sum: number, item: any) => sum + item.totalPrice, 0);
      unverifiedVatLines += unknownVatLines.length;
      unverifiedReceipts++;
    }
    if (isWholeMenu && headerFinancials.reconciliationDelta != null && Math.abs(headerFinancials.reconciliationDelta) > 0.01) {
      unknownNetGross += Math.abs(headerFinancials.reconciliationDelta);
      if (unknownVatLines.length === 0 && !(sale.items.length === 0 && headerFinancials.netRevenue == null)) unverifiedReceipts++;
    }
    if (receiptGross <= 0 && inScope.length === 0) continue;
    grossRevenue += receiptGross;
    revenue += receiptRevenue;
    receipts++;
    if (isWholeMenu) covers += sale.coverCount;
    if (fallbackRevenue > 0) fallbackReceipts++;

    const weekday = weekdays.get(sale.date.getDay())!;
    weekday.revenue += receiptRevenue;
    weekday.receipts++;
    if (isWholeMenu) weekday.covers += sale.coverCount;

    const monthKey = `${sale.date.getFullYear()}-${String(sale.date.getMonth() + 1).padStart(2, "0")}`;
    const month = monthly.get(monthKey) || { month: monthKey, revenue: 0, covers: 0, receipts: 0, contribution: 0 };
    month.revenue += receiptRevenue;
    month.receipts++;
    if (isWholeMenu) month.covers += sale.coverCount;
    monthly.set(monthKey, month);

    const timeKnown = sale.date.getHours() !== 0 || sale.date.getMinutes() !== 0 || sale.date.getSeconds() !== 0;
    if (timeKnown) {
      timedReceipts++;
      const daypart = dayparts.get(getDaypart(sale.date.getHours()))!;
      daypart.revenue += receiptRevenue;
      daypart.receipts++;
      daypart.covers += isWholeMenu ? sale.coverCount : 0;
    }

    for (const item of looseItems) unlinkedLines++;
    for (const item of matchedItems) {
      linkedLines++;
      const dish = dishData.get(item.dishId)!;
      if (item.vatRateKnown === false) {
        dish.units += item.quantity;
        dish.grossRevenue += item.totalPrice;
        continue;
      }
      const netLineRevenue = calcRicavoNettoRiga(item.totalPrice, item.vatRate);
      const unitNetPrice = item.quantity > 0 ? netLineRevenue / item.quantity : 0;
      const actualVat = Number.isFinite(item.vatRate) && item.vatRate >= 0 ? item.vatRate : dish.vatRate;
      const unitGrossPrice = unitNetPrice * (1 + actualVat / 100);
      const portionContribution = dish.recipeCost == null ? null : unitNetPrice - dish.recipeCost;
      dish.units += item.quantity;
      dish.revenue += netLineRevenue;
      dish.grossRevenue += item.totalPrice;
      dish.vatWeighted += item.quantity * actualVat;
      if (dish.recipeComplete && portionContribution != null) {
        const lineCogs = dish.recipeCost * item.quantity;
        const lineContribution = portionContribution * item.quantity;
        dish.costedRevenue += netLineRevenue;
        dish.contribution += lineContribution;
        cogs += lineCogs;
        contribution += lineContribution;
        costedRevenue += netLineRevenue;
        if (dish.category.toLocaleLowerCase("it-IT") === "bevande") { beverageRevenue += netLineRevenue; }
        else { foodRevenue += netLineRevenue; }
        const key = dish.category;
        const category = categories.get(key) || { name: key, revenue: 0, cogs: 0, contribution: 0, units: 0, receipts: 0 };
        category.revenue += netLineRevenue;
        category.cogs += lineCogs;
        category.contribution += lineContribution;
        category.units += item.quantity;
        category.receipts++;
        categories.set(key, category);
        const salePart = getDaypart(sale.date.getHours());
        if (timeKnown) dayparts.get(salePart)!.contribution += lineContribution;
        month.contribution += lineContribution;
      } else {
        missingRecipeLines++;
      }
    }
  }

  const totalUnits = Array.from(dishData.values()).reduce((sum, dish) => sum + dish.units, 0);
  for (const category of categories.values()) category.mixPct = revenue > 0 ? category.revenue / revenue * 100 : 0;
  const dishRows = Array.from(dishData.values()).map(dish => ({
    ...dish,
    appliedVatRate: dish.units > 0 ? dish.vatWeighted / dish.units : dish.vatRate,
    averageNetPrice: dish.units > 0 ? dish.revenue / dish.units : null,
    averageGrossPrice: dish.units > 0 ? dish.grossRevenue / dish.units : null,
    marginPerPortion: dish.units > 0 && dish.recipeComplete ? dish.contribution / dish.units : null,
    foodCostPct: dish.units > 0 && dish.costedRevenue > 0 ? (dish.recipeCost || 0) / (dish.revenue / dish.units) * 100 : null,
    salesMixPct: revenue > 0 ? dish.revenue / revenue * 100 : 0,
  }));
  const relevantRevenue = categoryId === "all" ? revenue : dishRows.reduce((sum, dish) => sum + dish.revenue, 0);
  const categoryRows = Array.from(categories.values()).sort((a, b) => b.contribution - a.contribution);
  const daypartRows = Array.from(dayparts.values());
  const weekdayRows = Array.from(weekdays.values());
  const averageContributionPct = costedRevenue > 0 ? contribution / costedRevenue * 100 : null;

  return {
    revenue: relevantRevenue,
    grossRevenue,
    unknownNetGross,
    unverifiedReceipts,
    unverifiedVatLines,
    netRevenueCoveragePct: grossRevenue > 0 ? Math.min(100, Math.max(0, (grossRevenue - unknownNetGross) / grossRevenue * 100)) : null,
    linkedRevenue: dishRows.reduce((sum, dish) => sum + dish.revenue, 0),
    foodRevenue,
    beverageRevenue,
    receipts,
    covers: categoryId === "all" ? covers : null,
    totalUnits,
    cogs,
    contribution,
    contributionPct: averageContributionPct,
    costCoveragePct: revenue > 0 ? costedRevenue / revenue * 100 : null,
    receiptsWithTime: timedReceipts,
    receiptsWithoutTime: Math.max(0, receipts - timedReceipts - fallbackReceipts),
    timestampCoveragePct: receipts > 0 ? timedReceipts / receipts * 100 : null,
    unlinkedLines,
    missingRecipeLines,
    averageCheck: receipts > 0 && unknownNetGross === 0 ? relevantRevenue / receipts : null,
    revenuePerCover: categoryId === "all" && covers > 0 && unknownNetGross === 0 ? relevantRevenue / covers : null,
    cogsPerCover: categoryId === "all" && covers > 0 ? cogs / covers : null,
    categories: categoryRows,
    dishes: dishRows.sort((a, b) => b.contribution - a.contribution),
    dayparts: daypartRows,
    weekdays: weekdayRows,
    trend: Array.from(monthly.values()).sort((a, b) => a.month.localeCompare(b.month)),
  };
}

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period") || "90d";
  const range = getRange(period, request.nextUrl.searchParams.get("from"), request.nextUrl.searchParams.get("to"));
  if (!range) return NextResponse.json({ error: "Periodo non valido" }, { status: 400 });
  const previousRange = getPreviousRange(range);
  const categoryId = request.nextUrl.searchParams.get("categoryId") || "all";
  const clientId = request.headers.get("x-df-client-id") || request.nextUrl.searchParams.get("clientId") || "default";

  const [dishes, currentSales, previousSales] = await Promise.all([
    prisma.dish.findMany({ where: { clientId }, include: { category: true, recipes: { include: { ingredient: true } } }, orderBy: [{ category: { name: "asc" } }, { name: "asc" }] }),
    prisma.sale.findMany({ where: { clientId, type: { not: "POS" }, date: { gte: range.start, lt: range.end } }, include: { items: { include: { dish: { include: { category: true, recipes: { include: { ingredient: true } } } } } } } }),
    prisma.sale.findMany({ where: { clientId, type: { not: "POS" }, date: { gte: previousRange.start, lt: previousRange.end } }, include: { items: { include: { dish: { include: { category: true, recipes: { include: { ingredient: true } } } } } } } }),
  ]);

  const scopedDishes = categoryId === "all" ? dishes : dishes.filter(dish => dish.categoryId === categoryId);
  const current = summarizeSales(currentSales, scopedDishes, categoryId);
  const previous = summarizeSales(previousSales, scopedDishes, categoryId);
  const categories = Array.from(new Map(dishes.map(dish => [dish.categoryId, { id: dish.categoryId, name: dish.category.name }])).values());
  const variation = (currentValue: number | null, previousValue: number | null) => currentValue == null || previousValue == null ? null : calcVariazione(currentValue, previousValue);
  const scenarioPriceIncreasePct = Number(request.nextUrl.searchParams.get("priceIncreasePct") || 5);
  const safePriceIncreasePct = Number.isFinite(scenarioPriceIncreasePct) ? Math.max(-20, Math.min(30, scenarioPriceIncreasePct)) : 5;

  const priceScenario = current.dishes.map(dish => {
    const scenarioVatRate = dish.units > 0 ? dish.appliedVatRate : dish.vatRate;
    const actualOrMenuGrossPrice = dish.averageGrossPrice ?? dish.listPrice;
    const scenarioGrossPrice = actualOrMenuGrossPrice * (1 + safePriceIncreasePct / 100);
    const scenarioNetPrice = getNetSellingPrice(scenarioGrossPrice, scenarioVatRate);
    const scenarioMargin = getContributionMargin(dish.recipeCost, scenarioGrossPrice, scenarioVatRate);
    const currentActualMargin = dish.marginPerPortion;
    const scenarioContribution = scenarioMargin == null ? null : scenarioMargin * dish.units;
    const currentContribution = currentActualMargin == null ? null : currentActualMargin * dish.units;
    return {
      dishId: dish.id,
      name: dish.name,
      category: dish.category,
      vatRate: scenarioVatRate,
      units: dish.units,
      currentGrossPrice: actualOrMenuGrossPrice,
      currentNetPrice: dish.averageNetPrice,
      scenarioGrossPrice,
      scenarioNetPrice,
      recipeCostPerPortion: dish.recipeCost,
      currentContribution,
      scenarioContribution,
      deltaContribution: scenarioContribution == null || currentContribution == null ? null : scenarioContribution - currentContribution,
      currentRevenue: dish.revenue,
      scenarioRevenue: scenarioNetPrice == null ? null : scenarioNetPrice * dish.units,
      deltaRevenue: scenarioNetPrice == null || dish.units <= 0 ? null : scenarioNetPrice * dish.units - dish.revenue,
      volumeBasis: dish.units > 0 ? "volumi osservati mantenuti costanti" : "nessun volume osservato",
      recipeComplete: dish.recipeComplete,
    };
  });

  return NextResponse.json({
    period: { key: range.key, label: range.label, from: dateKey(range.start), to: dateKey(addDays(range.end, -1)) },
    clientId,
    comparisonRange: { from: dateKey(previousRange.start), to: dateKey(addDays(previousRange.end, -1)) },
    categoryId,
    scenarioPriceIncreasePct: safePriceIncreasePct,
    categories,
    summary: current,
    previousSummary: previous,
    comparison: {
      revenue: variation(current.revenue, previous.revenue),
      receipts: variation(current.receipts, previous.receipts),
      contribution: variation(current.contribution, previous.contribution),
      averageCheck: variation(current.averageCheck, previous.averageCheck),
      contributionPctPoints: current.contributionPct != null && previous.contributionPct != null ? current.contributionPct - previous.contributionPct : null,
    },
    priceScenario,
  });
}
