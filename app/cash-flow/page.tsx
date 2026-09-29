"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Wallet, TrendingUp, TrendingDown, AlertTriangle, Calendar, Plus, X, Save, Trash2, Clock, ArrowDownToLine, ArrowUpFromLine, Activity, Gauge, Upload, FileText, CheckCircle2, Loader2, FileSpreadsheet, FileArchive, Landmark, Percent } from "lucide-react";
import { ForecastChart } from "./ForecastChart";

const F24_TIPI = [
  { code: "IVA", label: "IVA", period: "Trimestrale" },
  { code: "IRAP", label: "IRAP", period: "Annuale" },
  { code: "INPS", label: "INPS contributi", period: "Mensile" },
  { code: "IRES", label: "IRES", period: "Annuale" },
  { code: "RITENUTE", label: "Ritenute", period: "Mensile" },
  { code: "IMU", label: "IMU/TARI", period: "Annuale" },
];

export default function CashFlowPage() {
  const [tab, setTab] = useState<"panoramica" | "forecast" | "scadenziario">("panoramica");
  const [forecast, setForecast] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ type: "payment", description: "", counterparty: "", amount: "", dueDate: new Date().toISOString().split("T")[0], recurrence: "none", probability: 100, categoryId: "" });
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parsedTx, setParsedTx] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [riepilogoPeriodo, setRiepilogoPeriodo] = useState<any>(null);
  const [showF24, setShowF24] = useState(false);
  const [f24Form, setF24Form] = useState({ tipo: "IVA", codiceTributo: "", periodo: "", anno: 2026, importo: "", scadenza: new Date().toISOString().split("T")[0] });
  const [periodo, setPeriodo] = useState<"mese" | "intervallo" | "tutto">("tutto");
  const [meseSel, setMeseSel] = useState(() => new Date().toISOString().slice(0, 7));
  const [dataDa, setDataDa] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]);
  const [dataA, setDataA] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadTransactions(); }, [periodo, meseSel, dataDa, dataA]);

  const loadTransactions = async () => {
    try {
      let url = "/api/cashflow/transactions";
      if (periodo === "mese") {
        const mese = meseSel;
        url += `?dateFrom=${mese}-01&dateTo=${mese}-31`;
      } else if (periodo === "intervallo") {
        url += `?dateFrom=${dataDa}&dateTo=${dataA}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setTransactions(data.transactions || []);
      setRiepilogoPeriodo(data.riepilogo);
    } catch {}
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [f, s, t, c, a] = await Promise.all([
        fetch("/api/cashflow/forecast?weeks=13").then(r => r.json()),
        fetch("/api/cashflow/schedule?days=120").then(r => r.json()),
        fetch("/api/cashflow/transactions").then(r => r.json()),
        fetch("/api/cashflow/categories").then(r => r.json()),
        fetch("/api/cashflow/alerts").then(r => r.json()),
      ]);
      setForecast(f); setSchedules(Array.isArray(s) ? s : []); setTransactions(Array.isArray(t) ? t : []);
      setCategories(Array.isArray(c) ? c : []); setAlerts(Array.isArray(a) ? a : []);
    } catch {}
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.description || !form.amount) { setMsg("Descrizione e importo obbligatori"); return; }
    await fetch("/api/cashflow/schedule", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    setShowForm(false);
    setForm({ type: "payment", description: "", counterparty: "", amount: "", dueDate: new Date().toISOString().split("T")[0], recurrence: "none", probability: 100, categoryId: "" });
    setMsg("✅ Scadenza registrata");
    loadAll();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/cashflow/schedule/${id}`, { method: "DELETE" });
    loadAll();
  };

  const handleResolveAlert = async (id: string) => {
    await fetch(`/api/cashflow/alerts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isResolved: true }) });
    loadAll();
  };

  // Upload estratto conto (CSV/PDF)
  const handleStatementFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploading(true);
    setParsedTx([]);
    setShowPreview(false);

    for (const file of files) {
      let contentType = "";
      let content = "";
      if (file.name.toLowerCase().endsWith(".csv")) {
        contentType = "csv";
        content = await file.text();
      } else if (file.name.toLowerCase().endsWith(".pdf")) {
        contentType = "pdf";
        content = await fileToBase64(file);
      } else if (file.name.toLowerCase().endsWith(".txt")) {
        contentType = "text";
        content = await file.text();
      }

      if (!contentType) continue;

      const res = await fetch("/api/cashflow/transactions/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, content }),
      });
      const data = await res.json();
      if (data.transactions?.length > 0) {
        setParsedTx(prev => [...prev, ...data.transactions]);
        setShowPreview(true);
      }
    }

    setUploading(false);
    if (parsedTx.length === 0) setMsg("⚠️ Nessuna transazione riconosciuta");
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleStatementFiles(e.dataTransfer.files);
  };

  // Registra F24 come scadenza fiscale (impatto su liquidità)
  const handleSaveF24 = async () => {
    if (!f24Form.importo || !f24Form.scadenza) { setMsg("Importo e scadenza obbligatori"); return; }
    // Trova categoria "Tasse"
    const tasseCat = categories.find(c => c.name === "Tasse");
    const tipoInfo = F24_TIPI.find(t => t.code === f24Form.tipo);
    await fetch("/api/cashflow/schedule", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "payment",
        description: `F24 ${f24Form.tipo} ${f24Form.periodo ? `- ${f24Form.periodo}` : ""}`,
        counterparty: "Agenzia Entrate",
        amount: parseFloat(f24Form.importo),
        dueDate: f24Form.scadenza,
        recurrence: tipoInfo?.period === "Trimestrale" ? "quarterly" : tipoInfo?.period === "Annuale" ? "yearly" : "monthly",
        probability: 100,
        categoryId: tasseCat?.id,
        notes: `Codice tributo: ${f24Form.codiceTributo || "-"} · Competenza: ${f24Form.periodo || "-"}/${f24Form.anno}`,
      }),
    });
    setShowF24(false);
    setMsg(`✅ F24 ${f24Form.tipo} programmato — € ${parseFloat(f24Form.importo).toLocaleString("it-IT")} scaricato sulla liquidità`);
    loadAll();
  };

  const handleSaveParsed = async () => {
    await fetch("/api/cashflow/transactions/upload", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: "", transactions: parsedTx }),
    });
    setMsg(`✅ ${parsedTx.length} transazioni salvate`);
    setParsedTx([]);
    setShowPreview(false);
    loadAll();
  };

  const fmt = (v: number) => `€${Math.round(v).toLocaleString("it-IT")}`;
  const balance = forecast?.account?.balance || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cash Flow</h1>
          <p className="text-sm text-gray-500">Controllo liquidità · forecast 13 settimane</p>
        </div>
        <Link href="/controllo-gestione" className="text-sm text-emerald-600 hover:underline">Cost Control →</Link>
      </div>

      {/* Selettore periodo */}
      <div className="flex items-center gap-2 flex-wrap bg-white rounded-xl border border-slate-200 p-3">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button onClick={() => setPeriodo("tutto")} className={`px-3 py-1.5 rounded-md text-xs font-medium ${periodo === "tutto" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Tutto</button>
          <button onClick={() => setPeriodo("mese")} className={`px-3 py-1.5 rounded-md text-xs font-medium ${periodo === "mese" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Mese</button>
          <button onClick={() => setPeriodo("intervallo")} className={`px-3 py-1.5 rounded-md text-xs font-medium ${periodo === "intervallo" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Intervallo</button>
        </div>

        {periodo === "mese" && (
          <input type="month" value={meseSel} onChange={e => setMeseSel(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm" />
        )}

        {periodo === "intervallo" && (
          <div className="flex items-center gap-2">
            <input type="date" value={dataDa} onChange={e => setDataDa(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm" />
            <span className="text-slate-400">→</span>
            <input type="date" value={dataA} onChange={e => setDataA(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm" />
          </div>
        )}

        {riepilogoPeriodo && (
          <div className="flex gap-4 ml-auto text-xs">
            <span className="text-slate-500">Entrate: <strong className="text-emerald-600">€ {riepilogoPeriodo.totaleEntrate.toLocaleString("it-IT")}</strong></span>
            <span className="text-slate-500">Uscite: <strong className="text-rose-600">€ {riepilogoPeriodo.totaleUscite.toLocaleString("it-IT")}</strong></span>
            <span className="text-slate-500">Saldo: <strong className={riepilogoPeriodo.saldoPeriodo >= 0 ? "text-emerald-600" : "text-red-600"}>€ {riepilogoPeriodo.saldoPeriodo.toLocaleString("it-IT")}</strong></span>
            <span className="text-slate-400">({riepilogoPeriodo.count} movimenti)</span>
          </div>
        )}
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">{msg}</div>}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {[
          { key: "panoramica", label: "Panoramica", icon: <Wallet className="w-4 h-4" /> },
          { key: "forecast", label: "Forecast 13 sett.", icon: <Activity className="w-4 h-4" /> },
          { key: "scadenziario", label: "Scadenziario", icon: <Calendar className="w-4 h-4" /> },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${tab === t.key ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* PANORAMICA */}
      {tab === "panoramica" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <p className="text-sm opacity-80">Saldo Conto</p>
              <p className="text-3xl font-bold mt-1">{fmt(balance)}</p>
              <p className="text-xs opacity-60 mt-1">{forecast?.account?.name || "Conto"}</p>
            </div>
            <div className="rounded-2xl p-5 bg-white border border-slate-200">
              <p className="text-sm text-slate-500 flex items-center gap-2"><Gauge className="w-4 h-4 text-emerald-500" /> Runway</p>
              <p className="text-3xl font-bold mt-1 text-slate-900">{forecast?.runway == null ? "∞" : `${forecast?.runway} sett.`}</p>
              <p className="text-xs text-slate-400 mt-1">settimane di autonomia</p>
            </div>
            <div className="rounded-2xl p-5 bg-white border border-slate-200">
              <p className="text-sm text-slate-500 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Settimane a rischio</p>
              <p className="text-3xl font-bold mt-1 text-slate-900">{forecast?.atRiskWeeks || 0}</p>
              <p className="text-xs text-slate-400 mt-1">su 13 previste</p>
            </div>
          </div>

          {/* Alert */}
          {alerts.filter((a: any) => !a.isResolved).length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-700">Alert</h3>
              {alerts.filter((a: any) => !a.isResolved).map(a => (
                <div key={a.id} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
                  <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {a.message}</span>
                  <button onClick={() => handleResolveAlert(a.id)} className="text-xs text-red-500 hover:underline">Risolvi</button>
                </div>
              ))}
            </div>
          )}

          {/* Upload estratto conto */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-600" /> Importa Estratto Conto
            </h3>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                dragOver ? "border-emerald-500 bg-emerald-50" : "border-slate-300 hover:border-emerald-400 hover:bg-slate-50"
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".csv,.pdf,.txt" multiple className="hidden" onChange={(e) => e.target.files && handleStatementFiles(e.target.files)} />
              {uploading ? (
                <div className="flex flex-col items-center gap-2"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /><p className="text-sm text-slate-600">Analisi estratto conto...</p></div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-700 text-sm font-medium">Trascina estratto conto</p>
                  <p className="text-xs text-slate-400 mt-1">CSV · PDF · TXT</p>
                  <div className="flex items-center justify-center gap-2 mt-3 text-xs text-slate-500">
                    <span className="px-2 py-1 bg-slate-100 rounded"><FileSpreadsheet className="w-3 h-3 inline mr-1" />CSV</span>
                    <span className="px-2 py-1 bg-slate-100 rounded"><FileArchive className="w-3 h-3 inline mr-1" />PDF</span>
                  </div>
                </>
              )}
            </div>

            {/* Preview transazioni parsate */}
            {showPreview && parsedTx.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-700">Rilevate {parsedTx.length} transazioni (verifica prima di salvare)</h4>
                  <button onClick={handleSaveParsed} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm"><Save className="w-3.5 h-3.5 inline mr-1" /> Salva tutte</button>
                </div>
                <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                  {parsedTx.map((tx, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="flex-1">
                        <p className="text-slate-700 truncate">{tx.description}</p>
                        <p className="text-xs text-slate-400">{tx.date}{tx.category && ` · ${tx.category}`}</p>
                      </div>
                      <span className={`font-mono font-medium ${tx.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{tx.amount >= 0 ? "+" : ""}{fmt(tx.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Transazioni recenti */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b bg-slate-50 font-semibold">Ultime Transazioni</div>
            <div className="max-h-80 overflow-y-auto divide-y">
              {transactions.slice(0, 15).map(t => (
                <div key={t.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    {t.amount >= 0 ? <ArrowDownToLine className="w-4 h-4 text-emerald-500" /> : <ArrowUpFromLine className="w-4 h-4 text-rose-500" />}
                    <div>
                      <p className="text-slate-700">{t.description}</p>
                      <p className="text-xs text-slate-400">{new Date(t.date).toLocaleDateString("it-IT")} · {t.counterparty}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-medium ${t.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{t.amount >= 0 ? "+" : ""}{fmt(t.amount)}</p>
                    {t.category && <p className="text-xs text-slate-400">{t.category.name}</p>}
                  </div>
                </div>
              ))}
              {transactions.length === 0 && <p className="text-center py-6 text-slate-400">Nessuna transazione</p>}
            </div>
          </div>
        </div>
      )}

      {/* FORECAST */}
      {tab === "forecast" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-semibold mb-4">Previsione Grafica</h3>
            <ForecastChart forecast={forecast?.forecast || []} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
            <h3 className="font-semibold">Forecast Rolling 13 Settimane</h3>
            <span className="text-xs text-slate-400">partendo da {fmt(balance)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2">Settimana</th>
                  <th className="text-right px-3 py-2">Entrate</th>
                  <th className="text-right px-3 py-2">Uscite</th>
                  <th className="text-right px-3 py-2">Netto</th>
                  <th className="text-right px-3 py-2">Saldo Fine Sett.</th>
                  <th className="text-center px-3 py-2">Stato</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {forecast?.forecast?.map((w: any, i: number) => (
                  <tr key={i} className={`${w.atRisk ? "bg-red-50/50" : ""}`}>
                    <td className="px-3 py-2 text-slate-600">
                      {new Date(w.weekStart).toLocaleDateString("it-IT", { day: "numeric", month: "short" })} - {new Date(w.weekEnd).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-600">+{fmt(w.inflow)}</td>
                    <td className="px-3 py-2 text-right font-mono text-rose-600">-{fmt(w.outflow)}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium" style={{ color: w.net >= 0 ? "#16a34a" : "#dc2626" }}>{w.net >= 0 ? "+" : ""}{fmt(w.net)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: w.endingBalance >= 0 ? "#1f2937" : "#dc2626" }}>{fmt(w.endingBalance)}</td>
                    <td className="px-3 py-2 text-center">{w.atRisk ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">⚠️ rischio</span> : <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ ok</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}

      {/* SCADENZIARIO */}
      {tab === "scadenziario" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h3 className="font-semibold text-slate-700">Scadenze Pagamenti/Incassi</h3>
            <div className="flex gap-2">
              <button onClick={() => setShowF24(true)} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm"><Landmark className="w-4 h-4 inline mr-1" /> Registra F24</button>
              <button onClick={() => setShowForm(true)} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm"><Plus className="w-4 h-4 inline mr-1" /> Nuova Scadenza</button>
            </div>
          </div>

          {/* FORM F24 */}
          {showF24 && (
            <div className="bg-white rounded-2xl border-2 border-indigo-300 p-5">
              <div className="flex justify-between mb-4">
                <h4 className="font-semibold flex items-center gap-2"><Landmark className="w-5 h-5 text-indigo-600" /> Registra F24</h4>
                <button onClick={() => setShowF24(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><label className="text-xs text-slate-500 block mb-1">Tipo F24</label>
                  <select value={f24Form.tipo} onChange={e => { const t = F24_TIPI.find(x => x.code === e.target.value); setF24Form({...f24Form, tipo: e.target.value, periodo: t?.period || ""}); }} className="w-full px-3 py-2 border rounded-lg text-sm">
                    {F24_TIPI.map(t => <option key={t.code} value={t.code}>{t.label} ({t.period})</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-slate-500 block mb-1">Codice Tributo</label><input value={f24Form.codiceTributo} onChange={e => setF24Form({...f24Form, codiceTributo: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="es. 6099 (IVA)" /></div>
                <div><label className="text-xs text-slate-500 block mb-1">Competenza</label><input value={f24Form.periodo} onChange={e => setF24Form({...f24Form, periodo: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="es. Q1 2026" /></div>
                <div><label className="text-xs text-slate-500 block mb-1">Importo (€) *</label><input type="number" value={f24Form.importo} onChange={e => setF24Form({...f24Form, importo: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="text-xs text-slate-500 block mb-1">Scadenza *</label><input type="date" value={f24Form.scadenza} onChange={e => setF24Form({...f24Form, scadenza: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="text-xs text-slate-500 block mb-1">Anno</label><input type="number" value={f24Form.anno} onChange={e => setF24Form({...f24Form, anno: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              </div>
              {f24Form.importo && (
                <div className="mt-3 p-3 bg-indigo-50 rounded-lg text-sm text-indigo-700">
                  <Percent className="w-4 h-4 inline mr-1" /> Questo F24 di <strong>€ {parseFloat(f24Form.importo).toLocaleString("it-IT")}</strong> verrà considerato nel forecast e inciderà sulla liquidità.
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <button onClick={handleSaveF24} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"><Save className="w-4 h-4 inline mr-1" /> Programma F24</button>
                <button onClick={() => setShowF24(false)} className="px-4 py-2 border text-slate-600 rounded-lg text-sm">Annulla</button>
              </div>
            </div>
          )}

          {showForm && (
            <div className="bg-white rounded-2xl border-2 border-emerald-300 p-5">
              <div className="flex justify-between mb-4"><h4 className="font-semibold">Nuova Scadenza</h4><button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-500 block mb-1">Tipo</label><select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="payment">Pagamento</option><option value="income">Incasso</option></select></div>
                <div><label className="text-xs text-slate-500 block mb-1">Categoria</label><select value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="">Auto</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">Descrizione</label><input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="text-xs text-slate-500 block mb-1">Controparte</label><input value={form.counterparty} onChange={e => setForm({...form, counterparty: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="text-xs text-slate-500 block mb-1">Importo (€)</label><input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="text-xs text-slate-500 block mb-1">Data Scadenza</label><input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="text-xs text-slate-500 block mb-1">Ricorrenza</label><select value={form.recurrence} onChange={e => setForm({...form, recurrence: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="none">Nessuna</option><option value="weekly">Settimanale</option><option value="monthly">Mensile</option><option value="quarterly">Trimestrale</option><option value="yearly">Annuale</option></select></div>
                <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">Probabilità ({form.probability}%)</label><input type="range" min="0" max="100" value={form.probability} onChange={e => setForm({...form, probability: Number(e.target.value)})} className="w-full" /></div>
              </div>
              <div className="flex gap-2 mt-4"><button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"><Save className="w-4 h-4 inline mr-1" /> Salva</button><button onClick={() => setShowForm(false)} className="px-4 py-2 border text-slate-600 rounded-lg text-sm">Annulla</button></div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {schedules.length === 0 ? (
              <p className="text-center py-8 text-slate-400">Nessuna scadenza</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50"><tr><th className="text-left px-3 py-2">Data</th><th className="text-left px-3 py-2">Descrizione</th><th className="text-left px-3 py-2">Controparte</th><th className="text-center px-3 py-2">Tipo</th><th className="text-center px-3 py-2">Ricorr.</th><th className="text-right px-3 py-2">Importo</th><th className="w-10"></th></tr></thead>
                <tbody className="divide-y">
                  {schedules.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-600">{new Date(s.dueDate).toLocaleDateString("it-IT")}</td>
                      <td className="px-3 py-2">{s.description}</td>
                      <td className="px-3 py-2 text-slate-500">{s.counterparty}</td>
                      <td className="px-3 py-2 text-center">{s.type === "payment" ? <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Pagam.</span> : <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Incasso</span>}</td>
                      <td className="px-3 py-2 text-center text-xs text-slate-400">{s.recurrence === "none" ? "-" : s.recurrence}</td>
                      <td className="px-3 py-2 text-right font-mono font-medium" style={{ color: s.type === "payment" ? "#dc2626" : "#16a34a" }}>{s.type === "payment" ? "-" : "+"}{fmt(s.amount)}</td>
                      <td className="px-3 py-2"><button onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}