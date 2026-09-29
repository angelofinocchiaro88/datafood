"use client";

import { AlertTriangle, AlertCircle, Info, ChevronRight } from "lucide-react";

export interface DashboardAlert {
  priority: "critica" | "attenzione" | "informativa";
  title: string;
  description: string;
  value?: string;
  date?: string;
  action?: { label: string; href: string };
}

const PRIORITY_STYLES: Record<string, { bg: string; border: string; icon: any; iconColor: string }> = {
  critica: { bg: "bg-red-50", border: "border-red-200", icon: AlertTriangle, iconColor: "text-red-600" },
  attenzione: { bg: "bg-amber-50", border: "border-amber-200", icon: AlertCircle, iconColor: "text-amber-600" },
  informativa: { bg: "bg-blue-50", border: "border-blue-200", icon: Info, iconColor: "text-blue-600" },
};

export function AlertPanel({ alerts }: { alerts: DashboardAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
        <Info className="w-4 h-4" /> Non risultano criticità prioritarie nel periodo selezionato.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-700">Cosa richiede attenzione</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {alerts.slice(0, 4).map((a, i) => {
          const s = PRIORITY_STYLES[a.priority];
          const Icon = s.icon;
          return (
            <div key={i} className={`${s.bg} ${s.border} border rounded-xl p-3.5 flex items-start gap-3`}>
              <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${s.iconColor}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">{a.title}</h3>
                  {a.value && <span className="text-sm font-bold text-slate-900 whitespace-nowrap">{a.value}</span>}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{a.description}</p>
                {a.date && <p className="text-xs text-slate-400 mt-0.5">{a.date}</p>}
                {a.action && (
                  <a href={a.action.href} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline mt-1.5">
                    {a.action.label} <ChevronRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}