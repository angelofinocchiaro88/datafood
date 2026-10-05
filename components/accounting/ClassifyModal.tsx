"use client";

import { useState, useEffect } from "react";
import { X, Save, Tag, ChevronDown } from "lucide-react";

interface ClassifyModalProps {
  invoice: any;
  onClose: () => void;
  onClassify: (classification: any) => void;
}

export function ClassifyModal({ invoice, onClose, onClassify }: ClassifyModalProps) {
  const [macroAreas, setMacroAreas] = useState<any[]>([]);
  const [categorie, setCategorie] = useState<string[]>([]);
  const [sottocategorie, setSottocategorie] = useState<string[]>([]);
  const [voci, setVoci] = useState<string[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderId, setOrderId] = useState<string>(invoice?.orderId || "");

  const [macro, setMacro] = useState("");
  const [categoria, setCategoria] = useState("");
  const [sottocategoria, setSottocategoria] = useState("");
  const [voce, setVoce] = useState("");

  useEffect(() => {
    fetch("/api/cost-topology").then(r => r.json()).then(d => setMacroAreas(d.macro_areas || []));
    fetch("/api/orders").then(r => r.json()).then(d => setOrders((d.orders || []).filter((order: any) => order.status === "RECEIVED" && order.supplierId === invoice?.supplierId)));
  }, []);

  useEffect(() => {
    if (macro) { setCategoria(""); setSottocategoria(""); setVoce("");
      fetch(`/api/cost-topology?macro=${encodeURIComponent(macro)}`).then(r => r.json()).then(d => setCategorie(d.categorie || [])); }
  }, [macro]);

  useEffect(() => {
    if (categoria) { setSottocategoria(""); setVoce("");
      fetch(`/api/cost-topology?macro=${encodeURIComponent(macro)}&categoria=${encodeURIComponent(categoria)}`).then(r => r.json()).then(d => setSottocategorie(d.sottocategorie || [])); }
  }, [categoria]);

  useEffect(() => {
    if (sottocategoria) { setVoce("");
      fetch(`/api/cost-topology?macro=${encodeURIComponent(macro)}&categoria=${encodeURIComponent(categoria)}&sottocategoria=${encodeURIComponent(sottocategoria)}`).then(r => r.json()).then(d => setVoci(d.voci || [])); }
  }, [sottocategoria]);

  const contoGestionale = macroAreas.find(m => m.macro_area === macro)?.conto_gestionale || "";

  const handleSave = () => {
    onClassify({ macroArea: macro, categoria, sottocategoria, voceDettaglio: voce || sottocategoria, contoGestionale, orderId: orderId || null });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-500" />
            <div>
              <h3 className="font-semibold text-gray-900">Classifica Fattura</h3>
              <p className="text-xs text-gray-500">{invoice?.invoiceNumber} · {invoice?.senderName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
            <p className="font-medium text-amber-800">Importo: €{invoice?.totalAmount?.toFixed(2) || "0.00"}</p>
            <p className="text-xs text-amber-600 mt-0.5">Seleziona la classificazione gerarchica del costo</p>
          </div>

          {orders.length > 0 && <div><label className="text-xs font-medium text-gray-500 mb-1 block">Ordine ricevuto da riconciliare (facoltativo)</label><select value={orderId} onChange={event=>setOrderId(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"><option value="">Nessun ordine collegato</option>{orders.map(order=><option key={order.id} value={order.id}>Ordine #{order.id.slice(-6)} · {new Date(order.date).toLocaleDateString("it-IT")} · €{order.total.toFixed(2)}</option>)}</select><p className="mt-1 text-[10px] text-gray-400">Solo ordini ricevuti dallo stesso fornitore.</p></div>}

          {/* Livello 1: Macro Area */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">1. Macro Area</label>
            <select value={macro} onChange={e => setMacro(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
              <option value="">Seleziona macro area...</option>
              {macroAreas.map(m => <option key={m.macro_area} value={m.macro_area}>{m.macro_area}</option>)}
            </select>
          </div>

          {/* Livello 2: Categoria */}
          {macro && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">2. Categoria</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="">Seleziona categoria...</option>
                {categorie.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Livello 3: Sottocategoria */}
          {categoria && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">3. Sottocategoria</label>
              <select value={sottocategoria} onChange={e => setSottocategoria(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="">Seleziona sottocategoria...</option>
                {sottocategorie.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Livello 4: Voce Dettaglio */}
          {sottocategoria && voci.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">4. Voce Dettaglio</label>
              <select value={voce} onChange={e => setVoce(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="">Seleziona voce...</option>
                {voci.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}

          {/* Riepilogo classificazione */}
          {(macro || categoria) && (
            <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
              <p className="text-xs text-gray-500">Riepilogo:</p>
              <p><span className="font-medium">Macro:</span> {macro || "-"}</p>
              <p><span className="font-medium">Categoria:</span> {categoria || "-"}</p>
              <p><span className="font-medium">Sottocategoria:</span> {sottocategoria || "-"}</p>
              <p><span className="font-medium">Voce:</span> {voce || "-"}</p>
              <p><span className="font-medium">Conto Gestionale:</span> <span className="text-indigo-600">{contoGestionale}</span></p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-2">
          <button onClick={handleSave} disabled={!macro}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-500">
            <Save className="w-4 h-4 inline mr-1" /> Classifica e Approva
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm">Annulla</button>
        </div>
      </div>
    </div>
  );
}
