"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Save, X, Search, ChevronDown, ChevronRight, Package } from "lucide-react";

export default function FoodCostPage() {
  const [dishes, setDishes] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", price: "", description: "", categoryId: "" });
  const [showIngForm, setShowIngForm] = useState<string | null>(null);
  const [ingForm, setIngForm] = useState({ ingredientId: "", quantity: "" });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [d, i, c] = await Promise.all([
        fetch("/api/dishes").then(r => r.json()),
        fetch("/api/ingredients").then(r => r.json()),
        fetch("/api/categories").then(r => r.json()),
      ]);
      setDishes(Array.isArray(d) ? d : []);
      setIngredients(Array.isArray(i) ? i : []);
      setCategories(Array.isArray(c) ? c : []);
    } catch {}
    setLoading(false);
  };

  const openNew = () => { setEditing(null); setForm({ name: "", price: "", description: "", categoryId: categories[0]?.id || "" }); setShowForm(true); };
  const openEdit = (d: any) => { setEditing(d); setForm({ name: d.name, price: String(d.price), description: d.description || "", categoryId: d.categoryId }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name || !form.price) { setMsg("Nome e prezzo obbligatori"); return; }
    const url = editing ? `/api/dishes/${editing.id}` : "/api/dishes";
    await fetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowForm(false); setMsg(editing ? "✅ Piatto aggiornato" : "✅ Piatto creato"); load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questo piatto?")) return;
    await fetch(`/api/dishes/${id}`, { method: "DELETE" }); load();
  };

  const handleAddIngredient = async () => {
    if (!showIngForm || !ingForm.ingredientId || !ingForm.quantity) return;
    await fetch("/api/recipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dishId: showIngForm, ingredientId: ingForm.ingredientId, quantity: ingForm.quantity }) });
    setShowIngForm(null); setIngForm({ ingredientId: "", quantity: "" }); load();
  };

  const handleRemoveIngredient = async (dishId: string, ingredientId: string) => {
    await fetch("/api/recipes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dishId, ingredientId }) }); load();
  };

  const filtered = dishes.filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()));
  const calcCost = (d: any) => d.recipes?.reduce((s: number, r: any) => s + r.ingredient.unitPrice * r.quantity, 0) || 0;
  const getVat = (name: string, cat: string) => cat === "Bevande" ? (name.includes("Vino") ? 22 : 10) : 10;
  const calcFc = (d: any) => { const cost = calcCost(d); const pex = d.price / (1 + getVat(d.name, d.category?.name || "") / 100); return pex > 0 ? (cost / pex) * 100 : 0; };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Food Cost</h1>
          <p className="text-sm text-slate-500">{dishes.length} piatti · crea, modifica e gestisci ricette</p>
        </div>
        <div className="flex gap-2">
          <Link href="/magazzino" className="text-sm text-emerald-600 hover:underline flex items-center gap-1"><Package className="w-4 h-4" /> Ingredienti</Link>
          <button onClick={openNew} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium"><Plus className="w-4 h-4 inline mr-1" /> Nuovo Piatto</button>
        </div>
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">{msg}</div>}

      {showForm && (
        <div className="bg-white rounded-xl border-2 border-emerald-300 p-5">
          <div className="flex justify-between mb-4"><h3 className="font-semibold text-lg">{editing ? "Modifica Piatto" : "Nuovo Piatto"}</h3><button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">Nome *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-slate-500 block mb-1">Prezzo (€) *</label><input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-slate-500 block mb-1">Categoria</label><select value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">Descrizione</label><input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"><Save className="w-4 h-4 inline mr-1" /> {editing ? "Aggiorna" : "Crea"}</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border text-slate-600 rounded-lg text-sm">Annulla</button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca piatto..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" />
      </div>

      <div className="space-y-2">
        {filtered.map(d => {
          const cost = calcCost(d); const fc = calcFc(d);
          return (
            <div key={d.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
                <div className="flex items-center gap-3 flex-1">
                  <button className="text-slate-400">{expanded === d.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div><p className="font-medium text-slate-800">{d.name}</p><p className="text-xs text-slate-400">{d.category?.name} · {d.recipes?.length || 0} ingredienti</p></div>
                </div>
                <div className="flex items-center gap-4 mr-2">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Prezzo <strong className="text-slate-800">€ {d.price.toFixed(2)}</strong></p>
                    <p className="text-xs text-slate-400">Costo <strong className="text-red-600">€ {cost.toFixed(2)}</strong></p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${fc > 35 ? "bg-red-100 text-red-700" : fc > 28 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>FC {fc.toFixed(1)}%</span>
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(d); }} className="p-1.5 text-slate-400 hover:text-emerald-600"><Pencil className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>

              {expanded === d.id && (
                <div className="border-t border-slate-100 p-3.5 bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-slate-700">Ricetta</h4>
                    <button onClick={() => setShowIngForm(showIngForm === d.id ? null : d.id)} className="text-xs text-emerald-600 hover:underline"><Plus className="w-3.5 h-3.5 inline mr-0.5" /> Aggiungi ingrediente</button>
                  </div>

                  {showIngForm === d.id && (
                    <div className="flex gap-2 mb-3 p-2 bg-white rounded-lg border">
                      <select value={ingForm.ingredientId} onChange={e => setIngForm({...ingForm, ingredientId: e.target.value})} className="flex-1 px-2 py-1.5 border rounded text-sm">
                        <option value="">Seleziona ingrediente...</option>
                        {ingredients.filter(ing => !d.recipes?.some((r: any) => r.ingredientId === ing.id)).map(ing => (
                          <option key={ing.id} value={ing.id}>{ing.name} (€ {ing.unitPrice.toFixed(2)}/{ing.unit})</option>
                        ))}
                      </select>
                      <input type="number" step="0.001" value={ingForm.quantity} onChange={e => setIngForm({...ingForm, quantity: e.target.value})} placeholder="Qtà" className="w-20 px-2 py-1.5 border rounded text-sm" />
                      <button onClick={handleAddIngredient} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm"><Save className="w-3.5 h-3.5" /></button>
                    </div>
                  )}

                  {d.recipes?.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-2">Nessun ingrediente. Aggiungi la ricetta.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="text-slate-400 text-xs"><th className="text-left pb-1">Ingrediente</th><th className="text-right pb-1">Qtà</th><th className="text-right pb-1">Prezzo</th><th className="text-right pb-1">Costo</th><th className="w-8"></th></tr></thead>
                      <tbody>
                        {d.recipes?.map((r: any) => (
                          <tr key={r.id} className="border-t border-slate-100">
                            <td className="py-1.5">{r.ingredient.name}</td>
                            <td className="py-1.5 text-right">{r.quantity} {r.ingredient.unit}</td>
                            <td className="py-1.5 text-right">€ {r.ingredient.unitPrice.toFixed(2)}</td>
                            <td className="py-1.5 text-right font-medium text-red-600">€ {(r.quantity * r.ingredient.unitPrice).toFixed(2)}</td>
                            <td className="py-1.5"><button onClick={() => handleRemoveIngredient(d.id, r.ingredientId)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
                          </tr>
                        ))}
                        <tr className="border-t border-slate-200 font-semibold">
                          <td className="py-1.5">Totale ricetta</td><td></td><td></td>
                          <td className="py-1.5 text-right text-red-600">€ {cost.toFixed(2)}</td><td></td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">Nessun piatto trovato</div>}
      </div>
    </div>
  );
}