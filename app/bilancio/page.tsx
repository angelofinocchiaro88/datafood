"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, TrendingUp, TrendingDown, Building2, Wallet, Package, Truck, ChevronRight, Info, Scale } from "lucide-react";

type VistaCE = "valore_aggiunto" | "margine_contribuzione" | "sintetica";

export default function BilancioPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ce" | "sp">("ce");
  const [vista, setVista] = useState<VistaCE>("valore_aggiunto");

  useEffect(() => {
    fetch("/api/bilancio").then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const fm = (v: number) => `€ ${Math.round(v).toLocaleString("it-IT")}`;

  if (loading || !data) return <div className="p-8 text-center text-slate-400">Caricamento bilancio...</div>;

  const ce = data.contoEconomico;
  const sp = data.statoPatrimoniale;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bilancio</h1>
          <p className="text-sm text-slate-500">Conto Economico riclassificato e Stato Patrimoniale · Q1 2026</p>
        </div>
        <div className="flex gap-2 text-xs">
          <Link href="/accounting" className="text-emerald-600 hover:underline">Fatture →</Link>
          <Link href="/cash-flow" className="text-emerald-600 hover:underline">Cash Flow →</Link>
          <Link href="/ammortamenti" className="text-emerald-600 hover:underline">Ammortamenti →</Link>
          <Link href="/personale" className="text-emerald-600 hover:underline">Personale →</Link>
        </div>
      </div>

      {/* KPI sintetici */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox label="Ricavi Totali" value={fm(ce.ricaviTotali)} color="blue" />
        <KpiBox label="MOL / EBITDA" value={fm(ce.mol)} sub={`${ce.ricaviTotali > 0 ? (ce.mol / ce.ricaviTotali * 100).toFixed(1) : 0}%`} color={ce.mol > 0 ? "green" : "red"} />
        <KpiBox label="Utile Netto" value={fm(ce.utileNetto)} sub={`${ce.ricaviTotali > 0 ? (ce.utileNetto / ce.ricaviTotali * 100).toFixed(1) : 0}%`} color={ce.utileNetto > 0 ? "green" : "red"} />
        <KpiBox label="Patrimonio Netto" value={fm(sp.patrimonioNetto)} color={sp.patrimonioNetto > 0 ? "green" : "red"} />
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button onClick={() => setTab("ce")} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 ${tab === "ce" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
            <FileText className="w-4 h-4" /> Conto Economico
          </button>
          <button onClick={() => setTab("sp")} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 ${tab === "sp" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
            <Scale className="w-4 h-4" /> Stato Patrimoniale
          </button>
        </div>

        {tab === "ce" && (
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {([
              { k: "valore_aggiunto", l: "Valore Aggiunto" },
              { k: "margine_contribuzione", l: "Margine Contribuzione" },
              { k: "sintetica", l: "Sintetica" },
            ] as const).map(v => (
              <button key={v.k} onClick={() => setVista(v.k)} className={`px-3 py-1.5 rounded-md text-xs font-medium ${vista === v.k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{v.l}</button>
            ))}
          </div>
        )}
      </div>

      {/* CONTO ECONOMICO */}
      {tab === "ce" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Conto Economico · {vista === "valore_aggiunto" ? "a Valore Aggiunto" : vista === "margine_contribuzione" ? "a Margine di Contribuzione" : "Sintetico"}</h3>
            <span className="text-xs text-slate-400">importi in € · % su ricavi</span>
          </div>

          <div className="p-4 space-y-1">
            {vista === "valore_aggiunto" && (
              <>
                <CERow label="Ricavi delle vendite" value={ce.ricaviVendite} pct={ce.ricaviVendite / ce.ricaviTotali * 100} bold positive />
                <CERow label="Ricavi catering/eventi" value={ce.ricaviCatering} pct={ce.ricaviCatering / ce.ricaviTotali * 100} positive indent />
                <CERow label="RICAVI TOTALI" value={ce.ricaviTotali} pct={100} bold total />

                <CERow label="Costi materie prime (food + beverage)" value={-ce.costiMateriePrime} pct={-ce.costiMateriePrime / ce.ricaviTotali * 100} negative />
                <div className="border-t border-slate-100 my-1" />
                <CERow label="VALORE AGGIUNTO" value={ce.valoreAggiunto} pct={ce.valoreAggiunto / ce.ricaviTotali * 100} bold total />

                <CERow label="Costi per servizi" value={-ce.costiServizi} pct={-ce.costiServizi / ce.ricaviTotali * 100} negative />
                <CERow label="Costi godimento beni terzi (affitti)" value={-ce.costiGodimento} pct={-ce.costiGodimento / ce.ricaviTotali * 100} negative />
                <CERow label="Costo del personale" value={-ce.costiPersonale} pct={-ce.costiPersonale / ce.ricaviTotali * 100} negative />
                <div className="border-t border-slate-100 my-1" />
                <CERow label="MOL / EBITDA" value={ce.mol} pct={ce.mol / ce.ricaviTotali * 100} bold total />

                <CERow label="Ammortamenti" value={-ce.ammortamenti} pct={-ce.ammortamenti / ce.ricaviTotali * 100} negative />
                <CERow label="EBIT (Risultato Operativo)" value={ce.ebit} pct={ce.ebit / ce.ricaviTotali * 100} bold total />
                <CERow label="Oneri finanziari" value={-ce.oneriFinanziari} pct={-ce.oneriFinanziari / ce.ricaviTotali * 100} negative />
                <CERow label="Risultato ante imposte" value={ce.utileAnteImposte} pct={ce.utileAnteImposte / ce.ricaviTotali * 100} bold />
                <CERow label="Imposte" value={-ce.imposte} pct={-ce.imposte / ce.ricaviTotali * 100} negative />
                <CERow label="UTILE NETTO" value={ce.utileNetto} pct={ce.utileNetto / ce.ricaviTotali * 100} bold total positive={ce.utileNetto > 0} />
              </>
            )}

            {vista === "margine_contribuzione" && (
              <>
                <CERow label="Ricavi totali" value={ce.ricaviTotali} pct={100} bold positive />
                <CERow label="Costi variabili (materie prime)" value={-ce.costiMateriePrime} pct={-ce.costiMateriePrime / ce.ricaviTotali * 100} negative />
                <div className="border-t border-slate-100 my-1" />
                <CERow label="MARGINE DI CONTRIBUZIONE" value={ce.ricaviTotali - ce.costiMateriePrime} pct={(ce.ricaviTotali - ce.costiMateriePrime) / ce.ricaviTotali * 100} bold total />
                <CERow label="Costi fissi (personale + servizi + affitti)" value={-(ce.costiPersonale + ce.costiServizi + ce.costiGodimento)} pct={-(ce.costiPersonale + ce.costiServizi + ce.costiGodimento) / ce.ricaviTotali * 100} negative />
                <div className="border-t border-slate-100 my-1" />
                <CERow label="MOL / EBITDA" value={ce.mol} pct={ce.mol / ce.ricaviTotali * 100} bold total />
                <CERow label="Ammortamenti + oneri" value={-(ce.ammortamenti + ce.oneriFinanziari)} pct={-(ce.ammortamenti + ce.oneriFinanziari) / ce.ricaviTotali * 100} negative />
                <CERow label="UTILE NETTO" value={ce.utileNetto} pct={ce.utileNetto / ce.ricaviTotali * 100} bold total positive={ce.utileNetto > 0} />
              </>
            )}

            {vista === "sintetica" && (
              <>
                <CERow label="Ricavi" value={ce.ricaviTotali} pct={100} bold positive />
                <CERow label="Costi materie prime" value={-ce.costiMateriePrime} pct={-ce.costiMateriePrime / ce.ricaviTotali * 100} negative />
                <CERow label="Costo personale" value={-ce.costiPersonale} pct={-ce.costiPersonale / ce.ricaviTotali * 100} negative />
                <CERow label="Altri costi operativi" value={-(ce.costiServizi + ce.costiGodimento)} pct={-(ce.costiServizi + ce.costiGodimento) / ce.ricaviTotali * 100} negative />
                <CERow label="Ammortamenti e oneri" value={-(ce.ammortamenti + ce.oneriFinanziari)} pct={-(ce.ammortamenti + ce.oneriFinanziari) / ce.ricaviTotali * 100} negative />
                <div className="border-t border-slate-100 my-1" />
                <CERow label="UTILE NETTO" value={ce.utileNetto} pct={ce.utileNetto / ce.ricaviTotali * 100} bold total positive={ce.utileNetto > 0} />
              </>
            )}
          </div>

          <div className="px-4 py-3 bg-slate-50 border-t text-xs text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> Fonti: Vendite, Food Cost, Fatture, Personale, Ammortamenti — dati reali Q1 2026
          </div>
        </div>
      )}

      {/* STATO PATRIMONIALE */}
      {tab === "sp" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ATTIVO */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-emerald-50 border-b">
              <h3 className="font-semibold text-emerald-800">ATTIVO</h3>
            </div>
            <div className="p-4 space-y-1">
              <SPRow label="Immobilizzazioni lorde" value={sp.immobilizzazioniLorde} indent />
              <SPRow label="Fondo ammortamento" value={-sp.fondoAmmortamento} negative indent />
              <SPRow label="Immobilizzazioni nette" value={sp.immobilizzazioniNette} bold />
              <div className="border-t border-slate-100 my-1" />
              <SPRow label="Rimanenze di magazzino" value={sp.valoreMagazzino} />
              <SPRow label="Crediti verso clienti" value={sp.creditiClienti} />
              <SPRow label="Disponibilità liquide" value={sp.liquidita} />
              <div className="border-t-2 border-slate-200 my-2" />
              <SPRow label="TOTALE ATTIVO" value={sp.totaleAttivo} bold total />
            </div>
          </div>

          {/* PASSIVO */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-rose-50 border-b">
              <h3 className="font-semibold text-rose-800">PASSIVO E PATRIMONIO NETTO</h3>
            </div>
            <div className="p-4 space-y-1">
              <SPRow label="Debiti verso fornitori" value={sp.debitiFornitori} />
              <SPRow label="Fondo TFR" value={sp.fondoTRF} />
              <SPRow label="Debiti tributari" value={sp.debitiTributari} />
              <SPRow label="Totale debiti" value={sp.totaleDebiti} bold />
              <div className="border-t border-slate-100 my-1" />
              <SPRow label="Patrimonio netto" value={sp.patrimonioNetto} bold positive={sp.patrimonioNetto > 0} />
              <div className="border-t-2 border-slate-200 my-2" />
              <SPRow label="TOTALE PASSIVO E PN" value={sp.totalePassivo} bold total />
            </div>
          </div>

          {/* Collegamenti */}
          <div className="lg:col-span-2 bg-slate-50 rounded-xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Collegamenti alle fonti</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <SourceLink icon={<Building2 className="w-4 h-4" />} label="Immobilizzazioni" source="Ammortamenti" href="/ammortamenti" />
              <SourceLink icon={<Package className="w-4 h-4" />} label="Magazzino" source="Magazzino" href="/magazzino" />
              <SourceLink icon={<Wallet className="w-4 h-4" />} label="Liquidità" source="Cash Flow" href="/cash-flow" />
              <SourceLink icon={<Truck className="w-4 h-4" />} label="Debiti fornitori" source="Fatture" href="/accounting" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiBox({ label, value, sub, color }: any) {
  const m: Record<string, string> = { blue: "bg-blue-50 border-blue-200 text-blue-700", green: "bg-emerald-50 border-emerald-200 text-emerald-700", red: "bg-red-50 border-red-200 text-red-700" };
  return (
    <div className={`${m[color] || "bg-white border-slate-200"} rounded-xl p-4 border`}>
      <p className="text-xs opacity-70 mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

function CERow({ label, value, pct, bold, indent, positive, negative, total }: any) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${bold ? "font-semibold" : ""} ${total ? "bg-slate-50 -mx-2 px-2 rounded" : ""}`}>
      <span className={`${indent ? "pl-4" : ""} ${bold ? "text-slate-900" : "text-slate-600"}`}>{label}</span>
      <div className="flex items-center gap-4">
        <span className="text-xs text-slate-400 w-14 text-right">{pct !== undefined ? `${pct.toFixed(1)}%` : ""}</span>
        <span className={`font-mono w-28 text-right ${positive ? "text-emerald-600" : negative ? "text-red-600" : bold ? "text-slate-900" : "text-slate-700"}`}>
          {value < 0 ? "-" : ""}€ {Math.abs(Math.round(value)).toLocaleString("it-IT")}
        </span>
      </div>
    </div>
  );
}

function SPRow({ label, value, bold, indent, negative, total, positive }: any) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${bold ? "font-semibold" : ""} ${total ? "bg-slate-50 -mx-2 px-2 rounded" : ""}`}>
      <span className={`${indent ? "pl-4" : ""} ${bold ? "text-slate-900" : "text-slate-600"}`}>{label}</span>
      <span className={`font-mono ${negative ? "text-red-600" : positive ? "text-emerald-600" : bold ? "text-slate-900" : "text-slate-700"}`}>
        {value < 0 ? "-" : ""}€ {Math.abs(Math.round(value)).toLocaleString("it-IT")}
      </span>
    </div>
  );
}

function SourceLink({ icon, label, source, href }: any) {
  return (
    <Link href={href} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-emerald-400 transition-colors">
      <span className="text-slate-400">{icon}</span>
      <div>
        <p className="font-medium text-slate-700">{label}</p>
        <p className="text-slate-400">{source}</p>
      </div>
    </Link>
  );
}