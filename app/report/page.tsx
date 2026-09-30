"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, BarChart3, Database, Target } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { type PnlData, calcBeverageCostPct, calcEbitdaMargin, calcFoodCostPct, calcLaborCostPct, calcMargineLordoPct, calcPrimeCostPct, calcRicaviPerCoperto, calcScontrinoMedio } from "@/lib/metrics";

const PERIODS = [
  { key: "mese", label: "Mese" },
  { key: "trimestre", label: "Trimestre" },
  { key: "anno", label: "Anno" },
];

function euros(value: number | null | undefined, decimals = 0) {
  if (value == null || !Number.isFinite(value)) return "N/D";
  return `€ ${value.toLocaleString("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function percent(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "N/D" : `${value.toFixed(1)}%`;
}

function sourceLabel(source: string) {
  if (source === "consuntivo") return "Consuntivo";
  if (source === "misto") return "Misto";
  if (source === "stima") return "Stima";
  return "Non disponibile";
}

export default function KpiReportPage() {
  const [period, setPeriod] = useState("anno");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/cost-control?period=${period}`, { signal: controller.signal })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "Errore caricamento KPI"); setData(result); })
      .catch(reason => { if (reason.name !== "AbortError") setError(reason.message || "Errore caricamento KPI"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period]);

  if (loading && !data) return <div className="p-8 text-center text-slate-400">Caricamento KPI e fonti dati…</div>;
  if (!data) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error || "KPI non disponibili"}</div>;

  const k = data.kpi;
  const sources = data.sources;
  const pnl: PnlData = {
    ricavi: { food_sala: k.foodRevenue, bev_sala: k.beverageRevenue, delivery: 0, takeaway: 0, eventi: k.issuedRevenue, altri: 0, total: k.revenue },
    cogs: { food: k.theoreticalFoodCost, bev: k.theoreticalBeverageCost, packaging: 0, total: k.theoreticalCogs },
    margine_lordo: k.grossMargin,
    personale: { total: k.laborCost || 0, cucina: 0, sala: 0, bar: 0, delivery: 0, oneri: 0, interinale: 0, accessori: 0 },
    prime_cost: k.primeCost,
    operativi: { total: data.pnl.operatingInvoices },
    struttura: { total: 0 },
    ebitda: k.ebitdaEstimate || 0,
    ammortamenti: data.pnl.depreciationEstimate || 0,
    ebit: k.operatingResultEstimate || 0,
    utile_netto: 0,
    coperti: k.covers,
  };
  const posPnl: PnlData = { ...pnl, ricavi: { ...pnl.ricavi, total: k.posRevenue }, margine_lordo: k.posRevenue - k.theoreticalCogs };

  const kpis = [
    { code: "total_sales_net", label: "Ricavi netti", value: euros(k.revenue), formula: "Vendite POS nette + fatture emesse", detail: `${k.receipts} scontrini · ${euros(k.issuedRevenue)} eventi` },
    { code: "food_cost_pct", label: "Food Cost teorico", value: percent(calcFoodCostPct(pnl)), formula: "COGS food teorico / ricavi food netti", detail: `${percent(k.costCoveragePct)} copertura ricette`, target: data.budget.foodCostPct },
    { code: "beverage_cost_pct", label: "Beverage Cost teorico", value: percent(calcBeverageCostPct(pnl)), formula: "COGS beverage teorico / ricavi beverage netti", detail: "da ricette e vendite" },
    { code: "labor_cost_pct", label: "Labor Cost", value: percent(calcLaborCostPct(pnl)), formula: "Costo del personale / ricavi netti", detail: `fonte: ${k.laborCost > 0 ? sources.payroll.source : "non disponibile"}`, target: data.budget.laborCostPct },
    { code: "prime_cost_pct", label: "Prime Cost", value: percent(calcPrimeCostPct(pnl)), formula: "(COGS teorico + personale) / ricavi", detail: "costo industriale + lavoro" },
    { code: "gross_profit_pct", label: "Margine lordo teorico POS", value: percent(calcMargineLordoPct(posPnl)), formula: "(Ricavi POS − COGS teorico) / ricavi POS", detail: "non sostituisce inventario consuntivo" },
    { code: "sales_per_cover", label: "Ricavo per coperto", value: euros(calcRicaviPerCoperto(k.posRevenue, k.covers), 2), formula: "Ricavi POS netti / coperti", detail: `${k.covers.toLocaleString("it-IT")} coperti` },
    { code: "average_check", label: "Scontrino medio", value: euros(calcScontrinoMedio(k.posRevenue, k.receipts), 2), formula: "Ricavi POS netti / scontrini", detail: `${k.receipts} scontrini POS` },
    { code: "ebitda_margin_pct", label: "EBITDA gestionale", value: euros(k.ebitdaEstimate), formula: "Ricavi − COGS teorico − costo personale − costi fatturati", detail: `margine ${percent(calcEbitdaMargin(pnl))} · ${k.ebitdaQuality}` },
    { code: "contribution_margin", label: "Margine contribuzione", value: euros(k.primeCost == null ? null : k.revenue - k.theoreticalCogs - (k.laborCost || 0)), formula: "Ricavi − COGS teorico − personale", detail: "valore periodo" },
    { code: "revpash", label: "RevPASH", value: "N/D", formula: "Ricavi / (posti disponibili × ore servizio)", detail: "configura posti e ore di servizio" },
    { code: "table_turnover", label: "Turnover tavoli", value: "N/D", formula: "Coperti / tavoli disponibili", detail: "configura tavoli disponibili" },
  ];

  const trend = (data.trends || []).map((item: any) => ({ ...item, label: new Date(`${item.month}-15T12:00:00`).toLocaleDateString("it-IT", { month: "short" }) }));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">DATAFOOD · Registro KPI</p><h1 className="mt-1 text-2xl font-bold text-slate-900">KPI e diagnosi</h1><p className="mt-1 text-sm text-slate-500">{data.restaurantName} · {data.period.label} · {data.period.from} – {data.period.to}</p></div>
        <div className="flex items-center gap-2"><select value={period} onChange={event => setPeriod(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">{PERIODS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select><Link href="/controllo-gestione" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-emerald-400">Controllo completo →</Link></div>
      </header>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {loading && <div className="text-xs text-emerald-700">Aggiornamento…</div>}

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><p>Le percentuali food/beverage sono teoriche e dipendono da ricette complete. COGS consuntivo richiede inventario iniziale, acquisti, inventario finale e scarti. Personale ed EBITDA riportano lo stato della fonte: consuntivo, misto o stima.</p></div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((item: any) => <div key={item.code} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-slate-500">{item.label}</p>{item.target != null && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">target {item.target.toFixed(1)}%</span>}</div>
          <p className="mt-1 text-2xl font-bold text-slate-900">{item.value}</p><p className="mt-0.5 text-xs text-slate-500">{item.detail}</p><p className="mt-2 border-t border-slate-100 pt-2 font-mono text-[10px] text-slate-400">{item.formula}</p>
        </div>)}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Ricavi nel periodo</h2><p className="text-xs text-slate-500">Vendite POS e fatture emesse, netti IVA</p></div><BarChart3 className="h-4 w-4 text-emerald-600"/></div>
          {trend.length > 0 ? <div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis dataKey="label" fontSize={11}/><YAxis fontSize={10} tickFormatter={value => `€${Math.round(value/1000)}k`}/><Tooltip formatter={(value: any) => euros(Number(value))}/><Bar dataKey="revenue" name="Vendite POS" stackId="rev" fill="#10b981"/><Bar dataKey="issuedRevenue" name="Fatture emesse" stackId="rev" fill="#38bdf8" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></div> : <Empty text="Nessuna vendita o fattura emessa nel periodo."/>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Confronto periodo</h2><p className="text-xs text-slate-500">Intervallo precedente comparabile</p></div><Activity className="h-4 w-4 text-sky-600"/></div>
          <div className="space-y-4"><DeltaRow label="Ricavi" value={data.comparison.revenue} unit="euro"/><DeltaRow label="Food Cost teorico" value={data.comparison.foodCostPct} unit="punti" lowerGood/><DeltaRow label="EBITDA gestionale" value={data.comparison.ebitda} unit="euro"/><p className="border-t border-slate-100 pt-3 text-[11px] text-slate-400">Confronto: {data.comparisonRange.from} – {data.comparisonRange.to}</p></div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="mb-3 font-semibold text-slate-900">Variabili del periodo</h2><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><Variable label="Ricavi POS netti" value={euros(k.posRevenue)}/><Variable label="Fatture emesse" value={euros(k.issuedRevenue)}/><Variable label="Food revenue" value={euros(k.foodRevenue)}/><Variable label="Beverage revenue" value={euros(k.beverageRevenue)}/><Variable label="COGS food teorico" value={euros(k.theoreticalFoodCost)}/><Variable label="COGS beverage teorico" value={euros(k.theoreticalBeverageCost)}/><Variable label="Costo personale" value={euros(k.laborCost)}/><Variable label="Costi fatture" value={euros(data.pnl.operatingInvoices)}/><Variable label="Scadenze netto 30gg" value={euros(data.cash.dueOutflows30-data.cash.dueInflows30)}/></div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-slate-900">Copertura delle fonti</h2><Database className="h-4 w-4 text-slate-400"/></div><div className="space-y-3"><Coverage label="Vendite collegate" value={percent(sources.sales.netRevenueCoveragePct)} detail={`${sources.sales.linkedLines} righe collegate a piatti · ${sources.sales.unlinkedSaleLines} non collegate`}/><Coverage label="Ricette complete sulle vendite" value={percent(sources.recipeCosts.costCoveragePct)} detail={`${sources.recipeCosts.missingLines} righe senza scheda costo valida`}/><Coverage label="Fatture classificate" value={percent(sources.invoices.classificationCoveragePct)} detail={`${sources.invoices.classified}/${sources.invoices.approved} fatture approvate`}/><Coverage label="Personale" value={sourceLabel(sources.payroll.source)} detail={`${sources.payroll.actualMonths} mesi consuntivi · ${sources.payroll.estimatedMonths} stimati · ${sources.payroll.missingMonths} senza dati`}/></div></div>
      </section>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><span className="font-semibold text-slate-700">Analisi e azioni:</span><Link href="/menu" className="hover:text-emerald-700">Menu Engineering</Link><span>·</span><Link href="/food-cost" className="hover:text-emerald-700">Schede Food Cost</Link><span>·</span><Link href="/accounting" className="hover:text-emerald-700">Fatture e classificazione</Link><span>·</span><Link href="/personale" className="hover:text-emerald-700">Personale</Link><span>·</span><Link href="/bilancio" className="hover:text-emerald-700">Bilancio</Link></div>
    </div>
  );
}

function DeltaRow({ label, value, unit, lowerGood }: { label: string; value: { assoluta: number; pct: number | null } | { puntiPercentuali: number } | null; unit: "euro" | "punti"; lowerGood?: boolean }) {
  if (!value) return <div className="flex justify-between text-sm"><span className="text-slate-600">{label}</span><span className="text-slate-400">N/D</span></div>;
  if (unit === "punti") {
    const points = "puntiPercentuali" in value ? value.puntiPercentuali : 0;
    const good = lowerGood ? points <= 0 : points >= 0;
    return <div className="flex justify-between text-sm"><span className="text-slate-600">{label}</span><span className={`font-medium ${good ? "text-emerald-700" : "text-rose-700"}`}>{points > 0 ? "+" : ""}{points.toFixed(1)} p.p.</span></div>;
  }
  const change = value as { assoluta: number; pct: number | null };
  const up = change.assoluta >= 0;
  return <div className="flex justify-between text-sm"><span className="text-slate-600">{label}</span><span className={`font-medium ${up ? "text-emerald-700" : "text-rose-700"}`}>{up ? "+" : "−"}{euros(Math.abs(change.assoluta))}{change.pct == null ? "" : ` · ${up ? "+" : "−"}${Math.abs(change.pct).toFixed(1)}%`}</span></div>;
}

function Variable({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-2"><p className="text-[10px] text-slate-400">{label}</p><p className="mt-0.5 text-sm font-medium text-slate-800">{value}</p></div>;
}

function Coverage({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div><div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-600">{label}</span><strong className="text-xs text-slate-800">{value}</strong></div><p className="mt-0.5 text-[10px] text-slate-400">{detail}</p></div>;
}

function Empty({ text, link, linkLabel }: { text: string; link?: string; linkLabel?: string }) {
  return <div className="py-8 text-center text-sm text-slate-400">{text}{link && <Link href={link} className="ml-1 font-medium text-emerald-700 underline">{linkLabel}</Link>}</div>;
}
