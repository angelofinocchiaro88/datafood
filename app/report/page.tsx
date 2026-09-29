import { prisma } from "@/lib/db";
import { calculateRecipeCost } from "@/lib/recipe-cost";
import { calcRicavoNettoRiga } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const KPI = {
  food_cost_pct:    { name: "Food Cost %",   fmt: "(cogs_food / food_sales) × 100",    calc: (f: any) => f.foodRev > 0 ? (f.foodCost / f.foodRev * 100).toFixed(1) : "-" },
  beverage_cost_pct:{ name: "Beverage Cost %", fmt: "(cogs_bev / bev_sales) × 100",    calc: (f: any) => f.bevRev > 0 ? (f.bevCost / f.bevRev * 100).toFixed(1) : "-" },
  cogs_pct:         { name: "COGS %",        fmt: "(cogs_tot / total_sales) × 100",    calc: (f: any) => f.totRev > 0 ? (f.totMp / f.totRev * 100).toFixed(1) : "-" },
  labor_cost_pct:   { name: "Labor Cost %",  fmt: "(labor / total_sales) × 100",       calc: (f: any) => f.totRev > 0 ? (f.pers / f.totRev * 100).toFixed(1) : "-" },
  prime_cost_pct:   { name: "Prime Cost %",  fmt: "((cogs+labor) / total_sales) × 100",calc: (f: any) => f.totRev > 0 ? (((f.totMp + f.pers) / f.totRev) * 100).toFixed(1) : "-" },
  gross_profit_pct: { name: "Margine Lordo %", fmt: "((sales - cogs) / sales) × 100",  calc: (f: any) => f.totRev > 0 ? ((f.totRev - f.totMp) / f.totRev * 100).toFixed(1) : "-" },
  contrib_margin_pct:{ name: "Contrib. Margin %",fmt:"((sales-cogs-labor)/sales) × 100",calc:(f:any)=>f.totRev>0?((f.totRev-f.totMp-f.pers)/f.totRev*100).toFixed(1):"-" },
  sales_per_cover:  { name: "Sales per Cover", fmt: "total_sales / covers",            calc: (f: any) => f.cop > 0 ? (f.totRev / f.cop).toFixed(2) : "-" },
  ebitda_margin_pct:{ name: "EBITDA Margin %", fmt: "(ebitda / total_sales) × 100",    calc: (f: any) => f.totRev > 0 ? (f.ebitda / f.totRev * 100).toFixed(1) : "-" },
  revpash:          { name: "RevPASH",        fmt: "sales / (seats × hours)",           calc: (f: any) => f.seats > 0 ? (f.totRev / (f.seats * 180)).toFixed(2) : "-" },
  table_turnover:   { name: "Turnover Tavoli", fmt: "covers / tables",                  calc: (f: any) => f.tables > 0 ? (f.cop / f.tables).toFixed(2) : "-" },
  sales_per_labor:  { name: "Sales/Labor €",  fmt: "total_sales / labor_cost",          calc: (f: any) => f.pers > 0 ? (f.totRev / f.pers).toFixed(2) : "-" },
  covers_per_hour:  { name: "Covers/Hour",    fmt: "covers / service_hours",            calc: (f: any) => f.cop > 0 ? (f.cop / 180).toFixed(1) : "-" },
  food_sales_mix:   { name: "Food Mix %",     fmt: "(food_sales / total_sales) × 100",  calc: (f: any) => f.totRev > 0 ? (f.foodRev / f.totRev * 100).toFixed(1) : "-" },
  bev_sales_mix:    { name: "Beverage Mix %", fmt: "(bev_sales / total_sales) × 100",   calc: (f: any) => f.totRev > 0 ? (f.bevRev / f.totRev * 100).toFixed(1) : "-" },
};

export default async function KpiPanel() {
  const q1Start = new Date(2026, 0, 1);
  const q1End = new Date(2026, 2, 31);
  const sales = await prisma.sale.findMany({
    where: { date: { gte: q1Start, lte: q1End } },
    include: { items: { include: { dish: { include: { category: true, recipes: { include: { ingredient: true } } } } } } },
  });

  let foodRev = 0, bevRev = 0, foodCost = 0, bevCost = 0, coperti = 0, scontrini = sales.length;

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

  const totRev = foodRev + bevRev;
  const totMp = foodCost + bevCost;
  const pers = totRev * 0.30;
  const overhead = 40000 / 4 + totRev * 0.06;
  const ebitda = totRev - totMp - pers - overhead;

  const figures = { foodRev, bevRev, totRev, foodCost, bevCost, totMp, pers, cop: coperti, scontrini, ebitda, seats: 40, tables: 12 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-gray-900">KPI Panel</h1>
        <p className="text-gray-500 text-sm">Q1 2026 · Calcolati con KPI Registry ufficiale DATAFOOD</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Object.entries(KPI).map(([code, k]) => {
          const val = k.calc(figures);
          const n = parseFloat(val as string);
          const color = code.includes("cost") || code.includes("cogs") || code === "prime_cost_pct"
            ? (n > 35 ? "red" : n > 28 ? "amber" : "green")
            : code.includes("margin") || code.includes("profit")
            ? (n > 50 ? "green" : n > 30 ? "amber" : "red")
            : "blue";
          return (
            <div key={code} className="bg-white rounded-xl border border-gray-200 p-3 hover:shadow-sm transition-shadow">
              <p className="text-xs text-gray-500 mb-1">{k.name}</p>
              <p className={`text-lg font-bold ${
                color === "green" ? "text-green-700" : color === "red" ? "text-red-700" : color === "amber" ? "text-amber-700" : "text-blue-700"
              }`}>
                {typeof val === "string" && val !== "-" ? (code.includes("Cover") || code.includes("per") ? `€${val}` : `${val}%`) : val}
              </p>
              <p className="text-xs text-gray-400 mt-1 font-mono">{k.fmt}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold mb-3">Variabili Utilizzate (Q1 2026)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <VarBox label="total_sales_net" value={`€${Math.round(totRev).toLocaleString("it-IT")}`} />
          <VarBox label="food_sales_net" value={`€${Math.round(foodRev).toLocaleString("it-IT")}`} />
          <VarBox label="beverage_sales_net" value={`€${Math.round(bevRev).toLocaleString("it-IT")}`} />
          <VarBox label="cogs_food_used" value={`€${Math.round(foodCost).toLocaleString("it-IT")}`} />
          <VarBox label="cogs_beverage_used" value={`€${Math.round(bevCost).toLocaleString("it-IT")}`} />
          <VarBox label="cogs_total_used" value={`€${Math.round(totMp).toLocaleString("it-IT")}`} />
          <VarBox label="labor_cost_total" value={`€${Math.round(pers).toLocaleString("it-IT")}`} />
          <VarBox label="covers_served" value={coperti.toLocaleString()} />
          <VarBox label="receipts_count" value={scontrini.toLocaleString()} />
          <VarBox label="ebitda" value={`€${Math.round(ebitda).toLocaleString("it-IT")}`} />
          <VarBox label="available_seats" value="40" />
          <VarBox label="tables_available" value="12" />
          <VarBox label="service_hours" value="180" />
          <VarBox label="overhead_cost_total" value={`€${Math.round(overhead).toLocaleString("it-IT")}`} />
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>⚠️ Nota metodologica:</strong> COGS è calcolato da costo ricetta × quantità venduta (consumo reale da Food Cost).
        Personale è stimato al 30% dei ricavi (in attesa di modulo buste paga o fatture personale).
        Per dati precisi, inserire le fatture nel modulo Accounting.
      </div>
    </div>
  );
}

function VarBox({ label, value }: { label: string; value: string }) {
  return <div className="bg-gray-50 rounded-lg p-2"><p className="text-xs text-gray-400 font-mono mb-0.5">{label}</p><p className="font-medium">{value}</p></div>;
}
