"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const data = [
  { name: "Materie Prime", value: 35, color: "#1E3A5F" },
  { name: "Personale", value: 30, color: "#2D5016" },
  { name: "Affitto", value: 15, color: "#D4A574" },
  { name: "Utilities", value: 8, color: "#6B7280" },
  { name: "Altro", value: 12, color: "#9CA3AF" },
];

export function CostDistribution() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Card>
      <CardHeader><CardTitle>Distribuzione Costi</CardTitle></CardHeader>
      <CardContent>
        <div style={{ height: "256px", width: "100%" }}>
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                  {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-gray-600">{item.name}</span>
              <span className="text-xs font-medium text-gray-900 ml-auto">{item.value}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
