"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Upload, FileText, Plus, Calendar, Search, TrendingUp, Download, ClipboardPaste, Database, ArrowRight, CheckCircle2 } from "lucide-react";

export default function CorrispettiviPage() {
  const [tab, setTab] = useState<"import" | "storico" | "manuale">("import");
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Manual entry
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualTotal, setManualTotal] = useState("");
  const [manualCovers, setManualCovers] = useState("");
  const [manualPayment, setManualPayment] = useState("CASH");

  // CSV paste
  const [csvText, setCsvText] = useState("");

  useEffect(() => { loadSales(); }, []);

  const loadSales = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales?limit=100");
      const data = await res.json();
      setSales(data.sales || []);
    } catch {}
    setLoading(false);
  };

  const handleManualAdd = async () => {
    if (!manualTotal) return;
    await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: manualDate,
        total: parseFloat(manualTotal),
        coverCount: manualCovers ? parseInt(manualCovers) : 1,
        paymentMethod: manualPayment,
        type: "MANUAL",
        source: "corrispettivi_manuale",
      }),
    });
    setMsg("✅ Corrispettivo registrato");
    setManualTotal(""); setManualCovers("");
    loadSales();
  };

  const handleCsvPaste = async () => {
    if (!csvText.trim()) return;
    const lines = csvText.trim().split("\n");
    let count = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(/[,;\t]/);
      if (cols.length < 2) continue;
      const date = cols[0]?.trim();
      const total = parseFloat(cols[1]?.replace(",", ".").replace("€", "").trim());
      const covers = cols[2] ? parseInt(cols[2]) : 1;
      if (!date || isNaN(total)) continue;
      try {
        await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, total, coverCount: covers, type: "MANUAL", source: "corrispettivi_csv" }),
        });
        count++;
      } catch {}
    }
    setMsg(`✅ ${count} corrispettivi importati`);
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
              placeholder={`Data, Totale, Coperti, Pagamento\n2026-01-15, 1840.50, 62, CASH\n2026-01-16, 2100.00, 70, CARD`}
              className="w-full h-32 border border-gray-300 rounded-lg p-3 text-xs font-mono resize-none" />
            <button onClick={handleCsvPaste} disabled={!csvText.trim()}
              className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-50">
              Importa CSV
            </button>
            <p className="text-xs text-gray-400 mt-2">
              Formato: Data, Totale, Coperti, Pagamento. Separatore: virgola, punto e virgola o tab.
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
              <thead className="bg-gray-50"><tr><th className="text-left px-3 py-2">Data</th><th className="text-right px-3 py-2">Totale</th><th className="text-right px-3 py-2">Coperti</th><th className="text-center px-3 py-2">Pagamento</th><th className="text-center px-3 py-2">Fonte</th></tr></thead>
              <tbody className="divide-y">
                {sales.slice(0, 50).map((s: any) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{new Date(s.date).toLocaleDateString("it-IT")}</td>
                    <td className="px-3 py-2 text-right font-mono">€{s.total.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{s.coverCount}</td>
                    <td className="px-3 py-2 text-center"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">{s.paymentMethod}</span></td>
                    <td className="px-3 py-2 text-center text-xs text-gray-400">{s.source || "-"}</td>
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