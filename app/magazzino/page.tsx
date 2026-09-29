"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Save, X, Search, Package, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, TrendingUp, Filter, History } from "lucide-react";

const CATEGORIE = ["Carni", "Pesce", "Verdure", "Latticini", "Pasta e cereali", "Condimenti", "Bevande", "Bakery", "Altro"];

export default function MagazzinoPage() {
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", unit: "kg", categoria: "Altro", unitPrice: "", minStock: "", currentStock: "" });
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"stock" | "movimenti">("stock");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [ing, mov] = await Promise.all([
        fetch("/api/ingredients").then(r => r.json()),
        fetch("/api/movements").then(r => r.json()),
      ]);
      setIngredients(Array.isArray(ing) ? ing : []);
      setMovements(Array.isArray(mov) ? mov : []);
    } catch {}
    setLoading(false);
  };

  const openNew = () => { setEditing(null); setForm({ name: "", unit: "kg", categoria: "Altro", unitPrice: "", minStock: "", currentStock: "" }); setShowForm(true); };
  const openEdit = (ing: any) => { setEditing(ing); setForm({ name: ing.name, unit: ing.unit, categoria: ing.categoria || "Altro", unitPrice: String(ing.unitPrice), minStock: String(ing.minStock), currentStock: String(ing.currentStock) }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name) { setMsg("Nome obbligatorio"); return; }
    if (editing) await fetch(`/api/ingredients/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    else await fetch("/api/ingredients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowForm(false); setMsg(editing ? "✅ Ingrediente aggiornato" : "✅ Ingrediente creato"); load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questo ingrediente?")) return;
    await fetch(`/api/ingredients/${id}`, { method: "DELETE" }); load();
  };

  const handleAdjust = async (id: string, delta: number) => {
    const ing = ingredients.find(i => i.id === id);
    if (!ing) return;
    await fetch(`/api/ingredients/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentStock: Math.max(0, ing.currentStock + delta) }) });
    load();
  };

  const filtered = ingredients.filter(i =>
    (!search || i.name.toLowerCase().includes(search.toLowerCase())) &&
    (!catFilter || i.categoria === catFilter)
  );

  // KPI
  const valoreStock = ingredients.reduce((s, i) => s + i.currentStock * i.unitPrice, 0);
  const scorteBasse = ingredients.filter(i => i.currentStock <= i.minStock && i.minStock > 0);
  const esauriti = ingredients.filter(i => i.currentStock <= 0);

  // Analisi per categoria
  const perCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of ingredients) {
      const cat = i.categoria || "Altro";
      map[cat] = (map[cat] || 0) + i.currentStock * i.unitPrice;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [ingredients]);

  const maxCat = perCategoria.length > 0 ? perCategoria[0][1] : 1;

  const fm = (v: number) => `€ ${Math.round(v).toLocaleString("it-IT")}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Magazzino</h1>
          <p className="text-sm text-slate-500">{ingredients.length} ingredienti · valore stock {fm(valoreStock)}</p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium"><Plus className="w-4 h-4 inline mr-1" /> Nuovo Ingrediente</button>
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">{msg}</div>}

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox label="Valore stock" value={fm(valoreStock)} icon={<Boxes className="w-4 h-4" />} color="emerald" />
        <KpiBox label="Ingredienti" value={String(ingredients.length)} icon={<Package className="w-4 h-4" />} color="sky" />
        <KpiBox label="Scorte basse" value={String(scorteBasse.length)} icon={<AlertTriangle className="w-4 h-4" />} color={scorteBasse.length > 0 ? "amber" : "green"} />
        <KpiBox label="Esauriti" value={String(esauriti.length)} icon={<Package className="w-4 h-4" />} color={esauriti.length > 0 ? "red" : "green"} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab("stock")} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 ${tab === "stock" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}><Package className="w-4 h-4" /> Stock</button>
        <button onClick={() => setTab("movimenti")} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 ${tab === "movimenti" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}><History className="w-4 h-4" /> Movimenti ({movements.length})</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border-2 border-emerald-300 p-5">
          <div className="flex justify-between mb-4"><h3 className="font-semibold text-lg">{editing ? "Modifica Ingrediente" : "Nuovo Ingrediente"}</h3><button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button></div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">Nome *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-slate-500 block mb-1">Unità</label><input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="kg, lt, pz" /></div>
            <div><label className="text-xs text-slate-500 block mb-1">Categoria</label><select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">{CATEGORIE.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="text-xs text-slate-500 block mb-1">Prezzo (€/unità)</label><input type="number" step="0.01" value={form.unitPrice} onChange={e => setForm({...form, unitPrice: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-slate-500 block mb-1">Stock attuale</label><input type="number" step="0.1" value={form.currentStock} onChange={e => setForm({...form, currentStock: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-slate-500 block mb-1">Scorta minima</label><input type="number" step="0.1" value={form.minStock} onChange={e => setForm({...form, minStock: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"><Save className="w-4 h-4 inline mr-1" /> {editing ? "Aggiorna" : "Crea"}</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border text-slate-600 rounded-lg text-sm">Annulla</button>
          </div>
        </div>
      )}

      {tab === "stock" && (
        <>
          {/* Filtri */}
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca ingrediente..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setCatFilter("")} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${!catFilter ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"}`}>Tutte</button>
              {CATEGORIE.filter(c => ingredients.some(i => i.categoria === c)).map(c => (
                <button key={c} onClick={() => setCatFilter(catFilter === c ? "" : c)} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${catFilter === c ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"}`}>{c}</button>
              ))}
            </div>
          </div>

          {/* Analisi per categoria */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-600" /> Valore stock per categoria</h3>
            <div className="space-y-2">
              {perCategoria.map(([cat, val]) => (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-600">{cat}</span>
                    <span className="text-slate-800 font-medium">{fm(val)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(val / maxCat) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabella stock */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50"><tr><th className="text-left px-3 py-2 font-medium text-slate-600">Ingrediente</th><th className="text-left px-3 py-2 font-medium text-slate-600">Categoria</th><th className="text-right px-3 py-2 font-medium text-slate-600">Stock</th><th className="text-right px-3 py-2 font-medium text-slate-600">Min</th><th className="text-right px-3 py-2 font-medium text-slate-600">Prezzo</th><th className="text-right px-3 py-2 font-medium text-slate-600">Valore</th><th className="text-center px-3 py-2 font-medium text-slate-600">Stato</th><th className="text-right px-3 py-2 font-medium text-slate-600">Azioni</th></tr></thead>
                <tbody className="divide-y">
                  {filtered.map(ing => {
                    const low = ing.currentStock <= ing.minStock;
                    const valore = ing.currentStock * ing.unitPrice;
                    return (
                      <tr key={ing.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-800">{ing.name}</td>
                        <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{ing.categoria || "Altro"}</span></td>
                        <td className="px-3 py-2 text-right font-mono font-medium">{ing.currentStock}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-400">{ing.minStock}</td>
                        <td className="px-3 py-2 text-right font-mono">€ {ing.unitPrice.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700">{fm(valore)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex w-2.5 h-2.5 rounded-full ${ing.currentStock <= 0 ? "bg-red-500" : low ? "bg-amber-500" : "bg-emerald-500"}`} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => handleAdjust(ing.id, 1)} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded" title="+1"><ArrowUpFromLine className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleAdjust(ing.id, -1)} className="p-1 text-rose-500 hover:bg-rose-50 rounded" title="-1"><ArrowDownToLine className="w-3.5 h-3.5" /></button>
                            <button onClick={() => openEdit(ing)} className="p-1 text-slate-400 hover:text-emerald-600"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(ing.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && <div className="p-8 text-center text-slate-400"><Package className="w-12 h-12 mx-auto mb-3" /><p>Nessun ingrediente trovato</p></div>}
          </div>
        </>
      )}

      {tab === "movimenti" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b font-semibold">Ultimi movimenti</div>
          {movements.length === 0 ? (
            <p className="text-center py-8 text-slate-400">Nessun movimento registrato</p>
          ) : (
            <div className="divide-y">
              {movements.slice(0, 30).map((m: any) => (
                <div key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    {m.type === "IN" ? <ArrowDownToLine className="w-4 h-4 text-emerald-500" /> : <ArrowUpFromLine className="w-4 h-4 text-rose-500" />}
                    <div><p className="text-slate-700">{m.ingredient?.name || "?"}</p><p className="text-xs text-slate-400">{m.reference || "-"} · {new Date(m.date).toLocaleDateString("it-IT")}</p></div>
                  </div>
                  <span className={`font-mono ${m.type === "IN" ? "text-emerald-600" : "text-rose-600"}`}>{m.type === "IN" ? "+" : "-"}{m.quantity} {m.ingredient?.unit || ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KpiBox({ label, value, icon, color }: any) {
  const m: Record<string, string> = { emerald: "text-emerald-600 bg-emerald-50", sky: "text-sky-600 bg-sky-50", amber: "text-amber-600 bg-amber-50", red: "text-red-600 bg-red-50", green: "text-emerald-600 bg-emerald-50" };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5">
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${m[color] || "bg-slate-100 text-slate-500"}`}>{icon}</div>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}