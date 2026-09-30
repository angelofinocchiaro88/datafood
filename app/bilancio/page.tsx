"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, Building2, Wallet, Package, Truck, ChevronDown, ChevronRight, Info, Scale } from "lucide-react";

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
  const [period, setPeriod] = useState("anno");
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);

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
  const occupancy = management.costAreas.filter((area: any) => area.name.toLocaleUpperCase("it-IT").includes("OCCUPAZIONE")).reduce((sum: number, area: any) => sum + area.amount, 0);
  const services = Math.max(0, source.operatingInvoices - occupancy);
  const ce = {
    ricaviVendite: source.posRevenue,
    ricaviCatering: source.issuedRevenue,
    ricaviTotali: source.revenue,
    costiFood: source.theoreticalFoodCost,
    costiBeverage: source.theoreticalBeverageCost,
    costiMateriePrime: source.theoreticalFoodCost + source.theoreticalBeverageCost,
    margineLordoPos: source.grossMargin,
    costiServizi: services,
    costiGodimento: occupancy,
    costiPersonale: source.payroll,
    costiPersonaleEsterno: source.externalPersonnelInvoices,
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

      </div>

      {/* CONTO ECONOMICO */}
      {tab === "ce" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
            <div><h3 className="font-semibold text-slate-800">Conto Economico gestionale · {management.period.label}</h3><p className="text-xs text-slate-500">Voci e sotto-voci derivate da vendite, fatture classificate, personale e cespiti.</p></div>
            <span className="text-xs text-slate-400">€ · % sul totale ricavi</span>
          </div>

          <div className="p-4 space-y-1">
            <CERow label="Ricavi POS netti" value={ce.ricaviVendite} pct={share(ce.ricaviVendite)} positive />
            <CERow label="Ricavi catering / eventi" value={ce.ricaviCatering} pct={share(ce.ricaviCatering)} positive indent />
            <CERow label="RICAVI TOTALI NETTI" value={ce.ricaviTotali} pct={100} bold total />
            <div className="my-2 border-t border-slate-200" />
            <CERow label="Food Cost teorico · vendite POS" value={-ce.costiFood} pct={share(-ce.costiFood)} negative />
            <CERow label="Beverage Cost teorico · vendite POS" value={-ce.costiBeverage} pct={share(-ce.costiBeverage)} negative />
            <CERow label="MARGINE LORDO TEORICO POS" value={ce.margineLordoPos} pct={share(ce.margineLordoPos)} bold total />
            <p className="px-2 py-1 text-[10px] text-slate-400">Le fatture di eventi sono ricavi separati: finché non sono collegate a ricette, i relativi costi non entrano nel margine Food Cost.</p>
            <div className="my-2 border-t border-slate-200" />
            <CERow label="Personale da buste / stima contratti" value={-ce.costiPersonale} pct={share(-ce.costiPersonale)} negative />
            <CERow label="Personale esterno da fatture" value={-ce.costiPersonaleEsterno} pct={share(-ce.costiPersonaleEsterno)} negative />
            <CERow label="Costi operativi da conti classificati" value={-ce.costiServizi} pct={share(-ce.costiServizi)} negative />
            <CERow label="Occupazione e struttura da fatture" value={-ce.costiGodimento} pct={share(-ce.costiGodimento)} negative />
            <CERow label="MOL / EBITDA gestionale preliminare" value={ce.mol} pct={share(ce.mol)} bold total />
            <CERow label="Ammortamenti" value={-ce.ammortamenti} pct={share(-ce.ammortamenti)} negative />
            <CERow label="EBIT gestionale preliminare" value={ce.ebit} pct={share(ce.ebit)} bold total />
            <CERow label="Oneri finanziari classificati" value={-ce.oneriFinanziari} pct={share(-ce.oneriFinanziari)} negative />
            <CERow label="Risultato ante imposte" value={ce.utileAnteImposte} pct={share(ce.utileAnteImposte)} bold />
            <CERow label="Imposte" value={null} pct={null} negative />
            <CERow label="UTILE NETTO" value={null} pct={null} bold total />
          </div>

          <div className="border-t border-slate-200">
            <button onClick={() => setShowInvoiceDetails(value => !value)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"><span>Dettaglio voci fattura · {management.invoiceDetails.length} righe documento</span>{showInvoiceDetails ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}</button>
            {showInvoiceDetails && (management.invoiceDetails.length > 0 ? <div className="overflow-x-auto border-t border-slate-100"><table className="w-full min-w-[1100px] text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 text-left">Data / doc.</th><th className="px-3 py-2 text-left">Fornitore</th><th className="px-3 py-2 text-left">Conto gestionale / area</th><th className="px-3 py-2 text-left">Categoria / voce</th><th className="px-3 py-2 text-left">Riga documento</th><th className="px-3 py-2 text-right">Quantità</th><th className="px-3 py-2 text-right">Prezzo unitario</th><th className="px-3 py-2 text-right">Importo riga</th></tr></thead><tbody className="divide-y divide-slate-100">{management.invoiceDetails.map((item: any) => <tr key={item.id}><td className="px-3 py-2 text-slate-600">{new Date(item.date).toLocaleDateString("it-IT")}<span className="block text-[10px] text-slate-400">{item.invoiceNumber}</span></td><td className="px-3 py-2">{item.supplier}</td><td className="px-3 py-2">{item.contoGestionale || item.macroArea || <span className="text-amber-700">Non classificato</span>}</td><td className="px-3 py-2 text-slate-600">{[item.category, item.subcategory, item.detail].filter(Boolean).join(" · ") || "—"}</td><td className="px-3 py-2">{item.description}{item.ingredient && <span className="ml-1 text-slate-400">· {item.ingredient}</span>}</td><td className="px-3 py-2 text-right">{item.quantity == null ? "—" : item.quantity}</td><td className="px-3 py-2 text-right">{item.unitPrice == null ? "—" : fm(item.unitPrice)}</td><td className="px-3 py-2 text-right font-medium">{fm(item.lineTotal)}</td></tr>)}</tbody></table></div> : <div className="p-6 text-center text-sm text-slate-400">Nessuna fattura approvata nel periodo. Importa e classifica i documenti per popolare le voci.</div>)}
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
              <SPRow label="Debiti verso fornitori riconciliati" value={sp.debitiFornitori} />
              <SPRow label="Fondo TFR (saldo iniziale non registrato)" value={sp.fondoTRF} />
              <SPRow label="Debiti tributari (non integrati)" value={sp.debitiTributari} />
              <SPRow label="Totale debiti riconciliati" value={sp.totaleDebiti} bold />
              <div className="border-t border-slate-100 my-1" />
              <SPRow label="Patrimonio netto" value={sp.patrimonioNetto} bold positive={sp.patrimonioNetto > 0} />
              <div className="border-t-2 border-slate-200 my-2" />
              <SPRow label="TOTALE PASSIVO E PN" value={sp.totalePassivo} bold total />
            </div>
          </div>

          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-800">Importi da riconciliare</h4>
            <p className="mt-1 text-xs text-slate-500">Sono saldi operativi censiti, non passività certe finché non vengono abbinati a pagamenti e contabilità.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Fatture fornitori approvate</p><p className="mt-1 text-lg font-bold text-slate-900">{fm(sp.fattureFornitoriDaRiconciliare)}</p><p className="text-[10px] text-slate-400">{data.dataQuality.approvedSupplierInvoicesCount} documenti · stato pagamento non riconciliato</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Crediti da fatture emesse</p><p className="mt-1 text-lg font-bold text-slate-900">{fm(sp.creditiClienti)}</p><p className="text-[10px] text-slate-400">{data.dataQuality.issuedInvoicesToReconcileCount} fatture EMESSE · incassi non abbinati</p></div>
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
  const knownValue = value != null && Number.isFinite(value);
  return (
    <div className={`flex items-center justify-between py-1.5 ${bold ? "font-semibold" : ""} ${total ? "bg-slate-50 -mx-2 px-2 rounded" : ""}`}>
      <span className={`${indent ? "pl-4" : ""} ${bold ? "text-slate-900" : "text-slate-600"}`}>{label}</span>
      <span className={`font-mono ${!knownValue ? "text-slate-400" : negative ? "text-red-600" : positive ? "text-emerald-600" : bold ? "text-slate-900" : "text-slate-700"}`}>
        {knownValue ? `${value < 0 ? "−" : ""}€ ${Math.abs(Math.round(value)).toLocaleString("it-IT")}` : "N/D"}
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
