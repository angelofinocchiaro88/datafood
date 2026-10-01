import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateRunway, generateForecast, nextRecurrenceDate } from "@/lib/cashflow";

export const dynamic = "force-dynamic";

function mondayOf(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayAfter(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + 1);
  return result;
}

function expandSchedule(schedule: any, from: Date, to: Date, today: Date) {
  const entries: any[] = [];
  const recurrence = schedule.recurrence || "none";
  if (recurrence === "none") {
    const originalDate = new Date(schedule.dueDate);
    const dueDate = originalDate < today ? new Date(today) : originalDate;
    if (dueDate < to) entries.push({ scheduleId: schedule.id, dueDate, originalDueDate: originalDate, amount: schedule.amount, type: schedule.type, probability: schedule.probability, description: schedule.description, counterparty: schedule.counterparty, category: schedule.category?.name || null, recurrence, overdue: originalDate < today });
    return entries;
  }

  let dueDate = new Date(schedule.nextDueDate || schedule.dueDate);
  let iterations = 0;
  while (dueDate < today && iterations < 120) { dueDate = nextRecurrenceDate(dueDate, recurrence); iterations++; }
  if (dueDate < from) dueDate = new Date(from);
  iterations = 0;
  while (dueDate < to && iterations < 120) {
    entries.push({ scheduleId: schedule.id, dueDate: new Date(dueDate), originalDueDate: new Date(schedule.dueDate), amount: schedule.amount, type: schedule.type, probability: schedule.probability, description: schedule.description, counterparty: schedule.counterparty, category: schedule.category?.name || null, recurrence, overdue: false });
    dueDate = nextRecurrenceDate(dueDate, recurrence);
    iterations++;
  }
  return entries;
}

function summarizeHistory(transactions: any[], account: any, weeks: number, asOf: Date) {
  const currentWeek = mondayOf(asOf);
  const wantedStart = new Date(currentWeek);
  wantedStart.setDate(wantedStart.getDate() - weeks * 7);
  const openingDate = account.openingBalanceConfirmed && account.openingBalanceDate ? new Date(account.openingBalanceDate) : null;
  const firstIncludedMovement = openingDate ? dayAfter(openingDate) : null;
  const earliestHistory = firstIncludedMovement && firstIncludedMovement > wantedStart ? mondayOf(firstIncludedMovement) : wantedStart;
  const includedTransactions = transactions.filter(transaction => !openingDate || transaction.date >= openingDate);
  let runningBalance = account.openingBalance + includedTransactions.filter(transaction => transaction.date < earliestHistory).reduce((sum, transaction) => sum + transaction.amount, 0);
  const rows = [];
  for (let start = new Date(earliestHistory); start < currentWeek; start.setDate(start.getDate() + 7)) {
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const weekTransactions = includedTransactions.filter(transaction => transaction.date >= start && transaction.date < end);
    const inflow = weekTransactions.filter(transaction => transaction.amount > 0).reduce((sum, transaction) => sum + transaction.amount, 0);
    const outflow = weekTransactions.filter(transaction => transaction.amount < 0).reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
    const net = inflow - outflow;
    runningBalance += net;
    rows.push({ weekStart: formatDate(start), weekEnd: formatDate(new Date(end.getTime() - 86400000)), inflow, outflow, net, endingBalance: runningBalance, movementCount: weekTransactions.length, kind: "actual" as const });
  }
  return { weeks: rows, openingBalanceAtHistoryStart: rows.length ? rows[0].endingBalance - rows[0].net : null, weeksWithMovements: rows.filter(row => row.movementCount > 0).length };
}

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId");
  const weeksInput = Number(request.nextUrl.searchParams.get("weeks") || 13);
  const weeks = Number.isInteger(weeksInput) ? Math.max(1, Math.min(26, weeksInput)) : 13;
  const account = accountId
    ? await prisma.account.findUnique({ where: { id: accountId } })
    : await prisma.account.findFirst({ where: { status: "active" }, orderBy: { createdAt: "asc" } });

  if (!account) return NextResponse.json({ error: "Nessun conto configurato", needsAccount: true }, { status: 404 });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentWeek = mondayOf(today);
  const forecastEnd = new Date(currentWeek);
  forecastEnd.setDate(forecastEnd.getDate() + weeks * 7);
  const movementWhere: any = { accountId: account.id };
  if (account.openingBalanceConfirmed && account.openingBalanceDate) movementWhere.date = { gte: dayAfter(new Date(account.openingBalanceDate)) };

  const [transactions, schedules, accountList] = await Promise.all([
    prisma.cashTransaction.findMany({ where: movementWhere, orderBy: { date: "asc" }, select: { date: true, amount: true } }),
    prisma.paymentSchedule.findMany({ where: { clientId: account.clientId, status: "open", nextDueDate: { lt: forecastEnd } }, include: { category: true, account: { select: { id: true, name: true } } }, orderBy: { nextDueDate: "asc" } }),
    prisma.account.findMany({ where: { clientId: account.clientId, status: "active" }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true, currency: true, openingBalance: true, openingBalanceDate: true, openingBalanceConfirmed: true, minimumBalance: true } }),
  ]);

  const movementBalance = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const balance = account.openingBalance + movementBalance;
  const accountSchedules = schedules.filter(schedule => schedule.accountId === account.id);
  const unassignedSchedules = schedules.filter(schedule => !schedule.accountId);
  const occurrences = accountSchedules.flatMap(schedule => expandSchedule(schedule, currentWeek, forecastEnd, today));
  const scheduledItems = occurrences.map(item => ({ dueDate: item.dueDate, amount: item.amount, type: item.type as "payment" | "income", probability: item.probability }));
  const riskThreshold = account.openingBalanceConfirmed ? account.minimumBalance : Number.NEGATIVE_INFINITY;
  const forecast = generateForecast(balance, scheduledItems, weeks, riskThreshold, now);
  const runway = !account.openingBalanceConfirmed ? null : balance <= account.minimumBalance ? 0 : calculateRunway(forecast);
  const history = summarizeHistory(transactions, account, 13, today);
  const actualOutflows90d = transactions.filter(transaction => transaction.date >= new Date(today.getTime() - 90 * 86400000) && transaction.amount < 0).reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const actualInflows90d = transactions.filter(transaction => transaction.date >= new Date(today.getTime() - 90 * 86400000) && transaction.amount > 0).reduce((sum, transaction) => sum + transaction.amount, 0);
  const upcoming = occurrences.filter(item => item.dueDate >= today).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const overdue = accountSchedules.filter(schedule => schedule.recurrence === "none" && schedule.status === "open" && schedule.dueDate < today);
  const projectedInflows = forecast.reduce((sum, week) => sum + week.inflow, 0);
  const projectedOutflows = forecast.reduce((sum, week) => sum + week.outflow, 0);
  const actualCount90d = transactions.filter(transaction => transaction.date >= new Date(today.getTime() - 90 * 86400000)).length;

  const alerts = [];
  if (!account.openingBalanceConfirmed) alerts.push({ type: "setup", severity: "warning", message: "Conferma il saldo iniziale con data di riferimento per rendere affidabile la proiezione." });
  if (overdue.length > 0) alerts.push({ type: "overdue", severity: "critical", message: `${overdue.length} scadenze aperte risultano scadute (${Math.round(overdue.reduce((sum, item) => sum + item.amount, 0)).toLocaleString("it-IT")} €).` });
  if (unassignedSchedules.length > 0) alerts.push({ type: "unassigned_schedule", severity: "warning", message: `${unassignedSchedules.length} scadenze non sono associate a un conto e non entrano nella proiezione.` });
  if (forecast.some(week => week.atRisk)) alerts.push({ type: "minimum_balance", severity: "critical", message: `Il saldo previsto scende sotto la soglia minima di ${account.minimumBalance.toLocaleString("it-IT")} €.` });
  if (actualCount90d === 0) alerts.push({ type: "no_actuals", severity: "info", message: "Nessun movimento bancario registrato negli ultimi 90 giorni: la proiezione usa solo scadenze programmate." });
  if (upcoming.length === 0) alerts.push({ type: "no_schedules", severity: "info", message: "Nessun incasso o pagamento programmato nell’orizzonte del forecast." });

  return NextResponse.json({
    account: { id: account.id, name: account.name, type: account.type, currency: account.currency, openingBalance: account.openingBalance, openingBalanceDate: account.openingBalanceDate, openingBalanceConfirmed: account.openingBalanceConfirmed, minimumBalance: account.minimumBalance, movementBalance, balance },
    accounts: accountList,
    weeks,
    asOf: formatDate(today),
    forecastMethod: "Scadenze aperte ponderate per probabilità; nessun flusso settimanale ipotizzato senza storico o budget configurato.",
    forecast,
    history: history.weeks,
    historySummary: { weeksWithMovements: history.weeksWithMovements, actualInflows90d, actualOutflows90d, movementCount90d: actualCount90d },
    runway,
    atRiskWeeks: forecast.filter(week => week.atRisk).length,
    planned: { inflows: projectedInflows, outflows: projectedOutflows, net: projectedInflows - projectedOutflows, eventCount: occurrences.length },
    upcoming,
    overdue,
    unassignedSchedules: unassignedSchedules.map(schedule => ({ id: schedule.id, description: schedule.description, amount: schedule.amount, type: schedule.type, dueDate: schedule.nextDueDate, recurrence: schedule.recurrence })),
    alerts,
  });
}
