"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Wallet, Gauge, AlertTriangle, ChevronRight, Activity } from "lucide-react";

export function CashFlowWidget() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cashflow/forecast?weeks=13").then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const fmt = (v: number) => `€${Math.round(v).toLocaleString("it-IT")}`;
  const balance = data?.account?.balance || 0;
  const runway = data?.runway;
  const atRisk = data?.atRiskWeeks || 0;

  // Mini sparkline dei saldi settimanali
  const balances = data?.forecast?.map((w: any) => w.endingBalance) || [];
  const min = Math.min(...balances, 0);
  const max = Math.max(...balances, 1);
  const range = max - min || 1;
  const points = balances.map((b: number, i: number) => {
    const x = (i / (balances.length - 1 || 1)) * 100;
    const y = 40 - ((b - min) / range) * 36;
    return `${x},${y}`;
  }).join(" ");

  return (
    <Link href="/cash-flow" className="block bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-600" /> Cash Flow
        </h3>
        <ChevronRight className="w-4 h-4 text-slate-300" />
      </div>

      {loading ? (
        <div className="animate-pulse h-20 bg-slate-100 rounded-lg" />
      ) : (
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-slate-400">Saldo attuale</p>
              <p className="text-2xl font-bold text-slate-900">{fmt(balance)}</p>
            </div>
            {/* Mini sparkline */}
            <svg width="120" height="44" viewBox="0 0 100 44" className="flex-shrink-0">
              <line x1="0" y1="40" x2="100" y2="40" stroke="#dc2626" strokeWidth="0.5" strokeDasharray="2 2" />
              <polyline points={points} fill="none" stroke="#10b981" strokeWidth="2" />
            </svg>
          </div>

          <div className="flex gap-3 text-xs">
            <div className="flex-1 bg-slate-50 rounded-lg p-2">
              <div className="flex items-center gap-1 text-slate-400"><Gauge className="w-3 h-3" /> Runway</div>
              <p className="font-semibold text-slate-800 mt-0.5">{runway == null ? "∞" : `${runway} sett.`}</p>
            </div>
            <div className="flex-1 bg-slate-50 rounded-lg p-2">
              <div className="flex items-center gap-1 text-slate-400"><AlertTriangle className="w-3 h-3" /> Rischio</div>
              <p className={`font-semibold mt-0.5 ${atRisk > 0 ? "text-amber-600" : "text-emerald-600"}`}>{atRisk} sett.</p>
            </div>
            <div className="flex-1 bg-slate-50 rounded-lg p-2">
              <div className="flex items-center gap-1 text-slate-400"><Activity className="w-3 h-3" /> Forecast</div>
              <p className="font-semibold text-slate-800 mt-0.5">13 sett.</p>
            </div>
          </div>
        </div>
      )}
    </Link>
  );
}