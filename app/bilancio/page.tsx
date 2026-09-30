"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, TrendingUp, TrendingDown, Building2, Wallet, Package, Truck, ChevronRight, Info, Scale } from "lucide-react";

type VistaCE = "valore_aggiunto" | "margine_contribuzione" | "sintetica";
const PERIODS = [
  { key: "mese", label: "Mese" },
  { key: "trimestre", label: "Trimestre" },
  { key: "anno", label: "Anno" },
];

export default function BilancioPage() {
  const [data, setData] = useState<any>(null);
  const [management, setManagement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ce" | "sp">("ce");
  const [vista, setVista] = useState<VistaCE>("valore_aggiunto");
  const [period, setPeriod] = useState("anno");

  useEffect(() => { void load(period); }, [period]);

  const load = async (selectedPeriod: string) => {
    setLoading(true);
    try {
      const [balanceResponse, controlResponse] = await Promise.all([fetch("/api/bilancio"), fetch(`/api/cost-control?period=${selectedPeriod}`)]);
      const [balance, control] = await Promise.all([balanceResponse.json(), controlResponse.json()]);
      if (!balanceResponse.ok || !controlResponse.ok) throw new Error("Impossibile caricare bilancio e controllo gestionale");
      setData(balance);
      setManagement(control);
    } catch {
      setData(null);
      setManagement(null);
    } finally {
      setLoading(false);
    }
  };

  const fm = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? "N/D" : `€ ${Math.round(v).toLocaleString("it-IT")}`;

  if (loading || !data || !management) return <div className="p-8 text-center text-slate-400">Caricamento bilancio...</div>;

  const source = management.pnl;
  const cogs = source.theoreticalFoodCost + source.theoreticalBeverageCost;
  const occupancy = management.costAreas.filter((area: any) => area.name.toLocaleUpperCase("it-IT").includes("OCCUPAZIONE")).reduce((sum: number, area: any) => sum + area.amount, 0);
  const ce = {
    ricaviVendite: source.posRevenue,
    ricaviCatering: source.issuedRevenue,
    ricaviTotali: source.revenue,
    costiMateriePrime: cogs,
    valoreAggiunto: source.revenue - cogs,
    costiServizi: Math.max(0, source.operatingInvoices - occupancy),
    costiGodimento: occupancy,
    costiPersonale: source.payroll + source.externalPersonnelInvoices,
    mol: source.EBITDAEstimate,
    ammortamenti: source.depreciationEstimate,
    ebit: source.operatingResultEstimate,
    oneriFinanziari: source.financialCosts,
    utileAnteImposte: source.resultBeforeTaxEstimate,
    imposte: null,
    utileNetto: null,
  };
  const sp = data.statoPatrimoniale;
  const share = (value: number | null | undefined) => ce.ricaviTotali > 0 && value != null ? value / ce.ricaviTotali * 100 : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bilancio</h1>
          <p className="text-sm text-slate-500">Conto Economico gestionale · {management.period.label} · {management.period.from} – {management.period.to}</p>
        </div>
        <div className="flex gap-2 text-xs">
          {PERIODS.map(option => <button key={option.key} onClick={() => setPeriod(option.key)} className={`rounded-md px-2 py-1.5 ${period === option.key ? "bg-emerald-100 font-semibold text-emerald-800" : "text-slate-500 hover:bg-slate-100"}`}>{option.label}</button>)}
          <Link href="/accounting" className="text-emerald-600 hover:underline">Fatture →</Link>
          <Link href="/cash-flow" className="text-emerald-600 hover:underline">Cash Flow →</Link>
          <Link href="/ammortamenti" className="text-emerald-600 hover:underline">Ammortamenti →</Link>
          <Link href="/personale" className="text-emerald-600 hover:underline">Personale →</Link>
        </div>
      </div>

      {/* KPI sintetici */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox label="Ricavi Totali" value={fm(ce.ricaviTotali)} color="blue" />
        <KpiBox label="MOL / EBITDA gestionale" value={fm(ce.mol)} sub={share(ce.mol) == null ? "margine N/D" : `${share(ce.mol)!.toFixed(1)}% · ${management.kpi.ebitdaQuality}`} color={(ce.mol || 0) > 0 ? "green" : "red"} />
        <KpiBox label="Utile Netto" value={fm(ce.utileNetto)} sub="non calcolato: imposte non disponibili" color="amber" />
        <KpiBox label="Patrimonio Netto" value={fm(sp.patrimonioNetto)} sub="snapshot gestionale stimato" color="amber" />
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><Info className="mt-0.5 h-4 w-4 shrink-0"/><p>Conto Economico gestionale ricostruito dai dati disponibili. Food/Beverage Cost è teorico da schede ricetta; EBITDA e Stato Patrimoniale sono preliminari finché ricette, inventari, fatture e personale non hanno copertura completa. L’utile netto non viene stimato senza imposte configurate.</p></div>

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
                <CERow label="Ricavi delle vendite POS" value={ce.ricaviVendite} pct={share(ce.ricaviVendite)} bold positive />
                <CERow label="Ricavi catering/eventi" value={ce.ricaviCatering} pct={share(ce.ricaviCatering)} positive indent />
                <CERow label="RICAVI TOTALI" value={ce.ricaviTotali} pct={100} bold total />

                <CERow label="Costi materie prime (food + beverage)" value={-ce.costiMateriePrime} pct={share(-ce.costiMateriePrime)} negative />
                <div className="border-t border-slate-100 my-1" />
                <CERow label="VALORE AGGIUNTO TEORICO" value={ce.valoreAggiunto} pct={share(ce.valoreAggiunto)} bold total />

                <CERow label="Altri costi operativi da fatture" value={-ce.costiServizi} pct={share(-ce.costiServizi)} negative />
                <CERow label="Costi di occupazione e struttura" value={-ce.costiGodimento} pct={share(-ce.costiGodimento)} negative />
                <CERow label="Costo del personale" value={-ce.costiPersonale} pct={share(-ce.costiPersonale)} negative />
                <div className="border-t border-slate-100 my-1" />
                <CERow label="MOL / EBITDA gestionale preliminare" value={ce.mol} pct={share(ce.mol)} bold total />

                <CERow label="Ammortamenti" value={-ce.ammortamenti} pct={share(-ce.ammortamenti)} negative />
                <CERow label="EBIT (Risultato Operativo)" value={ce.ebit} pct={share(ce.ebit)} bold total />
                <CERow label="Oneri finanziari da fatture" value={-ce.oneriFinanziari} pct={share(-ce.oneriFinanziari)} negative />
                <CERow label="Risultato ante imposte gestionale" value={ce.utileAnteImposte} pct={share(ce.utileAnteImposte)} bold />
                <CERow label="Imposte" value={null} pct={null} negative />
                <CERow label="UTILE NETTO" value={null} pct={null} bold total />
              </>
            )}

            {vista === "margine_contribuzione" && (
              <>
                <CERow label="Ricavi netti" value={ce.ricaviTotali} pct={100} bold positive />
                <CERow label="Costi variabili teorici (materie prime)" value={-ce.costiMateriePrime} pct={share(-ce.costiMateriePrime)} negative />
                <div className="border-t border-slate-100 my-1" />
                <CERow label="MARGINE DI CONTRIBUZIONE TEORICO" value={ce.ricaviTotali - ce.costiMateriePrime} pct={share(ce.ricaviTotali - ce.costiMateriePrime)} bold total />
                <CERow label="Personale + altri costi classificati" value={-(ce.costiPersonale + ce.costiServizi + ce.costiGodimento)} pct={share(-(ce.costiPersonale + ce.costiServizi + ce.costiGodimento))} negative />
                <div className="border-t border-slate-100 my-1" />
                <CERow label="MOL / EBITDA gestionale preliminare" value={ce.mol} pct={share(ce.mol)} bold total />
                <CERow label="Ammortamenti + oneri finanziari" value={-(ce.ammortamenti + ce.oneriFinanziari)} pct={share(-(ce.ammortamenti + ce.oneriFinanziari))} negative />
                <CERow label="UTILE NETTO" value={null} pct={null} bold total />
              </>
            )}

            {vista === "sintetica" && (
              <>
                <CERow label="Ricavi netti" value={ce.ricaviTotali} pct={100} bold positive />
                <CERow label="Costi materie prime teorici" value={-ce.costiMateriePrime} pct={share(-ce.costiMateriePrime)} negative />
                <CERow label="Costo personale" value={-ce.costiPersonale} pct={share(-ce.costiPersonale)} negative />
                <CERow label="Altri costi operativi classificati" value={-(ce.costiServizi + ce.costiGodimento)} pct={share(-(ce.costiServizi + ce.costiGodimento))} negative />
                <CERow label="Ammortamenti e oneri" value={-(ce.ammortamenti + ce.oneriFinanziari)} pct={share(-(ce.ammortamenti + ce.oneriFinanziari))} negative />
                <div className="border-t border-slate-100 my-1" />
                <CERow label="EBITDA gestionale preliminare" value={ce.mol} pct={share(ce.mol)} bold total />
                <CERow label="UTILE NETTO" value={null} pct={null} bold total />
              </>
            )}
          </div>

          <div className="px-4 py-3 bg-slate-50 border-t text-xs text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> Fonti: Controllo di Gestione per il periodo selezionato. Costi ricetta teorici; IVA, inventario e copertura fonti mostrati separatamente.
          </div>
        </div>
      )}

      {/* STATO PATRIMONIALE */}
      {tab === "sp" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><Info className="mt-0.5 h-4 w-4 shrink-0"/><p>Snapshot operativo provvisorio: disponibilità e rimanenze arrivano dai moduli collegati, mentre debiti, TFR e patrimonio netto non sostituiscono una situazione patrimoniale riconciliata con la contabilità.</p></div>
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
               <SPRow label="Fatture fornitori approvate (da riconciliare)" value={sp.debitiFornitori} />
               <SPRow label="Fondo TFR stimato" value={sp.fondoTRF} />
               <SPRow label="Debiti tributari stimati" value={sp.debitiTributari} />
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
  const m: Record<string, string> = { blue: "bg-blue-50 border-blue-200 text-blue-700", green: "bg-emerald-50 border-emerald-200 text-emerald-700", red: "bg-red-50 border-red-200 text-red-700", amber: "bg-amber-50 border-amber-200 text-amber-700" };
  return (
    <div className={`${m[color] || "bg-white border-slate-200"} rounded-xl p-4 border`}>
      <p className="text-xs opacity-70 mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

function CERow({ label, value, pct, bold, indent, positive, negative, total }: { label: string; value: number | null; pct: number | null; bold?: boolean; indent?: boolean; positive?: boolean; negative?: boolean; total?: boolean }) {
  const knownValue = value != null && Number.isFinite(value);
  const knownPct = pct != null && Number.isFinite(pct);
  return (
    <div className={`flex items-center justify-between py-1.5 ${bold ? "font-semibold" : ""} ${total ? "bg-slate-50 -mx-2 px-2 rounded" : ""}`}>
      <span className={`${indent ? "pl-4" : ""} ${bold ? "text-slate-900" : "text-slate-600"}`}>{label}</span>
      <div className="flex items-center gap-4">
        <span className="text-xs text-slate-400 w-14 text-right">{knownPct ? `${pct!.toFixed(1)}%` : ""}</span>
        <span className={`font-mono w-28 text-right ${!knownValue ? "text-slate-400" : positive ? "text-emerald-600" : negative ? "text-red-600" : bold ? "text-slate-900" : "text-slate-700"}`}>
          {knownValue ? `${value! < 0 ? "−" : ""}€ ${Math.abs(Math.round(value!)).toLocaleString("it-IT")}` : "N/D"}
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
