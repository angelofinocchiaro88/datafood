"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface OrdersChartProps {
  orders: any[];
}

export function OrdersChart({ orders }: OrdersChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Valore per fornitore
  const bySupplier: Record<string, number> = {};
  const bySupplierCount: Record<string, number> = {};
  for (const o of orders) {
    const name = o.supplier?.name || "N/D";
    bySupplier[name] = (bySupplier[name] || 0) + o.total;
    bySupplierCount[name] = (bySupplierCount[name] || 0) + 1;
  }

  const supplierData = Object.entries(bySupplier)
    .map(([name, value]) => ({ name: name.split(" ")[0], fullName: name, valore: Math.round(value), ordini: bySupplierCount[name] }))
    .sort((a, b) => b.valore - a.valore);

  // Ordini per stato
  const statusMap: Record<string, { label: string; count: number; valore: number }> = {
    DRAFT: { label: "Bozza", count: 0, valore: 0 },
    SENT: { label: "Inviato", count: 0, valore: 0 },
    RECEIVED: { label: "Ricevuto", count: 0, valore: 0 },
  };
  for (const o of orders) {
    if (statusMap[o.status]) {
      statusMap[o.status].count++;
      statusMap[o.status].valore += o.total;
    }
  }
  const statusData = Object.entries(statusMap).map(([key, v]) => ({ stato: v.label, valore: Math.round(v.valore), ordini: v.count }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Valore per fornitore */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Valore ordini per fornitore</h4>
        <div style={{ height: "220px", width: "100%" }}>
          {mounted && supplierData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={supplierData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `€${v}`} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={80} />
                <Tooltip formatter={(v: any) => `€ ${Math.round(v).toLocaleString("it-IT")}`} labelFormatter={(l: any) => supplierData.find(s => s.name === l)?.fullName || l} />
                <Bar dataKey="valore" name="Valore" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {supplierData.length === 0 && <div className="h-full flex items-center justify-center text-slate-400 text-sm">Nessun ordine</div>}
        </div>
      </div>

      {/* Ordini per stato */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Valore ordini per stato</h4>
        <div style={{ height: "220px", width: "100%" }}>
          {mounted && statusData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="stato" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `€${v}`} />
                <Tooltip formatter={(v: any) => `€ ${Math.round(v).toLocaleString("it-IT")}`} />
                <Bar dataKey="valore" name="Valore" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}