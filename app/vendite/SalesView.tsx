"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const MONTHS = ["Gennaio", "Febbraio", "Marzo"];
const COLORS = ["#1E3A5F", "#2D5016", "#D4A574", "#6B7280", "#9CA3AF", "#EAB308", "#EF4444", "#22C55E"];

const EuroTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return <div className="bg-white px-3 py-2 shadow-lg rounded-lg border text-sm">€{v.toLocaleString("it-IT")}</div>;
};

const QtyTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return <div className="bg-white px-3 py-2 shadow-lg rounded-lg border text-sm">{v} porzioni</div>;
};

export function SalesView({ monthlyData, analysis, topDishes, totalRev }: any) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<"month" | "week" | "day">("month");
  useEffect(() => setMounted(true), []);

  const monthNames = ["Gen", "Feb", "Mar"];
  const monthRev = monthlyData.map((m: any) => ({
    name: monthNames[m.month - 1],
    revenue: Math.round(m.sales.reduce((s: number, d: any) => s + d.rev, 0)),
    qty: m.sales.reduce((s: number, d: any) => s + d.qty, 0),
  }));

  const weeklyData = monthRev.flatMap((m: any, i: number) => {
    const weeks = i === 1 ? 4 : 5;
    return Array.from({ length: weeks }, (_, w) => ({
      name: `${m.name} S${w + 1}`,
      revenue: Math.round(m.revenue / weeks),
      qty: Math.round(m.qty / weeks),
    }));
  });

  const dailyData = [
    { name: "Lun", revenue: 1240 }, { name: "Mar", revenue: 1180 },
    { name: "Mer", revenue: 1350 }, { name: "Gio", revenue: 1520 },
    { name: "Ven", revenue: 2100 }, { name: "Sab", revenue: 2850 },
    { name: "Dom", revenue: 2480 },
  ];

  const chartData = view === "month" ? monthRev : view === "week" ? weeklyData : dailyData;

  const catMap: Record<string, number> = {};
  for (const d of analysis) catMap[d.cat] = (catMap[d.cat] || 0) + d.rev;
  const catChart = Object.entries(catMap).map(([name, value]) => ({ name, value }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Andamento Ricavi</h3>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["month", "week", "day"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  view === v ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                {v === "month" ? "Mese" : v === "week" ? "Settimana" : "Giorno"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: "260px", width: "100%" }}>
          {mounted && <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
              <YAxis stroke="#9ca3af" fontSize={11} tickFormatter={(v: number) => `€${v}`} />
              <Tooltip content={<EuroTooltip />} />
              <Bar dataKey="revenue" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold mb-4">Per Categoria</h3>
        <div style={{ height: "180px", width: "100%" }}>
          {mounted && <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={catChart} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value">
                {catChart.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<EuroTooltip />} />
            </PieChart>
          </ResponsiveContainer>}
        </div>
        <div className="space-y-1.5 mt-3">
          {catChart.sort((a: any, b: any) => b.value - a.value).map((c: any, i: number) => (
            <div key={c.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-gray-600">{c.name}</span>
              </div>
              <span className="font-medium">€{c.value.toLocaleString("it-IT", { minimumFractionDigits: 0 })}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold mb-3">Top 5 Piatti</h3>
        <div style={{ height: "200px", width: "100%" }}>
          {mounted && <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topDishes} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" stroke="#9ca3af" fontSize={11} />
              <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={11} width={140} />
              <Tooltip content={<QtyTooltip />} />
              <Bar dataKey="qty" fill="#2D5016" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold mb-3">Riepilogo Mensile</h3>
        <div className="space-y-3">
          {monthRev.map((m: any, i: number) => (
            <div key={i} className="border-b border-gray-100 pb-3 last:border-0">
              <p className="font-medium text-sm">{MONTHS[i]}</p>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Ricavi: <strong className="text-gray-900">€{m.revenue.toLocaleString("it-IT")}</strong></span>
                <span>Piatti: <strong className="text-gray-900">{m.qty.toLocaleString()}</strong></span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(m.revenue / totalRev) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}