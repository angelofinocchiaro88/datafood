"use client";

import { ArrowUpRight, ArrowDownRight, Info } from "lucide-react";

export interface KpiData {
  label: string;
  value: string;
  sub?: string;
  comparison?: { text: string; positive: boolean };
  status?: "ok" | "warning" | "danger" | "neutral";
  tooltip?: string;
  badge?: string;
}

export function KpiCard({ data }: { data: KpiData }) {
  const statusStyles: Record<string, string> = {
    ok: "border-l-green-500",
    warning: "border-l-amber-500",
    danger: "border-l-red-500",
    neutral: "border-l-slate-300",
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-l-4 ${statusStyles[data.status || "neutral"]} p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-slate-500">{data.label}</p>
            {data.tooltip && (
              <span title={data.tooltip} className="text-slate-300 cursor-help"><Info className="w-3.5 h-3.5" /></span>
            )}
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{data.value}</p>
          {data.sub && <p className="text-xs text-slate-400 mt-0.5">{data.sub}</p>}
        </div>
        {data.badge && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 whitespace-nowrap">{data.badge}</span>}
      </div>

      {data.comparison && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${data.comparison.positive ? "text-green-600" : "text-red-600"}`}>
          {data.comparison.positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {data.comparison.text}
        </div>
      )}
    </div>
  );
}