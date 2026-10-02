"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Users, Receipt, Calendar, Wallet, TrendingUp, TrendingDown, ChevronRight, Upload, Plus, FileText, Scale, Activity, Gauge } from "lucide-react";
import { RevenuePerformanceChart } from "@/components/dashboard";
import { ForecastChart } from "@/app/cash-flow/ForecastChart";

const PERIODS = [
  { key: "oggi", label: "Oggi" },
  { key: "settimana", label: "Settimana" },
  { key: "mese", label: "Mese" },
  { key: "trimestre", label: "Trimestre" },
  { key: "anno", label: "Anno" },
];

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [period, setPeriod] = useState("anno");
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => { load(period); }, [period]);

  const load = async (p: string) => {
    setLoading(true);
    try {
      const [d, f] = await Promise.all([
        fetch(`/api/dashboard?period=${p}`).then(r => r.json()),
        fetch("/api/cashflow/forecast?weeks=13").then(r => r.json()),
      ]);
      setData(d);
      setForecast(f);
      setLastUpdate(d.lastUpdate ? new Date(d.lastUpdate) : new Date());
    } catch {}
    setLoading(false);
  };

  const fmt = (v: number) => `€ ${Math.round(v).toLocaleString("it-IT")}`;
  const pct = (v: number | null) => v == null ? "N/D" : `${v.toFixed(1)}%`;

  if (loading && !data) return <div className="p-8 text-center text-slate-400">Caricamento...</div>;
  if (!data) return <div className="p-8 text-center text-slate-400">Errore caricamento</div>;

  const b = data.bilancio;
  const f13 = forecast?.forecast || [];
  const trend = data.trend || [];
  const saldo13 = f13.length > 0 ? f13[f13.length - 1].endingBalance : null;
  const minSaldo = f13.length > 0 ? Math.min(...f13.map((w: any) => w.endingBalance)) : null;
  const settimaneRischio = f13.filter((w: any) => w.atRisk).length;
  const runway = forecast?.runway;

  const foodCostPct = b.food_cost_complete && b.food_sala > 0 ? (b.food_cost / b.food_sala) * 100 : null;
  const laborPct = b.ricavi > 0 ? (b.personale / b.ricavi) * 100 : null;
  const primePct = b.ricavi > 0 ? ((b.tot_materie + b.personale) / b.ricavi) * 100 : null;
  const ebitdaPct = b.ricavi > 0 ? (b.ebitda / b.ricavi) * 100 : null;
  const netCoverageComplete = b.coperturaRicaviNettiPct == null || b.coperturaRicaviNettiPct >= 99.99;
  const scontrino = b.transazioni > 0 && netCoverageComplete ? b.ricavi / b.transazioni : null;
  const ricavoCoperto = b.coperti > 0 && netCoverageComplete ? b.ricavi / b.coperti : null;
  const chartGranularity = period === "anno" ? "mensile" : period === "trimestre" ? "settimanale" : "giornaliero";

  // Alert
  const alerts: any[] = [];
  if (foodCostPct != null && foodCostPct > 30) alerts.push({ prio: "at", icon: "▲", title: "Food cost sopra target", desc: `${foodCostPct.toFixed(1)}% vs 30%`, href: "/food-cost" });
  if (b.transazioni > 0 && !b.food_cost_complete) alerts.push({ prio: "at", icon: "▲", title: "Food cost teorico incompleto", desc: `${b.food_cost_missing_items} righe senza ricetta collegata; KPI non confrontabile`, href: "/food-cost" });
  if (minSaldo !== null && minSaldo < 0) alerts.push({ prio: "cr", icon: "!", title: "Saldo previsto negativo", desc: `${fmt(minSaldo)} tra 13 settimane`, href: "/cash-flow" });
  if (runway != null && runway < 4) alerts.push({ prio: "cr", icon: "!", title: "Runway basso", desc: `${Math.round(runway)} settimane di autonomia`, href: "/cash-flow" });
  const scadenze = data.schedules || [];
  const stockAlerts = data.stockAlerts || [];
  const pendingOrders = data.pendingOrders || [];
  const scadImp = scadenze.find((s: any) => s.type === "payment" && s.amount > 5000);
  if (scadImp) alerts.push({ prio: "at", icon: "▲", title: "Scadenza importante", desc: `${scadImp.description} · ${fmt(scadImp.amount)}`, href: "/cash-flow" });
  if (stockAlerts.length > 0) alerts.push({ prio: "at", icon: "▲", title: "Ingredienti sotto scorta minima", desc: `${stockAlerts.length} ingredienti da controllare · ${stockAlerts.slice(0, 3).map((item: any) => item.name).join(", ")}`, href: "/magazzino" });
  if (pendingOrders.length > 0) alerts.push({ prio: "in", icon: "i", title: "Ordini in attesa di ricezione", desc: `${pendingOrders.length} ordini inviati o parzialmente ricevuti`, href: "/ordini" });
  if (b.transazioni === 0) alerts.unshift({ prio: "in", icon: "i", title: "Nessuna vendita registrata nel periodo", desc: `Intervallo ${data.range?.from || ""} – ${data.range?.to || ""}`, href: "/vendite" });
  if (b.lordoSenzaIVAVerificata > 0) alerts.unshift({ prio: "at", icon: "▲", title: "Ricavi netti incompleti", desc: `${fmt(b.lordoSenzaIVAVerificata)} lordi non riconciliati (IVA o righe)`, href: "/corrispettivi" });

  const prioStyle: any = { cr: "border-l-red-500 bg-red-50", at: "border-l-amber-500 bg-amber-50", in: "border-l-blue-500 bg-blue-50" };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Dashboard gestionale</h1>
          <p className="text-xs text-slate-500">
            {data.restaurantName} · {data.period} · {data.range?.from} – {data.range?.to} · aggiornato alle {lastUpdate?.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${period === p.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ATTENZIONE */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {alerts.slice(0, 4).map((a, i) => (
            <Link key={i} href={a.href} className={`${prioStyle[a.prio]} border rounded-lg p-3 flex items-start gap-2.5 hover:shadow-sm transition-shadow`}>
               <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${a.prio === "cr" ? "bg-red-500" : a.prio === "in" ? "bg-blue-500" : "bg-amber-500"}`}>{a.icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-600">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
      {alerts.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm text-emerald-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Non risultano criticità prioritarie nel periodo.
        </div>
      )}

      {/* KPI PRINCIPALI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Kpi label="Ricavi netti verificati" value={fmt(b.ricavi)} sub={`${b.transazioni.toLocaleString()} transazioni`} note={`${(b.coperturaRicaviNettiPct ?? 0).toFixed(1)}% copertura · lordo totale ${fmt(b.incassiLordi)}`} change={data.comparison?.ricavi} color="default" />
        <Kpi label="EBITDA stimato" value={fmt(b.ebitda)} sub={`margine ${pct(ebitdaPct)}`} note="stima, non consuntivo" title={data.estimateNotes?.ebitda} change={data.comparison?.ebitda} color={b.ebitda >= 0 ? "green" : "red"} />
        <Kpi label="Liquidità" value={fmt(data.liquidita)} sub={`${data.accountsCount} conti attivi`} note={data.accountsCount === 0 ? "nessun conto" : data.confirmedAccountsCount === data.accountsCount ? "saldi verificati" : "saldi parziali/non confermati"} color="default" />
        <Kpi label="Saldo tra 13 sett." value={saldo13 !== null ? fmt(saldo13) : "N/D"} sub={minSaldo !== null ? `min ${fmt(minSaldo)} · ${settimaneRischio} rischi` : ""} note="forecast" color={settimaneRischio > 0 ? "amber" : "green"} />
      </div>

      {/* PERFORMANCE + MARGINALITÀ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Performance */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-800">Andamento commerciale</h2>
            <span className="text-xs text-slate-400">{data.period}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <Mini label="Coperti" value={b.coperti.toLocaleString("it-IT")} />
            <Mini label="Scontrino medio" value={scontrino ? `€ ${scontrino.toFixed(2)}` : "N/D"} tip="ricavi / transazioni" />
            <Mini label="Ricavo/coperto" value={ricavoCoperto ? `€ ${ricavoCoperto.toFixed(2)}` : "N/D"} tip="ricavi / coperti" />
            <Mini label="Ricavi / gg periodo" value={fmt(b.ricavi / (b.giorniAperti || 1))} tip={`media sui ${b.giorniAperti} giorni di calendario inclusi nel periodo`} />
          </div>
          <RevenuePerformanceChart data={trend} granularity={chartGranularity} />
          <p className="mt-1 text-[10px] text-slate-400">Confronto ricavi: {data.comparison?.label} · intervallo precedente {data.comparison?.range?.from} – {data.comparison?.range?.to}</p>
        </div>

        {/* Marginalità */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Marginalità e costi</h2>
          <div className="space-y-3">
            <MarginRow label="Food cost teorico" val={foodCostPct} target={30} sub={b.food_cost_complete ? `€ ${b.food_cost.toLocaleString("it-IT")}` : `Costo parziale € ${b.food_cost.toLocaleString("it-IT")}`} changePoints={data.comparison?.foodCostPct?.puntiPercentuali} />
            <MarginRow label="Labor cost stimato" val={laborPct} target={30} sub={`€ ${b.personale.toLocaleString("it-IT")}`} />
            <MarginRow label="Prime cost stimato" val={primePct} target={60} sub={`€ ${(b.tot_materie + b.personale).toLocaleString("it-IT")}`} />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Ricavi food</span><span className="font-medium">{fmt(b.food_sala)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Ricavi beverage</span><span className="font-medium">{fmt(b.bev_sala)}</span></div>
            {Math.abs(b.non_classified_revenue) > 0.01 && <div className="flex justify-between text-sm" title="Differenza tra totale vendite e righe associate a piatti/categorie"><span className="text-slate-500">Ricavi non ripartiti</span><span className="font-medium">{fmt(b.non_classified_revenue)}</span></div>}
            <div className="flex justify-between text-sm"><span className="text-slate-500">Margine lordo</span><span className="font-medium text-emerald-600">{fmt(b.margine_lordo)}</span></div>
          </div>
          <Link href="/bilancio" className="text-xs text-emerald-600 hover:underline flex items-center gap-1 mt-3"><Scale className="w-3.5 h-3.5" /> Vedi bilancio completo</Link>
        </div>
      </div>

      {/* CASH FLOW + SCADENZIARIO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-600" /> Liquidità e cash flow</h2>
            <Link href="/cash-flow" className="text-xs text-emerald-600 hover:underline">13 settimane</Link>
          </div>
          <ForecastChart forecast={f13} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-800">Scadenziario</h2>
            <Link href="/cash-flow" className="text-xs text-emerald-600 hover:underline">Vedi tutto</Link>
          </div>
          {scadenze.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Nessuna scadenza.</p>
          ) : (
            <div className="space-y-2">
              {scadenze.slice(0, 5).map((s: any) => {
                const daysTo = Math.ceil((new Date(s.dueDate).getTime() - Date.now()) / 86400000);
                return (
                  <div key={s.id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${daysTo <= 7 ? "bg-amber-50" : "bg-slate-50"}`}>
                    <div>
                      <p className="text-slate-700 text-xs font-medium">{s.description}</p>
                      <p className="text-slate-400 text-xs">{new Date(s.dueDate).toLocaleDateString("it-IT")} · {daysTo <= 0 ? "scaduta" : `in ${daysTo} gg`}</p>
                    </div>
                    <span className={`font-mono font-medium text-xs ${s.type === "payment" ? "text-red-600" : "text-emerald-600"}`}>
                      {s.type === "payment" ? "-" : "+"}€ {Math.round(s.amount).toLocaleString("it-IT")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Riepilogo liquidità */}
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
            <Row label="Runway" value={runway != null ? `${Math.round(runway)} sett.` : "N/D"} />
            <Row label="Saldo attuale" value={fmt(data.liquidita)} />
            <Row label="Settimane a rischio" value={`${settimaneRischio}`} danger={settimaneRischio > 0} />
          </div>
        </div>
      </div>

      {/* AZIONI RAPIDE */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Action icon={<Upload className="w-4 h-4" />} label="Importa estratto" href="/cash-flow" />
        <Action icon={<Plus className="w-4 h-4" />} label="Registra incasso" href="/corrispettivi" />
        <Action icon={<FileText className="w-4 h-4" />} label="Inserisci costo" href="/accounting" />
        <Action icon={<TrendingUp className="w-4 h-4" />} label="Vedi report" href="/report" />
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, note, title, change, color }: any) {
  const c: Record<string, string> = { default: "text-slate-900", green: "text-emerald-700", red: "text-red-700", amber: "text-amber-700" };
  const b: Record<string, string> = { default: "border-slate-200", green: "border-emerald-200", red: "border-red-200", amber: "border-amber-200" };
  return (
    <div title={title} className={`bg-white rounded-xl border ${b[color]} p-3.5`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {note && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{note}</span>}
      </div>
      <p className={`text-xl font-bold ${c[color]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      {change && <Delta change={change} />}
    </div>
  );
}

function Delta({ change }: { change: { assoluta: number; pct: number | null } }) {
  const positive = change.assoluta >= 0;
  const absolute = `${positive ? "+" : "−"}€ ${Math.abs(Math.round(change.assoluta)).toLocaleString("it-IT")}`;
  const percent = change.pct == null ? "" : ` (${positive ? "+" : "−"}${Math.abs(change.pct).toFixed(1)}%)`;
  return <p className={`text-[11px] mt-1 font-medium ${positive ? "text-emerald-600" : "text-rose-600"}`}>{absolute}{percent} vs periodo precedente</p>;
}

function Mini({ label, value, tip }: any) {
  return <div className="bg-slate-50 rounded-lg p-2 text-center" title={tip}><p className="text-[10px] text-slate-500">{label}</p><p className="text-sm font-bold text-slate-800">{value}</p></div>;
}

function MarginRow({ label, val, target, sub, changePoints }: any) {
  const ok = val == null;
  const over = val != null && val > target;
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-600">{label}</p>
        <p className="text-xs text-slate-400">{sub}</p>
      </div>
      <div className="text-right">
        <p className={`text-lg font-bold ${ok ? "text-slate-400" : over ? "text-red-600" : "text-emerald-600"}`}>{ok ? "N/D" : `${val.toFixed(1)}%`}</p>
        <p className={`text-[10px] ${changePoints == null ? "text-slate-400" : changePoints <= 0 ? "text-emerald-600" : "text-rose-600"}`}>target {target}%{changePoints == null ? "" : ` · ${changePoints > 0 ? "+" : ""}${changePoints.toFixed(1)} p.p. vs prec.`}</p>
      </div>
    </div>
  );
}

function Row({ label, value, danger }: any) {
  return <div className="flex justify-between text-sm"><span className="text-slate-500">{label}</span><span className={`font-medium ${danger ? "text-amber-600" : "text-slate-800"}`}>{value}</span></div>;
}

function Action({ icon, label, href }: any) {
  return <Link href={href} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-colors">{icon}{label}</Link>;
}
