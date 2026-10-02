"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, CircleDollarSign, FileUp, Receipt, RotateCw, Utensils, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const PERIODS = [
  { key: "30d", label: "Ultimi 30 giorni" },
  { key: "90d", label: "Ultimi 90 giorni" },
  { key: "month", label: "Mese corrente" },
  { key: "quarter", label: "Trimestre corrente" },
  { key: "year", label: "Anno corrente" },
  { key: "custom", label: "Intervallo personalizzato" },
];
const COLORS = ["#047857", "#0284c7", "#7c3aed", "#d97706", "#e11d48", "#0891b2", "#65a30d", "#64748b"];

const inputDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const money = (value: number | null | undefined, digits = 0) => value == null || !Number.isFinite(value) ? "N/D" : `€ ${value.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const percent = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "N/D" : `${value.toFixed(1)}%`;
const dateLabel = (value: string | Date) => new Date(value).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });

export default function VenditePage() {
  const today = new Date();
  const [period, setPeriod] = useState("90d");
  const [from, setFrom] = useState(inputDate(new Date(today.getTime() - 89 * 86400000)));
  const [to, setTo] = useState(inputDate(today));
  const [categoryId, setCategoryId] = useState("all");
  const [granularity, setGranularity] = useState("week");
  const [refreshKey, setRefreshKey] = useState(0);
  const [payload, setPayload] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (period === "custom" && (!from || !to || from > to)) {
      setLoading(false);
      setError("Seleziona un intervallo date valido.");
      return;
    }
    const controller = new AbortController();
    const clientId = typeof window === "undefined" ? "default" : localStorage.getItem("df_clientId") || "default";
    const params = new URLSearchParams({ period, clientId, categoryId, granularity });
    if (period === "custom") { params.set("from", from); params.set("to", to); }
    const revenueParams = new URLSearchParams({ ...Object.fromEntries(params), priceIncreasePct: "5" });
    setLoading(true);
    setError("");
    Promise.all([
      fetch(`/api/sales/analysis?${params}`, { signal: controller.signal }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Analisi vendite non disponibile"); return data; }),
      fetch(`/api/revenue-management?${revenueParams}`, { signal: controller.signal }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Collegamento Revenue Management non disponibile"); return data; }),
    ]).then(([sales, revenue]) => { setPayload(sales); setRevenueData(revenue); })
      .catch(reason => { if (reason.name !== "AbortError") setError(reason.message || "Errore di caricamento vendite"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period, from, to, categoryId, granularity, refreshKey]);

  const chartData = useMemo(() => (payload?.summary.trend || []).map((row: any) => ({
    ...row,
    label: new Date(`${row.date}T12:00:00`).toLocaleDateString("it-IT", granularity === "month" ? { month: "short", year: "2-digit" } : { day: "2-digit", month: "short" }),
  })), [payload, granularity]);
  const menuById = new Map<string, any>((revenueData?.summary?.dishes || []).map((dish: any) => [dish.id, dish]));
  const products = (payload?.summary?.dishes || []).map((dish: any) => ({ ...dish, menu: dish.id ? menuById.get(dish.id) : null }));
  const totalScenarioMargin = (revenueData?.priceScenario || []).reduce((sum: number, row: any) => sum + (row.deltaContribution || 0), 0);
  const hasData = Boolean(payload?.summary?.receipts);

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">DATAFOOD · Vendite e performance</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Vendite</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Consuntivi POS, mix prodotto, coperti e qualità dei dati, collegati a costi ricetta e marginalità del Revenue Management.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/corrispettivi" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><FileUp className="mr-1.5 inline h-4 w-4"/>Importa corrispettivi</Link>
          <button onClick={() => setRefreshKey(value => value + 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><RotateCw className="mr-1.5 inline h-4 w-4"/>Aggiorna</button>
        </div>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <label className="text-xs text-slate-500">Periodo<select value={period} onChange={event => setPeriod(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">{PERIODS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        {period === "custom" && <><label className="text-xs text-slate-500">Dal<input type="date" value={from} onChange={event => setFrom(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><label className="text-xs text-slate-500">Al<input type="date" value={to} onChange={event => setTo(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label></>}
        <label className="text-xs text-slate-500">Sezione menu<select value={categoryId} onChange={event => setCategoryId(event.target.value)} className="mt-1 block min-w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"><option value="all">Tutto il locale</option>{(payload?.categories || []).map((category: any) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label className="text-xs text-slate-500">Dettaglio grafico<select value={granularity} onChange={event => setGranularity(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"><option value="day">Giornaliero</option><option value="week">Settimanale</option><option value="month">Mensile</option></select></label>
        {payload?.period && <span className="ml-auto pb-2 text-xs text-slate-400">{payload.period.label} · {dateLabel(`${payload.period.from}T12:00:00`)} – {dateLabel(`${payload.period.to}T12:00:00`)}</span>}
      </section>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mr-2 inline h-4 w-4"/>{error}</div>}
      {loading && <p className="text-xs text-emerald-700">Aggiornamento consuntivi e marginalità…</p>}
      {!loading && payload?.summary?.netCoveragePct != null && payload.summary.netCoveragePct < 100 && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/><p><strong>Ricavi netti parziali.</strong> {money(payload.summary.unknownNetGross)} di incassi lordi non hanno IVA o righe prodotto completamente riconciliate; restano visibili come lordo e non vengono trattati come ricavo netto. Copertura: {percent(payload.summary.netCoveragePct)}. Completa o verifica il dettaglio in Corrispettivi.</p></div>}
      {!loading && !hasData && <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950"><strong>Nessun corrispettivo nel periodo selezionato.</strong><p className="mt-1 text-sky-800">I grafici restano vuoti: non distribuiamo ricavi su giorni o settimane senza vendite registrate.</p></div>}

      {payload && <>
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric label="Incassi lordi POS" value={money(payload.summary.grossRevenue)} detail={`${payload.summary.receipts} corrispettivi`} change={payload.comparison.grossRevenue} icon={<CircleDollarSign className="h-4 w-4"/>}/>
          <Metric label="Ricavi netti verificati" value={money(payload.summary.netRevenue)} detail={`${percent(payload.summary.netCoveragePct)} copertura IVA / righe`} change={payload.comparison.netRevenue} icon={<Activity className="h-4 w-4"/>} warning={payload.summary.netCoveragePct != null && payload.summary.netCoveragePct < 100}/>
          <Metric label="Scontrino lordo medio" value={money(payload.summary.averageGrossCheck, 2)} detail="incasso lordo / corrispettivi" change={payload.comparison.averageGrossCheck} icon={<Receipt className="h-4 w-4"/>}/>
          <Metric label={categoryId === "all" ? "Ricavo netto per coperto" : "Coperti"} value={categoryId === "all" ? money(payload.summary.revenuePerCover, 2) : "N/D"} detail={categoryId === "all" ? `${payload.summary.covers || 0} coperti registrati` : "i coperti non sono ripartiti per sezione menu"} change={categoryId === "all" ? payload.comparison.covers : undefined} icon={<Utensils className="h-4 w-4"/>}/>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-semibold text-slate-900">Andamento degli incassi</h2><p className="text-xs text-slate-500">Dati registrati · lordo POS e netto verificabile, non stime.</p></div><BarChart3 className="h-4 w-4 text-sky-700"/></div>
            <div className="h-[300px]">{chartData.length > 0 ? <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis dataKey="label" fontSize={10} interval="preserveStartEnd"/><YAxis fontSize={10} tickFormatter={value => `€${Math.round(value / 1000)}k`}/><Tooltip formatter={(value: any, name: any) => [money(Number(value)), name]}/><Legend wrapperStyle={{fontSize: 11}}/><Bar dataKey="grossRevenue" name="Incasso lordo" fill="#0284c7" radius={[3,3,0,0]}/><Bar dataKey="netRevenue" name="Ricavo netto verificato" fill="#059669" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer> : <Empty text="Nessun dato nel periodo."/>}</div>
            {payload.summary.unknownNetGross > 0 && <p className="mt-2 text-[11px] text-amber-700">Il netto del grafico esclude {money(payload.summary.unknownNetGross)} di incassi senza imposta verificata.</p>}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-900">Pagamenti registrati</h2><p className="mb-3 text-xs text-slate-500">Ripartizione per metodo, sul lordo.</p>
            {payload.summary.paymentMethods.length > 0 ? <><div className="h-[205px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={payload.summary.paymentMethods} dataKey="grossRevenue" nameKey="key" innerRadius={48} outerRadius={78} paddingAngle={2}>{payload.summary.paymentMethods.map((_: any, index: number) => <Cell key={index} fill={COLORS[index % COLORS.length]}/>)}</Pie><Tooltip formatter={(value: any) => money(Number(value))}/></PieChart></ResponsiveContainer></div><div className="space-y-1.5">{payload.summary.paymentMethods.map((row: any, index: number) => <div key={row.key} className="flex items-center justify-between gap-2 text-xs"><span className="flex items-center gap-2 text-slate-600"><i className="h-2.5 w-2.5 rounded-full" style={{backgroundColor:COLORS[index%COLORS.length]}}/>{row.key} · {row.receipts} corrispettivi</span><strong>{money(row.grossRevenue)}</strong></div>)}</div></> : <Empty text="Nessun pagamento registrato."/>}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Performance per giorno</h2><p className="text-xs text-slate-500">Incasso lordo osservato nel periodo selezionato.</p></div><CalendarDays className="h-4 w-4 text-violet-600"/></div><div className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">{payload.summary.weekdays.map((day: any) => <div key={day.day} className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">{day.label}</p><p className="font-semibold text-slate-800">{money(day.grossRevenue)}</p><p className="text-[10px] text-slate-400">{day.receipts} corrispettivi</p></div>)}</div></div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4"><div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-indigo-700"/><h2 className="font-semibold text-slate-900">Collegamento economico</h2></div><p className="mt-2 text-xs text-slate-600">Revenue Management combina queste righe vendute con i costi delle ricette correnti.</p><div className="mt-3 space-y-2"><Mini label="Margine di contribuzione" value={money(revenueData?.summary?.contribution)}/><Mini label="Margine sui ricavi costati" value={percent(revenueData?.summary?.contributionPct)}/><Mini label="Copertura costi ricetta" value={percent(revenueData?.summary?.costCoveragePct)}/><Mini label="Righe collegate a piatti" value={`${revenueData?.summary?.linkedLines ?? 0}/${(revenueData?.summary?.linkedLines ?? 0) + (revenueData?.summary?.unlinkedLines ?? 0)}`}/><Mini label="Scenario prezzo +5% · Δ contribuzione" value={money(totalScenarioMargin)}/></div><p className="mt-3 text-[10px] text-indigo-900">Margine teorico sul costo ricetta corrente, non consumo effettivo di magazzino. Lo scenario non modifica il listino.</p><Link href={revenueHref(period, from, to, categoryId)} className="mt-3 inline-flex items-center font-semibold text-indigo-800 underline">Apri Revenue Management →</Link></div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-900">Mix categorie</h2><p className="text-xs text-slate-500">Ricavi netti verificati da righe prodotto collegate.</p></div><TableHead columns={["Categoria","Porzioni","Ricavo netto","Incidenza"]}/><div className="divide-y divide-slate-100">{payload.summary.categories.slice(0,8).map((row: any) => <div key={row.name} className="grid grid-cols-[1.2fr_.7fr_1fr_.7fr] gap-2 px-3 py-2 text-xs"><span className="truncate text-slate-700">{row.name}{row.unknownNetGross>0&&<small className="block text-amber-700">IVA N/D · {money(row.unknownNetGross)}</small>}</span><span className="text-right">{row.quantity.toLocaleString("it-IT",{maximumFractionDigits:1})}</span><span className="text-right font-medium">{money(row.netRevenue)}</span><span className="text-right text-slate-500">{percent(payload.summary.knownNetRevenue ? row.netRevenue / payload.summary.knownNetRevenue * 100 : null)}</span></div>)}{payload.summary.categories.length===0&&<Empty text="Nessuna riga prodotto disponibile."/>}</div></div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-900">Piatti e marginalità · Top venduto</h2><p className="text-xs text-slate-500">Volumi dal POS, margini dal Revenue Management.</p></div><div className="max-h-[390px] overflow-y-auto">{products.slice(0,12).map((row: any) => <div key={row.id || row.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-100 px-3 py-2.5 text-xs"><div className="min-w-0"><p className="truncate font-medium text-slate-800">{row.name}{!row.linked&&<span className="ml-1 font-normal text-amber-700">· non collegato</span>}</p><p className="text-[10px] text-slate-400">{row.category} · {row.quantity.toLocaleString("it-IT",{maximumFractionDigits:1})} porzioni · mix {percent(payload.summary.knownNetRevenue?row.netRevenue/payload.summary.knownNetRevenue*100:null)}{row.unknownNetGross>0&&` · IVA N/D ${money(row.unknownNetGross)}`}</p></div><div className="text-right"><p className="font-semibold text-slate-800">{money(row.netRevenue)}</p><p className="text-[10px] text-slate-500">MC unità {money(row.menu?.marginPerPortion)}</p></div></div>)}{products.length===0&&<Empty text="Nessun prodotto venduto nel periodo."/>}</div><div className="border-t bg-slate-50 px-3 py-2 text-[10px] text-slate-500">Un piatto non collegato resta visibile come vendita, ma non entra nell’analisi di costo. <Link href="/menu" className="font-semibold text-emerald-700 underline">Collega il menu</Link></div></div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4"><div><h2 className="font-semibold text-slate-900">Ultimi corrispettivi del periodo</h2><p className="text-xs text-slate-500">Importi lordi, metodo di pagamento, coperti e righe riconciliate.</p></div><Link href="/corrispettivi" className="text-xs font-semibold text-emerald-700 underline">Vai a Corrispettivi</Link></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 text-left">Data / ora</th><th className="px-3 py-2 text-left">Fonte</th><th className="px-3 py-2 text-center">Metodo</th><th className="px-3 py-2 text-right">Coperti</th><th className="px-3 py-2 text-right">Righe</th><th className="px-3 py-2 text-right">Lordo</th><th className="px-3 py-2 text-right">Netto verificato</th><th className="px-3 py-2 text-right">Quadratura righe</th></tr></thead><tbody className="divide-y divide-slate-100">{payload.recentSales.map((sale: any) => <tr key={sale.id}><td className="px-3 py-2 font-medium">{dateLabel(sale.date)}<span className="ml-1 text-slate-400">{new Date(sale.date).toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"})}</span></td><td className="px-3 py-2 text-slate-500">{sale.source || "N/D"}</td><td className="px-3 py-2 text-center">{sale.paymentMethod}</td><td className="px-3 py-2 text-right">{sale.coverCount ?? "—"}</td><td className="px-3 py-2 text-right">{sale.itemCount || "—"}</td><td className="px-3 py-2 text-right font-medium">{money(sale.grossRevenue,2)}</td><td className="px-3 py-2 text-right">{money(sale.netRevenue,2)}</td><td className="px-3 py-2 text-right">{sale.reconciliationDelta==null?"—":money(sale.reconciliationDelta,2)}</td></tr>)}{payload.recentSales.length===0&&<tr><td colSpan={8}><Empty text="Nessun corrispettivo nel periodo."/></td></tr>}</tbody></table></div>
        </section>

        <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><span className="font-semibold">Percorso dei dati:</span><Link href="/corrispettivi" className="underline">Corrispettivi / POS</Link><span>→</span><span>Vendite e mix prodotto</span><span>→</span><Link href={revenueHref(period, from, to, categoryId)} className="underline">Revenue Management</Link><span>→</span><Link href="/controllo-gestione" className="underline">Controllo di Gestione</Link><span>→</span><Link href="/bilancio" className="underline">Bilancio</Link></div>
      </>}
    </div>
  );
}

function revenueHref(period: string, from: string, to: string, categoryId: string) {
  const params = new URLSearchParams({ period });
  if (period === "custom") { params.set("from", from); params.set("to", to); }
  if (categoryId !== "all") params.set("categoryId", categoryId);
  return `/revenue-management?${params.toString()}`;
}

function Metric({ label, value, detail, change, icon, warning }: { label: string; value: string; detail: string; change?: { absolute: number; pct: number | null } | null; icon: React.ReactNode; warning?: boolean }) {
  return <div className={`rounded-xl border bg-white p-3.5 ${warning ? "border-amber-300" : "border-slate-200"}`}><div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-700">{icon}</span>{label}</div><p className="text-xl font-bold text-slate-900">{value}</p><p className="mt-0.5 text-xs text-slate-400">{detail}</p>{change&&<p className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${change.absolute>=0?"text-emerald-700":"text-rose-700"}`}>{change.absolute>=0?<ArrowUpRight className="h-3 w-3"/>:<ArrowDownRight className="h-3 w-3"/>}{money(Math.abs(change.absolute))} vs periodo precedente {change.pct==null?"":`· ${change.pct>0?"+":""}${change.pct.toFixed(1)}%`}</p>}</div>;
}
function Mini({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-2 border-b border-indigo-100 pb-1.5 text-xs"><span className="text-slate-600">{label}</span><strong className="text-slate-800">{value}</strong></div>; }
function TableHead({ columns }: { columns: string[] }) { return <div className="grid grid-cols-[1.2fr_.7fr_1fr_.7fr] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-500">{columns.map((column,index)=><span key={column} className={index>0?"text-right":""}>{column}</span>)}</div>; }
function Empty({ text }: { text: string }) { return <div className="flex h-44 items-center justify-center p-5 text-center text-sm text-slate-400">{text}</div>; }
