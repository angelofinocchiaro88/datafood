"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import JSZip from "jszip";
import { FileText, Plus, Trash2, Save, X, Building2, Search, Calendar, Upload, FileArchive, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const TIPOLOGIE = ["catering", "evento", "banqueting", "menu fisso", "business", "altro"];

export default function FattureEmessePage() {
  const [fatture, setFatture] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ numero: "", data: new Date().toISOString().split("T")[0], cliente: "", partitaIva: "", importo: "", iva: "0", tipologia: "catering", descrizione: "" });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fatture-emesse");
      const data = await res.json();
      setFatture(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.numero || !form.cliente || !form.importo) { setMsg("Numero, cliente e importo obbligatori"); return; }
    await fetch("/api/fatture-emesse", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, importo: parseFloat(form.importo), iva: parseFloat(form.iva) }),
    });
    setShowForm(false);
    setForm({ numero: "", data: new Date().toISOString().split("T")[0], cliente: "", partitaIva: "", importo: "", iva: "0", tipologia: "catering", descrizione: "" });
    setMsg("✅ Fattura emessa registrata");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questa fattura emessa?")) return;
    await fetch(`/api/fatture-emesse/${id}`, { method: "DELETE" });
    load();
  };

  // Upload multiplo XML/ZIP fatture emesse
  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploading(true);
    setUploadResult(null);

    const xmlFiles: { content: string; filename: string }[] = [];
    for (const file of files) {
      if (file.name.toLowerCase().endsWith(".zip")) {
        try {
          const zip = await JSZip.loadAsync(file);
          for (const [path, entry] of Object.entries(zip.files)) {
            if (entry.dir || !path.toLowerCase().endsWith(".xml")) continue;
            const content = await entry.async("string");
            xmlFiles.push({ content, filename: path.split("/").pop() || path });
          }
        } catch { setMsg(`Errore ZIP: ${file.name}`); }
      } else if (file.name.toLowerCase().endsWith(".xml")) {
        xmlFiles.push({ content: await file.text(), filename: file.name });
      }
    }

    if (xmlFiles.length === 0) { setMsg("⚠️ Nessun XML trovato"); setUploading(false); return; }

    const res = await fetch("/api/fatture-emesse/bulk", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: xmlFiles }),
    });
    const data = await res.json();
    setUploadResult(data);
    setMsg(`📥 ${data.imported} fatture emesse importate, ${data.skipped} saltate`);
    setUploading(false);
    load();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const filtered = fatture.filter(f => !search || f.numero.toLowerCase().includes(search.toLowerCase()) || f.cliente.toLowerCase().includes(search.toLowerCase()));
  const totaleImponibile = fatture.reduce((s, f) => s + f.importo, 0);
  const totaleIVA = fatture.reduce((s, f) => s + (f.importo * f.iva / 100), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fatture Emesse</h1>
          <p className="text-sm text-gray-500">{fatture.length} fatture · ricavo B2B (catering, eventi, business)</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4 inline mr-1" /> Nuova Fattura
        </button>
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">{msg}</div>}

      {/* Drag & Drop import XML */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
          dragOver ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-white hover:border-emerald-400 hover:bg-slate-50"
        }`}
      >
        <input ref={fileInputRef} type="file" accept=".xml,.zip" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-sm text-gray-600">Importazione...</p>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-gray-700 text-sm font-medium">Importa XML fatture emesse</p>
            <p className="text-xs text-gray-400 mt-1">Trascina qui file XML o ZIP · oppure clicca</p>
          </>
        )}
      </div>

      {/* Risultato upload */}
      {uploadResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm">
          <p className="font-medium text-emerald-800">📥 {uploadResult.imported} importate · {uploadResult.skipped} saltate</p>
          <div className="max-h-32 overflow-y-auto mt-2 space-y-1">
            {uploadResult.results?.slice(0, 12).map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {r.status === "ok" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-amber-500" />}
                <span className="text-gray-600 truncate">{r.filename}</span>
                {r.status === "ok" && <span className="text-emerald-700 ml-auto">{r.cliente}</span>}
                {r.status === "skip" && <span className="text-amber-600 ml-auto">{r.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Fatture Emesse" value={String(fatture.length)} />
        <Stat label="Imponibile Totale" value={`€${Math.round(totaleImponibile).toLocaleString("it-IT")}`} />
        <Stat label="IVA Totale" value={`€${Math.round(totaleIVA).toLocaleString("it-IT")}`} />
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border-2 border-emerald-300 p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Nuova Fattura Emessa</h3>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 mb-1 block">Numero Fattura *</label><input value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="FT-2026-001" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Data</label><input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Cliente *</label><input value={form.cliente} onChange={e => setForm({...form, cliente: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Es. Azienda Rossi S.p.A." /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Partita IVA Cliente</label><input value={form.partitaIva} onChange={e => setForm({...form, partitaIva: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="IT01234567890" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Tipologia</label><select value={form.tipologia} onChange={e => setForm({...form, tipologia: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">{TIPOLOGIE.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Imponibile (€) *</label><input type="number" step="0.01" value={form.importo} onChange={e => setForm({...form, importo: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">IVA (%)</label><input type="number" step="0.1" value={form.iva} onChange={e => setForm({...form, iva: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Descrizione</label><input value={form.descrizione} onChange={e => setForm({...form, descrizione: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Es. Servizio catering 50 persone" /></div>
          </div>
          <div className="flex gap-2 mt-4"><button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"><Save className="w-4 h-4 inline mr-1" /> Registra</button><button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm">Annulla</button></div>
        </div>
      )}

      {/* Lista */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per numero o cliente..." className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Caricamento...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400"><FileText className="w-12 h-12 mx-auto mb-3" /><p>Nessuna fattura emessa. Registra la prima.</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="text-left px-3 py-2">Numero</th><th className="text-left px-3 py-2">Data</th><th className="text-left px-3 py-2">Cliente</th><th className="text-center px-3 py-2">Tipologia</th><th className="text-right px-3 py-2">Imponibile</th><th className="text-right px-3 py-2">IVA</th><th className="text-right px-3 py-2">Totale</th><th className="w-10"></th></tr></thead>
            <tbody className="divide-y">
              {filtered.map(f => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{f.numero}</td>
                  <td className="px-3 py-2 text-gray-500">{new Date(f.data).toLocaleDateString("it-IT")}</td>
                  <td className="px-3 py-2">{f.cliente}</td>
                  <td className="px-3 py-2 text-center"><span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">{f.tipologia}</span></td>
                  <td className="px-3 py-2 text-right font-mono">€{f.importo.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-right font-mono">€{(f.importo * f.iva / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-right font-mono font-medium">€{(f.importo + f.importo * f.iva / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2"><button onClick={() => handleDelete(f.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-sm text-sky-800">
        <strong>Nota:</strong> i corrispettivi (scontrini B2C) si registrano nel modulo <Link href="/corrispettivi" className="underline">Corrispettivi</Link>. Le fatture emesse qui sono ricavi B2B (catering, eventi, pranzi aziendali). Entrambi confluiscono nei Ricavi del Conto Economico.
      </div>
    </div>
  );
}

function Stat({ label, value }: any) {
  return <div className="bg-white rounded-2xl border border-gray-100 p-4"><p className="text-xs text-gray-500 mb-1">{label}</p><p className="text-xl font-bold text-gray-900">{value}</p></div>;
}