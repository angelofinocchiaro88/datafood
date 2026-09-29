import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calcolaCostoPersona } from "@/lib/payroll";

export const dynamic = "force-dynamic";

// Calcola Conto Economico riclassificato + Stato Patrimoniale da tutte le fonti collegate
export async function GET() {
  const q1Start = new Date(2026, 0, 1);
  const q1End = new Date(2026, 2, 31);

  const [sales, invoices, fattureEmesse, assets, dipendenti, account, cashTx] = await Promise.all([
    prisma.sale.findMany({ where: { date: { gte: q1Start, lte: q1End } }, include: { items: { include: { dish: { include: { category: true, recipes: { include: { ingredient: true } } } } } } } }),
    prisma.invoice.findMany({ where: { status: "RECEIVED" }, include: { supplier: true } }),
    prisma.fatturaEmessa.findMany(),
    prisma.asset.findMany(),
    prisma.dipendente.findMany({ include: { contratti: true } }),
    prisma.account.findFirst(),
    prisma.cashTransaction.findMany(),
  ]);

  // ─── CONTO ECONOMICO ───
  let foodRev = 0, bevRev = 0, foodCost = 0, bevCost = 0;
  for (const s of sales) {
    for (const item of s.items) {
      const isBev = item.dish?.category?.name === "Bevande";
      const c = item.dish ? item.dish.recipes.reduce((sum, r) => sum + r.ingredient.unitPrice * r.quantity, 0) * item.quantity : 0;
      if (isBev) { bevRev += item.totalPrice; bevCost += c; }
      else { foodRev += item.totalPrice; foodCost += c; }
    }
  }

  const ricaviVendite = foodRev + bevRev;
  const ricaviCatering = fattureEmesse.reduce((s, f) => s + f.importo, 0);
  const ricaviTotali = ricaviVendite + ricaviCatering;

  // Costi per natura
  const costiMateriePrime = foodCost + bevCost;
  const costiPersonale = dipendenti.reduce((sum, d) => {
    const c = d.contratti?.[0];
    if (!c?.retribuzioneLordaMensile) return sum;
    const calc = calcolaCostoPersona({ retribuzioneLorda: c.retribuzioneLordaMensile, mensilita: c.mensilita });
    return sum + calc.costoAziendaMensile * 3; // Q1 = 3 mesi
  }, 0);
  const costiServizi = ricaviTotali * 0.05; // utenze, manutenzioni, consulenze (stima)
  const costiGodimento = 40000 / 4; // affitto trimestrale
  const ammortamenti = assets.reduce((s, a) => s + a.quotaAnnua, 0) / 4;
  const oneriFinanziari = 3000 / 4;
  const imposte = 0; // da calcolare

  const valoreAggiunto = ricaviTotali - costiMateriePrime;
  const mol = valoreAggiunto - costiServizi - costiGodimento - costiPersonale;
  const ebit = mol - ammortamenti;
  const utileAnteImposte = ebit - oneriFinanziari;
  const utileNetto = utileAnteImposte - imposte;

  // ─── STATO PATRIMONIALE ───
  const immobilizzazioniLorde = assets.reduce((s, a) => s + a.costoStorico, 0);
  const fondoAmmortamento = assets.reduce((s, a) => {
    const mesi = Math.max(0, (Date.now() - new Date(a.dataEntrataFunzione).getTime()) / (30 * 86400000));
    return s + Math.min(a.costoStorico, a.fondoAmmIniziale + a.quotaMensile * mesi);
  }, 0);
  const immobilizzazioniNette = immobilizzazioniLorde - fondoAmmortamento;

  const rimanenzeMagazzino = await prisma.ingredient.findMany();
  const valoreMagazzino = rimanenzeMagazzino.reduce((s, i) => s + i.currentStock * i.unitPrice, 0);

  const creditiClienti = fattureEmesse.filter(f => f.stato === "EMESSA").reduce((s, f) => s + f.importo * 1.22, 0);
  const liquidita = cashTx.reduce((s, t) => s + t.amount, 0);

  const debitiFornitori = invoices.reduce((s, i) => s + i.totalAmount + i.taxAmount, 0);
  const fondoTRF = costiPersonale * 0.0741;
  const debitiTributari = ricaviTotali * 0.10;

  const attivo = immobilizzazioniNette + valoreMagazzino + creditiClienti + liquidita;
  const passivoDebiti = debitiFornitori + fondoTRF + debitiTributari;
  const patrimonioNetto = attivo - passivoDebiti;

  return NextResponse.json({
    contoEconomico: {
      ricaviVendite: Math.round(ricaviVendite),
      ricaviCatering: Math.round(ricaviCatering),
      ricaviTotali: Math.round(ricaviTotali),
      costiMateriePrime: Math.round(costiMateriePrime),
      valoreAggiunto: Math.round(valoreAggiunto),
      costiServizi: Math.round(costiServizi),
      costiGodimento: Math.round(costiGodimento),
      costiPersonale: Math.round(costiPersonale),
      mol: Math.round(mol),
      ammortamenti: Math.round(ammortamenti),
      ebit: Math.round(ebit),
      oneriFinanziari: Math.round(oneriFinanziari),
      utileAnteImposte: Math.round(utileAnteImposte),
      imposte: Math.round(imposte),
      utileNetto: Math.round(utileNetto),
      // Dettaglio food/bev
      foodRev: Math.round(foodRev),
      bevRev: Math.round(bevRev),
      foodCost: Math.round(foodCost),
      bevCost: Math.round(bevCost),
    },
    statoPatrimoniale: {
      immobilizzazioniLorde: Math.round(immobilizzazioniLorde),
      fondoAmmortamento: Math.round(fondoAmmortamento),
      immobilizzazioniNette: Math.round(immobilizzazioniNette),
      valoreMagazzino: Math.round(valoreMagazzino),
      creditiClienti: Math.round(creditiClienti),
      liquidita: Math.round(liquidita),
      totaleAttivo: Math.round(attivo),
      debitiFornitori: Math.round(debitiFornitori),
      fondoTRF: Math.round(fondoTRF),
      debitiTributari: Math.round(debitiTributari),
      totaleDebiti: Math.round(passivoDebiti),
      patrimonioNetto: Math.round(patrimonioNetto),
      totalePassivo: Math.round(passivoDebiti + patrimonioNetto),
    },
  });
}
