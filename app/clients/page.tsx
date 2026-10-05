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
  serviceMode?: string;
  licenseStatus?: string;
  licensePlan?: string | null;
  licenseEndsAt?: string | null;
  managedServiceEnabled?: boolean;
  membershipRole?: string;
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const emptyForm = () => ({ name: "", sdiCode: "", pecAddress: "", vatNumber: "", address: "", phone: "", email: "", ownerEmail: "", serviceMode: "self_service", licenseStatus: "trial", licensePlan: "", licenseEndsAt: "", managedServiceEnabled: false });
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [platformRole, setPlatformRole] = useState("restaurant_user");
  const [createdInvitation, setCreatedInvitation] = useState("");
  const [editingLicenseId, setEditingLicenseId] = useState<string | null>(null);
  const [licenseForm, setLicenseForm] = useState({ serviceMode: "self_service", licenseStatus: "trial", licensePlan: "", licenseEndsAt: "", managedServiceEnabled: false });
  const [invitingClientId, setInvitingClientId] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "staff", managedAccess: false });
  const [inviteLink, setInviteLink] = useState("");

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!res.ok) { router.replace("/login"); return; }
      setPlatformRole(data.user?.platformRole || "restaurant_user");
      setClients(data.clients || []);
    } catch {}
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setMsg("Nome obbligatorio"); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossibile creare il ristorante");
      setForm(emptyForm());
      setShowForm(false);
      setCreatedInvitation(result.ownerInvitation || "");
      setMsg(result.ownerInvitation ? "Ristorante creato. Copia l’invito temporaneo per l’owner." : "Ristorante creato.");
      fetchClients();
    } catch (error) { setMsg(error instanceof Error ? error.message : "Errore"); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questo cliente? I dati non verranno cancellati dal database.")) return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    fetchClients();
  };

  const handleSelect = async (clientId: string) => {
    const response = await fetch("/api/auth/select-client", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) });
    const result = await response.json();
    if (!response.ok) { setMsg(result.error || "Accesso non autorizzato"); return; }
    localStorage.setItem("df_clientId", clientId);
    router.push("/dashboard");
  };

  const beginLicenseEdit = (client: Client) => {
    setEditingLicenseId(client.id);
    setLicenseForm({ serviceMode: client.serviceMode || "self_service", licenseStatus: client.licenseStatus || "trial", licensePlan: client.licensePlan || "", licenseEndsAt: client.licenseEndsAt ? new Date(client.licenseEndsAt).toISOString().slice(0, 10) : "", managedServiceEnabled: client.managedServiceEnabled || false });
  };

  const saveLicense = async (clientId: string) => {
    const response = await fetch(`/api/clients/${clientId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...licenseForm, licenseEndsAt: licenseForm.licenseEndsAt || null }) });
    const result = await response.json();
    if (!response.ok) { setMsg(result.error || "Licenza non aggiornata"); return; }
    setEditingLicenseId(null);
    setMsg("Licenza e modalità servizio aggiornate.");
    await fetchClients();
  };

  const createInvitation = async (clientId: string) => {
    const selected = await fetch("/api/auth/select-client", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) });
    if (!selected.ok) { const result = await selected.json(); setMsg(result.error || "Ristorante non selezionabile"); return; }
    localStorage.setItem("df_clientId", clientId);
    const response = await fetch("/api/auth/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inviteForm) });
    const result = await response.json();
    if (!response.ok) { setMsg(result.error || "Invito non creato"); return; }
    setInviteLink(`${window.location.origin}/invite/${result.invitationToken}`);
    setInviteForm({ email: "", role: "staff", managedAccess: false });
    setMsg(`Invito creato per ${result.email}; condividi il link, valido fino al ${new Date(result.expiresAt).toLocaleDateString("it-IT")}.`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => router.push("/dashboard")} className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Torna alla dashboard
            </button>
            <h1 className="text-2xl font-heading font-bold text-gray-900">Gestione Clienti</h1>
            <p className="text-gray-500 text-sm mt-1">{clients.length} clienti configurati</p>
          </div>
          {platformRole === "datafood_admin" && <button onClick={() => { setForm(emptyForm()); setCreatedInvitation(""); setShowForm(true); }} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4 inline mr-1" /> Nuovo
          </button>}
        </div>

        {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{msg}{createdInvitation&&<div className="mt-2 break-all rounded bg-white p-2 font-mono text-xs">{typeof window!=="undefined"?`${window.location.origin}/invite/${createdInvitation}`:createdInvitation}</div>}{inviteLink&&<div className="mt-2 break-all rounded bg-white p-2 font-mono text-xs">{inviteLink}</div>}</div>}

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
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Email owner da invitare</label>
                <input type="email" value={form.ownerEmail} onChange={e => setForm({...form, ownerEmail: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="owner@ristorante.it" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Modalità servizio</label>
                <select value={form.serviceMode} onChange={e=>setForm({...form,serviceMode:e.target.value,managedServiceEnabled:e.target.value==="managed"})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"><option value="self_service">Licenza self-service</option><option value="managed">Servizio gestito DATAFOOD</option><option value="hybrid">Ibrido</option></select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Stato licenza</label>
                <select value={form.licenseStatus} onChange={e=>setForm({...form,licenseStatus:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"><option value="trial">Prova</option><option value="active">Attiva</option><option value="past_due">Pagamento in ritardo</option><option value="suspended">Sospesa</option><option value="expired">Scaduta</option></select>
              </div>
              <div><label className="text-xs text-gray-500 mb-1 block">Piano licenza (facoltativo)</label><input value={form.licensePlan} onChange={e=>setForm({...form,licensePlan:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="mensile, annuale, managed"/></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Scadenza licenza (facoltativa)</label><input type="date" value={form.licenseEndsAt} onChange={e=>setForm({...form,licenseEndsAt:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"/></div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={form.managedServiceEnabled} onChange={e=>setForm({...form,managedServiceEnabled:e.target.checked})}/> Abilita incarico operativo DATAFOOD per questo ristorante</label>
                <p className="mt-1 text-[10px] text-gray-400">Le operazioni dell’operatore vengono attribuite e registrate.</p>
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
            <div key={c.id} className="space-y-2">
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
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
                  <p className="mt-1 text-[10px] text-slate-500">{c.serviceMode || "self_service"} · licenza {c.licenseStatus || "trial"}{c.membershipRole?` · ${c.membershipRole}`:""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleSelect(c.id)} className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs">Entra</button>
                {(platformRole === "datafood_admin" || ["owner", "manager"].includes(c.membershipRole || "")) && <button onClick={()=>{setInvitingClientId(invitingClientId===c.id?null:c.id);setInviteLink("");}} className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600">Invita</button>}
                {platformRole === "datafood_admin" && <button onClick={()=>editingLicenseId===c.id?setEditingLicenseId(null):beginLicenseEdit(c)} className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600">Licenza</button>}
                {platformRole === "datafood_admin" && <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Sospendi ristorante"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
            {platformRole === "datafood_admin" && editingLicenseId === c.id && <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4"><label className="text-xs text-slate-600">Servizio<select value={licenseForm.serviceMode} onChange={e=>setLicenseForm({...licenseForm,serviceMode:e.target.value,managedServiceEnabled:e.target.value==="self_service"?false:licenseForm.managedServiceEnabled})} className="mt-1 w-full rounded border border-slate-300 px-2 py-2"><option value="self_service">Self-service</option><option value="managed">Gestito</option><option value="hybrid">Ibrido</option></select></label><label className="text-xs text-slate-600">Licenza<select value={licenseForm.licenseStatus} onChange={e=>setLicenseForm({...licenseForm,licenseStatus:e.target.value})} className="mt-1 w-full rounded border border-slate-300 px-2 py-2"><option value="trial">Prova</option><option value="active">Attiva</option><option value="past_due">In ritardo</option><option value="suspended">Sospesa</option><option value="expired">Scaduta</option></select></label><label className="text-xs text-slate-600">Piano<input value={licenseForm.licensePlan} onChange={e=>setLicenseForm({...licenseForm,licensePlan:e.target.value})} className="mt-1 w-full rounded border border-slate-300 px-2 py-2" placeholder="mensile, annuale, managed"/></label><label className="text-xs text-slate-600">Scadenza<input type="date" value={licenseForm.licenseEndsAt} onChange={e=>setLicenseForm({...licenseForm,licenseEndsAt:e.target.value})} className="mt-1 w-full rounded border border-slate-300 px-2 py-2"/></label><label className="col-span-2 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={licenseForm.managedServiceEnabled} onChange={e=>setLicenseForm({...licenseForm,managedServiceEnabled:e.target.checked})}/> Incarico DATAFOOD autorizzato</label><div className="col-span-2 flex justify-end gap-2"><button onClick={()=>void saveLicense(c.id)} className="rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Salva</button><button onClick={()=>setEditingLicenseId(null)} className="rounded border border-slate-200 px-3 py-2 text-xs">Annulla</button></div></div>}
            {invitingClientId === c.id && <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3"><label className="text-xs text-slate-600">Email<input type="email" value={inviteForm.email} onChange={e=>setInviteForm({...inviteForm,email:e.target.value})} className="mt-1 w-full rounded border border-slate-300 px-2 py-2"/></label><label className="text-xs text-slate-600">Ruolo<select value={inviteForm.role} onChange={e=>setInviteForm({...inviteForm,role:e.target.value})} className="mt-1 w-full rounded border border-slate-300 px-2 py-2"><option value="manager">Manager</option><option value="accountant">Contabile</option><option value="staff">Staff</option>{platformRole==="datafood_admin"&&<option value="datafood_operator">Operatore DATAFOOD</option>}</select></label><div className="flex items-end"><button onClick={()=>void createInvitation(c.id)} disabled={!inviteForm.email} className="w-full rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Crea invito</button></div>{inviteForm.role==="datafood_operator"&&platformRole==="datafood_admin"&&<label className="col-span-full flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={inviteForm.managedAccess} onChange={e=>setInviteForm({...inviteForm,managedAccess:e.target.checked})}/> Concedi inserimento dati nell’ambito del servizio gestito</label>}</div>}
            </div>
          ))}
        </div>

        {!loading && clients.length === 0 && !showForm && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nessun ristorante associato a questo account.</p>
          </div>
        )}

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-blue-900 flex items-center gap-2"><Key className="w-5 h-5" /> Modalità di Accesso</h3>
          <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
            <div className="bg-white rounded-lg p-3">
              <p className="font-medium text-blue-800">🔑 Servizio gestito DATAFOOD</p>
              <p className="text-blue-700 mt-1 text-xs">Un operatore entra solo nei ristoranti con incarico gestito esplicito; gli inserimenti restano attribuiti all’operatore.</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="font-medium text-blue-800">🍽️ Licenza ristorante</p>
              <p className="text-blue-700 mt-1 text-xs">Owner, manager, contabile e staff operano solo nei ristoranti associati al proprio account.</p>
            </div>
          </div>
          <p className="text-xs text-blue-600 mt-3">
            Licenze e incarichi gestiti sono attivati manualmente dall’amministratore DATAFOOD in questa prima fase.
          </p>
        </div>
      </div>
    </div>
  );
}
