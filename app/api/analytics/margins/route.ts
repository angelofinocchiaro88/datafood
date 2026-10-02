import { NextRequest, NextResponse } from "next/server";
import { GET as getRevenueManagement } from "../../revenue-management/route";

export const dynamic = "force-dynamic";

/** Compatibility endpoint backed by the Revenue Management calculations. */
export async function GET(request: NextRequest) {
  const response = await getRevenueManagement(request);
  const data = await response.json();
  if (!response.ok) return NextResponse.json(data, { status: response.status });

  const sorted = (data.summary.dishes || []).map((dish: any) => {
    const marginPercentage = dish.marginPerPortion != null && dish.averageNetPrice > 0
      ? dish.marginPerPortion / dish.averageNetPrice * 100
      : null;
    return {
      id: dish.id,
      name: dish.name,
      category: dish.category,
      price: dish.listPrice,
      actualNetPrice: dish.averageNetPrice,
      recipeCost: dish.recipeCost,
      recipeComplete: dish.recipeComplete,
      marginValue: dish.marginPerPortion,
      marginPercentage: marginPercentage == null ? null : Number(marginPercentage.toFixed(1)),
      timesSold: dish.units,
      revenue: dish.revenue,
    };
  }).sort((a: any, b: any) => (b.marginPercentage ?? -Infinity) - (a.marginPercentage ?? -Infinity));
  const complete = sorted.filter((dish: any) => dish.marginPercentage != null);
  const bestMargin = complete[0] || null;
  const worstMargin = complete[complete.length - 1] || null;
  const averageMargin = complete.length > 0 ? complete.reduce((sum: number, dish: any) => sum + dish.marginPercentage, 0) / complete.length : null;
  return NextResponse.json({ sorted, bestMargin, worstMargin, averageMargin: averageMargin == null ? null : Number(averageMargin.toFixed(1)), period: data.period, netRevenueCoveragePct: data.summary.netRevenueCoveragePct });
}
