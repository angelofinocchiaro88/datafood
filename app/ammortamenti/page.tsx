"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calculator, Plus, X, Save, Trash2, TrendingDown, Building2, Monitor, Truck, ChefHat, Wrench, Home, Shirt, ChevronDown, ChevronRight } from "lucide-react";

const CATEGORIES = [
  { id: "edifici", name: "Edifici", coefficient: 3, icon: <Home className="w-4 h-4" />, ce: "Ammortamenti fabbricati", vita: 33.33 },
  { id: "costruzioni_leggere", name: "Costruzioni leggere", coefficient: 10, icon: <Building2 className="w-4 h-4" />, ce: "Ammortamenti costruzioni", vita: 10 },
  { id: "mobili_arredamento", name: "Mobili e arredamento", coefficient: 10, icon: <Building2 className="w-4 h-4" />, ce: "Ammortamenti arredi", vita: 10 },
  { id: "biancheria", name: "Biancheria", coefficient: 40, icon: <Shirt className="w-4 h-4" />, ce: "Ammortamenti biancheria", vita: 2.5 },
  { id: "attrezzatura", name: "Attrezzatura", coefficient: 25, icon: <ChefHat className="w-4 h-4" />, ce: "Ammortamenti attrezzature", vita: 4 },
  { id: "impianti_generici", name: "Impianti generici", coefficient: 8, icon: <Wrench className="w-4 h-4" />, ce: "Ammortamenti impianti generici", vita: 12.5 },
  { id: "impianti_specifici", name: "Impianti specifici", coefficient: 12, icon: <Wrench className="w-4 h-4" />, ce: "Ammortamenti impianti specifici", vita: 8.33 },
  { id: "macchine_ufficio", name: "Macchine ufficio elettroniche", coefficient: 20, icon: <Monitor className="w-4 h-4" />, ce: "Ammortamenti hardware", vita: 5 },
  { id: "autoveicoli_trasporto", name: "Autoveicoli da trasporto", coefficient: 20, icon: <Truck className="w-4 h-4" />, ce: "Ammortamenti automezzi", vita: 5 },
  { id: "autovetture", name: "Autovetture, motoveicoli", coefficient: 25, icon: <Truck className="w-4 h-4" />, ce: "Ammortamenti autovetture", vita: 4 },
];

export default function AmmortamentiPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ description: "", category: "attrezzatura", coefficient: 25, costoStorico: "", dataAcquisto: new Date().toISOString().split("T")[0], dataEntrataFunzione: new Date().toISOString().split("T")[0], fornitore: "", numFattura: "" });

  useEffect(() => { loadAssets(); }, []);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/assets");
      const data = await res.json();
      setAssets(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };

  const handleCategoryChange = (catId: string) => {
    const cat = CATEGORIES.find(c => c.id === catId);
    if (cat) setForm({ ...form, category: catId, coefficient: cat.coefficient });
  };

  const handleSave = async () => {
    if (!form.description || !form.costoStorico) { setMsg("Descrizione e costo obbligatori"); return; }
    await fetch("/api/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, costoStorico: parseFloat(form.costoStorico) }) });
    setShowForm(false);
    setForm({ description: "", category: "attrezzatura", coefficient: 25, costoStorico: "", dataAcquisto: new Date().toISOString().split("T")[0], dataEntrataFunzione: new Date().toISOString().split("T")[0], fornitore: "", numFattura: "" });
    setMsg("✅ Cespire registrato e piano ammortamento generato");
    loadAssets();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questo cespite?")) return;
    await fetch(`/api/assets/${id}`, { method: "DELETE" });
    loadAssets();
  };

  const totalCosto = assets.reduce((s: number, a: any) => s + a.costoStorico, 0);
  const totalFondo = assets.reduce((s: number, a: any) => {
    const mesiDaAcquisto = Math.max(0, (new Date().getTime() - new Date(a.dataEntrataFunzione).getTime()) / (30 * 24 * 60 * 60 * 1000));
    const quotaAccumulata = a.quotaMensile * Math.min(mesiDaAcquisto, (a.coefficient > 0 ? 1200 / a.coefficient : 120));
    return s + Math.min(a.costoStorico, a.fondoAmmIniziale + quotaAccumulata);
  }, 0);
  const quotaAnnuaTot = assets.reduce((s: number, a: any) => s + a.quotaAnnua, 0);

  const grouped = CATEGORIES.map(cat => ({ ...cat, items: assets.filter((a: any) => a.category === cat.id) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Ammortamenti</h1>
          <p className="text-gray-500 text-sm">D.M. 31/12/1988 - Gruppo XIX: Alberghi, ristoranti, bar</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm"><Plus className="w-4 h-4 inline mr-1" /> Nuovo Cespire</button>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{msg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatBox label="Cespiti" value={String(assets.length)} color="blue" />
        <StatBox label="Costo Storico" value={`€${Math.round(totalCosto).toLocaleString("it-IT")}`} color="green" />
        <StatBox label="Quota Annua Totale" value={`€${Math.round(quotaAnnuaTot).toLocaleString("it-IT")}`} color="amber" />
      </div>

      {/* FORM */}
      {showForm && (
        <div className="bg-white rounded-xl border-2 border-primary/30 p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Nuova Immobilizzazione</h3>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Descrizione Bene *</label><input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="es: Forno pizza professionale" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Categoria Ministeriale</label><select value={form.category} onChange={e => handleCategoryChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name} ({c.coefficient}%)</option>)}</select></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Coefficiente %</label><input type="number" value={form.coefficient} onChange={e => setForm({...form, coefficient: Number(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Costo Storico (€) *</label><input type="number" step="0.01" value={form.costoStorico} onChange={e => setForm({...form, costoStorico: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Quota Annua (auto)</label><p className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-mono">€{(Number(form.costoStorico) * form.coefficient / 100).toFixed(2)}</p></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Data Acquisto</label><input type="date" value={form.dataAcquisto} onChange={e => setForm({...form, dataAcquisto: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Data Entrata in Funzione</label><input type="date" value={form.dataEntrataFunzione} onChange={e => setForm({...form, dataEntrataFunzione: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Fornitore</label><input value={form.fornitore} onChange={e => setForm({...form, fornitore: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">N° Fattura</label><input value={form.numFattura} onChange={e => setForm({...form, numFattura: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          </div>
          <div className="flex gap-2 mt-4"><button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-lg text-sm"><Save className="w-4 h-4 inline mr-1" /> Registra Cespire</button><button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm">Annulla</button></div>
        </div>
      )}

      {/* REGISTRO CATEGORIE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b font-semibold">Registro Categorie Ministeriali (D.M. 31/12/1988)</div>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            {CATEGORIES.map(c => (
              <div key={c.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <span className="text-gray-500">{c.icon}</span>
                <div>
                  <p className="font-medium text-xs">{c.name}</p>
                  <p className="text-xs text-gray-400">Aliquota {c.coefficient}% · Vita {c.vita} anni</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LIBRO CESPITI */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
          <h3 className="font-semibold">Libro Cespiti ({assets.length})</h3>
          <div className="flex gap-4 text-sm">
            <span className="text-gray-500">Costo Storico: <strong>€{Math.round(totalCosto).toLocaleString("it-IT")}</strong></span>
            <span className="text-gray-500">Fondo: <strong>€{Math.round(totalFondo).toLocaleString("it-IT")}</strong></span>
            <span className="text-gray-500">Residuo: <strong>€{Math.round(totalCosto - totalFondo).toLocaleString("it-IT")}</strong></span>
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Caricamento...</div>
        ) : assets.length === 0 ? (
          <div className="p-8 text-center text-gray-400"><Calculator className="w-12 h-12 mx-auto mb-3" /><p>Nessun cespite. Registra il primo.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="text-left px-3 py-2">Descrizione</th><th className="text-left px-3 py-2">Categoria</th><th className="text-right px-3 py-2">Costo</th><th className="text-right px-3 py-2">%</th><th className="text-right px-3 py-2">Quota/Anno</th><th className="text-right px-3 py-2">Quota/Mese</th><th className="text-center px-3 py-2">Data Funz.</th><th className="w-10"></th></tr></thead>
              <tbody className="divide-y">
                {assets.map((a: any) => {
                  const mesi = Math.max(0, (new Date().getTime() - new Date(a.dataEntrataFunzione).getTime()) / (30 * 24 * 60 * 60 * 1000));
                  const accumulato = Math.min(a.costoStorico, a.fondoAmmIniziale + a.quotaMensile * mesi);
                  const residuo = a.costoStorico - accumulato;
                  const cat = CATEGORIES.find(c => c.id === a.category);
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{a.description}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{cat?.name || a.category}</td>
                      <td className="px-3 py-2 text-right font-mono">€{a.costoStorico.toLocaleString("it-IT")}</td>
                      <td className="px-3 py-2 text-right font-mono">{a.coefficient}%</td>
                      <td className="px-3 py-2 text-right font-mono">€{Math.round(a.quotaAnnua).toLocaleString("it-IT")}</td>
                      <td className="px-3 py-2 text-right font-mono">€{Math.round(a.quotaMensile).toLocaleString("it-IT")}</td>
                      <td className="px-3 py-2 text-center text-xs">{new Date(a.dataEntrataFunzione).toLocaleDateString("it-IT")}</td>
                      <td className="px-3 py-2"><button onClick={() => handleDelete(a.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CE LINK */}
      <div className="text-center text-sm text-gray-500">
        Le quote di ammortamento vengono automaticamente imputate nel <Link href="/controllo-gestione" className="text-primary hover:underline">Conto Economico →</Link> sotto la sezione Ammortamenti.
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: any) {
  const m: Record<string, string> = { blue: "bg-blue-50 border-blue-200 text-blue-700", green: "bg-green-50 border-green-200 text-green-700", amber: "bg-amber-50 border-amber-200 text-amber-700" };
  return <div className={`${m[color] || "bg-white"} rounded-xl p-4 border`}><p className="text-xs opacity-70 mb-1">{label}</p><p className="text-xl font-bold">{value}</p></div>;
}