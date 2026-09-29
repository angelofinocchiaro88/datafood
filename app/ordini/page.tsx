"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingCart, CheckCircle2, Clock, Package, AlertTriangle, Plus, Trash2, Truck, ArrowRight, Search, X, Save, Mail } from "lucide-react";
import { OrdersChart } from "@/components/ordini/OrdersChart";

export default function OrdiniPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ supplierId: "", items: [] as { ingredientId: string; quantity: number }[] });
  const [selSupplier, setSelSupplier] = useState("");
  const [cart, setCart] = useState<{ ingredientId: string; name: string; quantity: number; unitPrice: number }[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [o, i, s] = await Promise.all([
        fetch("/api/orders").then(r => r.json()),
        fetch("/api/ingredients").then(r => r.json()),
        fetch("/api/suppliers").then(r => r.json()),
      ]);
      setOrders(o.orders || []);
      setIngredients(Array.isArray(i) ? i : []);
      setSuppliers(Array.isArray(s) ? s : []);
    } catch {}
    setLoading(false);
  };

  const scorteBasse = ingredients.filter(i => i.currentStock <= i.minStock && i.minStock > 0);
  const attivi = orders.filter(o => o.status === "SENT" || o.status === "DRAFT");
  const ricevuti = orders.filter(o => o.status === "RECEIVED");
  const valoreTotale = orders.reduce((s, o) => s + o.total, 0);

  const addToCart = (ing: any) => {
    if (cart.some(c => c.ingredientId === ing.id)) return;
    setCart([...cart, { ingredientId: ing.id, name: ing.name, quantity: Math.max(1, ing.minStock - ing.currentStock), unitPrice: ing.unitPrice }]);
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch("/api/orders", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    setMsg(status === "RECEIVED" ? "✅ Ordine ricevuto: magazzino aggiornato + fattura creata" : "📤 Ordine inviato");
    load();
  };

  const createOrder = async () => {
    if (!selSupplier || cart.length === 0) { setMsg("Seleziona fornitore e ingredienti"); return; }
    const res = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierId: selSupplier, items: cart.map(c => ({ ingredientId: c.ingredientId, quantity: c.quantity, unitPrice: c.unitPrice })) }),
    });
    if (res.ok) {
      setShowForm(false); setCart([]); setSelSupplier("");
      setMsg("✅ Ordine creato"); load();
    }
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Eliminare ordine?")) return;
    // Da implementare l'endpoint DELETE se serve
    setMsg("Eliminazione non ancora configurata");
  };

  const sendOrderEmail = async (order: any) => {
    const items = (order.items || []).map((i: any) => `• ${i.ingredient?.name || "?"}: ${i.quantity} x €${i.unitPrice.toFixed(2)}`).join("\n");
    const res = await fetch("/api/email/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: order.supplier?.email || "",
        subject: `Ordine #${order.id.slice(-4)} - DATAFOOD`,
        template: "ordine",
        text: `Gentile ${order.supplier?.name || "fornitore"},\n\nVi trasmettiamo il seguente ordine:\n\n${items}\n\nTotale: €${order.total.toFixed(2)}\n\nCordiali saluti,\nDATAFOOD`,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setMsg(data.mode === "dry_run" ? "📧 Email simulata (configura SMTP nelle Impostazioni)" : "📧 Ordine inviato via email");
    } else {
      setMsg("⚠️ Errore invio: " + (data.error || ""));
    }
  };

  const fm = (v: number) => `€ ${Math.round(v).toLocaleString("it-IT")}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Ordini</h1>
          <p className="text-sm text-slate-500">{orders.length} ordini · gestione acquisti fornitori</p>
        </div>
        <div className="flex gap-2">
          <Link href="/magazzino" className="text-sm text-emerald-600 hover:underline flex items-center gap-1"><Package className="w-4 h-4" /> Magazzino</Link>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium"><Plus className="w-4 h-4 inline mr-1" /> Nuovo Ordine</button>
        </div>
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">{msg}</div>}

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Ordini totali" value={String(orders.length)} icon={<ShoppingCart className="w-4 h-4" />} color="sky" />
        <Kpi label="Attivi (in corso)" value={String(attivi.length)} icon={<Clock className="w-4 h-4" />} color="amber" />
        <Kpi label="Ricevuti" value={String(ricevuti.length)} icon={<CheckCircle2 className="w-4 h-4" />} color="green" />
        <Kpi label="Valore totale" value={fm(valoreTotale)} icon={<Truck className="w-4 h-4" />} color="indigo" />
      </div>

      {/* Grafico ordini */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <OrdersChart orders={orders} />
      </div>

      {/* Scorte basse → suggerimenti ordine */}
      {scorteBasse.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4" /> Scorte basse ({scorteBasse.length}) — suggerimenti ordine</h3>
          <div className="flex flex-wrap gap-2">
            {scorteBasse.slice(0, 8).map(ing => (
              <button key={ing.id} onClick={() => { setShowForm(true); addToCart(ing); }}
                className="bg-white text-amber-700 text-xs px-3 py-1.5 rounded-full border border-amber-200 hover:border-amber-400 flex items-center gap-1">
                <Plus className="w-3 h-3" /> {ing.name}: {ing.currentStock} {ing.unit} (min {ing.minStock})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form nuovo ordine */}
      {showForm && (
        <div className="bg-white rounded-xl border-2 border-emerald-300 p-5">
          <div className="flex justify-between mb-4">
            <h3 className="font-semibold text-lg">Nuovo Ordine</h3>
            <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Fornitore</label>
              <select value={selSupplier} onChange={e => setSelSupplier(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Seleziona...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Aggiungi ingrediente</label>
              <select onChange={e => { const ing = ingredients.find(i => i.id === e.target.value); if (ing) addToCart(ing); e.target.value = ""; }} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Cerca/aggiungi...</option>
                {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name} ({ing.currentStock} {ing.unit})</option>)}
              </select>
            </div>
          </div>

          {cart.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Riga ordine ({cart.length})</h4>
              <table className="w-full text-sm">
                <thead><tr className="text-slate-400 text-xs"><th className="text-left">Ingrediente</th><th className="text-right">Qtà</th><th className="text-right">Prezzo</th><th className="text-right">Totale</th><th className="w-8"></th></tr></thead>
                <tbody>
                  {cart.map((c, i) => (
                    <tr key={c.ingredientId} className="border-t">
                      <td className="py-1.5">{c.name}</td>
                      <td className="text-right"><input type="number" value={c.quantity} onChange={e => setCart(cart.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} className="w-16 text-right border rounded px-1 text-sm" min="1" /></td>
                      <td className="text-right">€ {c.unitPrice.toFixed(2)}</td>
                      <td className="text-right font-medium">€ {(c.quantity * c.unitPrice).toFixed(2)}</td>
                      <td><button onClick={() => setCart(cart.filter((_, j) => j !== i))} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t font-semibold"><td colSpan={3} className="text-right py-1.5">Totale:</td><td className="text-right">€ {cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0).toFixed(2)}</td><td></td></tr></tfoot>
              </table>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button onClick={createOrder} disabled={!selSupplier || cart.length === 0} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50"><Save className="w-4 h-4 inline mr-1" /> Crea Ordine</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border text-slate-600 rounded-lg text-sm">Annulla</button>
          </div>
        </div>
      )}

      {/* Tabella ordini */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b font-semibold">Storico Ordini</div>
        {orders.length === 0 ? (
          <p className="text-center py-8 text-slate-400">Nessun ordine</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className="text-left px-3 py-2">N°</th><th className="text-left px-3 py-2">Data</th><th className="text-left px-3 py-2">Fornitore</th><th className="text-right px-3 py-2">Totale</th><th className="text-center px-3 py-2">Stato</th><th className="text-right px-3 py-2">Items</th><th className="text-center px-3 py-2">Azioni</th></tr></thead>
              <tbody className="divide-y">
                {orders.map(o => {
                  const statusStyle = o.status === "RECEIVED" ? "bg-emerald-100 text-emerald-700" : o.status === "SENT" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600";
                  const statusLabel = o.status === "RECEIVED" ? "Ricevuto" : o.status === "SENT" ? "Inviato" : "Bozza";
                  return (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">#{o.id.slice(-4)}</td>
                      <td className="px-3 py-2 text-slate-500">{new Date(o.date).toLocaleDateString("it-IT")}</td>
                      <td className="px-3 py-2">{o.supplier?.name || "-"}</td>
                      <td className="px-3 py-2 text-right font-mono font-medium">€ {o.total.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle}`}>{statusLabel}</span></td>
                      <td className="px-3 py-2 text-right">{o.items?.length || 0}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => sendOrderEmail(o)} className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded" title="Invia via email"><Mail className="w-3 h-3 inline mr-0.5" />Email</button>
                          {o.status === "DRAFT" && <button onClick={() => updateStatus(o.id, "SENT")} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Invia</button>}
                          {o.status === "SENT" && <button onClick={() => updateStatus(o.id, "RECEIVED")} className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">Ricevuto</button>}
                          {o.status === "RECEIVED" && <span className="text-xs text-emerald-600">✓ completo</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Collegamenti */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-center text-xs">
        <Link href="/magazzino" className="bg-white border border-slate-200 rounded-xl p-3 hover:border-emerald-400 transition-colors"><Package className="w-5 h-5 mx-auto mb-1 text-slate-400" /><span className="text-slate-600">Magazzino</span></Link>
        <Link href="/fornitori" className="bg-white border border-slate-200 rounded-xl p-3 hover:border-emerald-400 transition-colors"><Truck className="w-5 h-5 mx-auto mb-1 text-slate-400" /><span className="text-slate-600">Fornitori</span></Link>
        <Link href="/accounting" className="bg-white border border-slate-200 rounded-xl p-3 hover:border-emerald-400 transition-colors"><Package className="w-5 h-5 mx-auto mb-1 text-slate-400" /><span className="text-slate-600">Fatture</span></Link>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, color }: any) {
  const m: Record<string, string> = { sky: "text-sky-600 bg-sky-50", amber: "text-amber-600 bg-amber-50", green: "text-emerald-600 bg-emerald-50", indigo: "text-indigo-600 bg-indigo-50" };
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