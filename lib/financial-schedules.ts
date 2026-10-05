import { prisma } from "@/lib/db";

export async function syncSupplierInvoiceSchedule(invoice: {
  id: string; clientId: string; invoiceNumber: string; senderName: string; totalAmount: number; dueDate: Date | null; status: string; paymentStatus: string;
}) {
  const key = { clientId: invoice.clientId, sourceType: "supplier_invoice", sourceId: invoice.id };
  const eligible = ["RECEIVED", "PROCESSED"].includes(invoice.status) && invoice.dueDate && invoice.totalAmount > 0;
  if (!eligible) {
    await prisma.paymentSchedule.updateMany({ where: key, data: { status: "cancelled" } });
    return null;
  }
  const dueDate = invoice.dueDate!;
  return prisma.paymentSchedule.upsert({
    where: { clientId_sourceType_sourceId: key },
    create: {
      ...key,
      type: "payment",
      description: `Pagamento fattura ${invoice.invoiceNumber}`,
      counterparty: invoice.senderName,
      amount: invoice.totalAmount,
      dueDate,
      nextDueDate: dueDate,
      recurrence: "none",
      probability: 100,
      status: invoice.paymentStatus === "paid" ? "paid" : "open",
    },
    update: {
      description: `Pagamento fattura ${invoice.invoiceNumber}`,
      counterparty: invoice.senderName,
      amount: invoice.totalAmount,
      dueDate,
      nextDueDate: dueDate,
      status: invoice.paymentStatus === "paid" ? "paid" : "open",
    },
  });
}

export async function syncIssuedInvoiceSchedule(invoice: {
  id: string; clientId: string; numero: string; cliente: string; importo: number; iva: number; scadenza: Date | null; stato: string; paymentStatus: string;
}) {
  const key = { clientId: invoice.clientId, sourceType: "issued_invoice", sourceId: invoice.id };
  const eligible = invoice.stato !== "ANNULLATA" && invoice.scadenza && invoice.importo > 0;
  if (!eligible) {
    await prisma.paymentSchedule.updateMany({ where: key, data: { status: "cancelled" } });
    return null;
  }
  const dueDate = invoice.scadenza!;
  const grossAmount = invoice.importo * (1 + invoice.iva / 100);
  return prisma.paymentSchedule.upsert({
    where: { clientId_sourceType_sourceId: key },
    create: {
      ...key,
      type: "income",
      description: `Incasso fattura ${invoice.numero}`,
      counterparty: invoice.cliente,
      amount: grossAmount,
      dueDate,
      nextDueDate: dueDate,
      recurrence: "none",
      probability: 100,
      status: invoice.paymentStatus === "paid" ? "paid" : "open",
    },
    update: {
      description: `Incasso fattura ${invoice.numero}`,
      counterparty: invoice.cliente,
      amount: grossAmount,
      dueDate,
      nextDueDate: dueDate,
      status: invoice.paymentStatus === "paid" ? "paid" : "open",
    },
  });
}
