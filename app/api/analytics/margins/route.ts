import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const dishes = await prisma.dish.findMany({
    include: {
      recipes: { include: { ingredient: true } },
      saleItems: true,
      category: true,
    },
  });

  const marginAnalysis = dishes.map((dish) => {
    const recipeCost = dish.recipes.reduce((sum, r) => {
      return sum + r.ingredient.unitPrice * r.quantity;
    }, 0);

    const revenue = dish.saleItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const timesSold = dish.saleItems.reduce((sum, item) => sum + item.quantity, 0);

    const marginValue = dish.price - recipeCost;
    const marginPercentage = dish.price > 0 ? (marginValue / dish.price) * 100 : 0;

    return {
      id: dish.id,
      name: dish.name,
      category: dish.category.name,
      price: dish.price,
      recipeCost,
      marginValue,
      marginPercentage: parseFloat(marginPercentage.toFixed(1)),
      timesSold,
      revenue,
    };
  });

  const sorted = marginAnalysis.sort((a, b) => b.marginPercentage - a.marginPercentage);

  const bestMargin = sorted[0];
  const worstMargin = sorted[sorted.length - 1];
  const averageMargin = sorted.reduce((sum, d) => sum + d.marginPercentage, 0) / (sorted.length || 1);

  return NextResponse.json({
    sorted,
    bestMargin,
    worstMargin,
    averageMargin: parseFloat(averageMargin.toFixed(1)),
  });
}