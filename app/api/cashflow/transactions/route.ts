import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { categorizeTransaction } from "@/lib/cashflow";

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId");
  const dateFrom = request.nextUrl.searchParams.get("dateFrom");
  const dateTo = request.nextUrl.searchParams.get("dateTo");
  const categoryId = request.nextUrl.searchParams.get("categoryId");

  const where: any = {};
  if (accountId) {
    const account = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true, clientId: true } });
    if (!account) return NextResponse.json({ error: "Conto non trovato" }, { status: 404 });
    where.accountId = account.id;
    where.clientId = account.clientId;
  } else {
    where.clientId = "default";
  }
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
  });

  // Il riepilogo usa tutti i movimenti filtrati; la tabella restituisce una pagina recente.
  const totaleEntrate = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totaleUscite = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const saldoPeriodo = transactions.reduce((s, t) => s + t.amount, 0);
  const categories = new Map<string, { id: string | null; name: string; inflow: number; outflow: number; count: number }>();
  const byMonth = new Map<string, { month: string; inflow: number; outflow: number; net: number; count: number }>();
  for (const transaction of transactions) {
    const categoryId = transaction.categoryId || null;
    const categoryName = transaction.category?.name || "Non categorizzato";
    const category = categories.get(categoryId || categoryName) || { id: categoryId, name: categoryName, inflow: 0, outflow: 0, count: 0 };
    if (transaction.amount > 0) category.inflow += transaction.amount;
    if (transaction.amount < 0) category.outflow += Math.abs(transaction.amount);
    category.count++;
    categories.set(categoryId || categoryName, category);

    const month = `${transaction.date.getFullYear()}-${String(transaction.date.getMonth() + 1).padStart(2, "0")}`;
    const monthly = byMonth.get(month) || { month, inflow: 0, outflow: 0, net: 0, count: 0 };
    if (transaction.amount > 0) monthly.inflow += transaction.amount;
    if (transaction.amount < 0) monthly.outflow += Math.abs(transaction.amount);
    monthly.net += transaction.amount;
    monthly.count++;
    byMonth.set(month, monthly);
  }
  const limit = Math.max(1, Math.min(1000, parseInt(request.nextUrl.searchParams.get("limit") || "300")));

  return NextResponse.json({
    transactions: transactions.slice(0, limit),
    riepilogo: {
      totaleEntrate: Math.round(totaleEntrate),
      totaleUscite: Math.round(totaleUscite),
      saldoPeriodo: Math.round(saldoPeriodo),
      count: transactions.length,
      reconciledCount: transactions.filter(t => t.isReconciled).length,
      unReconciledCount: transactions.filter(t => !t.isReconciled).length,
    },
    categories: Array.from(categories.values()).sort((a, b) => (b.inflow + b.outflow) - (a.inflow + a.outflow)),
    monthly: Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)),
  });
}

export async function POST(request: NextRequest) {
  const { accountId, date, amount, description, counterparty, categoryId, source } = await request.json();
  const numericAmount = Number(amount);
  const transactionDate = date ? new Date(date) : new Date();
  if (!accountId || !Number.isFinite(numericAmount) || numericAmount === 0 || Number.isNaN(transactionDate.getTime())) {
    return NextResponse.json({ error: "Conto, data e importo non nulli sono obbligatori" }, { status: 400 });
  }
  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true, clientId: true } });
  if (!account) return NextResponse.json({ error: "Conto non trovato" }, { status: 404 });

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
    data: { accountId, clientId: account.clientId, date: transactionDate, amount: numericAmount, description: description || "", counterparty: counterparty || "", categoryId: finalCategoryId, source: source || "manual", isReconciled: source === "bank_upload" },
    include: { category: true },
  });

  return NextResponse.json({ transaction: tx, suggestionConfidence: confidence });
}
