"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Upload, FileText, Plus, Calendar, Search, TrendingUp, Download, ClipboardPaste, Database, ArrowRight, CheckCircle2 } from "lucide-react";
import { getClientId } from "@/components/layout/ClientSelector";

export default function CorrispettiviPage() {
  const [tab, setTab] = useState<"import" | "storico" | "manuale">("import");
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [taxEditId, setTaxEditId] = useState<string | null>(null);
  const [taxEditAmount, setTaxEditAmount] = useState("");

  // Manual entry
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualTotal, setManualTotal] = useState("");
  const [manualTax, setManualTax] = useState("");
  const [manualCovers, setManualCovers] = useState("");
  const [manualPayment, setManualPayment] = useState("CASH");

  // CSV paste
  const [csvText, setCsvText] = useState("");

  useEffect(() => { loadSales(); }, []);

  const loadSales = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales?limit=100&clientId=${encodeURIComponent(getClientId())}`);
      const data = await res.json();
      setSales(Array.isArray(data) ? data : data.sales || []);
    } catch { setMsg("Errore nel caricamento dei corrispettivi."); }
    setLoading(false);
  };

  const handleManualAdd = async () => {
    if (!manualTotal) return;
    const response = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: getClientId(),
        date: manualDate,
        total: parseFloat(manualTotal),
        ...(manualTax !== "" ? { taxAmount: parseFloat(manualTax) } : {}),
        coverCount: manualCovers ? parseInt(manualCovers) : 1,
        paymentMethod: manualPayment,
        type: "MANUAL",
        source: "corrispettivi_manuale",
      }),
    });
    if (!response.ok) { const result = await response.json(); setMsg(`Errore: ${result.error || "corrispettivo non registrato"}`); return; }
    setMsg("✅ Corrispettivo registrato");
    setManualTotal(""); setManualTax(""); setManualCovers("");
    loadSales();
  };

  const saveExistingTax = async (saleId: string) => {
    const taxAmount = Number(taxEditAmount);
    if (!Number.isFinite(taxAmount) || taxAmount < 0) { setMsg("Inserisci un importo IVA valido."); return; }
    const response = await fetch(`/api/sales/${saleId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: getClientId(), taxAmount }) });
    const result = await response.json();
    if (!response.ok) { setMsg(`Errore: ${result.error || "IVA non aggiornata"}`); return; }
    setTaxEditId(null);
    setTaxEditAmount("");
    setMsg("IVA verificata: il corrispettivo ora contribuisce ai ricavi netti.");
    await loadSales();
  };

  const handleCsvPaste = async () => {
    if (!csvText.trim()) return;
    const lines = csvText.trim().split(/\r?\n/);
    let count = 0;
    const errors: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const delimiter = lines[i].includes(";") ? ";" : lines[i].includes("\t") ? "\t" : ",";
      const cols = lines[i].split(delimiter).map(value => value.trim().replace(/^"|"$/g, ""));
      if (cols.length < 2) continue;
      const date = cols[0]?.trim();
      const parseAmount = (value?: string) => {
        if (!value) return NaN;
        let normalized = value.replace(/[\s€]/g, "");
        if (normalized.includes(",") && normalized.includes(".")) normalized = normalized.lastIndexOf(",") > normalized.lastIndexOf(".") ? normalized.replace(/\./g, "").replace(",", ".") : normalized.replace(/,/g, "");
        else normalized = normalized.replace(",", ".");
        return Number(normalized);
      };
      const total = parseAmount(cols[1]);
      const covers = cols[2] ? parseInt(cols[2]) : 1;
      const paymentMethod = (cols[3] || "CASH").toUpperCase();
      const taxAmount = cols[4] ? parseAmount(cols[4]) : undefined;
      if (!date || isNaN(total)) continue;
      try {
        const response = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: getClientId(), date, total, ...(taxAmount == null ? {} : { taxAmount }), coverCount: covers, paymentMethod, type: "MANUAL", source: "corrispettivi_csv" }),
        });
        if (response.ok) count++;
        else { const result = await response.json(); errors.push(`Riga ${i + 1}: ${result.error || "non importata"}`); }
      } catch { errors.push(`Riga ${i + 1}: errore di rete`); }
    }
    setMsg(`${count} corrispettivi importati.${errors.length ? ` ${errors.length} righe non importate: ${errors.slice(0, 3).join(" · ")}` : ""}`);
    setCsvText("");
    loadSales();
  };

  const totalRev = sales.reduce((s: number, sa: any) => s + sa.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-gray-900">Corrispettivi</h1>
        <p className="text-gray-500 text-sm">Importa corrispettivi giornalieri da qualsiasi fonte</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { key: "import", label: "Importa", icon: <Upload className="w-4 h-4" /> },
          { key: "manuale", label: "Manuale", icon: <Plus className="w-4 h-4" /> },
          { key: "storico", label: "Storico", icon: <Database className="w-4 h-4" /> },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === t.key ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {msg && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{msg}</div>}

      {/* TAB: Importa */}
      {tab === "import" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CSV Paste */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardPaste className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold">Incolla CSV</h3>
                <p className="text-xs text-gray-500">Dal sito Agenzia Entrate o export POS</p>
              </div>
            </div>
            <textarea value={csvText} onChange={e => setCsvText(e.target.value)}
              placeholder={`Data, Totale lordo, Coperti, Pagamento, IVA\n2026-01-15, 1840.50, 62, CASH, 167.32\n2026-01-16, 2100.00, 70, CARD, 190.91`}
              className="w-full h-32 border border-gray-300 rounded-lg p-3 text-xs font-mono resize-none" />
            <button onClick={handleCsvPaste} disabled={!csvText.trim()}
              className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-50">
              Importa CSV
            </button>
            <p className="text-xs text-gray-400 mt-2">
              Formato: Data, Totale lordo, Coperti, Pagamento, IVA (facoltativa). Separatore: virgola, punto e virgola o tab. Se l’IVA manca, il ricavo netto resta N/D.
            </p>
          </div>

          {/* Sources explanation */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold">Fonti Disponibili</h3>
                <p className="text-xs text-gray-500">Scegli la fonte in base a cosa hai</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <SourceCard icon="🏛️" title="Agenzia Entrate" desc="Scarica CSV dal portale Fatture e Corrispettivi → Incolla qui sopra" color="bg-blue-50 border-blue-200" />
              <SourceCard icon="🖨️" title="Export Registratore" desc="Esporta CSV/XML dal tuo registratore telematico → Carica file" color="bg-green-50 border-green-200" />
              <SourceCard icon="☁️" title="Cassa in Cloud API" desc="Connessione automatica via API (serve API key del cliente)" color="bg-purple-50 border-purple-200" status="ready" />
              <SourceCard icon="📊" title="Fatture in Cloud" desc="Scarica da cassetto fiscale via API (serve account cliente)" color="bg-amber-50 border-amber-200" status="planned" />
              <SourceCard icon="✏️" title="Inserimento Manuale" desc="Digita i totali giornalieri a mano" color="bg-gray-50 border-gray-200" status="ready" />
            </div>
          </div>
        </div>
      )}

      {/* TAB: Manuale */}
      {tab === "manuale" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-md">
          <h3 className="font-semibold mb-4">Registra Corrispettivo Giornaliero</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data</label>
              <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Incasso Totale (€)</label>
              <input type="number" step="0.01" value={manualTotal} onChange={e => setManualTotal(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="1840.50" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">IVA totale inclusa (facoltativa, da documento)</label>
              <input type="number" min="0" step="0.01" value={manualTax} onChange={e => setManualTax(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="lascia vuoto se non disponibile" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Coperti</label>
              <input type="number" value={manualCovers} onChange={e => setManualCovers(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="62" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Pagamento</label>
              <select value={manualPayment} onChange={e => setManualPayment(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="CASH">Contanti</option><option value="CARD">Carta/POS</option><option value="MIXED">Misto</option>
              </select>
            </div>
            <button onClick={handleManualAdd} className="px-4 py-2 bg-primary text-white rounded-lg text-sm">Registra</button>
          </div>
        </div>
      )}

      {/* TAB: Storico */}
      {tab === "storico" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold">{sales.length} corrispettivi registrati</h3>
            <span className="text-sm text-gray-500">Totale: €{totalRev.toLocaleString("it-IT", { minimumFractionDigits: 0 })}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
               <thead className="bg-gray-50"><tr><th className="text-left px-3 py-2">Data</th><th className="text-right px-3 py-2">Incasso lordo</th><th className="text-right px-3 py-2">Coperti</th><th className="text-center px-3 py-2">Pagamento</th><th className="text-center px-3 py-2">Fonte</th><th className="text-center px-3 py-2">IVA / ricavo netto</th></tr></thead>
              <tbody className="divide-y">
                {sales.slice(0, 50).map((s: any) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{new Date(s.date).toLocaleDateString("it-IT")}</td>
                    <td className="px-3 py-2 text-right font-mono">€{s.total.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{s.coverCount}</td>
                    <td className="px-3 py-2 text-center"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">{s.paymentMethod}</span></td>
                    <td className="px-3 py-2 text-center text-xs text-gray-400">{s.source || "-"}</td>
                    <td className="px-3 py-2 text-center text-xs">{s.items?.length > 0 ? s.items.every((item: any) => item.vatRateKnown !== false) ? <span className="text-emerald-700">Calcolata dalle righe</span> : <span className="text-amber-700">IVA riga da verificare</span> : s.taxAmountKnown ? <span className="text-emerald-700">€{s.taxAmount.toFixed(2)} verificata</span> : <div className="flex items-center justify-center gap-1"><input aria-label="IVA del corrispettivo" type="number" min="0" max={s.total} step="0.01" value={taxEditId===s.id?taxEditAmount:""} onChange={event=>{setTaxEditId(s.id);setTaxEditAmount(event.target.value);}} placeholder="IVA N/D" className="w-20 rounded border border-gray-300 px-1.5 py-1 text-right text-xs"/><button onClick={()=>void saveExistingTax(s.id)} disabled={taxEditId!==s.id||taxEditAmount===""} className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-40">Verifica</button></div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SourceCard({ icon, title, desc, color, status }: any) {
  return (
    <div className={`${color} rounded-lg p-3 flex items-start gap-3`}>
      <span className="text-lg">{icon}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm">{title}</h4>
          {status === "ready" && <span className="text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">Pronto</span>}
          {status === "planned" && <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">In arrivo</span>}
        </div>
        <p className="text-xs opacity-70 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
