import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { categorizeTransaction } from "@/lib/cashflow";

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId");
  const dateFrom = request.nextUrl.searchParams.get("dateFrom");
  const dateTo = request.nextUrl.searchParams.get("dateTo");
  const categoryId = request.nextUrl.searchParams.get("categoryId");

  const where: any = {};
  if (accountId) where.accountId = accountId;
  if (categoryId) where.categoryId = categoryId;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      where.date.lte = to;
    }
  }

  const transactions = await prisma.cashTransaction.findMany({
    where,
    include: { category: true },
    orderBy: { date: "desc" },
    take: 300,
  });

  // Riepilogo periodo
  const totaleEntrate = transactions.filter(t => t.amount >= 0).reduce((s, t) => s + t.amount, 0);
  const totaleUscite = transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const saldoPeriodo = transactions.reduce((s, t) => s + t.amount, 0);

  return NextResponse.json({
    transactions,
    riepilogo: {
      totaleEntrate: Math.round(totaleEntrate),
      totaleUscite: Math.round(Math.abs(totaleUscite)),
      saldoPeriodo: Math.round(saldoPeriodo),
      count: transactions.length,
    },
  });
}

export async function POST(request: NextRequest) {
  const { accountId, date, amount, description, counterparty, categoryId, source } = await request.json();

  let finalCategoryId = categoryId;
  let confidence = 0;
  if (!finalCategoryId) {
    const suggestion = categorizeTransaction(description, counterparty);
    if (suggestion.category) {
      const cat = await prisma.cashFlowCategory.findFirst({ where: { name: suggestion.category } });
      if (cat) { finalCategoryId = cat.id; confidence = suggestion.confidence; }
    }
  }

  const tx = await prisma.cashTransaction.create({
    data: { accountId, date: new Date(date), amount, description, counterparty, categoryId: finalCategoryId, source: source || "manual" },
    include: { category: true },
  });

  return NextResponse.json({ transaction: tx, suggestionConfidence: confidence });
}