import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateForecast, calculateRunway } from "@/lib/cashflow";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId");
  const weeks = parseInt(request.nextUrl.searchParams.get("weeks") || "13");

  // Saldo attuale = somma transazioni
  const account = accountId
    ? await prisma.account.findUnique({ where: { id: accountId } })
    : await prisma.account.findFirst();

  if (!account) return NextResponse.json({ error: "Nessun conto" }, { status: 404 });

  const transactions = await prisma.cashTransaction.findMany({ where: { accountId: account.id } });
  const balance = transactions.reduce((s, t) => s + t.amount, 0);

  // Scadenze future
  const now = new Date();
  const schedules = await prisma.paymentSchedule.findMany({ where: { status: "open", dueDate: { gte: now } } });

  const scheduledItems = schedules.map(s => ({
    dueDate: s.dueDate,
    amount: s.amount,
    type: s.type as "payment" | "income",
    probability: s.probability,
  }));

  const forecast = generateForecast(balance, scheduledItems, weeks);
  const weeklyOutflow = forecast.length > 0 ? forecast.reduce((s, w) => s + w.outflow, 0) / forecast.length : 0;
  const runway = calculateRunway(forecast, weeklyOutflow);

  return NextResponse.json({
    account: { id: account.id, name: account.name, balance: Math.round(balance) },
    weeks,
    forecast,
    runway: runway === Infinity ? null : runway,
    atRiskWeeks: forecast.filter(w => w.atRisk).length,
  });
}