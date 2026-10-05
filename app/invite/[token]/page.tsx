"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DatafoodLogo } from "@/components/brand/DatafoodLogo";

export default function AcceptInvitationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [invitation, setInvitation] = useState<any>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/auth/invitations/${encodeURIComponent(params.token)}`).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Invito non disponibile");
      setInvitation(result);
    }).catch(reason => setError(reason.message || "Invito non disponibile")).finally(() => setLoading(false));
  }, [params.token]);

  const accept = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/auth/accept-invitation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: params.token, email: invitation.email, name, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Invito non accettato");
      if (!result.createdNewUser) { router.replace("/login"); return; }
      const login = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: invitation.email, password }) });
      if (!login.ok) throw new Error("Account creato. Accedi con le credenziali appena impostate.");
      const selected = await fetch("/api/auth/select-client", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: result.clientId }) });
      if (!selected.ok) throw new Error("Account creato. Accedi per continuare.");
      localStorage.setItem("df_clientId", result.clientId);
      router.replace("/dashboard");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Invito non accettato"); }
    finally { setSaving(false); }
  };

  return <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-4"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60"><div className="mb-6 flex justify-center"><DatafoodLogo size={42} showText dark={false}/></div>
    <h1 className="text-center text-xl font-bold text-slate-900">Invito DATAFOOD</h1>
    {loading ? <p className="py-8 text-center text-sm text-slate-400">Verifica invito…</p> : error && !invitation ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : invitation && <><p className="mt-2 text-center text-sm text-slate-500">Accesso a <strong>{invitation.restaurantName}</strong> · ruolo {invitation.role}</p>{error&&<p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}<form onSubmit={accept} className="mt-5 space-y-3"><label className="block text-xs font-medium text-slate-600">Email<input value={invitation.email} readOnly className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"/></label><label className="block text-xs font-medium text-slate-600">Nome<input required value={name} onChange={event=>setName(event.target.value)} autoComplete="name" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"/></label><label className="block text-xs font-medium text-slate-600">Crea password<input required minLength={12} type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"/><span className="mt-1 block text-[10px] text-slate-400">Almeno 12 caratteri.</span></label><button disabled={saving} className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving?"Attendi…":"Accetta invito"}</button></form></>}
  </section></main>;
}
