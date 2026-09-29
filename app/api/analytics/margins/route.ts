import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateRecipeCost, getContributionMargin, getNetSellingPrice } from "@/lib/recipe-cost";
import { calcRicavoNettoRiga } from "@/lib/metrics";

export async function GET() {
  const dishes = await prisma.dish.findMany({
    include: {
      recipes: { include: { ingredient: true } },
      saleItems: true,
      category: true,
    },
  });

  const marginAnalysis = dishes.map((dish) => {
    const costing = calculateRecipeCost(dish);
    const recipeCost = costing.costPerPortion;

    const revenue = dish.saleItems.reduce((sum, item) => sum + calcRicavoNettoRiga(item.totalPrice, item.vatRate), 0);
    const timesSold = dish.saleItems.reduce((sum, item) => sum + item.quantity, 0);

    const marginValue = getContributionMargin(recipeCost, dish.price, dish.vatRate);
    const netPrice = getNetSellingPrice(dish.price, dish.vatRate);
    const marginPercentage = marginValue != null && netPrice ? (marginValue / netPrice) * 100 : null;

    return {
      id: dish.id,
      name: dish.name,
      category: dish.category.name,
      price: dish.price,
      recipeCost,
      recipeCostBatch: costing.totalBatchCost,
      recipeComplete: costing.complete,
      vatRate: dish.vatRate,
      marginValue,
      marginPercentage: marginPercentage == null ? null : parseFloat(marginPercentage.toFixed(1)),
      timesSold,
      revenue,
    };
  });

  const sorted = marginAnalysis.sort((a, b) => {
    if (a.marginPercentage == null) return 1;
    if (b.marginPercentage == null) return -1;
    return b.marginPercentage - a.marginPercentage;
  });

  const complete = sorted.filter(dish => dish.marginPercentage != null);
  const bestMargin = complete[0] || null;
  const worstMargin = complete[complete.length - 1] || null;
  const averageMargin = complete.length > 0 ? complete.reduce((sum, d) => sum + d.marginPercentage!, 0) / complete.length : null;

  return NextResponse.json({
    sorted,
    bestMargin,
    worstMargin,
    averageMargin: averageMargin == null ? null : parseFloat(averageMargin.toFixed(1)),
  });
}
