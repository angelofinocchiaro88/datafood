import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const days = parseInt(request.nextUrl.searchParams.get("days") || "90");
  const accountId = request.nextUrl.searchParams.get("accountId");
  const now = new Date();
  const limit = new Date(now);
  limit.setDate(now.getDate() + Math.max(1, Math.min(days, 730)));

  const schedules = await prisma.paymentSchedule.findMany({
    where: { clientId: "default", status: "open", nextDueDate: { lte: limit }, ...(accountId ? { OR: [{ accountId }, { accountId: null }] } : {}) },
    include: { category: true, account: { select: { id: true, name: true } } },
    orderBy: { nextDueDate: "asc" },
  });
  return NextResponse.json(schedules.map(schedule => ({
    ...schedule,
    displayDueDate: schedule.recurrence === "none" ? schedule.dueDate : schedule.nextDueDate,
    overdue: schedule.recurrence === "none" && schedule.dueDate < now,
  })));
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const accountId = data.accountId;
  const amount = Number(data.amount);
  const dueDate = new Date(data.dueDate);
  const recurrence = data.recurrence || "none";
  const probability = Number(data.probability ?? 100);
  if (!accountId || !data.description?.trim() || !["payment", "income"].includes(data.type) || !["none", "weekly", "monthly", "quarterly", "yearly"].includes(recurrence) || !Number.isFinite(amount) || amount <= 0 || Number.isNaN(dueDate.getTime()) || !Number.isInteger(probability) || probability < 0 || probability > 100) {
    return NextResponse.json({ error: "Conto, descrizione, tipo, importo e scadenza validi sono obbligatori" }, { status: 400 });
  }
  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true, clientId: true } });
  if (!account) return NextResponse.json({ error: "Conto non trovato" }, { status: 404 });
  const schedule = await prisma.paymentSchedule.create({
    data: { ...data, accountId: account.id, recurrence, probability, amount, dueDate, nextDueDate: dueDate, description: data.description.trim(), clientId: account.clientId },
    include: { category: true },
  });
  return NextResponse.json(schedule);
}
