"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Calculator, PieChart, AlertTriangle, Users, Clock, UtensilsCrossed, Gauge, Scale, Wallet, Truck, Calendar, ChevronRight, Landmark } from "lucide-react";

const PERIODS = [
  { key: "oggi", label: "Oggi" },
  { key: "settimana", label: "Settimana" },
  { key: "mese", label: "Mese" },
  { key: "trimestre", label: "Trimestre" },
];

export default function CostControlPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("trimestre");

  useEffect(() => { load(period); }, [period]);

  const load = async (p: string) => {
    setLoading(true);
    try { setData(await fetch(`/api/cost-control?period=${p}`).then(r => r.json())); } catch {}
    setLoading(false);
  };

  const fm = (v: number) => `€ ${Math.round(v).toLocaleString("it-IT")}`;
  const pct = (v: number) => `${v.toFixed(1)}%`;

  if (loading && !data) return <div className="p-8 text-center text-slate-400">Caricamento...</div>;
  if (!data) return <div className="p-8 text-center text-slate-400">Errore</div>;

  const p = data.pnl;
  const i = data.indicatori;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Cost Control</h1>
          <p className="text-xs text-slate-500">{data.restaurantName} · centralina di controllo {data.period}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} className={`px-3 py-1.5 rounded-md text-xs font-medium ${period === p.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{p.label}</button>
            ))}
          </div>
          <Link href="/bilancio" className="text-xs text-emerald-600 hover:underline flex items-center gap-1"><Scale className="w-3.5 h-3.5" /> Bilancio</Link>
        </div>
      </div>

      {/* ALERT */}
      {data.alerts.length > 0 && (
        <div className="space-y-1.5">
          {data.alerts.map((a: any, idx: number) => (
            <div key={idx} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${a.level === "critico" ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* KPI PRINCIPALI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Ricavi" value={fm(p.ricavi)} sub={`${i.transazioni} transazioni`} color="default" />
        <Kpi label="EBITDA" value={fm(p.ebitda)} sub={`margine ${pct(i.ebitdaPct)}`} color={p.ebitda >= 0 ? "green" : "red"} badge={i.personaleStimato ? "pers. stimato" : ""} />
        <Kpi label="Utile netto" value={fm(p.utile_netto)} sub={`dopo ammortamenti e oneri`} color={p.utile_netto >= 0 ? "green" : "red"} />
        <Kpi label="Liquidità" value={fm(data.liquidita)} sub={`uscite 30gg: ${fm(data.prossimeUscite30)}`} color={data.liquidita > data.prossimeUscite30 ? "green" : "amber"} />
      </div>

      {/* INDICATORI OPERATIVI (stile Tomato AI) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800">Indicatori operativi</h2>
          <span className="text-xs text-slate-400">produttività e costi unitari</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <OpInd icon={<UtensilsCrossed className="w-4 h-4" />} label="Ricavo medio/coperto" value={`€ ${i.ricavoMedioCoperto}`} color="indigo" />
          <OpInd icon={<Calculator className="w-4 h-4" />} label="Costo pasto" value={`€ ${i.costoPasto}`} sub="materie/coperto" color="rose" />
          <OpInd icon={<PieChart className="w-4 h-4" />} label="Costo pasto primo" value={`€ ${i.costoPastoPrimo}`} sub="prime cost/coperto" color="amber" />
          <OpInd icon={<Clock className="w-4 h-4" />} label="Produttività oraria" value={`€ ${i.produttivitaOraria}`} sub="ricavo/ora" color="emerald" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <OpInd icon={<Users className="w-4 h-4" />} label="Incidenza personale" value={pct(i.incidenzaPersonale)} sub="su ricavi" color={i.incidenzaPersonale > 32 ? "red" : "green"} />
          <OpInd icon={<Gauge className="w-4 h-4" />} label="Coperti/ora" value={String(i.copertiOra)} sub="produttività sala" color="sky" />
          <OpInd icon={<TrendingDown className="w-4 h-4" />} label="Food cost %" value={pct(i.foodCostPct)} sub={`bev ${pct(i.beverageCostPct)}`} color={i.foodCostPct > 33 ? "red" : "green"} />
          <OpInd icon={<TrendingUp className="w-4 h-4" />} label="Scontrino medio" value={`€ ${i.scontrinoMedio}`} sub="ricavi/transaz." color="slate" />
        </div>
      </div>

      {/* CE COMPATTO + MARGINI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Conto Economico compatto */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-800">Conto Economico automatico</h2>
            <Link href="/bilancio" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">dettaglio <ChevronRight className="w-3 h-3" /></Link>
          </div>
          <div className="space-y-1 text-sm">
            <Row label="Ricavi totali" value={fm(p.ricavi)} bold positive />
            <Row label="Materie prime" value={`-${fm(p.tot_materie)}`} negative />
            <div className="border-t border-slate-100 my-1" />
            <Row label="Margine lordo" value={fm(p.margine_lordo)} bold positive />
            <Row label="Personale" value={`-${fm(p.personale)}`} negative />
            <Row label="Costi fissi" value={`-${fm(p.costi_fissi)}`} negative />
            <div className="border-t border-slate-100 my-1" />
            <Row label="EBITDA" value={fm(p.ebitda)} bold positive={p.ebitda > 0} />
            <Row label="Ammortamenti" value={`-${fm(p.ammortamenti)}`} negative />
            <Row label="Utile netto" value={fm(p.utile_netto)} bold positive={p.utile_netto > 0} />
          </div>
        </div>

        {/* Prime cost / food cost / labor */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Sintesi marginalità</h2>
          <div className="space-y-3">
            <MarginBar label="Food cost" val={i.foodCostPct} target={30} />
            <MarginBar label="Labor cost" val={i.laborPct} target={30} />
            <MarginBar label="Beverage cost" val={i.beverageCostPct} target={25} />
            <div className="border-t border-slate-100 pt-3">
              <div className="flex justify-between text-sm"><span className="text-slate-600 font-medium">Prime cost</span><span className={`font-bold ${i.primeCostPct > 60 ? "text-red-600" : "text-emerald-600"}`}>{pct(i.primeCostPct)}</span></div>
              <p className="text-xs text-slate-400 mt-0.5">target ≤ 60% · food + labor</p>
            </div>
          </div>
        </div>
      </div>

      {/* FORNITORI + SCADENZE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monitoraggio fornitori */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Truck className="w-4 h-4 text-rose-500" /> Monitoraggio fornitori</h2>
            <Link href="/fornitori" className="text-xs text-emerald-600 hover:underline">gestisci</Link>
          </div>
          <div className="space-y-2">
            {data.fornitori.slice(0, 5).map((f: any) => (
              <div key={f.id} className="flex justify-between items-center py-1.5 border-b border-slate-50 text-sm">
                <span className="text-slate-600">{f.name}</span>
                <span className="text-slate-500 text-xs">{f.fatture} fatture</span>
                <span className="font-mono">{fm(f.totale)}</span>
              </div>
            ))}
            {data.fornitori.length === 0 && <p className="text-sm text-slate-400 text-center py-2">Nessun acquisto registrato</p>}
          </div>
        </div>

        {/* Prossime scadenze */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-500" /> Prossime scadenze</h2>
            <Link href="/cash-flow" className="text-xs text-emerald-600 hover:underline">cash flow</Link>
          </div>
          <div className="space-y-2">
            {data.scadenze.slice(0, 5).map((s: any) => {
              const daysTo = Math.ceil((new Date(s.dueDate).getTime() - Date.now()) / 86400000);
              return (
                <div key={s.id} className={`flex justify-between items-center py-1.5 border-b border-slate-50 text-sm ${daysTo <= 7 ? "bg-amber-50 rounded px-2" : ""}`}>
                  <div>
                    <p className="text-slate-700 text-xs">{s.description}</p>
                    <p className="text-slate-400 text-xs">{new Date(s.dueDate).toLocaleDateString("it-IT")} · {daysTo <= 0 ? "scaduta" : `in ${daysTo}gg`}</p>
                  </div>
                  <span className={`font-mono ${s.type === "payment" ? "text-red-600" : "text-emerald-600"}`}>{s.type === "payment" ? "-" : "+"}€ {Math.round(s.amount).toLocaleString("it-IT")}</span>
                </div>
              );
            })}
            {data.scadenze.length === 0 && <p className="text-sm text-slate-400 text-center py-2">Nessuna scadenza</p>}
            <div className="flex justify-between text-xs text-slate-500 pt-2">
              <span>Uscite 30gg: <strong className="text-red-600">{fm(data.prossimeUscite30)}</strong></span>
              <span>Incassi 30gg: <strong className="text-emerald-600">{fm(data.prossimiIncassi30)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* FONTI DATI */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-xs text-slate-500 flex flex-wrap gap-3">
        <span>Fonti dati:</span>
        <Link href="/food-cost" className="hover:text-emerald-600">Food Cost</Link>·
        <Link href="/vendite" className="hover:text-emerald-600">Vendite</Link>·
        <Link href="/accounting" className="hover:text-emerald-600">Fatture</Link>·
        <Link href="/personale" className="hover:text-emerald-600">Personale</Link>·
        <Link href="/cash-flow" className="hover:text-emerald-600">Cash Flow</Link>·
        <Link href="/ammortamenti" className="hover:text-emerald-600">Ammortamenti</Link>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, color, badge }: any) {
  const c: Record<string, string> = { default: "text-slate-900", green: "text-emerald-700", red: "text-red-700", amber: "text-amber-700" };
  const b: Record<string, string> = { default: "border-slate-200", green: "border-emerald-200", red: "border-red-200", amber: "border-amber-200" };
  return (
    <div className={`bg-white rounded-xl border ${b[color]} p-3.5`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {badge && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{badge}</span>}
      </div>
      <p className={`text-xl font-bold ${c[color]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function OpInd({ icon, label, value, sub, color }: any) {
  const m: Record<string, string> = { indigo: "from-indigo-500 to-purple-600", rose: "from-rose-500 to-pink-600", amber: "from-amber-500 to-orange-600", emerald: "from-emerald-500 to-teal-600", green: "from-green-500 to-emerald-600", red: "from-red-500 to-rose-600", sky: "from-sky-500 to-blue-600", slate: "from-slate-500 to-slate-600" };
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${m[color] || "from-slate-500 to-slate-600"} flex items-center justify-center text-white`}>{icon}</div>
        <span className="text-[11px] text-slate-500">{label}</span>
      </div>
      <p className="text-lg font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function Row({ label, value, bold, positive, negative }: any) {
  return (
    <div className="flex justify-between py-1">
      <span className={`${bold ? "font-semibold text-slate-900" : "text-slate-600"}`}>{label}</span>
      <span className={`font-mono ${positive ? "text-emerald-600" : negative ? "text-red-600" : bold ? "text-slate-900" : "text-slate-700"}`}>{value}</span>
    </div>
  );
}

function MarginBar({ label, val, target }: any) {
  const over = val > target;
  const pct = (v: number) => `${v.toFixed(1)}%`;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-600">{label}</span>
        <span className={`font-medium ${over ? "text-red-600" : "text-emerald-600"}`}>{pct(val)}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${over ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, (val / target) * 100)}%` }} />
      </div>
    </div>
  );
}