"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Plus } from "lucide-react";

interface Client {
  id: string;
  name: string;
}

export function ClientSelector() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setSelected(localStorage.getItem("df_clientId") || "");
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!res.ok) return;
      setClients(data.clients || []);
      const active = data.activeClientId || "";
      const stored = localStorage.getItem("df_clientId") || "";
      if (active && active !== stored) await fetch("/api/auth/select-client", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: active }) });
      setSelected(active);
      if (active) localStorage.setItem("df_clientId", active);
    } catch {}
  };

  const handleSelect = async (clientId: string) => {
    const response = await fetch("/api/auth/select-client", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) });
    if (!response.ok) return;
    localStorage.setItem("df_clientId", clientId);
    setSelected(clientId);
    setOpen(false);
    router.refresh();
    window.location.reload();
  };

  const currentName = clients.find((c) => c.id === selected)?.name || "Ristorante Demo";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-slate-50 transition-colors"
      >
        <Building2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span className="flex-1 text-left truncate text-xs font-medium text-slate-700">{currentName}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-1">
            {clients.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelect(c.id)}
                className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md text-left transition-colors ${
                  c.id === selected ? "bg-emerald-50 text-emerald-700 font-medium" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span className="truncate">{c.name}</span>
                {c.id === selected && <span className="ml-auto text-xs text-emerald-600">✓</span>}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 p-1">
            <button
              onClick={() => { setOpen(false); router.push("/clients"); }}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-50 rounded-md"
            >
              <Plus className="w-3.5 h-3.5" />
              Gestisci clienti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function getClientId(): string {
  if (typeof window === "undefined") return "default";
  return localStorage.getItem("df_clientId") || "default";
}
