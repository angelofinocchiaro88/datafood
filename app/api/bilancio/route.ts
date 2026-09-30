import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Lo stato patrimoniale mostra saldi operativi disponibili; non inventa
// debiti, imposte o patrimonio netto se non sono riconciliati.
export async function GET() {
  const [assets, ingredients, approvedInvoices, issuedInvoices, cashTransactions] = await Promise.all([
    prisma.asset.findMany({ where: { clientId: "default", stato: "attivo" } }),
    prisma.ingredient.findMany({ where: { clientId: "default" }, select: { currentStock: true, unitPrice: true } }),
    prisma.invoice.findMany({ where: { clientId: "default", status: { in: ["RECEIVED", "PROCESSED"] } }, select: { totalAmount: true, taxAmount: true } }),
    prisma.fatturaEmessa.findMany({ where: { clientId: "default", stato: "EMESSA" }, select: { importo: true, iva: true } }),
    prisma.cashTransaction.findMany({ where: { clientId: "default" }, select: { amount: true } }),
  ]);

  const immobilizzazioniLorde = assets.reduce((sum, asset) => sum + asset.costoStorico, 0);
  const fondoAmmortamento = assets.reduce((sum, asset) => {
    const monthsInService = Math.max(0, (Date.now() - new Date(asset.dataEntrataFunzione).getTime()) / (30 * 86400000));
    return sum + Math.min(asset.costoStorico, asset.fondoAmmIniziale + asset.quotaMensile * monthsInService);
  }, 0);
  const immobilizzazioniNette = immobilizzazioniLorde - fondoAmmortamento;
  const valoreMagazzino = ingredients.reduce((sum, ingredient) => sum + ingredient.currentStock * ingredient.unitPrice, 0);
  const creditiClienti = issuedInvoices.reduce((sum, invoice) => sum + invoice.importo + invoice.iva, 0);
  const liquidita = cashTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const totaleAttivoConosciuto = immobilizzazioniNette + valoreMagazzino + creditiClienti + liquidita;
  const fattureFornitoriDaRiconciliare = approvedInvoices.reduce((sum, invoice) => sum + invoice.totalAmount + invoice.taxAmount, 0);

  return NextResponse.json({
    contoEconomico: null,
    statoPatrimoniale: {
      immobilizzazioniLorde,
      fondoAmmortamento,
      immobilizzazioniNette,
      valoreMagazzino,
      creditiClienti,
      liquidita,
      totaleAttivo: totaleAttivoConosciuto,
      fattureFornitoriDaRiconciliare,
      debitiFornitori: null,
      fondoTRF: null,
      debitiTributari: null,
      totaleDebiti: null,
      patrimonioNetto: null,
      totalePassivo: null,
    },
    dataQuality: {
      assetsCount: assets.length,
      inventoryItemsCount: ingredients.length,
      approvedSupplierInvoicesCount: approvedInvoices.length,
      issuedInvoicesToReconcileCount: issuedInvoices.length,
      cashTransactionsCount: cashTransactions.length,
      liabilitiesReconciled: false,
    },
  });
}
