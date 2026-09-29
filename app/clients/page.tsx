"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Trash2, Edit3, Save, X, ArrowLeft, Key } from "lucide-react";

interface Client {
  id: string;
  name: string;
  sdiCode: string | null;
  pecAddress: string | null;
  vatNumber: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", sdiCode: "", pecAddress: "", vatNumber: "", address: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clients");
      const data = await res.json();
      setClients(data.clients || []);
    } catch {}
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setMsg("Nome obbligatorio"); return; }
    setSaving(true);
    try {
      await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({ name: "", sdiCode: "", pecAddress: "", vatNumber: "", address: "", phone: "", email: "" });
      setShowForm(false);
      setMsg("✅ Cliente creato!");
      fetchClients();
    } catch { setMsg("Errore"); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questo cliente? I dati non verranno cancellati dal database.")) return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    fetchClients();
  };

  const handleSelect = (clientId: string) => {
    localStorage.setItem("df_clientId", clientId);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => router.push("/")} className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Torna alla home
            </button>
            <h1 className="text-2xl font-heading font-bold text-gray-900">Gestione Clienti</h1>
            <p className="text-gray-500 text-sm mt-1">{clients.length} clienti configurati</p>
          </div>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4 inline mr-1" /> Nuovo
          </button>
        </div>

        {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{msg}</div>}

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h3 className="font-semibold mb-4">Nuovo Cliente</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Nome Ristorante *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Es: Trattoria da Mario" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">P.IVA</label>
                <input value={form.vatNumber} onChange={e => setForm({...form, vatNumber: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="IT12345678901" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Codice SDI</label>
                <input value={form.sdiCode} onChange={e => setForm({...form, sdiCode: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="ABC1234" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">PEC</label>
                <input value={form.pecAddress} onChange={e => setForm({...form, pecAddress: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="nome@pec.it" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Telefono</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Indirizzo</label>
                <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Email</label>
                <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm"><Save className="w-4 h-4 inline mr-1" /> {saving ? "Salvo..." : "Salva"}</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm"><X className="w-4 h-4 inline mr-1" /> Annulla</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {clients.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{c.name}</p>
                  <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                    {c.vatNumber && <span>P.IVA: {c.vatNumber}</span>}
                    {c.sdiCode && <span>SDI: {c.sdiCode}</span>}
                    {c.pecAddress && <span>PEC: {c.pecAddress}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleSelect(c.id)} className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs">Entra</button>
                <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>

        {!loading && clients.length === 0 && !showForm && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nessun cliente. Clicca "Nuovo" per crearne uno.</p>
          </div>
        )}

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-blue-900 flex items-center gap-2"><Key className="w-5 h-5" /> Modalità di Accesso</h3>
          <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
            <div className="bg-white rounded-lg p-3">
              <p className="font-medium text-blue-800">🔑 Consulente</p>
              <p className="text-blue-700 mt-1 text-xs">Vedi tutti i clienti, gestisci dati, fai controllo di gestione per ogni ristorante. Accesso completo.</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="font-medium text-blue-800">🍽️ Cliente</p>
              <p className="text-blue-700 mt-1 text-xs">Vede solo il suo ristorante. Inserisce fatture, vede dashboard e report del suo locale.</p>
            </div>
          </div>
          <p className="text-xs text-blue-600 mt-3">
            Il cliente acquista DATAFOOD con il suo SDI code. Il consulente accede a tutti i clienti dallo stesso pannello.
          </p>
        </div>
      </div>
    </div>
  );
}