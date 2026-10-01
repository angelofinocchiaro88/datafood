import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nextRecurrenceDate } from "@/lib/cashflow";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const data = await request.json();
  if (data.action === "assign") {
    const account = await prisma.account.findUnique({ where: { id: data.accountId }, select: { id: true, clientId: true } });
    if (!account) return NextResponse.json({ error: "Conto non trovato" }, { status: 404 });
    const schedule = await prisma.paymentSchedule.update({ where: { id: params.id }, data: { accountId: account.id, clientId: account.clientId }, include: { account: true, category: true } });
    return NextResponse.json({ schedule });
  }
  if (data.action === "settle") {
    if (!data.accountId) return NextResponse.json({ error: "Seleziona il conto su cui registrare il movimento" }, { status: 400 });
    const transactionDate = data.actualDate ? new Date(data.actualDate) : new Date();
    if (Number.isNaN(transactionDate.getTime())) return NextResponse.json({ error: "Data movimento non valida" }, { status: 400 });

    try {
      const result = await prisma.$transaction(async tx => {
        const lock = await tx.paymentSchedule.updateMany({ where: { id: params.id, status: "open" }, data: { status: "PROCESSING" } });
        if (lock.count !== 1) throw new Error("SCADENZA_NON_APERTA");
        const schedule = await tx.paymentSchedule.findUnique({ where: { id: params.id }, include: { category: true } });
        if (!schedule) throw new Error("SCADENZA_NON_TROVATA");
        if (schedule.accountId && schedule.accountId !== data.accountId) throw new Error("CONTO_DIVERSO_DA_SCADENZA");
        const account = await tx.account.findUnique({ where: { id: schedule.accountId || data.accountId } });
        if (!account) throw new Error("CONTO_NON_TROVATO");

        const scheduledDate = schedule.recurrence === "none" ? schedule.dueDate : schedule.nextDueDate;
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (scheduledDate > today && data.allowEarly !== true) throw new Error("SCADENZA_NON_ANCORA_DOVUTA");

        const amount = schedule.type === "payment" ? -Math.abs(schedule.amount) : Math.abs(schedule.amount);
        const transaction = await tx.cashTransaction.create({
          data: {
            accountId: account.id,
            clientId: account.clientId,
            date: transactionDate,
            amount,
            currency: schedule.currency || account.currency,
            description: schedule.description,
            counterparty: schedule.counterparty,
            categoryId: schedule.categoryId,
            source: "schedule",
            isReconciled: true,
          },
        });

        if (schedule.recurrence === "none") {
          await tx.paymentSchedule.update({ where: { id: schedule.id }, data: { accountId: account.id, status: "paid", linkedTransactionId: transaction.id } });
        } else {
          const nextDate = nextRecurrenceDate(schedule.nextDueDate, schedule.recurrence);
          await tx.paymentSchedule.update({ where: { id: schedule.id }, data: { accountId: account.id, status: "open", dueDate: nextDate, nextDueDate: nextDate, linkedTransactionId: transaction.id } });
        }
        return { transaction, recurrence: schedule.recurrence };
      });
      return NextResponse.json({ success: true, transaction: result.transaction, message: result.recurrence === "none" ? "Movimento registrato e scadenza chiusa" : "Movimento registrato; prossima ricorrenza aggiornata" });
    } catch (error) {
      const code = error instanceof Error ? error.message : "ERRORE";
      const messages: Record<string, string> = {
        SCADENZA_NON_APERTA: "Scadenza già chiusa o in elaborazione",
        SCADENZA_NON_TROVATA: "Scadenza non trovata",
        CONTO_NON_TROVATO: "Conto non trovato",
        CONTO_DIVERSO_DA_SCADENZA: "La scadenza è già associata a un conto diverso",
        SCADENZA_NON_ANCORA_DOVUTA: "La data prevista è futura. Conferma prima la data effettiva o autorizza il pagamento anticipato.",
      };
      const status = code === "SCADENZA_NON_TROVATA" ? 404 : code === "SCADENZA_NON_ANCORA_DOVUTA" || code === "SCADENZA_NON_APERTA" ? 409 : 400;
      return NextResponse.json({ error: messages[code] || "Impossibile registrare il movimento" }, { status });
    }
  }

  if (data.dueDate) data.dueDate = new Date(data.dueDate);
  if (data.nextDueDate) data.nextDueDate = new Date(data.nextDueDate);
  const schedule = await prisma.paymentSchedule.update({ where: { id: params.id }, data });
  return NextResponse.json(schedule);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.paymentSchedule.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
