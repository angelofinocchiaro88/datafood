"use client";

import { Calendar, RefreshCw, Download, ChevronDown } from "lucide-react";

export type PeriodKey = "oggi" | "settimana" | "mese" | "trimestre" | "anno";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "oggi", label: "Oggi" },
  { key: "settimana", label: "Settimana" },
  { key: "mese", label: "Mese" },
  { key: "trimestre", label: "Trimestre" },
  { key: "anno", label: "Anno" },
];

interface DashboardHeaderProps {
  restaurantName: string;
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  lastUpdate: Date | null;
  onRefresh: () => void;
}

export function DashboardHeader({ restaurantName, period, onPeriodChange, lastUpdate, onRefresh }: DashboardHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard gestionale</h1>
          <p className="text-sm text-slate-500">{restaurantName}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => onPeriodChange(p.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${period === p.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button onClick={onRefresh} title="Aggiorna dati" className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button title="Esporta report" className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contesto periodo */}
      <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Q1 2026 (Gen–Mar)</span>
        <span>·</span>
        <span>Dati reali da vendite</span>
        <span>·</span>
        <span className="flex items-center gap-1">
          Aggiornato alle {lastUpdate ? lastUpdate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
        </span>
      </div>
    </div>
  );
}