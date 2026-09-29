"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export interface RevenueTrendPoint {
  date: string;
  ricavi: number;
  coperti: number;
  transazioni: number;
}

interface RevenuePerformanceChartProps {
  data: RevenueTrendPoint[];
  granularity?: "giornaliero" | "settimanale" | "mensile";
}

function getWeekStart(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function aggregate(data: RevenueTrendPoint[], granularity: RevenuePerformanceChartProps["granularity"]) {
  if (granularity === "giornaliero") return data;

  const grouped = new Map<string, RevenueTrendPoint>();
  for (const point of data) {
    const key = granularity === "mensile" ? point.date.slice(0, 7) : getWeekStart(point.date);
    const item = grouped.get(key) || { date: key, ricavi: 0, coperti: 0, transazioni: 0 };
    item.ricavi += point.ricavi;
    item.coperti += point.coperti;
    item.transazioni += point.transazioni;
    grouped.set(key, item);
  }

  return Array.from(grouped.values());
}

// Il grafico usa la stessa serie già aggregata dall'API della dashboard,
// quindi rispetta il periodo selezionato e non ricarica un trimestre fisso.
export function RevenuePerformanceChart({ data, granularity = "giornaliero" }: RevenuePerformanceChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const chartData = useMemo(() => aggregate(data, granularity), [data, granularity]);
  const tooltipFormatter = (value: any, name: any) => {
    if (name === "ricavi") return [`€ ${Math.round(value).toLocaleString("it-IT")}`, "Ricavi"];
    return [value.toLocaleString("it-IT"), name === "coperti" ? "Coperti" : name];
  };

  return (
    <div style={{ height: "200px", width: "100%" }}>
      {mounted && chartData.length > 0 && data.some(point => point.transazioni > 0) && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickFormatter={(value) => granularity === "giornaliero" ? value.slice(5).replace("-", "/") : value} interval="preserveStartEnd" />
            <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`} />
            <Tooltip formatter={tooltipFormatter} />
            <Bar dataKey="ricavi" name="ricavi" fill="#10b981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      {mounted && (chartData.length === 0 || !data.some(point => point.transazioni > 0)) && <div className="h-full flex items-center justify-center text-slate-400 text-sm">Nessun dato vendite nel periodo</div>}
    </div>
  );
}
