"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, BarChart3, CalendarClock, CircleDollarSign, Clock3, Info, Receipt, Target, TrendingUp, UtensilsCrossed } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { calcBreakEvenRevenue } from "@/lib/metrics";

const PERIODS = [
  { key: "30d", label: "Ultimi 30 giorni" },
  { key: "90d", label: "Ultimi 90 giorni" },
  { key: "month", label: "Mese corrente" },
  { key: "quarter", label: "Trimestre corrente" },
  { key: "year", label: "Anno corrente" },
  { key: "custom", label: "Date personalizzate" },
];

const DAYPART_NAMES: Record<string, string> = { colazione: "Colazione", pranzo: "Pranzo", pomeriggio: "Pomeriggio", cena: "Cena", notte: "Notte" };

function inputDate(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function money(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "N/D";
  return `€ ${value.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function pct(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "N/D" : `${value.toFixed(1)}%`;
}

function dateLabel(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString("it-IT"); }

export default function RevenueManagementPage() {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - 29);
  const [period, setPeriod] = useState("90d");
  const [from, setFrom] = useState(inputDate(since));
  const [to, setTo] = useState(inputDate(now));
  const [categoryId, setCategoryId] = useState("all");
  const [priceIncreasePct, setPriceIncreasePct] = useState(5);
  const [fixedCosts, setFixedCosts] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (period === "custom" && (!from || !to || from > to)) { setLoading(false); setError("Intervallo date non valido."); return; }
    const params = new URLSearchParams({ period, categoryId, priceIncreasePct: String(priceIncreasePct) });
    if (period === "custom") { params.set("from", from); params.set("to", to); }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/revenue-management?${params.toString()}`, { signal: controller.signal })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "Caricamento Revenue Management non riuscito"); setData(result); })
      .catch(reason => { if (reason.name !== "AbortError") setError(reason.message || "Errore di caricamento"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period, from, to, categoryId, priceIncreasePct]);

  const filteredDishes = useMemo(() => (data?.summary.dishes || []).filter((dish: any) => !search || `${dish.name} ${dish.category}`.toLocaleLowerCase("it-IT").includes(search.toLocaleLowerCase("it-IT"))), [data, search]);
  const scenario = data?.priceScenario || [];
  const scenarioMarginDelta = scenario.reduce((sum: number, item: any) => sum + (item.deltaContribution || 0), 0);
  const scenarioRevenueDelta = scenario.reduce((sum: number, item: any) => sum + (item.deltaRevenue || 0), 0);
  const beRevenue = fixedCosts !== "" && data?.summary.contributionPct != null ? calcBreakEvenRevenue(Number(fixedCosts), data.summary.contributionPct) : null;
  const beChecks = beRevenue != null && data.summary.averageCheck > 0 ? beRevenue / data.summary.averageCheck : null;

  if (loading && !data) return <div className="p-8 text-center text-slate-400">Caricamento Revenue Management…</div>;
  if (!data) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error || "Revenue Management non disponibile."}</div>;

  const bestDaypart = data.summary.dayparts.filter((slot: any) => slot.receipts >= 3).sort((a: any, b: any) => (b.revenue / b.receipts) - (a.revenue / a.receipts))[0];
  const quietDaypart = data.summary.dayparts.filter((slot: any) => slot.receipts >= 3).sort((a: any, b: any) => (a.revenue / a.receipts) - (b.revenue / b.receipts))[0];
  const timeDataAdequate = data.summary.timestampCoveragePct != null && data.summary.timestampCoveragePct >= 70;
  const categoryIdIsFiltered = data.categoryId !== "all";

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">DATAFOOD · Prezzi, domanda e margini</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Ricavi, domanda e marginalità</h1>
          <p className="mt-1 text-sm text-slate-500">Capire quando vendere, cosa rende e simulare il prezzo senza cambiare il listino.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-500">Periodo<select value={period} onChange={event => setPeriod(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">{PERIODS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
          {period === "custom" && <><label className="text-xs text-slate-500">Dal<input type="date" value={from} onChange={event => setFrom(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><label className="text-xs text-slate-500">Al<input type="date" value={to} onChange={event => setTo(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label></>}
          <label className="text-xs text-slate-500">Sezione menù<select value={categoryId} onChange={event => setCategoryId(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"><option value="all">Tutto il locale</option>{data.categories.map((category: any) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <Link href="/menu" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-emerald-400">Menu Engineering →</Link>
        </div>
      </header>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {loading && <p className="text-xs text-emerald-700">Aggiornamento analisi…</p>}

      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><div className="font-semibold text-slate-700">{data.period.label}: {dateLabel(data.period.from)} – {dateLabel(data.period.to)}</div><div className="text-slate-500">Confronto: {dateLabel(data.comparisonRange.from)} – {dateLabel(data.comparisonRange.to)}</div></div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500 md:grid-cols-4"><span>Vendite collegate: {data.summary.linkedLines}/{data.summary.linkedLines + data.summary.unlinkedLines}</span><span>Ricette complete: {data.summary.costCoveragePct == null ? "N/D" : pct(data.summary.costCoveragePct)}</span><span>Orario presente: {data.summary.timestampCoveragePct == null ? "N/D" : pct(data.summary.timestampCoveragePct)}</span><span>Fonte prezzi: scheda ricetta e righe vendita</span></div>
      </section>

      {(data.summary.unlinkedLines > 0 || data.summary.missingRecipeLines > 0 || (data.summary.receipts > 0 && !timeDataAdequate)) && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><p>{data.summary.unlinkedLines > 0 ? `${data.summary.unlinkedLines} righe vendita non associate a un piatto. ` : ""}{data.summary.missingRecipeLines > 0 ? `${data.summary.missingRecipeLines} righe vendute senza costo ricetta completo. ` : ""}{data.summary.receipts > 0 && !timeDataAdequate ? "Le vendite non hanno un orario affidabile: l’analisi per fascia oraria è incompleta." : ""}</p></div>
      )}

      {data.summary.revenue === 0 && <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950"><strong>Nessun ricavo registrato nel periodo selezionato.</strong><p className="mt-1 text-sky-800">Revenue Management non stima domanda o fasce orarie da dati assenti. Importa le vendite con date, orari e righe prodotto.</p><Link href="/vendite" className="mt-2 inline-flex font-semibold text-sky-800 underline">Vai a Vendite</Link></div>}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Ricavi netti" value={money(data.summary.revenue)} detail={`${data.summary.receipts} scontrini nel filtro`} change={data.comparison.revenue} icon={<CircleDollarSign className="h-4 w-4"/>}/>
        <Metric label="Ricavo medio per scontrino" value={money(data.summary.averageCheck, 2)} detail={categoryIdIsFiltered ? "scontrini con almeno una riga nella sezione" : "POS · ricavi netti / scontrini"} change={data.comparison.averageCheck} icon={<Receipt className="h-4 w-4"/>}/>
        <Metric label="Ricavo per coperto" value={categoryIdIsFiltered ? "N/D" : money(data.summary.revenuePerCover, 2)} detail={categoryIdIsFiltered ? "i coperti non sono ripartiti per categoria" : "ricavi POS / coperti"} icon={<UtensilsCrossed className="h-4 w-4"/>}/>
        <Metric label="Margine contribuzione" value={money(data.summary.contribution)} detail={`${pct(data.summary.contributionPct)} sui ricavi con costo valido`} change={data.comparison.contribution} icon={<TrendingUp className="h-4 w-4"/>} warning={data.summary.costCoveragePct != null && data.summary.costCoveragePct < 99.99}/>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Quando arrivano i ricavi</h2><p className="text-xs text-slate-500">Fasce calcolate solo sulle vendite con ora registrata</p></div><Clock3 className="h-4 w-4 text-sky-600"/></div>
          {timeDataAdequate && data.summary.dayparts.some((slot: any) => slot.receipts > 0) ? <div className="h-[260px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.summary.dayparts.filter((slot: any) => slot.receipts > 0)}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis dataKey="label" fontSize={11}/><YAxis fontSize={10} tickFormatter={value => `€${Math.round(value/1000)}k`}/><Tooltip formatter={(value: any) => money(Number(value))}/><Bar dataKey="revenue" name="Ricavi netti" fill="#0ea5e9" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div> : <Empty text="Fasce orarie non calcolabili con sufficiente affidabilità."/>}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"><SlotInsight title="Fascia più redditizia" slot={bestDaypart} /><SlotInsight title="Fascia da verificare" slot={quietDaypart} quiet /></div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Giorni della settimana</h2><p className="text-xs text-slate-500">Domanda osservata, non capienza del locale</p></div><CalendarClock className="h-4 w-4 text-violet-600"/></div>
          {data.summary.weekdays.some((day: any) => day.receipts > 0) ? <div className="space-y-2">{data.summary.weekdays.map((day: any) => <div key={day.day} className="grid grid-cols-[80px_1fr_80px] items-center gap-2 text-xs"><span className="text-slate-600">{day.label}</span><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-violet-500" style={{ width: `${Math.min(100, data.summary.revenue > 0 ? day.revenue / Math.max(...data.summary.weekdays.map((row: any) => row.revenue), 1) * 100 : 0)}%` }}/></div><span className="text-right font-medium text-slate-700">{money(day.revenue)}</span></div>)}</div> : <Empty text="Nessuna distribuzione settimanale nel periodo."/>}
          <p className="mt-3 text-[10px] text-slate-400">Non sono presenti dati di posti disponibili e ore di servizio: RevPASH e occupazione tavoli restano N/D.</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Pareggio operativo · simulazione</h2><p className="text-xs text-slate-500">Inserisci i costi fissi del periodo; il calcolo non modifica il budget.</p></div><Target className="h-4 w-4 text-emerald-600"/></div>
          <label className="block text-xs text-slate-500">Costi fissi del periodo
            <input type="number" min="0" step="100" value={fixedCosts} onChange={event => setFixedCosts(event.target.value)} placeholder="Inserisci dai costi classificati / budget" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"/>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Ricavi di pareggio</p><p className="mt-1 text-xl font-bold text-slate-900">{money(beRevenue)}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Scontrini equivalenti</p><p className="mt-1 text-xl font-bold text-slate-900">{beChecks == null ? "N/D" : Math.ceil(beChecks).toLocaleString("it-IT")}</p></div></div>
          <p className="mt-2 text-[10px] text-slate-400">Formula: costi fissi inseriti / margine di contribuzione %. Usa il margine rilevato sui piatti con ricette complete.</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
          <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Simulazione prezzo</h2><p className="text-xs text-slate-500">Che cosa cambierebbe se il prezzo salisse di questa percentuale?</p></div><BarChart3 className="h-4 w-4 text-indigo-600"/></div>
          <label className="block text-xs text-slate-500">Variazione simulata
            <div className="mt-1 flex items-center gap-2"><input type="range" min="0" max="20" step="1" value={priceIncreasePct} onChange={event => setPriceIncreasePct(Number(event.target.value))} className="w-full"/><span className="w-12 text-right text-sm font-bold text-slate-800">+{priceIncreasePct}%</span></div>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Ricavi aggiuntivi · volumi costanti</p><p className="mt-1 text-xl font-bold text-slate-900">{money(scenarioRevenueDelta)}</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Margine aggiuntivo · volumi costanti</p><p className="mt-1 text-xl font-bold text-slate-900">{money(scenarioMarginDelta)}</p></div></div>
          <p className="mt-2 text-[10px] text-slate-500">Scenario matematico a quantità vendute invariate: non prevede l’elasticità della domanda e non aggiorna i prezzi del menù.</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4"><div><h2 className="font-semibold text-slate-900">Leve di ricavo piatto per piatto</h2><p className="text-xs text-slate-500">Prezzo realizzato, costo porzione, mix, contribuzione e scenario prezzo.</p></div><div className="flex gap-2"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cerca piatto" className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-xs"/><button className="rounded-lg border border-slate-200 px-3 py-2 text-xs" onClick={() => setSearch("")}>Reset</button></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2 text-left">Piatto</th><th className="px-3 py-2 text-left">Sezione</th><th className="px-3 py-2 text-right">Porzioni</th><th className="px-3 py-2 text-right">Mix</th><th className="px-3 py-2 text-right">Prezzo listino</th><th className="px-3 py-2 text-right">Prezzo realizzato</th><th className="px-3 py-2 text-right">Costo / porzione</th><th className="px-3 py-2 text-right">MC / porzione</th><th className="px-3 py-2 text-right">Prezzo scenario</th><th className="px-3 py-2 text-right">Δ MC periodo</th></tr></thead><tbody className="divide-y divide-slate-100">
          {filteredDishes.map((dish: any) => { const scenarioRow = scenario.find((item: any) => item.dishId === dish.id); return <tr key={dish.id} className="hover:bg-slate-50"><td className="px-3 py-2 font-medium text-slate-800">{dish.name}</td><td className="px-3 py-2 text-slate-500">{dish.category}</td><td className="px-3 py-2 text-right">{dish.units.toLocaleString("it-IT", { maximumFractionDigits: 1 })}</td><td className="px-3 py-2 text-right">{pct(dish.salesMixPct)}</td><td className="px-3 py-2 text-right">{money(dish.listPrice)}</td><td className="px-3 py-2 text-right">{money(dish.averageGrossPrice)}</td><td className="px-3 py-2 text-right">{dish.recipeComplete ? money(dish.recipeCost) : "N/D ricetta"}</td><td className="px-3 py-2 text-right font-semibold">{money(dish.marginPerPortion)}</td><td className="px-3 py-2 text-right">{scenarioRow ? money(scenarioRow.scenarioGrossPrice) : "N/D"}</td><td className={`px-3 py-2 text-right ${scenarioRow?.deltaContribution == null ? "text-slate-400" : scenarioRow.deltaContribution >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{scenarioRow?.deltaContribution == null ? "—" : `${scenarioRow.deltaContribution >= 0 ? "+" : "−"}${money(Math.abs(scenarioRow.deltaContribution))}`}</td></tr>; })}
          {filteredDishes.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-400">Nessun piatto in questo periodo/sezione.</td></tr>}
        </tbody></table></div>
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-[11px] text-slate-500">Il margine usa il prezzo medio effettivamente venduto al netto IVA meno il costo ricetta corrente. Il prezzo listino è mostrato a parte; il costo non include consumi reali d’inventario.</div>
      </section>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><span className="font-semibold text-slate-700">Azioni correlate:</span><Link href="/vendite" className="hover:text-emerald-700">Vendite</Link><span>·</span><Link href="/menu" className="hover:text-emerald-700">Menu Engineering</Link><span>·</span><Link href="/food-cost" className="hover:text-emerald-700">Schede Food Cost</Link><span>·</span><Link href="/controllo-gestione" className="hover:text-emerald-700">Controllo di Gestione</Link></div>
    </div>
  );
}

function Metric({ label, value, detail, change, icon, warning }: { label: string; value: string; detail: string; change?: { assoluta: number; pct: number | null }; icon: React.ReactNode; warning?: boolean }) {
  return <div className={`rounded-xl border bg-white p-3.5 ${warning ? "border-amber-300" : "border-slate-200"}`}><div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">{icon}</span>{label}</div><p className="text-xl font-bold text-slate-900">{value}</p><p className="mt-0.5 text-xs text-slate-400">{detail}</p>{change && <p className={`mt-1 text-[11px] font-medium ${change.assoluta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{change.assoluta >= 0 ? "+" : "−"}{money(Math.abs(change.assoluta))} vs periodo precedente</p>}</div>;
}

function SlotInsight({ title, slot, quiet }: { title: string; slot: any; quiet?: boolean }) {
  if (!slot) return <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{title}</p><p className="mt-1 text-xs text-slate-400">Dati insufficienti</p></div>;
  return <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{title}</p><p className={`mt-1 font-semibold ${quiet ? "text-amber-700" : "text-emerald-700"}`}>{DAYPART_NAMES[slot.key]}</p><p className="mt-0.5 text-xs text-slate-500">{money(slot.revenue / slot.receipts)} per scontrino · {slot.receipts} scontrini</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-48 items-center justify-center text-center text-sm text-slate-400">{text}</div>;
}
