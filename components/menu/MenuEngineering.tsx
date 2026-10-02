"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Search, SlidersHorizontal, Info, Utensils, TrendingUp, Target, CircleDollarSign, ClipboardList } from "lucide-react";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

type Quadrant = "star" | "puzzle" | "plow-horse" | "dog" | "non-valutabile";
type MenuDish = {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  listPriceGross: number;
  vatRate: number;
  recipeCost: number;
  recipeCount: number;
  missingCostIngredients: number;
  recipeComplete: boolean;
  salesQty: number;
  salesMixPct: number;
  netRevenue: number;
  actualNetPrice: number | null;
  analysisNetPrice: number;
  analysisGrossPrice: number;
  analysisPriceSource: "scenario" | "consuntivo";
  unitMargin: number | null;
  totalContribution: number | null;
  foodCostPct: number | null;
  minimumGrossPriceAtTargetFoodCost: number | null;
  quadrant: Quadrant;
  recommendation: string;
};

type MenuAnalysis = {
  period: { key: string; label: string; from: string; to: string };
  categoryId: string;
  scenario: { targetFoodCostPct: number };
  categories: { id: string; name: string }[];
  thresholds: { averageContribution: number | null; averageUnitsPerMenuItem: number; popularityThreshold: number; popularityFactor: number };
  summary: { menuItems: number; soldItems: number; classifiedItems: number; unclassifiedItems: number; units: number; netRevenue: number; unknownVatGross: number; theoreticalCost: number; contribution: number; unlinkedSalesLines: number; costCoveragePct: number | null };
  menu: MenuDish[];
};

const QUADRANTS: { key: Quadrant; title: string; short: string; advice: string; color: string; dot: string }[] = [
  { key: "star", title: "Stelle", short: "Alta popolarità · alta contribuzione", advice: "Proteggi ricetta e prezzo; mantieni alta visibilità e disponibilità.", color: "border-emerald-200 bg-emerald-50", dot: "bg-emerald-500" },
  { key: "puzzle", title: "Enigmi", short: "Bassa popolarità · alta contribuzione", advice: "Testa posizione, descrizione e raccomandazione del personale; misura di nuovo.", color: "border-sky-200 bg-sky-50", dot: "bg-sky-500" },
  { key: "plow-horse", title: "Cavalli da tiro", short: "Alta popolarità · bassa contribuzione", advice: "Lavora su resa, porzione e costo ingredienti; simula il prezzo prima di cambiarlo.", color: "border-amber-200 bg-amber-50", dot: "bg-amber-500" },
  { key: "dog", title: "Bassa priorità", short: "Bassa popolarità · bassa contribuzione", advice: "Controlla stagionalità, disponibilità e ruolo strategico prima di riprogettare o rimuovere.", color: "border-rose-200 bg-rose-50", dot: "bg-rose-500" },
];

const PERIODS = [
  { key: "30d", label: "Ultimi 30 giorni" },
  { key: "90d", label: "Ultimi 90 giorni" },
  { key: "month", label: "Mese corrente" },
  { key: "quarter", label: "Trimestre corrente" },
  { key: "year", label: "Anno corrente" },
  { key: "custom", label: "Date personalizzate" },
];

function euros(value: number | null | undefined, decimals = 2) {
  if (value == null || !Number.isFinite(value)) return "N/D";
  return `€ ${value.toLocaleString("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function pct(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "N/D" : `${value.toFixed(1)}%`;
}

function inputDate(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function quadrantName(key: Quadrant) {
  return QUADRANTS.find(item => item.key === key)?.title || "Da completare";
}

export function MenuEngineering() {
  const todayDate = new Date();
  const monthAgoDate = new Date(todayDate);
  monthAgoDate.setDate(monthAgoDate.getDate() - 29);
  const today = inputDate(todayDate);
  const thirtyDaysAgo = inputDate(monthAgoDate);
  const [period, setPeriod] = useState("90d");
  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [categoryId, setCategoryId] = useState("all");
  const [targetFoodCost, setTargetFoodCost] = useState(30);
  const [search, setSearch] = useState("");
  const [quadrantFilter, setQuadrantFilter] = useState("all");
  const [data, setData] = useState<MenuAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (period === "custom" && (!from || !to || from > to)) {
      setLoading(false);
      setError("Seleziona un intervallo date valido.");
      return;
    }

    const params = new URLSearchParams({ period, categoryId, targetFoodCost: String(targetFoodCost) });
    if (period === "custom") { params.set("from", from); params.set("to", to); }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/menu-engineering?${params.toString()}`, { signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Impossibile caricare l'analisi");
        setData(result);
      })
      .catch(reason => { if (reason.name !== "AbortError") setError(reason.message || "Errore caricamento"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period, from, to, categoryId, targetFoodCost]);

  const searchedMenu = useMemo(() => {
    if (!data) return [];
    return data.menu
      .filter(dish => (!search || `${dish.name} ${dish.category}`.toLocaleLowerCase("it-IT").includes(search.toLocaleLowerCase("it-IT"))))
      .sort((a, b) => (b.totalContribution ?? -Infinity) - (a.totalContribution ?? -Infinity));
  }, [data, search]);

  const visibleMenu = useMemo(() => searchedMenu.filter(dish => quadrantFilter === "all" || dish.quadrant === quadrantFilter), [searchedMenu, quadrantFilter]);

  const exportCsv = () => {
    if (!data) return;
    const headers = ["Piatto", "Categoria", "Classificazione", "Vendite unita", "Mix vendite %", "Prezzo menu lordo", "Prezzo realizzato lordo", "Costo ricetta porzione", "Margine contribuzione unitario", "Food cost %", "Prezzo minimo a FC obiettivo", "Azione suggerita"];
    const rows = visibleMenu.map(dish => [dish.name, dish.category, quadrantName(dish.quadrant), dish.salesQty, dish.salesMixPct.toFixed(1), dish.listPriceGross.toFixed(2), dish.analysisPriceSource === "consuntivo" ? dish.analysisGrossPrice.toFixed(2) : "", dish.recipeComplete ? dish.recipeCost.toFixed(2) : "", dish.unitMargin?.toFixed(2) ?? "", dish.foodCostPct?.toFixed(1) ?? "", dish.minimumGrossPriceAtTargetFoodCost?.toFixed(2) ?? "", dish.recommendation]);
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `datafood-menu-engineering-${data.period.from}-${data.period.to}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (loading && !data) return <div className="p-8 text-center text-slate-400">Caricamento analisi menù...</div>;
  if (error && !data) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>;
  if (!data) return <div className="p-8 text-center text-slate-400">Nessun dato disponibile.</div>;

  const quadrants = Object.fromEntries(QUADRANTS.map(item => [item.key, searchedMenu.filter(dish => dish.quadrant === item.key)])) as Record<Quadrant, MenuDish[]>;
  const chartItems = data.menu.filter(dish => dish.salesQty > 0 && dish.recipeComplete && dish.unitMargin != null);
  const fmtDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("it-IT");

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">DATAFOOD · Decisioni sul menù</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Menu Engineering</h1>
          <p className="mt-1 text-sm text-slate-500">Kasavana–Smith · popolarità e margine di contribuzione per porzione</p>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-emerald-400">
          <Download className="h-4 w-4" /> Esporta analisi CSV
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><SlidersHorizontal className="h-4 w-4 text-emerald-600" /> Ambito dell’analisi</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-slate-500">Periodo
            <select value={period} onChange={event => setPeriod(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">
              {PERIODS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </label>
          {period === "custom" && <>
            <label className="text-xs text-slate-500">Dal<input type="date" value={from} onChange={event => setFrom(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800" /></label>
            <label className="text-xs text-slate-500">Al<input type="date" value={to} onChange={event => setTo(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800" /></label>
          </>}
          <label className="text-xs text-slate-500">Categoria / sezione
            <select value={categoryId} onChange={event => setCategoryId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">
              <option value="all">Tutto il menù</option>
              {data.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-500">Food cost obiettivo · simulazione
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2">
              <input type="number" min="10" max="80" step="1" value={targetFoodCost} onChange={event => setTargetFoodCost(Math.min(80, Math.max(10, Number(event.target.value) || 30)))} className="w-full text-sm text-slate-800 outline-none" />
              <span className="text-sm text-slate-400">%</span>
            </div>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{data.period.label}: {fmtDate(data.period.from)} – {fmtDate(data.period.to)}</span>
          <span>La matrice usa solo piatti venduti con ricetta e costi completi.</span>
          {loading && <span className="text-emerald-700">Aggiornamento…</span>}
        </div>
      </section>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {(data.summary.unlinkedSalesLines > 0 || data.summary.unclassifiedItems > 0 || data.summary.unknownVatGross > 0) && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {data.summary.unclassifiedItems} piatti sono fuori dalla matrice perché non hanno vendite nel periodo o costi ricetta completi
            {data.summary.unlinkedSalesLines > 0 ? `; inoltre ${data.summary.unlinkedSalesLines} righe vendita non sono collegate a un piatto` : ""}.
            {data.summary.unknownVatGross > 0 ? ` IVA non verificata su ${euros(data.summary.unknownVatGross)} lordi; le righe non entrano nei ricavi netti.` : ""}
            Collega le vendite e completa le ricette prima di usare i quadranti come decisione.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Piatti a menù" value={String(data.summary.menuItems)} detail={`${data.summary.soldItems} con vendite nel periodo`} icon={<Utensils className="h-4 w-4" />} />
        <Metric label="Porzioni vendute" value={data.summary.units.toLocaleString("it-IT", { maximumFractionDigits: 1 })} detail={`soglia popolarità ${data.thresholds.popularityThreshold.toFixed(1)} porzioni`} icon={<TrendingUp className="h-4 w-4" />} />
        <Metric label="Ricavi menu netti verificati" value={euros(data.summary.netRevenue, 0)} detail={data.summary.unknownVatGross > 0 ? `IVA da verificare su ${euros(data.summary.unknownVatGross)}` : "da righe vendita collegate ai piatti"} icon={<CircleDollarSign className="h-4 w-4" />} />
        <Metric label="Margine contribuzione" value={euros(data.summary.contribution, 0)} detail={`${data.summary.classifiedItems} piatti classificati`} icon={<Target className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Soglia di popolarità</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{data.thresholds.popularityThreshold.toFixed(1)} porzioni</p>
          <p className="mt-1 text-xs text-slate-500">70% della vendita media per piatto nel menù filtrato ({data.thresholds.averageUnitsPerMenuItem.toFixed(1)} porzioni medie).</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Soglia di contribuzione unitaria</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{euros(data.thresholds.averageContribution)}</p>
          <p className="mt-1 text-xs text-slate-500">Margine medio per porzione dei piatti venduti con ricette complete nel periodo.</p>
        </div>
      </div>

      {data.summary.units === 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
          <h2 className="font-semibold text-sky-950">Non ci sono vendite collegate ai piatti nel periodo selezionato</h2>
          <p className="mt-1 text-sm text-sky-800">La matrice non inventa popolarità o margini: importa le vendite con gli articoli associati ai piatti oppure scegli un intervallo con dati.</p>
          <Link href="/vendite" className="mt-3 inline-flex text-sm font-semibold text-sky-800 underline">Vai a Vendite</Link>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Matrice decisionale</h2>
            <p className="text-xs text-slate-500">X = porzioni vendute · Y = margine di contribuzione netto per porzione</p>
          </div>
          <p className="text-xs text-slate-500">Nessun piatto viene rimosso automaticamente dal menù.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {chartItems.length > 0 && data.thresholds.averageContribution != null ? (
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 18, right: 22, bottom: 20, left: 14 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" dataKey="salesQty" name="Porzioni vendute" domain={[0, "dataMax"]} stroke="#64748b" fontSize={11} label={{ value: "Porzioni vendute", position: "insideBottom", offset: -12, fontSize: 11 }} />
                    <YAxis type="number" dataKey="unitMargin" name="Margine unitario" stroke="#64748b" fontSize={11} tickFormatter={value => `€${value}`} width={62} />
                    <ZAxis range={[70, 70]} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => {
                      const dish = payload?.[0]?.payload as MenuDish | undefined;
                      if (!active || !dish) return null;
                      return <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg"><p className="font-semibold text-slate-900">{dish.name}</p><p className="mt-1">Vendite: {dish.salesQty.toLocaleString("it-IT")} · MC: {euros(dish.unitMargin)}</p><p>{quadrantName(dish.quadrant)}</p></div>;
                    }} />
                    {data.thresholds.popularityThreshold > 0 && <ReferenceLine x={data.thresholds.popularityThreshold} stroke="#64748b" strokeDasharray="5 4" label={{ value: "soglia popolarità", fill: "#64748b", fontSize: 10 }} />}
                    <ReferenceLine y={data.thresholds.averageContribution} stroke="#64748b" strokeDasharray="5 4" label={{ value: "MC medio", fill: "#64748b", fontSize: 10 }} />
                    {QUADRANTS.map(item => <Scatter key={item.key} name={item.title} data={chartItems.filter(dish => dish.quadrant === item.key)} fill={item.key === "star" ? "#10b981" : item.key === "puzzle" ? "#0ea5e9" : item.key === "plow-horse" ? "#f59e0b" : "#f43f5e"} />)}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="flex h-[360px] items-center justify-center text-center text-sm text-slate-400">Servono vendite collegate e costi ricetta completi per tracciare i piatti.</div>}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {QUADRANTS.map(item => (
              <button key={item.key} onClick={() => setQuadrantFilter(quadrantFilter === item.key ? "all" : item.key)} className={`rounded-xl border p-3 text-left transition-shadow hover:shadow-sm ${item.color} ${quadrantFilter === item.key ? "ring-2 ring-slate-700" : ""}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} /><span className="font-semibold text-slate-900">{item.title}</span></div>
                  <span className="text-xl font-bold text-slate-900">{quadrants[item.key].length}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-600">{item.short}</p>
                <p className="mt-1 text-xs text-slate-500">{item.advice}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div><h2 className="font-semibold text-slate-900">Piano piatto per piatto</h2><p className="text-xs text-slate-500">Costo teorico da ricetta; vendite e mix dal periodo selezionato.</p></div>
          <div className="flex flex-wrap gap-2">
            <label className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cerca piatto" className="w-44 rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm" /></label>
            <select value={quadrantFilter} onChange={event => setQuadrantFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="all">Tutte le decisioni</option>
              {QUADRANTS.map(item => <option key={item.key} value={item.key}>{item.title}</option>)}
              <option value="non-valutabile">Da completare / senza vendite</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Piatto</th><th className="px-3 py-2 text-left">Decisione</th>
                <th className="px-3 py-2 text-right">Porzioni</th><th className="px-3 py-2 text-right">Mix</th>
                <th className="px-3 py-2 text-right">Prezzo menù</th><th className="px-3 py-2 text-right">Costo porzione</th>
                <th className="px-3 py-2 text-right">MC / porzione</th><th className="px-3 py-2 text-right">Food cost</th>
                <th className="px-3 py-2 text-right">Prezzo minimo · FC target</th><th className="px-3 py-2 text-left">Prossima azione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleMenu.map(dish => {
                const quadrant = QUADRANTS.find(item => item.key === dish.quadrant);
                return (
                  <tr key={dish.id} className="align-top hover:bg-slate-50">
                    <td className="px-3 py-3"><p className="font-semibold text-slate-900">{dish.name}</p><p className="text-xs text-slate-500">{dish.category} · {dish.analysisPriceSource === "consuntivo" ? "prezzo netto realizzato" : `simulazione listino, IVA ${dish.vatRate}%`}</p></td>
                    <td className="px-3 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${quadrant?.key === "star" ? "bg-emerald-100 text-emerald-800" : quadrant?.key === "puzzle" ? "bg-sky-100 text-sky-800" : quadrant?.key === "plow-horse" ? "bg-amber-100 text-amber-800" : quadrant?.key === "dog" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-600"}`}>{quadrantName(dish.quadrant)}</span></td>
                    <td className="px-3 py-3 text-right tabular-nums">{dish.salesQty.toLocaleString("it-IT", { maximumFractionDigits: 1 })}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{pct(dish.salesMixPct)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{euros(dish.listPriceGross)}{dish.analysisPriceSource === "consuntivo" && Math.abs(dish.analysisGrossPrice - dish.listPriceGross) > 0.01 && <span className="block text-[10px] text-slate-400">realizzato {euros(dish.analysisGrossPrice)}</span>}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{dish.recipeComplete ? euros(dish.recipeCost) : "Incompleto"}</td>
                    <td className={`px-3 py-3 text-right font-semibold tabular-nums ${(dish.unitMargin || 0) < 0 ? "text-rose-700" : "text-slate-800"}`}>{euros(dish.unitMargin)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{pct(dish.foodCostPct)}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${dish.minimumGrossPriceAtTargetFoodCost != null && dish.analysisGrossPrice + 0.01 < dish.minimumGrossPriceAtTargetFoodCost ? "font-semibold text-rose-700" : "text-slate-700"}`}>{euros(dish.minimumGrossPriceAtTargetFoodCost)}{dish.minimumGrossPriceAtTargetFoodCost != null && <span className="block text-[10px] text-slate-400">{dish.analysisPriceSource === "consuntivo" ? "realizzato" : "listino"} {dish.analysisGrossPrice + 0.01 < dish.minimumGrossPriceAtTargetFoodCost ? "sotto soglia" : "sopra soglia"}</span>}</td>
                    <td className="max-w-[320px] px-3 py-3 text-xs text-slate-600">{dish.recommendation}<Link href="/food-cost" className="ml-1 whitespace-nowrap font-medium text-emerald-700 underline">Apri ricetta</Link></td>
                  </tr>
                );
              })}
              {visibleMenu.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-400">Nessun piatto corrisponde ai filtri selezionati.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-start gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          <ClipboardList className="mt-0.5 h-4 w-4 shrink-0" />
          Il prezzo minimo è il pavimento lordo per non superare il food cost obiettivo, calcolato dal costo ricetta e dall’IVA effettiva delle vendite; senza vendite usa l’aliquota IVA salvata nella scheda piatto. Non è un prezzo consigliato né modifica il listino.
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="mb-2 flex items-center gap-2 text-slate-500"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">{icon}</span><span className="text-xs font-medium">{label}</span></div>
    <p className="text-xl font-bold text-slate-900">{value}</p><p className="mt-0.5 text-xs text-slate-400">{detail}</p>
  </div>;
}
