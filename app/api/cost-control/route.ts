import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calcolaCostoPersona } from "@/lib/payroll";
import { calculateRecipeCost } from "@/lib/recipe-cost";
import { calcRicavoNettoRiga } from "@/lib/metrics";

export const dynamic = "force-dynamic";

// API aggregata Cost Control: unisce P&L, indicatori operativi, budget, fornitori, scadenze
export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period") || "trimestre";

  const [sales, client, schedules, suppliers, invoices, assets, dipendenti, cashTx, forecastRules] = await Promise.all([
    prisma.sale.findMany({ include: { items: { include: { dish: { include: { category: true, recipes: { include: { ingredient: true } } } } } } } }),
    prisma.client.findFirst({ where: { id: "default" } }),
    prisma.paymentSchedule.findMany({ where: { status: "open" }, orderBy: { dueDate: "asc" }, include: { category: true } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.invoice.findMany({ where: { status: "RECEIVED" } }),
    prisma.asset.findMany(),
    prisma.dipendente.findMany({ include: { contratti: true } }),
    prisma.cashTransaction.findMany(),
    prisma.forecastRule.findMany(),
  ]);

  // ─── RICAVI E COSTI ───
  let foodRev = 0, bevRev = 0, foodCost = 0, bevCost = 0, coperti = 0, transazioni = sales.length;
  for (const s of sales) {
    coperti += s.coverCount;
    for (const item of s.items) {
      const isBev = item.dish?.category?.name === "Bevande";
      const c = item.dish ? (calculateRecipeCost(item.dish).costPerPortion || 0) * item.quantity : 0;
      const ricavoNetto = calcRicavoNettoRiga(item.totalPrice, item.vatRate);
      if (isBev) { bevRev += ricavoNetto; bevCost += c; }
      else { foodRev += ricavoNetto; foodCost += c; }
    }
  }

  const totalRev = foodRev + bevRev;
  const totMp = foodCost + bevCost;
  const margineLordo = totalRev - totMp;

  // Costo personale reale da modulo Personale (se dipendenti presenti) altrimenti stima
  let personale = 0;
  if (dipendenti.length > 0) {
    personale = dipendenti.reduce((sum, d) => {
      const c = d.contratti?.[0];
      if (!c?.retribuzioneLordaMensile) return sum;
      return sum + calcolaCostoPersona({ retribuzioneLorda: c.retribuzioneLordaMensile, mensilita: c.mensilita }).costoAziendaMensile * 3;
    }, 0);
  } else {
    personale = totalRev * 0.30;
  }
  const personaleStimato = dipendenti.length === 0;

  const costiFissi = {
    affitto: 40000 / 4,
    utenze: totalRev * 0.045,
    marketing: totalRev * 0.015,
    manutenzione: totalRev * 0.008,
  };
  const totFissi = Object.values(costiFissi).reduce((s, v) => s + v, 0);
  const costiOperativi = personale + totFissi;
  const ebitda = margineLordo - costiOperativi;
  const ammortamenti = assets.reduce((s, a) => s + a.quotaAnnua, 0) / 4;
  const ebit = ebitda - ammortamenti;
  const oneriFinanziari = 3000 / 4;
  const utileNetto = ebit - oneriFinanziari;

  // ─── INDICATORI OPERATIVI (stile Tomato AI) ───
  const giorni = 90;
  const oreServizio = giorni * 8;
  const ricavoMedioCoperto = coperti > 0 ? totalRev / coperti : 0;
  const costoPasto = totMp / Math.max(1, coperti);
  const costoPastoPrimo = (totMp + personale) / Math.max(1, coperti);
  const produttivitaOraria = totalRev / oreServizio;
  const incidenzaPersonale = totalRev > 0 ? (personale / totalRev) * 100 : 0;
  const scontrinoMedio = transazioni > 0 ? totalRev / transazioni : 0;
  const copertiOra = coperti / oreServizio;

  const foodCostPct = foodRev > 0 ? (foodCost / foodRev) * 100 : 0;
  const beverageCostPct = bevRev > 0 ? (bevCost / bevRev) * 100 : 0;
  const laborPct = totalRev > 0 ? (personale / totalRev) * 100 : 0;
  const primeCostPct = totalRev > 0 ? ((totMp + personale) / totalRev) * 100 : 0;
  const ebitdaPct = totalRev > 0 ? (ebitda / totalRev) * 100 : 0;

  // ─── LIQUIDITÀ ───
  const liquidita = cashTx.reduce((s, t) => s + t.amount, 0);

  // ─── PROSSIME SCADENZE ───
  const prossimeUscite30 = schedules.filter(s => s.type === "payment" && new Date(s.dueDate) <= new Date(Date.now() + 30 * 86400000)).reduce((s, x) => s + x.amount, 0);
  const prossimiIncassi30 = schedules.filter(s => s.type === "income" && new Date(s.dueDate) <= new Date(Date.now() + 30 * 86400000)).reduce((s, x) => s + x.amount, 0);

  // ─── ALERT ───
  const alerts: any[] = [];
  if (foodCostPct > 33) alerts.push({ level: "critico", msg: `Food cost ${foodCostPct.toFixed(1)}% sopra target 30%`, type: "food_cost" });
  if (laborPct > 32) alerts.push({ level: "critico", msg: `Personale ${laborPct.toFixed(1)}% sopra target 30%`, type: "labor" });
  if (primeCostPct > 60) alerts.push({ level: "attenzione", msg: `Prime cost ${primeCostPct.toFixed(1)}% sopra target 60%`, type: "prime" });
  const scadenzaGrossa = schedules.find(s => s.type === "payment" && s.amount > 5000);
  if (scadenzaGrossa) alerts.push({ level: "attenzione", msg: `Scadenza €${Math.round(scadenzaGrossa.amount).toLocaleString("it-IT")}: ${scadenzaGrossa.description}`, type: "scadenza" });

  // ─── MONITORAGGIO FORNITORI (prezzi) ───
  const fornitoriMonitor = suppliers.map(s => {
    const sInvoices = invoices.filter(i => i.supplierId === s.id);
    const totale = sInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
    return { id: s.id, name: s.name, fatture: sInvoices.length, totale: Math.round(totale) };
  }).sort((a, b) => b.totale - a.totale);

  return NextResponse.json({
    period,
    restaurantName: client?.name || "Ristorante",
    pnl: {
      ricavi: Math.round(totalRev),
      food_sala: Math.round(foodRev),
      bev_sala: Math.round(bevRev),
      food_cost: Math.round(foodCost),
      bev_cost: Math.round(bevCost),
      tot_materie: Math.round(totMp),
      margine_lordo: Math.round(margineLordo),
      personale: Math.round(personale),
      costi_fissi: Math.round(totFissi),
      ebitda: Math.round(ebitda),
      ammortamenti: Math.round(ammortamenti),
      ebit: Math.round(ebit),
      utile_netto: Math.round(utileNetto),
    },
    indicatori: {
      ricavoMedioCoperto: Math.round(ricavoMedioCoperto * 100) / 100,
      costoPasto: Math.round(costoPasto * 100) / 100,
      costoPastoPrimo: Math.round(costoPastoPrimo * 100) / 100,
      produttivitaOraria: Math.round(produttivitaOraria),
      incidenzaPersonale: Math.round(incidenzaPersonale * 10) / 10,
      scontrinoMedio: Math.round(scontrinoMedio * 100) / 100,
      copertiOra: Math.round(copertiOra * 10) / 10,
      foodCostPct: Math.round(foodCostPct * 10) / 10,
      beverageCostPct: Math.round(beverageCostPct * 10) / 10,
      laborPct: Math.round(laborPct * 10) / 10,
      primeCostPct: Math.round(primeCostPct * 10) / 10,
      ebitdaPct: Math.round(ebitdaPct * 10) / 10,
      coperti,
      transazioni,
      personaleStimato,
    },
    liquidita: Math.round(liquidita),
    prossimeUscite30: Math.round(prossimeUscite30),
    prossimiIncassi30: Math.round(prossimiIncassi30),
    alerts,
    fornitori: fornitoriMonitor,
    scadenze: schedules.slice(0, 8),
    forecastRules: forecastRules.length,
  });
}
