import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Funzione per calcolare range date in base al periodo
function getPeriodRange(period: string, customDate?: string): { start: Date; end: Date; label: string; days: number } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - (today.getDay() || 7) + 1); // lunedì

  switch (period) {
    case "oggi":
      return { start: today, end: new Date(today.getTime() + 86400000), label: "Oggi", days: 1 };
    case "settimana":
      return { start: startOfWeek, end: new Date(startOfWeek.getTime() + 7 * 86400000), label: "Settimana corrente", days: 7 };
    case "mese": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: new Date(now.getFullYear(), now.getMonth() + 1, 1), label: "Mese corrente", days: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() };
    }
    case "trimestre": {
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1);
      return { start, end: new Date(now.getFullYear(), quarter * 3 + 3, 1), label: "Trimestre corrente", days: Math.round((now.getTime() - start.getTime()) / 86400000) };
    }
    case "anno": {
      return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 12, 1), label: "Anno corrente", days: Math.round((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) };
    }
    default:
      // Q1 2026 test data
      return { start: new Date(2026, 0, 1), end: new Date(2026, 2, 31), label: "Q1 2026", days: 90 };
  }
}

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period") || "trimestre";
  const range = getPeriodRange(period);

  // Se periodo "tutto" o non standard, usa Q1 2026 (dati test disponibili)
  const start = period === "trimestre" && range.label === "Q1 2026" ? range.start : range.start;
  const end = range.end;

  const [sales, client, schedules, account, alerts, categories, cashTx] = await Promise.all([
    prisma.sale.findMany({
      where: { date: { gte: start, lte: end } },
      include: { items: { include: { dish: { include: { category: true, recipes: { include: { ingredient: true } } } } } } },
    }),
    prisma.client.findFirst({ where: { id: "default" } }),
    prisma.paymentSchedule.findMany({ where: { status: "open" }, orderBy: { dueDate: "asc" }, take: 6, include: { category: true } }),
    prisma.account.findFirst(),
    prisma.alert.findMany({ where: { isResolved: false }, orderBy: { createdAt: "desc" } }),
    prisma.cashFlowCategory.findMany(),
    prisma.cashTransaction.findMany(),
  ]);

  let foodRev = 0, bevRev = 0, foodCost = 0, bevCost = 0, coperti = 0, transazioni = sales.length;
  for (const s of sales) {
    coperti += s.coverCount;
    for (const item of s.items) {
      const isBev = item.dish?.category?.name === "Bevande";
      const c = item.dish ? item.dish.recipes.reduce((sum, r) => sum + r.ingredient.unitPrice * r.quantity, 0) * item.quantity : 0;
      if (isBev) { bevRev += item.totalPrice; bevCost += c; }
      else { foodRev += item.totalPrice; foodCost += c; }
    }
  }

  const totalRev = foodRev + bevRev;
  const totMp = foodCost + bevCost;
  const margineLordo = totalRev - totMp;
  const personale = totalRev * 0.30;
  const struttura = 40000 / 4 + totalRev * 0.06;
  const ebitda = totalRev - totMp - personale - struttura;

  const liquidita = cashTx.reduce((s, t) => s + t.amount, 0);

  return NextResponse.json({
    period: range.label,
    periodDays: range.days,
    restaurantName: client?.name || "Ristorante",
    bilancio: {
      ricavi: Math.round(totalRev),
      food_sala: Math.round(foodRev),
      bev_sala: Math.round(bevRev),
      food_cost: Math.round(foodCost),
      bev_cost: Math.round(bevCost),
      tot_materie: Math.round(totMp),
      margine_lordo: Math.round(margineLordo),
      personale: Math.round(personale),
      ebitda: Math.round(ebitda),
      coperti,
      transazioni,
      giorniAperti: range.days,
    },
    liquidita: Math.round(liquidita),
    schedules,
    alerts,
    cashFlowCategories: categories,
    accountsCount: await prisma.account.count(),
    lastUpdate: new Date().toISOString(),
  });
}