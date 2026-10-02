import { NextRequest, NextResponse } from "next/server";
import { GET as getCostControl } from "../../cost-control/route";

export const dynamic = "force-dynamic";

/** Legacy-compatible view backed by the same sources as Cost Control. */
export async function GET(request: NextRequest) {
  const response = await getCostControl(request);
  const data = await response.json();
  if (!response.ok) return NextResponse.json(data, { status: response.status });

  const kpi = data.kpi;
  const pnl = data.pnl;
  return NextResponse.json({
    period: data.period,
    range: data.period,
    ricavi: {
      food_sala: kpi.foodRevenue,
      bev_sala: kpi.beverageRevenue,
      delivery: 0,
      takeaway: 0,
      eventi: pnl.issuedRevenue,
      altri: 0,
      total: kpi.revenue,
    },
    cogs: {
      food: pnl.theoreticalFoodCost,
      bev: pnl.theoreticalBeverageCost,
      packaging: 0,
      total: pnl.theoreticalFoodCost + pnl.theoreticalBeverageCost,
    },
    margine_lordo: pnl.grossMargin,
    personale: { total: pnl.payroll, source: data.sources.payroll.source },
    prime_cost: kpi.primeCost,
    operativi: { total: pnl.operatingInvoices },
    struttura: { total: null },
    ebitda: pnl.EBITDAEstimate,
    ammortamenti: pnl.depreciationEstimate,
    ebit: pnl.operatingResultEstimate,
    finanziaria: { total: pnl.financialCosts },
    utile_ante_imposte: pnl.resultBeforeTaxEstimate,
    imposte: null,
    utile_netto: null,
    coperti: kpi.covers,
    sources: data.sources,
    estimateNotes: data.estimateNotes,
  });
}
