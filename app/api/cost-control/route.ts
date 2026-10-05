import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calcolaCostoPersona } from "@/lib/payroll";
import { calculateRecipeCost } from "@/lib/recipe-cost";
import { calcRicavoNettoRiga, calcVariazione } from "@/lib/metrics";
import { calculateSaleFinancials } from "@/lib/sale-financials";
import { totalCashPosition } from "@/lib/cash-position";

export const dynamic = "force-dynamic";

type DateRange = { start: Date; end: Date; label: string; days: number };
type MonthSegment = { year: number; month: number; start: Date; end: Date; overlapDays: number; monthDays: number };

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + amount);
  return value;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(year, month - 1, day);
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day ? result : null;
}

function getRange(period: string, now = new Date(), from?: string | null, to?: string | null): DateRange | null {
  const today = dayStart(now);
  let start: Date;
  let end = addDays(today, 1);
  let label: string;

  if (period === "custom") {
    const customStart = parseDate(from || null);
    const customEnd = parseDate(to || null);
    if (!customStart || !customEnd || customStart > customEnd) return null;
    start = customStart;
    end = addDays(customEnd, 1);
    label = "Periodo personalizzato";
  } else if (period === "mese") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    label = "Mese corrente";
  } else if (period === "trimestre") {
    start = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
    label = "Trimestre corrente";
  } else {
    start = new Date(today.getFullYear(), 0, 1);
    label = "Anno corrente";
    period = "anno";
  }

  return { start, end, label, days: Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000)) };
}

function getPreviousRange(period: string, current: DateRange): DateRange {
  const duration = current.days;
  let start: Date;
  let end: Date;
  if (period === "mese") {
    start = new Date(current.start.getFullYear(), current.start.getMonth() - 1, 1);
    const nextStart = current.start;
    end = new Date(Math.min(addDays(start, duration).getTime(), nextStart.getTime()));
  } else if (period === "trimestre") {
    start = new Date(current.start.getFullYear(), current.start.getMonth() - 3, 1);
    const nextStart = current.start;
    end = new Date(Math.min(addDays(start, duration).getTime(), nextStart.getTime()));
  } else if (period === "anno") {
    start = new Date(current.start.getFullYear() - 1, 0, 1);
    end = new Date(Math.min(addDays(start, duration).getTime(), current.start.getTime()));
  } else {
    end = current.start;
    start = addDays(end, -duration);
  }
  return { start, end, label: "Periodo precedente", days: Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000)) };
}

function getMonthSegments(range: DateRange): MonthSegment[] {
  const segments: MonthSegment[] = [];
  for (let cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1); cursor < range.end; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const overlapStart = new Date(Math.max(monthStart.getTime(), range.start.getTime()));
    const overlapEnd = new Date(Math.min(monthEnd.getTime(), range.end.getTime()));
    segments.push({
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      start: overlapStart,
      end: overlapEnd,
      overlapDays: Math.max(0, Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 86400000)),
      monthDays: Math.round((monthEnd.getTime() - monthStart.getTime()) / 86400000),
    });
  }
  return segments;
}

function sumSales(sales: any[]) {
  let revenue = 0, foodRevenue = 0, beverageRevenue = 0, foodCost = 0, beverageCost = 0, linkedCostRevenue = 0;
  let covers = 0, linkedSaleLines = 0, unlinkedSaleLines = 0, unlinkedRevenue = 0, unknownNetGross = 0, unverifiedVatLines = 0, missingRecipeLines = 0, receiptsWithoutLines = 0;
  const byCategory = new Map<string, { category: string; revenue: number; cost: number; quantity: number }>();
  const byDish = new Map<string, { id: string; name: string; category: string; revenue: number; cost: number; quantity: number; complete: boolean }>();
  const trend = new Map<string, { month: string; revenue: number; covers: number; receipts: number; foodRevenue: number; beverageRevenue: number; foodCost: number; beverageCost: number; foodCostedRevenue: number; beverageCostedRevenue: number }>();

  for (const sale of sales) {
    covers += sale.coverCount;
    const monthKey = `${sale.date.getFullYear()}-${String(sale.date.getMonth() + 1).padStart(2, "0")}`;
    const monthRow = trend.get(monthKey) || { month: monthKey, revenue: 0, covers: 0, receipts: 0, foodRevenue: 0, beverageRevenue: 0, foodCost: 0, beverageCost: 0, foodCostedRevenue: 0, beverageCostedRevenue: 0 };
    monthRow.covers += sale.coverCount;
    monthRow.receipts++;
    if (sale.items.length > 0) unknownNetGross += Math.abs(sale.total - sale.items.reduce((sum: number, item: any) => sum + item.totalPrice, 0));

    if (sale.items.length === 0) {
      receiptsWithoutLines++;
      const financials = calculateSaleFinancials(sale);
      if (financials.netRevenue == null) unknownNetGross += financials.grossRevenue;
      else {
        revenue += financials.netRevenue;
        unlinkedRevenue += financials.netRevenue;
        monthRow.revenue += financials.netRevenue;
      }
    }

    for (const item of sale.items) {
      if (item.vatRateKnown === false) { unknownNetGross += item.totalPrice; unverifiedVatLines++; continue; }
      const netRevenue = calcRicavoNettoRiga(item.totalPrice, item.vatRate);
      revenue += netRevenue;
      monthRow.revenue += netRevenue;
      if (!item.dish) { unlinkedSaleLines++; unlinkedRevenue += netRevenue; continue; }
      linkedSaleLines++;

      const isBeverage = item.dish.category?.name?.trim().toLocaleLowerCase("it-IT") === "bevande";
      const categoryName = item.dish.category?.name || "Senza categoria";
      const category = byCategory.get(categoryName) || { category: categoryName, revenue: 0, cost: 0, quantity: 0 };
      category.revenue += netRevenue;
      category.quantity += item.quantity;
      if (isBeverage) monthRow.beverageRevenue += netRevenue;
      else monthRow.foodRevenue += netRevenue;

      const recipe = calculateRecipeCost(item.dish);
      const cost = recipe.costPerPortion == null ? 0 : recipe.costPerPortion * item.quantity;
      if (recipe.complete) {
        linkedCostRevenue += netRevenue;
        category.cost += cost;
        if (isBeverage) { beverageCost += cost; monthRow.beverageCost += cost; monthRow.beverageCostedRevenue += netRevenue; }
        else { foodCost += cost; monthRow.foodCost += cost; monthRow.foodCostedRevenue += netRevenue; }
      } else {
        missingRecipeLines++;
      }

      if (isBeverage) beverageRevenue += netRevenue;
      else foodRevenue += netRevenue;

      const dish = byDish.get(item.dish.id) || { id: item.dish.id, name: item.dish.name, category: categoryName, revenue: 0, cost: 0, quantity: 0, complete: recipe.complete };
      dish.revenue += netRevenue;
      dish.quantity += item.quantity;
      dish.complete = dish.complete && recipe.complete;
      if (recipe.complete) dish.cost += cost;
      byDish.set(item.dish.id, dish);
      byCategory.set(categoryName, category);
    }
    trend.set(monthKey, monthRow);
  }

  const costCoveragePct = revenue > 0 ? linkedCostRevenue / revenue * 100 : null;
  const validFoodSales = byCategory.size > 0 ? foodRevenue : 0;
  const costedFoodSales = Array.from(byDish.values()).filter(dish => dish.complete && dish.category.toLocaleLowerCase("it-IT") !== "bevande").reduce((sum, dish) => sum + dish.revenue, 0);
  const costedBeverageSales = Array.from(byDish.values()).filter(dish => dish.complete && dish.category.toLocaleLowerCase("it-IT") === "bevande").reduce((sum, dish) => sum + dish.revenue, 0);

  return {
    revenue, grossRevenue: sales.reduce((sum, sale) => sum + sale.total, 0), unknownNetGross, foodRevenue, beverageRevenue, foodCost, beverageCost, covers, receipts: sales.length,
    linkedSaleLines, unlinkedSaleLines, unlinkedRevenue, receiptsWithoutLines, unverifiedVatLines, missingRecipeLines, linkedCostRevenue, costCoveragePct,
    foodCostPct: costedFoodSales > 0 ? foodCost / costedFoodSales * 100 : null,
    beverageCostPct: costedBeverageSales > 0 ? beverageCost / costedBeverageSales * 100 : null,
    foodCostedRevenue: costedFoodSales, beverageCostedRevenue: costedBeverageSales,
    categories: Array.from(byCategory.values()).sort((a, b) => b.revenue - a.revenue),
    dishes: Array.from(byDish.values()).sort((a, b) => (b.revenue - b.cost) - (a.revenue - a.cost)).slice(0, 8),
    trend: Array.from(trend.values()).sort((a, b) => a.month.localeCompare(b.month)).map(month => ({
      ...month,
      foodCostPct: month.foodCostedRevenue > 0 ? month.foodCost / month.foodCostedRevenue * 100 : null,
      beverageCostPct: month.beverageCostedRevenue > 0 ? month.beverageCost / month.beverageCostedRevenue * 100 : null,
      foodCostCoveragePct: month.foodRevenue > 0 ? month.foodCostedRevenue / month.foodRevenue * 100 : null,
      beverageCostCoveragePct: month.beverageRevenue > 0 ? month.beverageCostedRevenue / month.beverageRevenue * 100 : null,
    })),
  };
}

function sumInvoices(invoices: any[]) {
  const byArea = new Map<string, { name: string; amount: number; count: number }>();
  const bySupplier = new Map<string, { id: string; name: string; amount: number; invoices: number }>();
  let foodPurchases = 0, beveragePurchases = 0, personnelInvoices = 0, financialCosts = 0, otherCosts = 0, unclassifiedAmount = 0, unclassifiedCount = 0;

  for (const invoice of invoices) {
    const amount = invoice.totalAmount || 0;
    const area = invoice.macroArea || invoice.contoGestionale || invoice.categoria || "Non classificata";
    const areaKey = area.trim() || "Non classificata";
    const normalized = areaKey.toLocaleUpperCase("it-IT");
    const food = normalized.includes("FOOD") || normalized.includes("MATERIE PRIME FOOD");
    const beverage = normalized.includes("BEVERAGE");
    const personnel = normalized.includes("PERSONALE") || normalized.includes("LABOR");
    const financial = normalized.includes("FINANZI") || normalized.includes("INTERESSI PASSIVI");
    const classified = Boolean(invoice.macroArea || invoice.contoGestionale || invoice.categoria);

    const row = byArea.get(areaKey) || { name: areaKey, amount: 0, count: 0 };
    row.amount += amount;
    row.count++;
    byArea.set(areaKey, row);

    if (!classified) { unclassifiedAmount += amount; unclassifiedCount++; }
    if (food) foodPurchases += amount;
    else if (beverage) beveragePurchases += amount;
    else if (personnel) personnelInvoices += amount;
    else if (financial) financialCosts += amount;
    else if (classified) otherCosts += amount;

    const supplierName = invoice.supplier?.name || invoice.senderName || "Fornitore non associato";
    const supplierId = invoice.supplierId || supplierName;
    const supplier = bySupplier.get(supplierId) || { id: supplierId, name: supplierName, amount: 0, invoices: 0 };
    supplier.amount += amount;
    supplier.invoices++;
    bySupplier.set(supplierId, supplier);
  }

  return {
    total: invoices.reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0),
    foodPurchases, beveragePurchases, personnelInvoices, financialCosts, otherCosts,
    unclassifiedAmount, unclassifiedCount, count: invoices.length,
    classifiedCount: invoices.length - unclassifiedCount,
    byArea: Array.from(byArea.values()).sort((a, b) => b.amount - a.amount),
    bySupplier: Array.from(bySupplier.values()).sort((a, b) => b.amount - a.amount).slice(0, 8),
  };
}

function summarizePayroll(range: DateRange, slips: any[], employees: any[]) {
  const segments = getMonthSegments(range);
  let actual = 0, estimated = 0, unknownMonths = 0, slipsCount = 0;
  const monthSources: { label: string; source: "consuntivo" | "misto" | "stima" | "non_disponibile"; amount: number; overlapDays: number }[] = [];

  for (const segment of segments) {
    const monthSlips = slips.filter(slip => slip.anno === segment.year && slip.mese === segment.month);
    const factor = segment.overlapDays / segment.monthDays;
    const actualByEmployee = new Map<string, number>();
    for (const slip of monthSlips) actualByEmployee.set(slip.dipendenteId, (actualByEmployee.get(slip.dipendenteId) || 0) + slip.costoAzienda);
    const monthActual = monthSlips.reduce((sum, slip) => sum + slip.costoAzienda, 0);
    let monthEstimate = 0;
    let missingStaff = 0;
    const activeStaff = employees.filter(employee => employee.stato === "attivo");

    for (const employee of activeStaff) {
      if (actualByEmployee.has(employee.id)) continue;
      const contract = employee.contratti.find((item: any) => item.dataInizio <= segment.end && (!item.dataFine || item.dataFine >= segment.start));
      if (!contract || contract.retribuzioneLordaMensile <= 0) { missingStaff++; continue; }
      monthEstimate += calcolaCostoPersona({ retribuzioneLorda: contract.retribuzioneLordaMensile, mensilita: contract.mensilita }).costoAziendaMensile;
    }

    const proratedActual = monthActual * factor;
    const proratedEstimate = monthEstimate * factor;
    actual += proratedActual;
    estimated += proratedEstimate;
    slipsCount += monthSlips.length;
    if (missingStaff > 0) unknownMonths++;

    const source = monthActual > 0
      ? monthEstimate > 0 || missingStaff > 0 ? "misto" : "consuntivo"
      : monthEstimate > 0 ? "stima" : "non_disponibile";
    monthSources.push({
      label: `${segment.year}-${String(segment.month).padStart(2, "0")}`,
      source,
      amount: proratedActual + proratedEstimate,
      overlapDays: segment.overlapDays,
    });
  }

  const hasActual = actual > 0;
  const hasEstimate = estimated > 0;
  const source = hasActual && (hasEstimate || unknownMonths > 0) ? "misto" : hasActual ? "consuntivo" : hasEstimate ? "stima" : "non_disponibile";
  return { actual, estimated, total: actual + estimated, source, slipsCount, expectedMonths: segments.length, actualMonths: monthSources.filter(item => item.source === "consuntivo" || item.source === "misto").length, estimatedMonths: monthSources.filter(item => item.source === "stima" || item.source === "misto").length, unknownMonths, months: monthSources };
}

function getBudget(range: DateRange, targets: any[]) {
  const segments = getMonthSegments(range);
  let revenueTarget = 0, coversTarget = 0;
  let foodWeighted = 0, laborWeighted = 0, otherWeighted = 0, weight = 0;
  let configuredMonths = 0;
  for (const segment of segments) {
    const target = targets.find(item => item.year === segment.year && item.month === segment.month);
    if (!target) continue;
    configuredMonths++;
    const factor = segment.overlapDays / segment.monthDays;
    const targetRevenueForSegment = target.revenueTarget * factor;
    revenueTarget += targetRevenueForSegment;
    coversTarget += target.coverTarget * factor;
    const w = targetRevenueForSegment > 0 ? targetRevenueForSegment : factor;
    foodWeighted += target.foodCostPct * w;
    laborWeighted += target.laborCostPct * w;
    otherWeighted += target.otherCostPct * w;
    weight += w;
  }
  return {
    configuredMonths,
    months: segments.length,
    revenueTarget: configuredMonths > 0 ? revenueTarget : null,
    coversTarget: configuredMonths > 0 ? coversTarget : null,
    foodCostPct: weight > 0 ? foodWeighted / weight : null,
    laborCostPct: weight > 0 ? laborWeighted / weight : null,
    otherCostPct: weight > 0 ? otherWeighted / weight : null,
  };
}

function calculatePriceChanges(invoices: any[], previousRange: DateRange, currentRange: DateRange) {
  const groups = new Map<string, { ingredient: string; supplier: string; previousAmount: number; previousQty: number; currentAmount: number; currentQty: number }>();
  for (const invoice of invoices) {
    const current = invoice.invoiceDate >= currentRange.start && invoice.invoiceDate < currentRange.end;
    const previous = invoice.invoiceDate >= previousRange.start && invoice.invoiceDate < previousRange.end;
    if (!current && !previous) continue;
    for (const item of invoice.items) {
      if (!item.ingredientId || !item.ingredient || item.quantity <= 0) continue;
      const supplierId = invoice.supplierId || "supplier-n-a";
      const key = `${item.ingredientId}:${supplierId}`;
      const row = groups.get(key) || { ingredient: item.ingredient.name, supplier: invoice.supplier?.name || invoice.senderName, previousAmount: 0, previousQty: 0, currentAmount: 0, currentQty: 0 };
      if (current) { row.currentAmount += item.unitPrice * item.quantity; row.currentQty += item.quantity; }
      if (previous) { row.previousAmount += item.unitPrice * item.quantity; row.previousQty += item.quantity; }
      groups.set(key, row);
    }
  }
  return Array.from(groups.values())
    .filter(row => row.currentQty > 0 && row.previousQty > 0)
    .map(row => {
      const previousPrice = row.previousAmount / row.previousQty;
      const currentPrice = row.currentAmount / row.currentQty;
      return { ingredient: row.ingredient, supplier: row.supplier, previousPrice, currentPrice, change: currentPrice - previousPrice, changePct: previousPrice > 0 ? (currentPrice - previousPrice) / previousPrice * 100 : null };
    })
    .sort((a, b) => Math.abs(b.changePct || 0) - Math.abs(a.changePct || 0))
    .slice(0, 8);
}

export async function GET(request: NextRequest) {
  const clientId = request.headers.get("x-df-client-id") || "default";
  const requestedPeriod = request.nextUrl.searchParams.get("period") || "anno";
  const range = getRange(requestedPeriod, new Date(), request.nextUrl.searchParams.get("from"), request.nextUrl.searchParams.get("to"));
  if (!range) return NextResponse.json({ error: "Periodo non valido" }, { status: 400 });
  const previousRange = getPreviousRange(requestedPeriod, range);
  const queryStart = new Date(Math.min(range.start.getTime(), previousRange.start.getTime()));
  const queryEnd = new Date(Math.max(range.end.getTime(), previousRange.end.getTime()));
  const startYear = queryStart.getFullYear();
  const endYear = queryEnd.getFullYear();
  const salesInclude = { items: { include: { dish: { include: { category: true, recipes: { include: { ingredient: true } } } } } } };

  const [currentSales, previousSales, currentIssuedInvoices, previousIssuedInvoices, invoices, buste, employees, assets, schedules, cashTx, accounts, budgetTargets, client] = await Promise.all([
    prisma.sale.findMany({ where: { clientId: "default", type: { not: "POS" }, date: { gte: range.start, lt: range.end } }, include: salesInclude }),
    prisma.sale.findMany({ where: { clientId: "default", type: { not: "POS" }, date: { gte: previousRange.start, lt: previousRange.end } }, include: salesInclude }),
    prisma.fatturaEmessa.findMany({ where: { clientId: "default", data: { gte: range.start, lt: range.end }, stato: { not: "ANNULLATA" } } }),
    prisma.fatturaEmessa.findMany({ where: { clientId: "default", data: { gte: previousRange.start, lt: previousRange.end }, stato: { not: "ANNULLATA" } } }),
    prisma.invoice.findMany({
      where: { clientId: "default", status: { in: ["RECEIVED", "PROCESSED"] }, invoiceDate: { gte: queryStart, lt: queryEnd } },
      include: { supplier: true, items: { include: { ingredient: true } } },
      orderBy: { invoiceDate: "asc" },
    }),
    prisma.bustaPaga.findMany({ where: { clientId: "default", anno: { gte: startYear, lte: endYear } } }),
    prisma.dipendente.findMany({ where: { clientId: "default" }, include: { contratti: true } }),
    prisma.asset.findMany({ where: { clientId: "default", stato: "attivo" } }),
    prisma.paymentSchedule.findMany({ where: { clientId: "default", status: "open", dueDate: { gte: new Date() } }, orderBy: { dueDate: "asc" }, take: 12 }),
    prisma.cashTransaction.findMany({ where: { clientId: "default" }, select: { accountId: true, date: true, amount: true } }),
    prisma.account.findMany({ where: { clientId: "default", status: "active" }, select: { id: true, openingBalance: true, openingBalanceDate: true, openingBalanceConfirmed: true } }),
    prisma.budgetTarget.findMany({ where: { clientId: "default", year: { gte: startYear, lte: endYear } } }),
    prisma.client.findFirst({ where: { id: clientId } }),
  ]);

  const sales = sumSales(currentSales);
  const previousSalesSummary = sumSales(previousSales);
  const issuedRevenue = currentIssuedInvoices.reduce((sum, invoice) => sum + invoice.importo, 0);
  const previousIssuedRevenue = previousIssuedInvoices.reduce((sum, invoice) => sum + invoice.importo, 0);
  const totalRevenue = sales.revenue + issuedRevenue;
  const previousTotalRevenue = previousSalesSummary.revenue + previousIssuedRevenue;
  const currentInvoices = invoices.filter(invoice => invoice.invoiceDate >= range.start && invoice.invoiceDate < range.end);
  const previousInvoices = invoices.filter(invoice => invoice.invoiceDate >= previousRange.start && invoice.invoiceDate < previousRange.end);
  const invoiceSummary = sumInvoices(currentInvoices);
  const previousInvoiceSummary = sumInvoices(previousInvoices);
  const payroll = summarizePayroll(range, buste, employees);
  const previousPayroll = summarizePayroll(previousRange, buste, employees);
  const budget = getBudget(range, budgetTargets);
  const totalCostsKnown = sales.foodCost + sales.beverageCost + payroll.total + invoiceSummary.personnelInvoices + invoiceSummary.otherCosts;
  const hasFinancialData = totalRevenue > 0 || invoiceSummary.count > 0 || payroll.total > 0;
  const ebitdaEstimate = hasFinancialData ? totalRevenue - totalCostsKnown : null;
  const amortization = getMonthSegments(range).reduce((sum, segment) => sum + assets.reduce((assetSum, asset) => assetSum + (asset.quotaMensile || asset.quotaAnnua / 12), 0) * (segment.overlapDays / segment.monthDays), 0);
  const operatingResultEstimate = ebitdaEstimate == null ? null : ebitdaEstimate - amortization;
  const resultBeforeTaxEstimate = operatingResultEstimate == null ? null : operatingResultEstimate - invoiceSummary.financialCosts;
  const previousCostsKnown = previousSalesSummary.foodCost + previousSalesSummary.beverageCost + previousPayroll.total + previousInvoiceSummary.personnelInvoices + previousInvoiceSummary.otherCosts;
  const previousHasFinancialData = previousTotalRevenue > 0 || previousInvoiceSummary.count > 0 || previousPayroll.total > 0;
  const previousEbitdaEstimate = previousHasFinancialData ? previousTotalRevenue - previousCostsKnown : null;
  const liquidita = totalCashPosition(accounts, cashTx);
  const schedules30 = schedules.filter(schedule => schedule.dueDate <= new Date(Date.now() + 30 * 86400000));
  const outflows30 = schedules30.filter(schedule => schedule.type === "payment").reduce((sum, schedule) => sum + schedule.amount, 0);
  const inflows30 = schedules30.filter(schedule => schedule.type === "income").reduce((sum, schedule) => sum + schedule.amount, 0);
  const purchasePriceChanges = calculatePriceChanges(invoices, previousRange, range);
  const budgetRevenueVariance = budget.revenueTarget == null ? null : calcVariazione(totalRevenue, budget.revenueTarget);
  const foodTargetVariance = budget.foodCostPct == null || sales.foodCostPct == null ? null : { puntiPercentuali: sales.foodCostPct - budget.foodCostPct };
  const laborPct = totalRevenue > 0 && payroll.total > 0 ? payroll.total / totalRevenue * 100 : null;
  const laborTargetVariance = budget.laborCostPct == null || laborPct == null ? null : { puntiPercentuali: laborPct - budget.laborCostPct };
  const trendsByMonth = new Map<string, any>(sales.trend.map(item => [item.month, { ...item, issuedRevenue: 0 }]));
  for (const invoice of currentIssuedInvoices) {
    const month = `${invoice.data.getFullYear()}-${String(invoice.data.getMonth() + 1).padStart(2, "0")}`;
    const row = trendsByMonth.get(month) || { month, revenue: 0, covers: 0, receipts: 0, foodRevenue: 0, beverageRevenue: 0, foodCost: 0, beverageCost: 0, foodCostedRevenue: 0, beverageCostedRevenue: 0, foodCostPct: null, beverageCostPct: null, issuedRevenue: 0 };
    row.issuedRevenue += invoice.importo;
    trendsByMonth.set(month, row);
  }
  const managementTrend = Array.from(trendsByMonth.values()).map(row => ({ ...row, totalRevenue: row.revenue + row.issuedRevenue })).sort((a, b) => a.month.localeCompare(b.month));
  const invoiceDetails: any[] = [];
  for (const invoice of currentInvoices) {
    const classification = {
      invoiceId: invoice.id,
      date: invoice.invoiceDate,
      invoiceNumber: invoice.invoiceNumber,
      supplier: invoice.supplier?.name || invoice.senderName,
      macroArea: invoice.macroArea,
      contoGestionale: invoice.contoGestionale,
      category: invoice.categoria,
      subcategory: invoice.sottocategoria,
      detail: invoice.voceDettaglio,
    };
    if (invoice.items.length === 0) {
      invoiceDetails.push({ ...classification, id: invoice.id, description: "Totale documento (nessun dettaglio riga)", quantity: null, unitPrice: null, lineTotal: invoice.totalAmount, vatRate: null, ingredient: null });
    } else {
      for (const item of invoice.items) invoiceDetails.push({
        ...classification,
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.totalPrice,
        vatRate: item.vatRate,
        ingredient: item.ingredient?.name || null,
      });
    }
  }

  const alerts = [];
  if (sales.receipts === 0) alerts.push({ level: "info", code: "no-sales", title: "Nessun corrispettivo POS nel periodo", detail: "Verifica l’intervallo o importa i corrispettivi con gli articoli venduti.", href: "/vendite" });
  if (sales.unknownNetGross > 0) alerts.push({ level: "warning", code: "unknown-sales-tax", title: "Incassi POS da riconciliare", detail: `${Math.round(sales.unknownNetGross).toLocaleString("it-IT")} € lordi non sono inclusi nei ricavi netti; verifica IVA e quadratura delle righe.`, href: "/corrispettivi" });
  if (sales.receiptsWithoutLines > 0 || sales.unlinkedSaleLines > 0) alerts.push({ level: "warning", code: "unlinked-sales", title: "Vendite non collegate ai piatti", detail: `${sales.receiptsWithoutLines} scontrini senza righe e ${sales.unlinkedSaleLines} righe senza piatto.`, href: "/vendite" });
  if (sales.missingRecipeLines > 0) alerts.push({ level: "warning", code: "missing-recipes", title: "Food Cost teorico incompleto", detail: `${sales.missingRecipeLines} righe vendute senza scheda costo valida (${sales.costCoveragePct == null ? "0" : sales.costCoveragePct.toFixed(1)}% copertura).`, href: "/food-cost" });
  if (invoiceSummary.count === 0) alerts.push({ level: "info", code: "no-invoices", title: "Costi da fatture non disponibili", detail: "Il risultato operativo non include costi di gestione registrati nel periodo.", href: "/accounting" });
  if (invoiceSummary.unclassifiedCount > 0) alerts.push({ level: "warning", code: "unclassified-invoices", title: "Fatture da classificare", detail: `${invoiceSummary.unclassifiedCount} fatture approvate non sono assegnate a un conto gestionale.`, href: "/accounting" });
  if (payroll.source !== "consuntivo") alerts.push({ level: "info", code: "payroll-source", title: `Costo personale ${payroll.source === "stima" ? "stimato" : payroll.source === "misto" ? "parzialmente stimato" : "non disponibile"}`, detail: `${payroll.actualMonths} mesi consuntivi, ${payroll.estimatedMonths} stimati, ${payroll.unknownMonths} senza dati.`, href: "/personale" });
  if (budget.configuredMonths < budget.months) alerts.push({ level: "info", code: "budget-incomplete", title: "Budget non completo", detail: `Obiettivi impostati per ${budget.configuredMonths} mesi su ${budget.months}.`, href: "/budget" });
  if (budget.foodCostPct != null && sales.foodCostPct != null && sales.foodCostPct > budget.foodCostPct) alerts.push({ level: "warning", code: "food-cost-target", title: "Food Cost sopra budget", detail: `${sales.foodCostPct.toFixed(1)}% consuntivo teorico vs ${budget.foodCostPct.toFixed(1)}% target.`, href: "/food-cost" });
  if (liquidita < outflows30 - inflows30) alerts.push({ level: "critical", code: "cash-gap", title: "Copertura scadenze a 30 giorni insufficiente", detail: `Liquidità ${Math.round(liquidita).toLocaleString("it-IT")} € · saldo scadenze ${Math.round(inflows30 - outflows30).toLocaleString("it-IT")} €.`, href: "/cash-flow" });

  const recipeCoverageComplete = totalRevenue === 0 || (issuedRevenue === 0 && sales.unknownNetGross === 0 && sales.costCoveragePct != null && sales.costCoveragePct >= 99.99);
  const invoiceCoverageComplete = invoiceSummary.count > 0 && invoiceSummary.unclassifiedCount === 0;
  const ebitdaQuality = !hasFinancialData ? "non_disponibile" : recipeCoverageComplete && invoiceCoverageComplete && payroll.source === "consuntivo" ? "completo" : "parziale";

  return NextResponse.json({
    restaurantName: client?.name || "Ristorante",
    period: { key: requestedPeriod, label: range.label, from: dateKey(range.start), to: dateKey(addDays(range.end, -1)) },
    comparisonRange: { from: dateKey(previousRange.start), to: dateKey(addDays(previousRange.end, -1)), label: previousRange.label },
    comparison: {
      revenue: calcVariazione(totalRevenue, previousTotalRevenue),
      ebitda: ebitdaEstimate != null && previousEbitdaEstimate != null ? calcVariazione(ebitdaEstimate, previousEbitdaEstimate) : null,
      foodCostPct: sales.foodCostPct != null && previousSalesSummary.foodCostPct != null ? { puntiPercentuali: sales.foodCostPct - previousSalesSummary.foodCostPct } : null,
      covers: calcVariazione(sales.covers, previousSalesSummary.covers),
    },
    kpi: {
      revenue: totalRevenue,
      posRevenue: sales.revenue,
      issuedRevenue,
      foodRevenue: sales.foodRevenue,
      beverageRevenue: sales.beverageRevenue,
      theoreticalCogs: sales.foodCost + sales.beverageCost,
      theoreticalFoodCostPct: sales.foodCostPct,
      beverageCostPct: sales.beverageCostPct,
      costCoveragePct: sales.costCoveragePct,
      grossMargin: sales.revenue - sales.foodCost - sales.beverageCost,
      laborCost: payroll.total,
      laborPct,
      primeCost: sales.foodCost + sales.beverageCost + payroll.total,
      primeCostPct: sales.revenue > 0 && payroll.total > 0 ? (sales.foodCost + sales.beverageCost + payroll.total) / sales.revenue * 100 : null,
      ebitdaEstimate,
      ebitdaQuality,
      operatingResultEstimate,
      financialCosts: invoiceSummary.financialCosts,
      resultBeforeTaxEstimate,
      netIncomeEstimate: null,
       averageCheck: sales.receipts > 0 && sales.unknownNetGross === 0 ? sales.revenue / sales.receipts : null,
       revenuePerCover: sales.covers > 0 && sales.unknownNetGross === 0 ? sales.revenue / sales.covers : null,
       theoreticalCostPerCover: sales.covers > 0 && sales.unknownNetGross === 0 ? (sales.foodCost + sales.beverageCost) / sales.covers : null,
       costPerFirstCover: sales.covers > 0 && sales.unknownNetGross === 0 ? (sales.foodCost + sales.beverageCost + payroll.total) / sales.covers : null,
      receipts: sales.receipts,
      covers: sales.covers,
      menuItemsWithoutCost: sales.missingRecipeLines,
    },
    pnl: {
      revenue: totalRevenue,
      posRevenue: sales.revenue,
      issuedRevenue,
      theoreticalFoodCost: sales.foodCost,
      theoreticalBeverageCost: sales.beverageCost,
      grossMargin: sales.revenue - sales.foodCost - sales.beverageCost,
      payroll: payroll.total,
      payrollActual: payroll.actual,
      payrollEstimated: payroll.estimated,
      externalPersonnelInvoices: invoiceSummary.personnelInvoices,
      operatingInvoices: invoiceSummary.otherCosts,
      EBITDAEstimate: ebitdaEstimate,
      depreciationEstimate: amortization,
      operatingResultEstimate,
      financialCosts: invoiceSummary.financialCosts,
      resultBeforeTaxEstimate,
      netIncomeEstimate: null,
      purchasesFood: invoiceSummary.foodPurchases,
      purchasesBeverage: invoiceSummary.beveragePurchases,
      unclassifiedInvoices: invoiceSummary.unclassifiedAmount,
    },
    budget,
    budgetVariance: { revenue: budgetRevenueVariance, foodCostPct: foodTargetVariance, laborPct: laborTargetVariance },
    sources: {
      sales: { receipts: sales.receipts, linkedLines: sales.linkedSaleLines, unlinkedReceipts: sales.receiptsWithoutLines, unlinkedSaleLines: sales.unlinkedSaleLines, netRevenue: sales.revenue, grossRevenue: sales.grossRevenue, unknownNetGross: sales.unknownNetGross, issuedRevenue, netRevenueCoveragePct: sales.grossRevenue > 0 ? Math.min(100, Math.max(0, (sales.grossRevenue - sales.unknownNetGross) / sales.grossRevenue * 100)) : null, linkedRevenueCoveragePct: sales.revenue > 0 ? Math.min(100, Math.max(0, (sales.revenue - sales.unlinkedRevenue) / sales.revenue * 100)) : null },
      recipeCosts: { costCoveragePct: sales.costCoveragePct, missingLines: sales.missingRecipeLines, basis: "Costo teorico da ricetta × porzioni vendute" },
      invoices: { approved: invoiceSummary.count, classified: invoiceSummary.classifiedCount, unclassified: invoiceSummary.unclassifiedCount, classificationCoveragePct: invoiceSummary.count > 0 ? invoiceSummary.classifiedCount / invoiceSummary.count * 100 : null },
      payroll: { source: payroll.source, slipsCount: payroll.slipsCount, actualMonths: payroll.actualMonths, estimatedMonths: payroll.estimatedMonths, missingMonths: payroll.unknownMonths, months: payroll.months },
    },
    trends: managementTrend,
    costAreas: invoiceSummary.byArea,
    invoiceDetails,
    suppliers: invoiceSummary.bySupplier,
    purchasePriceChanges,
    topDishes: sales.dishes,
    alerts,
    cash: { balance: liquidita, dueOutflows30: outflows30, dueInflows30: inflows30, schedules: schedules.slice(0, 8) },
  });
}
