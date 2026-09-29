"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface RevenuePerformanceChartProps {
  days?: number;
  granularity?: "giornaliero" | "settimanale" | "mensile";
}

// Grafico ricavi reali dal modulo Vendite (dati del database)
export function RevenuePerformanceChart({ days = 90, granularity = "giornaliero" }: RevenuePerformanceChartProps) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const from = new Date(2026, 0, 1);
    const to = new Date(2026, 2, 31);
    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];

    fetch(`/api/sales?from=${fromStr}&to=${toStr}&limit=1000`)
      .then(r => r.json())
      .then(sales => {
        // Aggrega per giorno
        const daily: Record<string, { date: string; ricavi: number; coperti: number; transazioni: number }> = {};
        for (const s of sales) {
          const key = new Date(s.date).toISOString().split("T")[0];
          if (!daily[key]) daily[key] = { date: key, ricavi: 0, coperti: 0, transazioni: 0 };
          daily[key].ricavi += s.total;
          daily[key].coperti += s.coverCount;
          daily[key].transazioni += 1;
        }

        let result = Object.values(daily).sort((a, b) => a.date.localeCompare(b.date));

        // Aggrega per settimana se richiesto
        if (granularity === "settimanale") {
          const weekly: any[] = [];
          for (let i = 0; i < result.length; i += 7) {
            const chunk = result.slice(i, i + 7);
            if (chunk.length === 0) continue;
            weekly.push({
              date: `S${Math.ceil((i + 1) / 7)}`,
              ricavi: chunk.reduce((s, c) => s + c.ricavi, 0),
              coperti: chunk.reduce((s, c) => s + c.coperti, 0),
            });
          }
          result = weekly;
        } else if (granularity === "mensile") {
          const monthly: any[] = [];
          const months: Record<string, any> = {};
          for (const d of result) {
            const mKey = d.date.slice(0, 7);
            if (!months[mKey]) months[mKey] = { date: mKey, ricavi: 0, coperti: 0 };
            months[mKey].ricavi += d.ricavi;
            months[mKey].coperti += d.coperti;
          }
          result = Object.values(months);
        }

        setData(result);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [granularity]);

  const tooltipFormatter = (v: any, name: any) => {
    if (name === "ricavi") return [`€ ${Math.round(v).toLocaleString("it-IT")}`, "Ricavi"];
    return [v.toLocaleString("it-IT"), name === "coperti" ? "Coperti" : name];
  };

  return (
    <div>
      <div style={{ height: "200px", width: "100%" }}>
        {mounted && !loading && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickFormatter={(v) => {
                if (granularity === "giornaliero") return v.slice(5).replace("-", "/");
                return v;
              }} interval="preserveStartEnd" />
              <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="ricavi" name="Ricavi" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {loading && <div className="h-full flex items-center justify-center text-slate-400 text-sm">Caricamento ricavi...</div>}
        {!loading && data.length === 0 && <div className="h-full flex items-center justify-center text-slate-400 text-sm">Nessun dato vendite nel periodo</div>}
      </div>
    </div>
  );
}