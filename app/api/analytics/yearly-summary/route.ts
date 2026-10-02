import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { GET as getCostControl } from "../../cost-control/route";

function monthRange(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const year = Number(body.year ?? new Date().getFullYear());
    const month = Number(body.month ?? new Date().getMonth() + 1);
    if (!Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Anno o mese non validi" }, { status: 400 });
    }

    const range = monthRange(year, month);
    const url = new URL(request.url);
    url.pathname = "/api/cost-control";
    url.search = new URLSearchParams({ period: "custom", from: range.from, to: range.to }).toString();
    const controlResponse = await getCostControl(new NextRequest(url));
    const control = await controlResponse.json();
    if (!controlResponse.ok) return NextResponse.json(control, { status: controlResponse.status });

    const revenue = control.kpi.revenue;
    const foodCost = control.kpi.theoreticalCogs;
    const laborCost = control.kpi.laborCost;
    const otherCosts = control.pnl.operatingInvoices + control.pnl.externalPersonnelInvoices;
    const margin = control.kpi.ebitdaEstimate ?? 0;
    const fiscalYear = await prisma.fiscalYear.upsert({
      where: { year },
      create: { year, startDate: new Date(year, 0, 1), endDate: new Date(year, 11, 31), isActive: true },
      update: {},
    });

    await prisma.yearlySummary.upsert({
      where: { fiscalYearId_month: { fiscalYearId: fiscalYear.id, month } },
      create: { fiscalYearId: fiscalYear.id, year, month, revenue, foodCost, laborCost, otherCosts, margin, transactionCount: control.kpi.receipts, coverCount: control.kpi.covers },
      update: { revenue, foodCost, laborCost, otherCosts, margin, transactionCount: control.kpi.receipts, coverCount: control.kpi.covers },
    });
    const months = await prisma.yearlySummary.findMany({ where: { fiscalYearId: fiscalYear.id } });
    const totals = months.reduce((sum, row) => ({ revenue: sum.revenue + row.revenue, costs: sum.costs + row.foodCost + row.laborCost + row.otherCosts, margin: sum.margin + row.margin }), { revenue: 0, costs: 0, margin: 0 });
    await prisma.fiscalYear.update({ where: { id: fiscalYear.id }, data: { totalRevenue: totals.revenue, totalCosts: totals.costs, totalMargin: totals.margin } });

    return NextResponse.json({ success: true, year, month, summary: months.find(row => row.month === month), sourceQuality: control.kpi.ebitdaQuality, estimateNotes: control.estimateNotes });
  } catch (error) {
    console.error("Yearly summary update error:", error);
    return NextResponse.json({ error: "Impossibile aggiornare il riepilogo annuale" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const year = Number.parseInt(request.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    if (!Number.isInteger(year) || year < 2000 || year > 2200) return NextResponse.json({ error: "Anno non valido" }, { status: 400 });
    const fiscalYear = await prisma.fiscalYear.findUnique({ where: { year }, include: { YearlySummary: { orderBy: { month: "asc" } } } });
    if (!fiscalYear) return NextResponse.json({ year, YearlySummary: [] });
    return NextResponse.json({ ...fiscalYear, YearlySummary: fiscalYear.YearlySummary });
  } catch {
    return NextResponse.json({ error: "Impossibile caricare il riepilogo annuale" }, { status: 500 });
  }
}
