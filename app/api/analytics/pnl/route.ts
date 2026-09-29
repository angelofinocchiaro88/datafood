import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const q1Start = new Date(2026, 0, 1);
  const q1End = new Date(2026, 2, 31);
  const sales = await prisma.sale.findMany({
    where: { date: { gte: q1Start, lte: q1End } },
    include: { items: { include: { dish: { include: { category: true, recipes: { include: { ingredient: true } } } } } } },
  });

  // Revenue calculation
  let food_sala = 0, bev_sala = 0, foodCost = 0, bevCost = 0, coperti = 0;
  const foodDetail: Record<string, number> = { carni: 0, pesce: 0, verdure: 0, latticini: 0, pasta: 0, pane: 0, dessert: 0, condimenti: 0, altri: 0 };
  const bevDetail: Record<string, number> = { acqua: 0, vini: 0, birre: 0, spirits: 0, caffe: 0 };

  const classifyIngredient = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes("manzo") || n.includes("vitello") || n.includes("scottona") || n.includes("pollo") || n.includes("guanciale")) return "carni";
    if (n.includes("branzino") || n.includes("pesce") || n.includes("gamber")) return "pesce";
    if (n.includes("cipolla") || n.includes("limon") || n.includes("patat") || n.includes("pomodoro") || n.includes("rosmarino") || n.includes("aglio") || n.includes("porcini")) return "verdure";
    if (n.includes("parmigiano") || n.includes("pecorino") || n.includes("mascarpone") || n.includes("burro") || n.includes("uova") || n.includes("tuorlo")) return "latticini";
    if (n.includes("riso") || n.includes("spaghetti") || n.includes("pasta") || n.includes("farina") || n.includes("savoiardi")) return "pasta";
    if (n.includes("pane")) return "pane";
    if (n.includes("cacao") || n.includes("zucchero") || n.includes("caffe") || n.includes("marsala") || n.includes("vanillina")) return "dessert";
    if (n.includes("olio") || n.includes("sale") || n.includes("pepe") || n.includes("brodo") || n.includes("vino")) return "condimenti";
    return "altri";
  };

  const classifyBev = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes("acqua") || n.includes("coca") || n.includes("cola")) return "acqua";
    if (n.includes("vino")) return "vini";
    if (n.includes("birra")) return "birre";
    if (n.includes("spirit") || n.includes("gin") || n.includes("vodka")) return "spirits";
    if (n.includes("caffe") || n.includes("caffè")) return "caffe";
    return "altri";
  };

  for (const s of sales) {
    coperti += s.coverCount;
    for (const item of s.items) {
      const isBev = item.dish?.category?.name === "Bevande";
      const costo = item.dish ? item.dish.recipes.reduce((sum, r) => sum + r.ingredient.unitPrice * r.quantity, 0) * item.quantity : 0;
      
      if (isBev) {
        bev_sala += item.totalPrice;
        bevCost += costo;
        for (const r of item.dish?.recipes || []) {
          const cat = classifyBev(r.ingredient.name);
          bevDetail[cat] = (bevDetail[cat] || 0) + r.ingredient.unitPrice * r.quantity * item.quantity;
        }
      } else {
        food_sala += item.totalPrice;
        foodCost += costo;
        for (const r of item.dish?.recipes || []) {
          const cat = classifyIngredient(r.ingredient.name);
          foodDetail[cat] = (foodDetail[cat] || 0) + r.ingredient.unitPrice * r.quantity * item.quantity;
        }
      }
    }
  }

  const totalRev = food_sala + bev_sala;
  const cogsTotal = foodCost + bevCost;
  const margineLordo = totalRev - cogsTotal;

  // Personnel (estimated 30% of revenue)
  const personaleTotal = totalRev * 0.30;
  const personale = { cucina: personaleTotal * 0.45, sala: personaleTotal * 0.30, bar: personaleTotal * 0.10, delivery: 0, oneri: personaleTotal * 0.12, interinale: 0, accessori: personaleTotal * 0.03, total: personaleTotal };
  
  const primeCost = cogsTotal + personaleTotal;

  // Operating costs
  const operativi = {
    delivery_comm: 0, marketing: totalRev * 0.015, software: totalRev * 0.005,
    consulenze: totalRev * 0.01, pulizia: totalRev * 0.008, materiali: totalRev * 0.005,
    lavanderia: totalRev * 0.003, manutenzioni: totalRev * 0.007, utenze: totalRev * 0.045, attrezzature: totalRev * 0.003,
    total: totalRev * 0.101,
  };

  // Structure costs
  const struttura = {
    affitto: 40000 / 4, condominio: 2000 / 4, assicurazioni: 3000 / 4,
    amministrative: totalRev * 0.01, tributi: totalRev * 0.005,
    vigilanza: 1500 / 4, generali: totalRev * 0.008,
    total: (40000/4) + (2000/4) + (3000/4) + (totalRev * 0.01) + (totalRev * 0.005) + (1500/4) + (totalRev * 0.008),
  };

  const ebitda = totalRev - cogsTotal - personaleTotal - operativi.total - struttura.total;
  const ammortamenti = 10000 / 4;
  const ebit = ebitda - ammortamenti;
  const finanziaria = { oneri: 3000 / 4, straordinari: 0, total: 3000 / 4 };
  const utileAnteImposte = ebit - finanziaria.total;
  const imposte = utileAnteImposte * 0.28;
  const utileNetto = utileAnteImposte - imposte;

  // Correct margine_reparto
  const margineRepartoVal = totalRev - cogsTotal - personaleTotal - operativi.total;

  return NextResponse.json({
    ricavi: { food_sala, bev_sala, delivery: 0, takeaway: 0, eventi: 0, altri: 0, total: totalRev },
    cogs: { food: foodCost, bev: bevCost, packaging: 0, total: cogsTotal, food_detail: foodDetail, bev_detail: bevDetail },
    margine_lordo: margineLordo,
    personale,
    prime_cost: primeCost,
    operativi,
    margine_reparto: margineRepartoVal,
    struttura,
    ebitda,
    ammortamenti,
    ebit,
    finanziaria,
    utile_ante_imposte: utileAnteImposte,
    imposte,
    utile_netto: utileNetto,
    coperti,
  });
}