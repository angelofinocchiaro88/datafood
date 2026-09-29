import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateRecipeCost, getContributionMargin, getFoodCostPct, getNetSellingPrice } from "@/lib/recipe-cost";
import { calcRicavoNettoRiga } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const [dishes, dailySummaries] = await Promise.all([
    prisma.dish.findMany({
      include: { category: true, recipes: { include: { ingredient: true } }, saleItems: true },
      orderBy: { name: "asc" },
    }),
    prisma.dailySummary.findMany({ orderBy: { date: "desc" }, take: 30 }),
  ]);

  let totalRevenue = 0;
  let comparableRevenue = 0;
  let totalFoodCost = 0;

  const dishAnalysis = dishes.map(dish => {
    const recipeCost = calculateRecipeCost(dish);
    const revenue = dish.saleItems.reduce((sum, item) => sum + calcRicavoNettoRiga(item.totalPrice, item.vatRate), 0);
    const quantity = dish.saleItems.reduce((sum, item) => sum + item.quantity, 0);
    const netPrice = getNetSellingPrice(dish.price, dish.vatRate);
    const foodCostPct = getFoodCostPct(recipeCost.costPerPortion, dish.price, dish.vatRate);
    const margin = getContributionMargin(recipeCost.costPerPortion, dish.price, dish.vatRate);

    totalRevenue += revenue;
    if (recipeCost.complete && quantity > 0) {
      comparableRevenue += revenue;
      totalFoodCost += (recipeCost.costPerPortion || 0) * quantity;
    }

    return {
      id: dish.id,
      name: dish.name,
      category: dish.category.name,
      price: dish.price,
      vatRate: dish.vatRate,
      recipeCostBatch: recipeCost.totalBatchCost,
      yieldPortions: recipeCost.yieldPortions,
      recipeCost: recipeCost.costPerPortion,
      recipeComplete: recipeCost.complete,
      recipeIssues: recipeCost.lines.filter(line => !line.complete).map(line => line.issue),
      netSellingPrice: netPrice,
      foodCostPct,
      marginPerPortion: margin,
      marginPercentage: margin != null && netPrice ? margin / netPrice * 100 : null,
      timesSold: quantity,
      revenue,
    };
  });

  const overallFoodCost = comparableRevenue > 0 ? totalFoodCost / comparableRevenue * 100 : null;
  const costCoveragePct = totalRevenue > 0 ? comparableRevenue / totalRevenue * 100 : null;

  return NextResponse.json({
    overallFoodCost,
    totalFoodCost,
    totalRevenue,
    comparableRevenue,
    costCoveragePct,
    uncostedDishes: dishAnalysis.filter(dish => !dish.recipeComplete).length,
    dishAnalysis: dishAnalysis.sort((a, b) => b.revenue - a.revenue),
    trend: dailySummaries.slice(0, 14),
  });
}
