"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, Banknote, BarChart3, CircleHelp, Package, Target, TrendingUp, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const PERIODS = [
  { key: "mese", label: "Mese corrente" },
  { key: "trimestre", label: "Trimestre corrente" },
  { key: "anno", label: "Anno corrente" },
  { key: "custom", label: "Date personalizzate" },
];

function localDate(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function money(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "N/D";
  return `€ ${value.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function percent(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "N/D" : `${value.toFixed(1)}%`;
}

function displayDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("it-IT");
}

function sourceLabel(source: string) {
  if (source === "consuntivo") return "Consuntivo";
  if (source === "misto") return "Misto";
  if (source === "stima") return "Stima";
  return "Non disponibile";
}

export default function CostControlPage() {
  const now = new Date();
  const [period, setPeriod] = useState("anno");
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(localDate(now));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (period === "custom" && (!from || !to || from > to)) {
      setLoading(false);
      setError("Seleziona un intervallo date valido.");
      return;
    }
    const params = new URLSearchParams({ period });
    if (period === "custom") { params.set("from", from); params.set("to", to); }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/cost-control?${params.toString()}`, { signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Caricamento del controllo non riuscito");
        setData(result);
      })
      .catch(reason => { if (reason.name !== "AbortError") setError(reason.message || "Errore di caricamento"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period, from, to]);

  if (loading && !data) return <div className="p-8 text-center text-slate-400">Caricamento controllo di gestione…</div>;
  if (!data) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error || "Controllo di gestione non disponibile."}</div>;

  const kpi = data.kpi;
  const sources = data.sources;
  const target = data.budget;
  const fcTarget = target.foodCostPct;
  const laborTarget = target.laborCostPct;
  const budgetRevenueDelta = data.budgetVariance.revenue;
  const chartData = data.trends.map((month: any) => ({ ...month, monthLabel: new Date(`${month.month}-15T12:00:00`).toLocaleDateString("it-IT", { month: "short" }) }));
  const dataQuality = kpi.ebitdaQuality === "completo" ? "fonti complete" : kpi.ebitdaQuality === "non_disponibile" ? "dati insufficienti" : "parziale: consulta coperture";

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">DATAFOOD · Area consulenza</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Controllo di Gestione</h1>
          <p className="mt-1 text-sm text-slate-500">{data.restaurantName} · {data.period.label} · {displayDate(data.period.from)} – {displayDate(data.period.to)}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-500">Periodo<select value={period} onChange={event => setPeriod(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">{PERIODS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
          {period === "custom" && <><label className="text-xs text-slate-500">Dal<input type="date" value={from} onChange={event => setFrom(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><label className="text-xs text-slate-500">Al<input type="date" value={to} onChange={event => setTo(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label></>}
          <Link href="/budget" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-emerald-400">Budget →</Link>
          <Link href="/bilancio" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-emerald-400">Bilancio →</Link>
        </div>
      </header>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {loading && <div className="text-xs text-emerald-700">Aggiornamento dati…</div>}

      <section className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        {data.alerts.slice(0, 6).map((alert: any) => <Link key={alert.code} href={alert.href} className={`flex items-start gap-2 rounded-lg border p-3 transition hover:shadow-sm ${alert.level === "critical" ? "border-rose-200 bg-rose-50" : alert.level === "warning" ? "border-amber-200 bg-amber-50" : "border-sky-200 bg-sky-50"}`}>
          <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${alert.level === "critical" ? "text-rose-600" : alert.level === "warning" ? "text-amber-600" : "text-sky-600"}`} />
          <span><span className="block text-sm font-semibold text-slate-800">{alert.title}</span><span className="mt-0.5 block text-xs text-slate-600">{alert.detail}</span></span>
        </Link>)}
        {data.alerts.length === 0 && <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><BadgeCheck className="h-4 w-4"/>Nessuna anomalia rilevata nelle fonti presenti.</div>}
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Ricavi netti" value={money(kpi.revenue)} detail={`${kpi.receipts} scontrini POS · ${money(kpi.issuedRevenue)} fatture emesse`} change={data.comparison.revenue} icon={<Banknote className="h-4 w-4"/>}/>
        <Metric label="Food Cost teorico" value={percent(kpi.theoreticalFoodCostPct)} detail={`${percent(kpi.costCoveragePct)} dei ricavi coperti da ricette complete`} target={fcTarget == null ? null : `${fcTarget.toFixed(1)}% target`} icon={<Package className="h-4 w-4"/>} warning={fcTarget != null && kpi.theoreticalFoodCostPct != null && kpi.theoreticalFoodCostPct > fcTarget}/>
        <Metric label="Labor Cost" value={percent(kpi.laborPct)} detail={sourceLabel(sources.payroll.source)} target={laborTarget == null ? null : `${laborTarget.toFixed(1)}% budget`} icon={<Users className="h-4 w-4"/>} warning={laborTarget != null && kpi.laborPct != null && kpi.laborPct > laborTarget}/>
        <Metric label="EBITDA gestionale" value={money(kpi.ebitdaEstimate)} detail={dataQuality} change={data.comparison.ebitda} icon={<TrendingUp className="h-4 w-4"/>} warning={kpi.ebitdaQuality !== "completo"}/>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SmallMetric label="Scontrino medio" value={money(kpi.averageCheck, 2)} detail="ricavi POS netti / scontrini" />
        <SmallMetric label="Ricavo per coperto" value={money(kpi.revenuePerCover, 2)} detail={`${kpi.covers.toLocaleString("it-IT")} coperti`} />
        <SmallMetric label="Costo teorico per coperto" value={money(kpi.theoreticalCostPerCover, 2)} detail="ricette vendute / coperti" />
        <SmallMetric label="Prime Cost" value={percent(kpi.primeCostPct)} detail="Food Cost teorico + personale" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Andamento economico</h2><p className="text-xs text-slate-500">Ricavi mensili netti e margine di contribuzione teorico</p></div><span className="text-[11px] text-slate-400">mensile</span></div>
          {chartData.length > 0 ? <div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 5, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis dataKey="monthLabel" fontSize={11} stroke="#64748b"/><YAxis fontSize={10} stroke="#64748b" tickFormatter={value => `€${Math.round(value / 1000)}k`}/>
            <Tooltip formatter={(value: any) => money(Number(value))}/><Bar dataKey="revenue" name="Vendite POS" stackId="revenue" fill="#10b981" radius={[0,0,0,0]}/><Bar dataKey="issuedRevenue" name="Fatture emesse" stackId="revenue" fill="#38bdf8" radius={[3,3,0,0]}/>
          </BarChart></ResponsiveContainer></div> : <Empty text="Nessun ricavo registrato nel periodo."/>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Budget vs consuntivo</h2><p className="text-xs text-slate-500">Obiettivi salvati per i mesi del periodo</p></div><Target className="h-4 w-4 text-emerald-600"/></div>
          {target.configuredMonths > 0 ? <div className="space-y-4">
            <Variance label="Ricavi" actual={kpi.revenue} target={target.revenueTarget} variance={budgetRevenueDelta} />
            <PercentVariance label="Food Cost teorico" actual={kpi.theoreticalFoodCostPct} target={target.foodCostPct} variance={data.budgetVariance.foodCostPct?.puntiPercentuali} lowerIsBetter />
            <PercentVariance label="Labor Cost" actual={kpi.laborPct} target={target.laborCostPct} variance={data.budgetVariance.laborPct?.puntiPercentuali} lowerIsBetter />
            <p className="text-[11px] text-slate-400">Target configurati {target.configuredMonths}/{target.months} mesi · coperti obiettivo {target.coversTarget?.toLocaleString("it-IT") ?? "N/D"}</p>
          </div> : <Empty text="Non ci sono target salvati per questo periodo. Imposta ricavi e incidenze mensili per leggere gli scostamenti." link="/budget" linkLabel="Apri Budget"/>}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3"><h2 className="font-semibold text-slate-900">Conto Economico gestionale</h2><p className="text-xs text-slate-500">Consumi da ricetta e vendite; costi operativi da fatture approvate e classificate.</p></div>
          <div className="divide-y divide-slate-100">
            <PnlRow label="Ricavi netti complessivi" value={data.pnl.revenue} type="positive" strong />
            <PnlRow label="di cui vendite POS" value={data.pnl.posRevenue} type="positive" />
            <PnlRow label="di cui fatture emesse / eventi" value={data.pnl.issuedRevenue} type="positive" />
            <PnlRow label="Food Cost teorico venduto" value={-data.pnl.theoreticalFoodCost} type="negative" note={`${percent(sources.recipeCosts.costCoveragePct)} copertura ricette`}/>
            <PnlRow label="Beverage Cost teorico venduto" value={-data.pnl.theoreticalBeverageCost} type="negative"/>
            <PnlRow label="Margine lordo teorico POS" value={data.pnl.grossMargin} type="subtotal" strong note="fatture evento escluse dal COGS ricetta"/>
            <PnlRow label="Costo del personale" value={data.pnl.payroll == null ? null : -data.pnl.payroll} type="negative" note={sourceLabel(sources.payroll.source)}/>
            <PnlRow label="Altri costi da fatture classificate" value={-data.pnl.operatingInvoices} type="negative" note={`${sources.invoices.classified}/${sources.invoices.approved} classificate`}/>
            <PnlRow label="EBITDA gestionale preliminare" value={data.pnl.EBITDAEstimate} type="subtotal" strong note={kpi.ebitdaQuality === "completo" ? "fonti coperte" : "parziale: vedi qualità dati"}/>
            <PnlRow label="Ammortamenti stimati" value={-data.pnl.depreciationEstimate} type="negative"/>
            <PnlRow label="Risultato operativo preliminare" value={data.pnl.operatingResultEstimate} type="final" strong/>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50 p-4 text-xs">
            <div><p className="text-slate-500">Acquisti food da fatture</p><p className="mt-0.5 font-semibold text-slate-800">{money(data.pnl.purchasesFood)}</p><p className="text-[10px] text-slate-400">acquisti, non consumo del periodo</p></div>
            <div><p className="text-slate-500">Acquisti beverage da fatture</p><p className="mt-0.5 font-semibold text-slate-800">{money(data.pnl.purchasesBeverage)}</p><p className="text-[10px] text-slate-400">confrontali con inventario e consumi</p></div>
          </div>
          <div className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0"/>Il Food Cost esposto è teorico da ricette e vendite. Gli acquisti da fatture sono mostrati a parte perché senza inventario iniziale/finale non equivalgono al consumo. Il risultato operativo è preliminare, non un bilancio civilistico.</div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Dove nasce il margine</h2><p className="text-xs text-slate-500">Contribuzione teorica per sezione venduta</p></div><Link href="/menu" className="text-xs font-medium text-emerald-700 hover:underline">Menu Engineering</Link></div>
            {data.topDishes.length > 0 ? <div className="space-y-2">{data.topDishes.slice(0, 5).map((dish: any) => <div key={dish.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{dish.name}</p><p className="text-[11px] text-slate-400">{dish.category} · {dish.quantity.toLocaleString("it-IT", { maximumFractionDigits: 1 })} porzioni {dish.complete ? "· ricetta completa" : "· costo da completare"}</p></div><div className="shrink-0 text-right"><p className="text-sm font-semibold text-slate-900">{money(dish.revenue - dish.cost)}</p><p className="text-[10px] text-slate-400">margine teorico</p></div></div>)}</div> : <Empty text="Nessuna vendita associata a un piatto nel periodo." link="/vendite" linkLabel="Verifica vendite"/>}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Struttura dei costi</h2><p className="text-xs text-slate-500">Fatture approvate per conto gestionale</p></div><Link href="/bilancio" className="text-xs font-medium text-emerald-700 hover:underline">Dettaglio CE</Link></div>
            {data.costAreas.length > 0 ? <div className="space-y-2">{data.costAreas.slice(0, 6).map((area: any) => <div key={area.name} className="flex items-center justify-between gap-2 text-sm"><span className="truncate text-slate-600">{area.name}</span><span className="shrink-0 font-mono text-slate-800">{money(area.amount)}</span></div>)}</div> : <Empty text="Nessuna fattura approvata nel periodo." link="/accounting" linkLabel="Classifica fatture"/>}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Andamento acquisti fornitori</h2><p className="text-xs text-slate-500">Spesa da fatture approvate nel periodo</p></div><Link href="/fornitori" className="text-xs text-emerald-700 hover:underline">Fornitori</Link></div>
          {data.suppliers.length > 0 ? <div className="space-y-2">{data.suppliers.slice(0, 6).map((supplier: any) => <div key={supplier.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0"><div><p className="text-sm font-medium text-slate-800">{supplier.name}</p><p className="text-[11px] text-slate-400">{supplier.invoices} fatture</p></div><p className="font-mono text-sm">{money(supplier.amount)}</p></div>)}</div> : <Empty text="Nessun acquisto registrato nel periodo." link="/accounting" linkLabel="Vai ad Accounting"/>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Variazioni prezzi d’acquisto</h2><p className="text-xs text-slate-500">Ingredienti collegati a fatture, confronto con il periodo precedente</p></div><Link href="/food-cost" className="text-xs text-emerald-700 hover:underline">Costi ricette</Link></div>
          {data.purchasePriceChanges.length > 0 ? <div className="space-y-2">{data.purchasePriceChanges.map((change: any) => <div key={`${change.ingredient}-${change.supplier}`} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{change.ingredient}</p><p className="text-[11px] text-slate-400">{change.supplier} · {money(change.previousPrice, 2)} → {money(change.currentPrice, 2)}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${change.changePct > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{change.changePct > 0 ? "+" : ""}{change.changePct?.toFixed(1)}%</span></div>)}</div> : <Empty text="Non ci sono righe fattura collegate allo stesso ingrediente in entrambi i periodi." link="/accounting" linkLabel="Collega righe fattura"/>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Qualità e copertura del dato</h2><p className="text-xs text-slate-500">La solidità del risultato dipende da queste fonti.</p></div><Link href="/report" className="text-xs font-medium text-emerald-700 hover:underline">KPI Registry →</Link></div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Coverage label="Vendite collegate" value={percent(sources.sales.netRevenueCoveragePct)} detail={`${sources.sales.linkedLines} righe collegate · ${sources.sales.unlinkedSaleLines} senza piatto`} />
          <Coverage label="Ricette complete sulle vendite" value={percent(sources.recipeCosts.costCoveragePct)} detail={`${sources.recipeCosts.missingLines} righe vendute non calcolabili`} />
          <Coverage label="Fatture classificate" value={percent(sources.invoices.classificationCoveragePct)} detail={`${sources.invoices.classified}/${sources.invoices.approved} approvate`} />
          <Coverage label="Costo personale" value={sourceLabel(sources.payroll.source)} detail={`${sources.payroll.actualMonths} mesi consuntivi · ${sources.payroll.estimatedMonths} stimati · ${sources.payroll.missingMonths} mancanti`} />
        </div>
      </section>

      <section className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <span className="font-semibold text-slate-700">Approfondisci:</span>
        <Link href="/food-cost" className="hover:text-emerald-700">Schede ricetta</Link><span>·</span><Link href="/menu" className="hover:text-emerald-700">Menu Engineering</Link><span>·</span><Link href="/accounting" className="hover:text-emerald-700">Fatture</Link><span>·</span><Link href="/personale" className="hover:text-emerald-700">Personale</Link><span>·</span><Link href="/cash-flow" className="hover:text-emerald-700">Cash Flow</Link><span>·</span><Link href="/magazzino" className="hover:text-emerald-700">Magazzino</Link>
      </section>
    </div>
  );
}

function Metric({ label, value, detail, change, target, icon, warning }: { label: string; value: string; detail: string; change?: { assoluta: number; pct: number | null }; target?: string | null; icon: React.ReactNode; warning?: boolean }) {
  return <div className={`rounded-xl border bg-white p-3.5 ${warning ? "border-amber-300" : "border-slate-200"}`}><div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-medium text-slate-500"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">{icon}</span>{label}</div>{target && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{target}</span>}</div><p className="text-xl font-bold text-slate-900">{value}</p><p className="mt-0.5 text-xs text-slate-400">{detail}</p>{change && <Delta change={change}/>}</div>;
}

function Delta({ change }: { change: { assoluta: number; pct: number | null } }) {
  const up = change.assoluta >= 0;
  const sign = up ? "+" : "−";
  return <p className={`mt-1 text-[11px] font-medium ${up ? "text-emerald-700" : "text-rose-700"}`}>{sign}{money(Math.abs(change.assoluta))}{change.pct == null ? "" : ` · ${sign}${Math.abs(change.pct).toFixed(1)}%`} vs periodo precedente</p>;
}

function SmallMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white px-3 py-2"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-0.5 font-semibold text-slate-800">{value}</p><p className="text-[10px] text-slate-400">{detail}</p></div>;
}

function PnlRow({ label, value, type, strong, note }: { label: string; value: number | null; type: "positive" | "negative" | "subtotal" | "final"; strong?: boolean; note?: string }) {
  const color = type === "positive" ? "text-emerald-700" : type === "negative" ? "text-slate-700" : type === "final" && (value || 0) < 0 ? "text-rose-700" : type === "subtotal" || type === "final" ? "text-slate-900" : "text-slate-700";
  return <div className={`flex items-center justify-between gap-3 px-4 py-2.5 ${type === "subtotal" ? "border-t border-slate-200 bg-slate-50" : type === "final" ? "border-t-2 border-slate-300 bg-slate-50" : ""}`}><span className={`${strong ? "font-semibold" : ""} text-sm text-slate-700`}>{label}{note && <span className="ml-2 text-[10px] font-normal text-slate-400">{note}</span>}</span><span className={`font-mono text-sm ${strong ? "font-bold" : "font-medium"} ${color}`}>{value == null ? "N/D" : `${value < 0 ? "−" : ""}${money(Math.abs(value))}`}</span></div>;
}

function Variance({ label, actual, target, variance }: { label: string; actual: number; target: number | null; variance: { assoluta: number; pct: number | null } | null }) {
  if (target == null) return <div className="flex justify-between gap-3 text-sm"><span className="text-slate-600">{label}</span><span className="text-xs text-slate-400">Target non impostato</span></div>;
  return <div><div className="flex justify-between gap-3 text-sm"><span className="text-slate-600">{label}</span><span className="font-medium text-slate-800">{money(actual)} / {money(target)}</span></div><div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>Consuntivo / budget</span><span className={variance && variance.assoluta >= 0 ? "text-emerald-700" : "text-rose-700"}>{variance ? `${variance.assoluta >= 0 ? "+" : "−"}${money(Math.abs(variance.assoluta))} · ${variance.pct?.toFixed(1) ?? "N/D"}%` : "N/D"}</span></div></div>;
}

function PercentVariance({ label, actual, target, variance, lowerIsBetter }: { label: string; actual: number | null; target: number | null; variance: number | null; lowerIsBetter?: boolean }) {
  if (target == null) return <div className="flex justify-between gap-3 text-sm"><span className="text-slate-600">{label}</span><span className="text-xs text-slate-400">Target non impostato</span></div>;
  const favorable = variance == null ? null : lowerIsBetter ? variance <= 0 : variance >= 0;
  return <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-600">{label}</span><span className="text-right"><strong className="text-slate-800">{percent(actual)}</strong><span className="text-xs text-slate-400"> · target {percent(target)}</span><span className={`ml-1 text-xs ${favorable == null ? "text-slate-400" : favorable ? "text-emerald-700" : "text-rose-700"}`}>{variance == null ? "" : `${variance > 0 ? "+" : ""}${variance.toFixed(1)} p.p.`}</span></span></div>;
}

function Coverage({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-slate-900">{value}</p><p className="mt-0.5 text-[10px] text-slate-400">{detail}</p></div>;
}

function Empty({ text, link, linkLabel }: { text: string; link?: string; linkLabel?: string }) {
  return <div className="py-5 text-center text-sm text-slate-400">{text}{link && <Link href={link} className="ml-1 font-medium text-emerald-700 underline">{linkLabel}</Link>}</div>;
}
