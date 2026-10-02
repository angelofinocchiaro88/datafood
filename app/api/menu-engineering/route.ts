import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateRecipeCost, getFoodCostPct, getGrossTargetPrice } from "@/lib/recipe-cost";
import { calcRicavoNettoRiga } from "@/lib/metrics";

export const dynamic = "force-dynamic";

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function parseDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getRange(request: NextRequest) {
  const now = new Date();
  const today = dayStart(now);
  const period = request.nextUrl.searchParams.get("period") || "90d";
  const fromInput = request.nextUrl.searchParams.get("from");
  const toInput = request.nextUrl.searchParams.get("to");
  let start: Date;
  const end = addDays(today, 1);

  if (period === "custom") {
    const from = parseDate(fromInput);
    const to = parseDate(toInput);
    if (!from || !to || from > to) return null;
    start = from;
    return { start, end: addDays(to, 1), label: "Periodo personalizzato", period };
  }

  if (period === "30d" || period === "90d") {
    const days = period === "30d" ? 30 : 90;
    start = addDays(today, -(days - 1));
  } else if (period === "month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (period === "quarter") {
    start = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  } else if (period === "year") {
    start = new Date(today.getFullYear(), 0, 1);
  } else {
    return null;
  }

  const labels: Record<string, string> = {
    "30d": "Ultimi 30 giorni",
    "90d": "Ultimi 90 giorni",
    month: "Mese corrente",
    quarter: "Trimestre corrente",
    year: "Anno corrente",
  };
  return { start, end, label: labels[period], period };
}

export async function GET(request: NextRequest) {
  const range = getRange(request);
  if (!range) return NextResponse.json({ error: "Periodo o date non validi" }, { status: 400 });

  const requestedCategory = request.nextUrl.searchParams.get("categoryId") || "all";
  const targetFoodCost = Number(request.nextUrl.searchParams.get("targetFoodCost") || 30);
  const safeTargetFoodCost = Number.isFinite(targetFoodCost) && targetFoodCost >= 10 && targetFoodCost <= 80 ? targetFoodCost : 30;
  const categoryWhere = requestedCategory === "all" ? {} : { categoryId: requestedCategory };

  const [dishes, saleItems] = await Promise.all([
    prisma.dish.findMany({
      where: { clientId: "default", ...categoryWhere },
      include: { category: true, recipes: { include: { ingredient: true } } },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.saleItem.findMany({
      where: {
        dishId: { not: null },
        sale: { clientId: "default", date: { gte: range.start, lt: range.end } },
      },
      select: { dishId: true, quantity: true, totalPrice: true, vatRate: true, vatRateKnown: true },
    }),
  ]);

  const dishIds = new Set(dishes.map(dish => dish.id));
  const dishVatRates = new Map(dishes.map(dish => [dish.id, dish.vatRate]));
  const salesByDish = new Map<string, { units: number; knownUnits: number; netRevenue: number; unknownVatGross: number; vatWeighted: number }>();
  for (const line of saleItems) {
    if (!line.dishId || !dishIds.has(line.dishId) || line.quantity <= 0) continue;
    const current = salesByDish.get(line.dishId) || { units: 0, knownUnits: 0, netRevenue: 0, unknownVatGross: 0, vatWeighted: 0 };
    current.units += line.quantity;
    if (line.vatRateKnown === false) {
      current.unknownVatGross += line.totalPrice;
      salesByDish.set(line.dishId, current);
      continue;
    }
    const vatRate = Number.isFinite(line.vatRate) && line.vatRate >= 0 ? line.vatRate : dishVatRates.get(line.dishId) || 10;
    current.knownUnits += line.quantity;
    current.netRevenue += calcRicavoNettoRiga(line.totalPrice, vatRate);
    current.vatWeighted += line.quantity * vatRate;
    salesByDish.set(line.dishId, current);
  }

  let unlinkedSalesLines = 0;
  if (requestedCategory === "all") {
    unlinkedSalesLines = await prisma.saleItem.count({
      where: {
        dishId: null,
        sale: { clientId: "default", date: { gte: range.start, lt: range.end } },
      },
    });
  }

  const categories = Array.from(new Map(dishes.map(dish => [dish.categoryId, { id: dish.categoryId, name: dish.category.name }])).values());
  const menu = dishes.map(dish => {
    const sales = salesByDish.get(dish.id) || { units: 0, knownUnits: 0, netRevenue: 0, unknownVatGross: 0, vatWeighted: 0 };
    const costing = calculateRecipeCost(dish);
    const recipeCost = costing.costPerPortion;
    const missingCostIngredients = costing.lines.filter(line => !line.complete).length;
    const recipeComplete = costing.complete;
    const vatRate = sales.knownUnits > 0 ? sales.vatWeighted / sales.knownUnits : dish.vatRate;
    const actualNetPrice = sales.knownUnits > 0 ? sales.netRevenue / sales.knownUnits : null;
    const planningNetPrice = dish.price / (1 + vatRate / 100);
    const referenceNetPrice = actualNetPrice ?? planningNetPrice;
    const hasKnownSalePrice = sales.knownUnits > 0 || sales.units === 0;
    const unitMargin = recipeComplete && recipeCost != null && hasKnownSalePrice ? referenceNetPrice - recipeCost : null;
    const foodCostPct = recipeComplete && hasKnownSalePrice ? getFoodCostPct(recipeCost, referenceNetPrice * (1 + vatRate / 100), vatRate) : null;
    const minimumGrossPriceAtTargetFoodCost = recipeComplete ? getGrossTargetPrice(recipeCost, safeTargetFoodCost, vatRate) : null;

    return {
      id: dish.id,
      name: dish.name,
      categoryId: dish.categoryId,
      category: dish.category.name,
      listPriceGross: dish.price,
      vatRate,
      recipeCost,
      recipeCostBatch: costing.totalBatchCost,
      yieldPortions: costing.yieldPortions,
      recipeCount: dish.recipes.length,
      missingCostIngredients,
      recipeComplete,
      salesQty: sales.units,
      knownVatUnits: sales.knownUnits,
      unknownVatGross: sales.unknownVatGross,
      salesMixPct: 0,
      netRevenue: sales.netRevenue,
      actualNetPrice,
      analysisNetPrice: referenceNetPrice,
      analysisGrossPrice: referenceNetPrice * (1 + vatRate / 100),
      analysisPriceSource: actualNetPrice == null ? "scenario" as const : "consuntivo" as const,
      unitMargin,
      totalContribution: unitMargin == null ? null : unitMargin * (sales.knownUnits || sales.units),
      foodCostPct,
      minimumGrossPriceAtTargetFoodCost,
      quadrant: "non-valutabile" as "star" | "puzzle" | "plow-horse" | "dog" | "non-valutabile",
      recommendation: "",
    };
  });

  const totalUnits = menu.reduce((sum, dish) => sum + dish.salesQty, 0);
  for (const dish of menu) dish.salesMixPct = totalUnits > 0 ? dish.salesQty / totalUnits * 100 : 0;
  const eligibleSold = menu.filter(dish => dish.salesQty > 0 && dish.recipeComplete && dish.unitMargin != null);
  const averageContribution = eligibleSold.length > 0
    ? eligibleSold.reduce((sum, dish) => sum + (dish.unitMargin || 0), 0) / eligibleSold.length
    : null;
  const averageUnitsPerMenuItem = menu.length > 0 ? totalUnits / menu.length : 0;
  const popularityThreshold = averageUnitsPerMenuItem * 0.7;

  for (const dish of menu) {
    if (!dish.recipeComplete) {
      dish.recommendation = dish.recipeCount === 0
        ? "Completa la ricetta prima di valutare margine e convenienza."
        : "Completa i costi degli ingredienti: il piatto non entra nella matrice finché il costo non è affidabile.";
      continue;
    }
    if (dish.salesQty === 0) {
      dish.recommendation = "Nessuna vendita nel periodo. Verifica disponibilità e presenza nel menù; il margine mostrato è una simulazione sul prezzo di listino e sull’IVA selezionata.";
      continue;
    }
    if (dish.knownVatUnits === 0) {
      dish.recommendation = "Le quantità vendute sono presenti, ma l’IVA delle righe non è verificata: il piatto non entra nella matrice di marginalità finché il ricavo netto non è attendibile.";
      continue;
    }

    const highPopularity = dish.salesQty >= popularityThreshold;
    const highContribution = averageContribution != null && (dish.unitMargin || 0) >= averageContribution;
    dish.quadrant = highPopularity
      ? highContribution ? "star" : "plow-horse"
      : highContribution ? "puzzle" : "dog";

    if ((dish.unitMargin || 0) <= 0) {
      dish.recommendation = "Il margine unitario è nullo o negativo: rivedi ricetta, porzione, prezzo e costo d’acquisto prima di promuoverlo.";
    } else if (dish.quadrant === "star") {
      dish.recommendation = "Proteggi ricetta e prezzo; mantieni alta visibilità e controlla che disponibilità e qualità restino costanti.";
    } else if (dish.quadrant === "puzzle") {
      dish.recommendation = "Margine sopra la media ma popolarità bassa: prova posizione, descrizione e raccomandazione del personale; misura di nuovo nel periodo successivo.";
    } else if (dish.quadrant === "plow-horse") {
      dish.recommendation = "Molto richiesto ma con margine sotto la media: lavora su resa, porzione e costo ingredienti; simula un eventuale ritocco prezzo prima di applicarlo.";
    } else {
      dish.recommendation = "Popolarità e margine sotto le rispettive soglie: verifica stagionalità, disponibilità e ruolo strategico prima di riprogettarlo o toglierlo.";
    }
  }

  const classified = menu.filter(dish => dish.quadrant !== "non-valutabile");
  const totalNetRevenue = menu.reduce((sum, dish) => sum + dish.netRevenue, 0);
  const totalContribution = eligibleSold.reduce((sum, dish) => sum + (dish.totalContribution || 0), 0);
  const netRevenueWithDish = menu.reduce((sum, dish) => sum + dish.netRevenue, 0);
  const totalTheoreticalCost = eligibleSold.reduce((sum, dish) => sum + (dish.recipeCost || 0) * (dish.knownVatUnits || dish.salesQty), 0);
  const unknownVatGross = menu.reduce((sum, dish) => sum + dish.unknownVatGross, 0);

  return NextResponse.json({
    period: { key: range.period, label: range.label, from: dateKey(range.start), to: dateKey(addDays(range.end, -1)) },
    categoryId: requestedCategory,
    scenario: { targetFoodCostPct: safeTargetFoodCost },
    categories,
    thresholds: { averageContribution, averageUnitsPerMenuItem, popularityThreshold, popularityFactor: 0.7 },
    summary: {
      menuItems: menu.length,
      soldItems: menu.filter(dish => dish.salesQty > 0).length,
      classifiedItems: classified.length,
      unclassifiedItems: menu.length - classified.length,
      units: totalUnits,
      netRevenue: totalNetRevenue,
      unknownVatGross,
      theoreticalCost: totalTheoreticalCost,
      contribution: totalContribution,
      unlinkedSalesLines,
      costCoveragePct: netRevenueWithDish + unknownVatGross > 0 ? (eligibleSold.reduce((sum, dish) => sum + dish.netRevenue, 0) / (netRevenueWithDish + unknownVatGross)) * 100 : null,
    },
    menu,
  });
}
