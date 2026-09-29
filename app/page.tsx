"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Building2, ArrowRight, Plus, ShieldCheck, BarChart3, LineChart, Lock } from "lucide-react";
import { DatafoodLogo } from "@/components/brand/DatafoodLogo";

export default function HomePage() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch("/api/clients").then(r => r.json()).then(d => { setClients(d.clients || []); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const handleSelect = (clientId: string) => {
    localStorage.setItem("df_clientId", clientId);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white/70 backdrop-blur border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <DatafoodLogo size={40} showText dark={false} />
          <span className="text-xs text-slate-400">Software professionale · v1.0</span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-12">
          {/* Left: claim */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium mb-6">
              <BarChart3 className="w-3.5 h-3.5" /> Controllo di Gestione Ristorante
            </div>
            <h1 className="text-5xl font-bold text-slate-900 leading-tight mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>
              Il tuo ristorante<br />sotto controllo.<br /><span className="text-emerald-600">Ogni giorno.</span>
            </h1>
            <p className="text-slate-600 text-lg mb-8 max-w-md">
              Numeri chiari, margini reali, decisioni giuste. La piattaforma per chi non può permettersi di navigare a vista.
            </p>
            <div className="flex gap-6">
              <div className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 rounded-full bg-sky-500" /><span className="text-sm">KPI reali</span></div>
              <div className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-sm">Food Cost</span></div>
              <div className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-sm">Dati protetti</span></div>
            </div>
          </div>

          {/* Right: client selection */}
          <div>
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-6">
                <Building2 className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-semibold text-slate-800">Seleziona Ristorante</span>
                <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Online</span>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
                </div>
              ) : clients.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Nessun cliente configurato</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {clients.map(c => (
                    <button key={c.id} onClick={() => handleSelect(c.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center border border-slate-200">
                        <Building2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-slate-900 text-sm">{c.name}</p>
                        {c.sdiCode && <p className="text-xs text-slate-400">Codice SDI: {c.sdiCode}</p>}
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              )}

              <button onClick={() => router.push("/clients")}
                className="w-full mt-4 p-3 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:text-emerald-600 hover:border-emerald-500 transition-all text-sm flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Gestisci Ristoranti
              </button>
            </div>

            <div className="mt-6 flex items-center gap-2 justify-center text-xs text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Software professionale · On-premise · Nessun dato in cloud</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 py-4">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <DatafoodLogo size={22} />
          <span className="text-xs text-slate-400">Controllo di Gestione per la Ristorazione</span>
        </div>
      </footer>
    </div>
  );
}