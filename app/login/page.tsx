"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LockKeyhole } from "lucide-react";
import { DatafoodLogo } from "@/components/brand/DatafoodLogo";

export default function LoginPage() {
  const router = useRouter();
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [bootstrapConfigured, setBootstrapConfigured] = useState(true);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<"login" | "bootstrap">("login");
  const [nextPath, setNextPath] = useState("/dashboard");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const candidate = new URLSearchParams(window.location.search).get("next");
    if (candidate?.startsWith("/") && !candidate.startsWith("//")) setNextPath(candidate);
    fetch("/api/auth/status").then(response => response.json()).then(result => {
      setNeedsBootstrap(Boolean(result.needsBootstrap));
      setBootstrapConfigured(Boolean(result.bootstrapConfigured));
      if (result.needsBootstrap) setMode("bootstrap");
    }).catch(() => setError("Impossibile verificare lo stato del servizio.")).finally(() => setChecking(false));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const endpoint = mode === "bootstrap" ? "/api/auth/bootstrap" : "/api/auth/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, ...(mode === "bootstrap" ? { token: bootstrapToken } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Accesso non riuscito");
      const sessionResponse = await fetch("/api/auth/me");
      const session = await sessionResponse.json();
      const selected = session.activeClientId;
      if (selected) {
        const selectResponse = await fetch("/api/auth/select-client", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: selected }) });
        if (!selectResponse.ok) throw new Error("Impossibile selezionare il ristorante");
        localStorage.setItem("df_clientId", selected);
      }
      router.replace(selected ? nextPath : "/clients");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Accesso non riuscito");
    } finally { setSaving(false); }
  };

  return <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-4"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60">
    <div className="mb-6 flex justify-center"><DatafoodLogo size={42} showText dark={false}/></div>
    <div className="mb-5 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">{mode === "bootstrap" ? <Building2 className="h-5 w-5"/> : <LockKeyhole className="h-5 w-5"/>}</div><h1 className="text-xl font-bold text-slate-900">{mode === "bootstrap" ? "Configura DATAFOOD" : "Accedi al tuo spazio"}</h1><p className="mt-1 text-sm text-slate-500">{mode === "bootstrap" ? "Crea l’amministratore iniziale della piattaforma." : "Ogni ristorante e ogni incarico hanno accessi separati."}</p></div>
    {error && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    {!checking && needsBootstrap && !bootstrapConfigured && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Configurazione iniziale in corso: l’amministratore DATAFOOD deve completare la configurazione sicura.</div>}
    {checking ? <p className="py-8 text-center text-sm text-slate-400">Verifica servizio…</p> : <form onSubmit={submit} className="space-y-3">
      {mode === "bootstrap" && <><label className="block text-xs font-medium text-slate-600">Nome amministratore<input required value={name} onChange={event=>setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" autoComplete="name"/></label><label className="block text-xs font-medium text-slate-600">Token iniziale DATAFOOD<input required value={bootstrapToken} onChange={event=>setBootstrapToken(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" autoComplete="off"/></label></>}
      <label className="block text-xs font-medium text-slate-600">Email<input required type="email" value={email} onChange={event=>setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" autoComplete="email"/></label>
      <label className="block text-xs font-medium text-slate-600">Password<input required type="password" minLength={mode === "bootstrap" ? 12 : 1} value={password} onChange={event=>setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" autoComplete={mode === "bootstrap" ? "new-password" : "current-password"}/>{mode === "bootstrap"&&<span className="mt-1 block text-[10px] text-slate-400">Almeno 12 caratteri.</span>}</label>
      <button disabled={saving || (mode === "bootstrap" && !bootstrapConfigured)} className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white enabled:hover:bg-emerald-700 disabled:opacity-50">{saving ? "Attendi…" : mode === "bootstrap" ? "Crea amministratore" : "Accedi"}</button>
    </form>}
    {!checking && !needsBootstrap && mode === "login" && <p className="mt-4 text-center text-xs text-slate-400">Per un nuovo accesso, chiedi un invito al gestore del ristorante o all’amministratore DATAFOOD.</p>}
  </section></main>;
}
