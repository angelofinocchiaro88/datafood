import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const targetYear = body.year ?? new Date().getFullYear();
    const targetMonth = body.month ?? new Date().getMonth() + 1;

    const monthStart = new Date(targetYear, targetMonth - 1, 1);
    const monthEnd = new Date(targetYear, targetMonth, 0);

    const sales = await prisma.sale.findMany({ where: { date: { gte: monthStart, lte: monthEnd } } });
    const invoices = await prisma.invoice.findMany({ where: { invoiceDate: { gte: monthStart, lte: monthEnd } } });

    const revenue = sales.reduce((sum, s) => sum + s.total, 0);
    const transactionCount = sales.length;
    const coverCount = sales.reduce((sum, s) => sum + s.coverCount, 0);
    const foodCost = revenue * 0.32;
    const laborCost = revenue * 0.28;
    const otherCosts = revenue * 0.05;
    const totalCosts = foodCost + laborCost + otherCosts;
    const margin = revenue - totalCosts;

    let fiscalYear = await prisma.fiscalYear.findUnique({ where: { year: targetYear } });
    if (!fiscalYear) { fiscalYear = await prisma.fiscalYear.create({ data: { year: targetYear, startDate: new Date(targetYear, 0, 1), endDate: new Date(targetYear, 11, 31), isActive: true } }); }

    const existingSummary = await prisma.yearlySummary.findUnique({ where: { fiscalYearId_month: { fiscalYearId: fiscalYear.id, month: targetMonth } } });

    if (existingSummary) { await prisma.yearlySummary.update({ where: { id: existingSummary.id }, data: { revenue, foodCost, laborCost, otherCosts, margin, transactionCount, coverCount } }); }
    else { await prisma.yearlySummary.create({ data: { fiscalYearId: fiscalYear.id, month: targetMonth, year: targetYear, revenue, foodCost, laborCost, otherCosts, margin, transactionCount, coverCount } }); }

    await prisma.fiscalYear.update({ where: { id: fiscalYear.id }, data: { totalRevenue: { increment: revenue }, totalCosts: { increment: totalCosts }, totalMargin: { increment: margin } } });

    return NextResponse.json({ success: true });
  } catch (error) { console.error(error); return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}

export async function GET(request: NextRequest) {
  try {
    const year = parseInt(request.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()));
    const fiscalYear = await prisma.fiscalYear.findUnique({ where: { year }, include: { YearlySummary: { orderBy: { month: "asc" } } } });
    if (!fiscalYear) return NextResponse.json({ year, YearlySummary: [] });
    return NextResponse.json({ ...fiscalYear, YearlySummary: fiscalYear.YearlySummary });
  } catch (error) { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}