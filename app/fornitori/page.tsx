"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Truck, Phone, Mail, MapPin, Calendar, Clock, User, Plus, X, Save, Pencil, Trash2, Search } from "lucide-react";

interface Supplier {
  id: string; name: string; vat: string | null; email: string | null;
  phone: string | null; address: string | null; notes: string | null;
}

export default function FornitoriPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: "", vat: "", email: "", phone: "", address: "", notes: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => { loadSuppliers(); }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers");
      const data = await res.json();
      const arr = Array.isArray(data) ? data : data.suppliers || [];
      // dedup by id
      setSuppliers(arr.filter((s: Supplier, i: number, a: Supplier[]) => a.findIndex(x => x.id === s.id) === i));
    } catch {}
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", vat: "", email: "", phone: "", address: "", notes: "" });
    setShowForm(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, vat: s.vat || "", email: s.email || "", phone: s.phone || "", address: s.address || "", notes: "" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setMsg("Nome obbligatorio"); return; }
    const url = editing ? `/api/suppliers/${editing.id}` : "/api/suppliers";
    const method = editing ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowForm(false);
    setMsg(editing ? "✅ Fornitore aggiornato" : "✅ Nuovo fornitore aggiunto");
    loadSuppliers();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questo fornitore?")) return;
    await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
    loadSuppliers();
  };

  const filtered = suppliers.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.vat && s.vat.includes(search)) || (s.email && s.email.includes(search))
  );

  const parseNotes = (s: string | null) => { try { return JSON.parse(s || "{}"); } catch { return {}; } };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Fornitori</h1>
          <p className="text-gray-500 text-sm">{suppliers.length} fornitori</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openNew} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4 inline mr-1" /> Nuovo Fornitore
          </button>
          <Link href="/ordini" className="text-xs text-primary hover:underline self-center">Ordini →</Link>
        </div>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{msg}</div>}

      {showForm && (
        <div className="bg-white rounded-xl border-2 border-primary/30 p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">{editing ? "Modifica Fornitore" : "Nuovo Fornitore"}</h3>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Nome *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div><label className="text-xs text-gray-500 mb-1 block">P.IVA</label><input value={form.vat} onChange={e => setForm({...form, vat: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Telefono</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Email</label><input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Indirizzo</label><input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-lg text-sm"><Save className="w-4 h-4 inline mr-1" /> {editing ? "Aggiorna" : "Salva"}</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm">Annulla</button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca fornitore..." className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-40" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const notes = parseNotes(s.notes);
            return (
              <div key={s.id} className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-sm transition-shadow group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center"><Truck className="w-5 h-5 text-primary" /></div>
                    <div>
                      <h3 className="font-medium text-gray-900">{s.name}</h3>
                      {notes.category && <p className="text-xs text-primary font-medium">{notes.category}</p>}
                      {notes.code && <p className="text-xs text-gray-400">{notes.code}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(s)} className="p-1 text-gray-400 hover:text-primary"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(s.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {s.vat && <div className="flex items-center gap-2 text-gray-600"><span className="text-xs font-mono text-gray-400">P.IVA:</span><span>{s.vat}</span></div>}
                  {s.address && <div className="flex items-start gap-2 text-gray-600"><MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" /><span className="line-clamp-2">{s.address}</span></div>}
                  {s.phone && <div className="flex items-center gap-2 text-gray-600"><Phone className="w-4 h-4 text-gray-400" /><span>{s.phone}</span></div>}
                  {s.email && <div className="flex items-center gap-2 text-gray-600"><Mail className="w-4 h-4 text-gray-400" /><span className="text-primary text-xs">{s.email}</span></div>}
                  {notes.contact && <div className="flex items-center gap-2 text-gray-600"><User className="w-4 h-4 text-gray-400" /><span>Ref: {notes.contact}</span></div>}
                  {notes.paymentTerms && <div className="flex items-center gap-2 text-gray-600"><Calendar className="w-4 h-4 text-gray-400" /><span>{notes.paymentTerms}</span></div>}
                  {notes.deliveryHours && <div className="flex items-center gap-2 text-gray-600"><Clock className="w-4 h-4 text-gray-400" /><span>{notes.deliveryHours}</span></div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nessun fornitore trovato</p>
          <button onClick={openNew} className="mt-3 text-primary text-sm hover:underline">Crea il primo →</button>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
        <p className="text-blue-800"><strong>Collegamento con Fatture:</strong> quando inserisci una fattura in Accounting, se il fornitore non esiste viene creato automaticamente qui. Puoi anche registrarlo manualmente con "Nuovo Fornitore".</p>
      </div>
    </div>
  );
}