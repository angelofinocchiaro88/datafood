"use client";

import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, ReferenceLine } from "recharts";

interface ForecastChartProps {
  forecast: any[];
}

export function ForecastChart({ forecast }: ForecastChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = forecast.map((w: any, i: number) => ({
    settimana: `S${i + 1}`,
    entrate: w.inflow,
    uscite: w.outflow,
    saldo: w.endingBalance,
  }));

  return (
    <div className="space-y-6">
      {/* Saldo fine settimana (linea) */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Proiezione Saldo (13 settimane)</h4>
        <div style={{ height: "220px", width: "100%" }}>
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="settimana" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => `€${Math.round(v).toLocaleString("it-IT")}`} />
                <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: "#10b981" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Entrate vs Uscite (barre) */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Entrate vs Uscite settimanali</h4>
        <div style={{ height: "200px", width: "100%" }}>
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="settimana" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => `€${Math.round(v).toLocaleString("it-IT")}`} />
                <Legend />
                <Bar dataKey="entrate" name="Entrate" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="uscite" name="Uscite" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}