import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calcRicavoNettoRiga, calcVariazione } from "@/lib/metrics";
import { calculateRecipeCost } from "@/lib/recipe-cost";
import { calculateSaleFinancials } from "@/lib/sale-financials";
import { totalCashPosition } from "@/lib/cash-position";

export const dynamic = "force-dynamic";

type Period = "oggi" | "settimana" | "mese" | "trimestre" | "anno";
type DateRange = { start: Date; end: Date; label: string; days: number };

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function shiftDays(date: Date, days: number) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

function getPeriodRange(period: Period, now = new Date()): DateRange {
  const today = startOfDay(now);
  let start: Date;
  let label: string;

  switch (period) {
    case "oggi":
      start = today;
      label = "Oggi";
      break;
    case "settimana": {
      start = shiftDays(today, -((today.getDay() + 6) % 7));
      label = "Settimana corrente";
      break;
    }
    case "mese":
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      label = "Mese corrente";
      break;
    case "trimestre": {
      const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
      start = new Date(today.getFullYear(), quarterStartMonth, 1);
      label = "Trimestre corrente";
      break;
    }
    case "anno":
      start = new Date(today.getFullYear(), 0, 1);
      label = "Anno corrente";
      break;
  }

  // Intervallo [inizio, domani): include tutto il giorno corrente, senza includere
  // record del giorno successivo. I confronti seguono lo stesso avanzamento.
  const end = shiftDays(today, 1);
  return { start, end, label, days: Math.round((end.getTime() - start.getTime()) / 86400000) };
}

function getPreviousRange(period: Period, current: DateRange): DateRange {
  let start: Date;
  let end: Date;
  const durationDays = current.days;

  if (period === "oggi") {
    start = shiftDays(current.start, -1);
    end = current.start;
  } else if (period === "settimana") {
    start = shiftDays(current.start, -7);
    end = shiftDays(current.end, -7);
  } else {
    const monthOffset = period === "mese" ? -1 : period === "trimestre" ? -3 : -12;
    const previousPeriodStart = period === "mese"
      ? new Date(current.start.getFullYear(), current.start.getMonth() - 1, 1)
      : period === "trimestre"
        ? new Date(current.start.getFullYear(), current.start.getMonth() - 3, 1)
        : new Date(current.start.getFullYear() - 1, 0, 1);
    const nextPeriodStart = new Date(previousPeriodStart.getFullYear(), previousPeriodStart.getMonth() - monthOffset, 1);
    start = previousPeriodStart;
    end = new Date(Math.min(shiftDays(start, durationDays).getTime(), nextPeriodStart.getTime()));
  }

  return { start, end, label: "Periodo precedente", days: Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000)) };
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function summarizeSales(sales: any[], range: DateRange) {
  let totalRev = 0, grossRevenue = 0, unknownNetGross = 0, foodRev = 0, bevRev = 0, foodCost = 0, bevCost = 0, coperti = 0, missingRecipeItems = 0;
  const trendByDate = new Map<string, { date: string; ricavi: number; coperti: number; transazioni: number }>();

  for (const sale of sales) {
    const financials = calculateSaleFinancials(sale);
    const saleNetRevenue = financials.knownNetRevenue;
    grossRevenue += financials.grossRevenue;
    if (financials.basis === "unknown") unknownNetGross += sale.items.length > 0 ? sale.items.filter((item: any) => item.vatRateKnown === false).reduce((sum: number, item: any) => sum + item.totalPrice, 0) : financials.grossRevenue;
    if (financials.reconciliationDelta != null) unknownNetGross += Math.abs(financials.reconciliationDelta);
    totalRev += saleNetRevenue;
    coperti += sale.coverCount;
    const key = dateKey(new Date(sale.date));
    const daily = trendByDate.get(key) || { date: key, ricavi: 0, coperti: 0, transazioni: 0 };
    daily.ricavi += saleNetRevenue;
    daily.coperti += sale.coverCount;
    daily.transazioni += 1;
    trendByDate.set(key, daily);

    if (sale.items.length === 0 && sale.total > 0) {
      missingRecipeItems += 1;
    }

    for (const item of sale.items) {
      if (item.vatRateKnown === false) { missingRecipeItems++; continue; }
      if (!item.dish) {
        missingRecipeItems += 1;
        continue;
      }
      const isBev = item.dish?.category?.name?.trim().toLocaleLowerCase("it-IT") === "bevande";
      const costing = calculateRecipeCost(item.dish);
      if (!costing.complete) missingRecipeItems += 1;
      const recipeCost = (costing.costPerPortion || 0) * item.quantity;
      const revenue = calcRicavoNettoRiga(item.totalPrice, item.vatRate);
      if (isBev) {
        bevRev += revenue;
        bevCost += recipeCost;
      } else {
        foodRev += revenue;
        foodCost += recipeCost;
      }
    }
  }

  const totMp = foodCost + bevCost;
  const personnelEstimate = totalRev * 0.30;
  const overheadEstimate = (40000 / 365.25) * range.days + totalRev * 0.06;
  const ebitdaEstimate = totalRev - totMp - personnelEstimate - overheadEstimate;

  const trend = [];
  for (let day = new Date(range.start); day < range.end; day = shiftDays(day, 1)) {
    const key = dateKey(day);
    trend.push(trendByDate.get(key) || { date: key, ricavi: 0, coperti: 0, transazioni: 0 });
  }

  return {
    bilancio: {
      ricavi: totalRev,
      incassiLordi: grossRevenue,
      lordoSenzaIVAVerificata: unknownNetGross,
      coperturaRicaviNettiPct: grossRevenue > 0 ? Math.min(100, Math.max(0, (grossRevenue - unknownNetGross) / grossRevenue * 100)) : null,
      food_sala: foodRev,
      bev_sala: bevRev,
      food_cost: foodCost,
      bev_cost: bevCost,
      food_cost_complete: missingRecipeItems === 0,
      food_cost_missing_items: missingRecipeItems,
      non_classified_revenue: totalRev - foodRev - bevRev,
      tot_materie: totMp,
      margine_lordo: totalRev - totMp,
      personale: personnelEstimate,
      ebitda: ebitdaEstimate,
      coperti,
      transazioni: sales.length,
      giorniAperti: range.days,
    },
    trend,
  };
}

export async function GET(request: NextRequest) {
  const requestedPeriod = request.nextUrl.searchParams.get("period") || "trimestre";
  const supportedPeriods: Period[] = ["oggi", "settimana", "mese", "trimestre", "anno"];
  const period: Period = supportedPeriods.includes(requestedPeriod as Period) ? requestedPeriod as Period : "trimestre";
  const range = getPeriodRange(period);
  const clientId = request.headers.get("x-df-client-id") || "default";
  const previousRange = getPreviousRange(period, range);
  const salesInclude = { items: { include: { dish: { include: { category: true, recipes: { include: { ingredient: true } } } } } } };

  const [sales, previousSales, client, schedules, alerts, categories, cashTx, accounts, ingredients, activeOrders] = await Promise.all([
    prisma.sale.findMany({
      where: { clientId: "default", type: { not: "POS" }, date: { gte: range.start, lt: range.end } },
      include: salesInclude,
    }),
    prisma.sale.findMany({
      where: { clientId: "default", type: { not: "POS" }, date: { gte: previousRange.start, lt: previousRange.end } },
      include: salesInclude,
    }),
    prisma.client.findFirst({ where: { id: clientId } }),
    prisma.paymentSchedule.findMany({ where: { status: "open" }, orderBy: { dueDate: "asc" }, take: 6, include: { category: true } }),
    prisma.alert.findMany({ where: { isResolved: false }, orderBy: { createdAt: "desc" } }),
    prisma.cashFlowCategory.findMany(),
    prisma.cashTransaction.findMany({ where: { clientId: "default" }, select: { accountId: true, date: true, amount: true } }),
    prisma.account.findMany({ where: { clientId: "default", status: "active" }, select: { id: true, openingBalance: true, openingBalanceDate: true, openingBalanceConfirmed: true } }),
    prisma.ingredient.findMany({ where: { minStock: { gt: 0 } }, select: { id: true, name: true, unit: true, currentStock: true, minStock: true } }),
    prisma.order.findMany({
      where: { status: { in: ["SENT", "PARTIAL"] } },
      orderBy: { date: "asc" },
      include: { supplier: { select: { name: true } }, items: { include: { ingredient: { select: { name: true, unit: true } } } } },
    }),
  ]);

  const currentSummary = summarizeSales(sales, range);
  const previousSummary = summarizeSales(previousSales, previousRange);
  const currentFoodCostPct = currentSummary.bilancio.food_cost_complete && currentSummary.bilancio.food_sala > 0 ? currentSummary.bilancio.food_cost / currentSummary.bilancio.food_sala * 100 : null;
  const previousFoodCostPct = previousSummary.bilancio.food_cost_complete && previousSummary.bilancio.food_sala > 0 ? previousSummary.bilancio.food_cost / previousSummary.bilancio.food_sala * 100 : null;
  const currentLaborPct = currentSummary.bilancio.ricavi > 0 ? currentSummary.bilancio.personale / currentSummary.bilancio.ricavi * 100 : null;
  const previousLaborPct = previousSummary.bilancio.ricavi > 0 ? previousSummary.bilancio.personale / previousSummary.bilancio.ricavi * 100 : null;

  const liquidita = totalCashPosition(accounts, cashTx);
  const stockAlerts = ingredients.filter(ingredient => ingredient.currentStock <= ingredient.minStock);
  const pendingOrders = activeOrders
    .map(order => ({
      id: order.id,
      date: order.date,
      supplier: order.supplier.name,
      outstanding: order.items.filter(item => item.received < item.quantity).map(item => ({
        ingredient: item.ingredient.name,
        quantity: item.quantity - item.received,
        unit: item.ingredient.unit,
      })),
    }))
    .filter(order => order.outstanding.length > 0);

  return NextResponse.json({
    period: range.label,
    periodDays: range.days,
    range: { from: dateKey(range.start), to: dateKey(shiftDays(range.end, -1)), toExclusive: dateKey(range.end) },
    comparison: {
      label: "vs periodo precedente",
      range: { from: dateKey(previousRange.start), to: dateKey(shiftDays(previousRange.end, -1)), toExclusive: dateKey(previousRange.end) },
      ricavi: calcVariazione(currentSummary.bilancio.ricavi, previousSummary.bilancio.ricavi),
      ebitda: calcVariazione(currentSummary.bilancio.ebitda, previousSummary.bilancio.ebitda),
      foodCostPct: currentFoodCostPct != null && previousFoodCostPct != null
        ? { puntiPercentuali: currentFoodCostPct - previousFoodCostPct }
        : null,
      laborPct: currentLaborPct != null && previousLaborPct != null
        ? { puntiPercentuali: currentLaborPct - previousLaborPct }
        : null,
      previous: previousSummary.bilancio,
    },
    restaurantName: client?.name || "Ristorante",
    bilancio: currentSummary.bilancio,
    trend: currentSummary.trend,
    estimateNotes: {
      foodCost: "Costo teorico da ricette e vendite; se mancano righe di vendita o ricette il KPI viene indicato come incompleto. Non sostituisce il consumo reale da inventario.",
      labor: "Costo personale stimato al 30% dei ricavi.",
      overhead: "Struttura stimata su base annua di € 40.000 ripartita sui giorni del periodo + 6% dei ricavi.",
      ebitda: "Stima basata sulle assunzioni sopra; non è un consuntivo contabile.",
    },
    liquidita: Math.round(liquidita),
    schedules,
    alerts,
    stockAlerts,
    pendingOrders,
    cashFlowCategories: categories,
    accountsCount: accounts.length,
    confirmedAccountsCount: accounts.filter(account => account.openingBalanceConfirmed).length,
    lastUpdate: new Date().toISOString(),
  });
}
