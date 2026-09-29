"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import JSZip from "jszip";
import { 
  FileText, Upload, Trash2, Eye, Search, Calculator, Building2, Receipt, TrendingDown,
  DollarSign, PieChart, ArrowUpDown, Download, Filter, Inbox, CheckCircle2, XCircle, Clock, FileArchive, Loader2
} from "lucide-react";
import { ClassifyModal } from "@/components/accounting/ClassifyModal";

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  senderName: string;
  senderVat: string;
  totalAmount: number;
  taxAmount: number;
  status: string;
  supplierId: string | null;
  macroArea?: string | null;
  categoria?: string | null;
  sottocategoria?: string | null;
  voceDettaglio?: string | null;
  contoGestionale?: string | null;
}

export default function AccountingPage() {
  const [tab, setTab] = useState<"arrivo" | "fatture" | "contabilita">("arrivo");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [staging, setStaging] = useState("");
  const [msg, setMsg] = useState("");
  const [classifyingInvoice, setClassifyingInvoice] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchInvoices(); }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invoices?limit=100");
      const data = await res.json();
      setInvoices(data.invoices || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleStageInvoice = async () => {
    if (!staging.trim()) return;
    setMsg("Analisi in corso...");
    try {
      // Parse XML
      const parseRes = await fetch("/api/invoices/parse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xmlContent: staging }),
      });
      const parsed = await parseRes.json();

      if (!parsed.invoiceNumber) {
        setMsg("Errore: formato XML non valido o incompleto");
        return;
      }

      // Save to DB as PENDING (staging)
      const saveRes = await fetch("/api/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: parsed.invoiceNumber,
          invoiceDate: parsed.invoiceDate,
          senderName: parsed.senderName,
          senderVat: parsed.senderVat,
          recipientVat: parsed.recipientVat,
          recipientName: parsed.recipientName,
          totalAmount: parsed.totalAmount,
          taxAmount: parsed.taxAmount,
          status: "PENDING",
          xmlContent: staging,
        }),
      });
      const saved = await saveRes.json();
      if (saved.id) {
        setStaging("");
        setMsg("✅ In staging! Ora approvala la fattura per inserirla.");
        fetchInvoices();
      } else {
        setMsg("Errore nel salvataggio");
      }
    } catch (e: any) { setMsg("Errore: " + e.message); }
  };

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch("/api/invoices", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    return res.json();
  };

  const approveInvoice = async (id: string) => {
    const inv = invoices.find(i => i.id === id);
    setClassifyingInvoice(inv);
  };

  const handleClassify = async (classification: any) => {
    if (!classifyingInvoice) return;
    await fetch("/api/invoices", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: classifyingInvoice.id, status: "RECEIVED", ...classification }),
    });
    setClassifyingInvoice(null);
    setMsg("✅ Fattura classificata e approvata");
    fetchInvoices();
  };

  const rejectInvoice = async (id: string) => {
    await updateStatus(id, "REJECTED");
    fetchInvoices();
  };

  const deleteInvoice = async (id: string) => {
    if (!confirm("Eliminare questa fattura?")) return;
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    fetchInvoices();
  };

  // Gestione upload multiplo (XML + ZIP)
  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploading(true);
    setUploadResult(null);

    const xmlFiles: { content: string; filename: string }[] = [];

    for (const file of files) {
      if (file.name.toLowerCase().endsWith(".zip")) {
        // Estrai ZIP client-side
        try {
          const zip = await JSZip.loadAsync(file);
          for (const [path, entry] of Object.entries(zip.files)) {
            if (entry.dir || !path.toLowerCase().endsWith(".xml")) continue;
            const content = await entry.async("string");
            xmlFiles.push({ content, filename: path.split("/").pop() || path });
          }
        } catch (e) {
          setMsg(`Errore estrazione ZIP: ${file.name}`);
        }
      } else if (file.name.toLowerCase().endsWith(".xml")) {
        const content = await file.text();
        xmlFiles.push({ content, filename: file.name });
      }
    }

    if (xmlFiles.length === 0) {
      setMsg("⚠️ Nessun file XML trovato");
      setUploading(false);
      return;
    }

    // Invia tutti al server
    const res = await fetch("/api/invoices/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: xmlFiles }),
    });
    const data = await res.json();
    setUploadResult(data);
    setMsg(`📥 ${data.imported} fatture importate in staging, ${data.skipped} saltate`);
    setUploading(false);
    fetchInvoices();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const pending = invoices.filter((i) => i.status === "PENDING");
  const approved = invoices.filter((i) => i.status === "RECEIVED" || i.status === "PROCESSED");
  const rejected = invoices.filter((i) => i.status === "REJECTED");
  const filtered = (tab === "arrivo" ? pending : approved).filter((inv) =>
    !search || inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) || inv.senderName.toLowerCase().includes(search.toLowerCase())
  );

  const totImponibile = approved.reduce((s, i) => s + i.totalAmount, 0);
  const totIVA = approved.reduce((s, i) => s + i.taxAmount, 0);

  const costCenters = [
    { nome: "Cucina", budget: 120000, actual: 112000 },
    { nome: "Bar/Bevande", budget: 25000, actual: 20000 },
    { nome: "Personale Sala", budget: 60000, actual: 58000 },
    { nome: "Personale Cucina", budget: 60000, actual: 62000 },
    { nome: "Affitto", budget: 40000, actual: 40000 },
    { nome: "Utenze", budget: 18000, actual: 17500 },
    { nome: "Marketing", budget: 6000, actual: 5500 },
    { nome: "Manutenzione", budget: 8000, actual: 7200 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-gray-900">Accounting</h1>
        <p className="text-gray-500 mt-1">Fatture e Contabilità Analitica</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab("arrivo")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors relative ${tab === "arrivo" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <Inbox className="w-4 h-4 inline mr-1" /> Arrivo {pending.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{pending.length}</span>}
        </button>
        <button onClick={() => setTab("fatture")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "fatture" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <FileText className="w-4 h-4 inline mr-1" /> Fatture {approved.length > 0 && `(${approved.length})`}
        </button>
        <button onClick={() => setTab("contabilita")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "contabilita" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <Calculator className="w-4 h-4 inline mr-1" /> Contabilità
        </button>
      </div>

      {/* STAGING AREA (Arrivo) */}
      {tab === "arrivo" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <Inbox className="w-6 h-6 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800">Area di Staging</h3>
              <p className="text-sm text-amber-700 mt-1">
                Carica le fatture XML (anche più file insieme o un file ZIP). Verranno messe in staging, poi le classifichi e approvi una per una.
              </p>
            </div>
          </div>

          {/* Drag & Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
              dragOver ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-white hover:border-emerald-400 hover:bg-slate-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.zip"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                <p className="text-sm text-gray-600">Caricamento e parsing...</p>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-gray-700 font-medium">Trascina qui i file XML o ZIP</p>
                <p className="text-sm text-gray-400 mt-1">oppure clicca per selezionare</p>
                <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-500">
                  <span className="px-2 py-1 bg-slate-100 rounded"><FileArchive className="w-3 h-3 inline mr-1" />ZIP (max 100 file)</span>
                  <span className="px-2 py-1 bg-slate-100 rounded"><FileText className="w-3 h-3 inline mr-1" />XML multipli</span>
                </div>
              </>
            )}
          </div>

          {/* Risultato upload */}
          {uploadResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <h4 className="font-medium text-emerald-800 mb-2">
                📥 Importati {uploadResult.imported} · Saltati {uploadResult.skipped}
              </h4>
              {uploadResult.results?.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
                  {uploadResult.results.slice(0, 15).map((r: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      {r.status === "ok" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-amber-500" />}
                      <span className="text-xs text-gray-600 truncate">{r.filename}</span>
                      {r.status === "ok" && <span className="text-xs text-emerald-700 ml-auto">{r.supplier}</span>}
                      {r.status === "skip" && <span className="text-xs text-amber-600 ml-auto">{r.reason}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {pending.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Nessuna fattura in attesa di approvazione</p>
            </div>
          )}

          {/* Incolla manuale */}
          <details className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <summary className="text-xs text-gray-500 font-medium cursor-pointer">Oppure incolla manualmente un singolo XML</summary>
            <textarea value={staging} onChange={(e) => setStaging(e.target.value)}
              placeholder="<FatturaElettronica...>...</FatturaElettronica>"
              className="w-full h-28 border border-gray-300 rounded-lg p-3 text-xs font-mono resize-none mt-3" />
            <button onClick={handleStageInvoice} disabled={!staging.trim()}
              className="mt-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-amber-700">
              <Inbox className="w-4 h-4 inline mr-1" /> Invia in Staging
            </button>
          </details>

          {msg && <p className="text-sm text-gray-600">{msg}</p>}

          {pending.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
              <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                <h3 className="font-semibold text-amber-800 text-sm">In attesa di approvazione ({pending.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">N° Fattura</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Data</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Fornitore</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Imponibile</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">IVA</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Totale</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-600">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pending.map((inv) => (
                      <tr key={inv.id} className="hover:bg-amber-50">
                        <td className="px-3 py-2 font-medium">{inv.invoiceNumber}</td>
                        <td className="px-3 py-2 text-gray-500">{new Date(inv.invoiceDate).toLocaleDateString("it-IT")}</td>
                        <td className="px-3 py-2">{inv.senderName}</td>
                        <td className="px-3 py-2 text-right font-mono">€{inv.totalAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right font-mono">€{inv.taxAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right font-mono font-medium">€{(inv.totalAmount + inv.taxAmount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => approveInvoice(inv.id)} className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200" title="Approva">
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => rejectInvoice(inv.id)} className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200" title="Rifiuta">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {rejected.length > 0 && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <h4 className="font-medium text-red-800 text-sm mb-2">Rifiutate ({rejected.length})</h4>
              <div className="flex flex-wrap gap-2">
                {rejected.map((inv) => (
                  <span key={inv.id} className="bg-white text-red-700 text-xs px-2 py-1 rounded-full border border-red-200">
                    {inv.invoiceNumber} - {inv.senderName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* APPROVED INVOICES */}
      {tab === "fatture" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox label="Fatture Approvate" value={String(approved.length)} icon={<Receipt className="w-4 h-4" />} color="blue" />
            <StatBox label="Imponibile" value={`€${totImponibile.toLocaleString("it-IT", { minimumFractionDigits: 0 })}`} icon={<DollarSign className="w-4 h-4" />} color="green" />
            <StatBox label="IVA" value={`€${totIVA.toLocaleString("it-IT", { minimumFractionDigits: 0 })}`} icon={<TrendingDown className="w-4 h-4" />} color="amber" />
            <StatBox label="In Staging" value={String(pending.length)} icon={<Clock className="w-4 h-4" />} color={pending.length > 0 ? "amber" : "default"} />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Cerca fattura..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <Link href="/accounting" onClick={() => setTab("arrivo")}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">
              <Inbox className="w-4 h-4 inline mr-1" /> Vai a Staging ({pending.length})
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">N° Fattura</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Data</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Fornitore</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">P.IVA</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Imponibile</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Totale</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Classificazione</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Stato</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400">
                      Nessuna fattura approvata. <Link href="#" onClick={() => setTab("arrivo")} className="text-primary hover:underline">Vai allo staging</Link> per approvarle.
                    </td></tr>
                  ) : (
                    filtered.map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{inv.invoiceNumber}</td>
                        <td className="px-3 py-2 text-gray-500">{new Date(inv.invoiceDate).toLocaleDateString("it-IT")}</td>
                        <td className="px-3 py-2">{inv.senderName}</td>
                        <td className="px-3 py-2 text-xs font-mono text-gray-500">{inv.senderVat}</td>
                        <td className="px-3 py-2 text-right font-mono">€{inv.totalAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right font-mono font-medium">€{(inv.totalAmount + inv.taxAmount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2">
                          {inv.contoGestionale ? (
                            <div>
                              <span className="text-xs font-medium text-indigo-600">{inv.contoGestionale}</span>
                              <p className="text-xs text-gray-400">{inv.categoria}{inv.sottocategoria ? ` · ${inv.sottocategoria}` : ""}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Non classificata</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">APPROVATA</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => deleteInvoice(inv.id)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "contabilita" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox label="Centri di Costo" value="8" icon={<Building2 className="w-4 h-4" />} color="blue" />
            <StatBox label="Budget Totale" value="€317.000" icon={<DollarSign className="w-4 h-4" />} color="green" />
            <StatBox label="Actual" value="€322.200" icon={<Receipt className="w-4 h-4" />} color="amber" />
            <StatBox label="Fatture Approvate" value={String(approved.length)} icon={<FileText className="w-4 h-4" />} color="default" />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="font-semibold">Analisi per Centro di Costo</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Centro di Costo</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Budget (€)</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Actual (€)</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Varianza €</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Varianza %</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {costCenters.map((cc) => {
                    const diff = cc.actual - cc.budget;
                    const varPct = cc.budget > 0 ? Math.round((diff / cc.budget) * 1000) / 10 : 0;
                    return (
                      <tr key={cc.nome} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{cc.nome}</td>
                        <td className="px-3 py-2 text-right font-mono">€{cc.budget.toLocaleString("it-IT")}</td>
                        <td className="px-3 py-2 text-right font-mono">€{cc.actual.toLocaleString("it-IT")}</td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: diff > 0 ? "#dc2626" : "#16a34a" }}>{diff >= 0 ? "+" : ""}€{diff.toLocaleString("it-IT")}</td>
                        <td className="px-3 py-2 text-right" style={{ color: varPct > 0 ? "#dc2626" : "#16a34a" }}>{varPct > 0 ? "+" : ""}{varPct}%</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${varPct > 5 ? "bg-red-100 text-red-700" : varPct < -5 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                            {varPct > 5 ? "⬆ Sopra budget" : varPct < -5 ? "⬇ Sotto budget" : "≈ In linea"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-primary" /> Ripartizione Spese
              </h3>
              <div className="space-y-2">
                {costCenters.sort((a, b) => b.actual - a.actual).map((cc) => {
                  const max = Math.max(...costCenters.map((c) => c.actual));
                  return (
                    <div key={cc.nome}>
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="text-gray-600">{cc.nome}</span>
                        <span className="text-gray-900 font-medium">€{cc.actual.toLocaleString("it-IT")}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${(cc.actual / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <h3 className="font-semibold mb-3">Flusso Fatture</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                  <Inbox className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-800">1. Arrivo (Staging)</p>
                    <p className="text-xs text-amber-700">Le fatture arrivano qui per la validazione</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">2. Approvazione</p>
                    <p className="text-xs text-green-700">Flagghi la fattura → entra in contabilità</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-800">3. Centri di Costo</p>
                    <p className="text-xs text-blue-700">Alimenta automaticamente food cost, magazzino, CE</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {classifyingInvoice && (
        <ClassifyModal
          invoice={classifyingInvoice}
          onClose={() => setClassifyingInvoice(null)}
          onClassify={handleClassify}
        />
      )}
    </div>
  );
}

function StatBox({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const m: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-700", green: "bg-green-50 border-green-200 text-green-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700", red: "bg-red-50 border-red-200 text-red-700",
    default: "bg-white border-gray-200 text-gray-900",
  };
  return (
    <div className={`${m[color] || m.default} rounded-xl p-4 border`}>
      <div className="flex items-center justify-between mb-1"><span className="text-xs opacity-70">{label}</span><span className="opacity-70">{icon}</span></div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}