"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { day: "Lun", revenue: 1200 },
  { day: "Mar", revenue: 1500 },
  { day: "Mer", revenue: 1350 },
  { day: "Gio", revenue: 1680 },
  { day: "Ven", revenue: 2100 },
  { day: "Sab", revenue: 2800 },
  { day: "Dom", revenue: 2400 },
];

export function RevenueChart() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Card>
      <CardHeader><CardTitle>Andamento Fatturato</CardTitle></CardHeader>
      <CardContent>
        <div style={{ height: "256px", width: "100%" }}>
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `€${v}`} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#1E3A5F" strokeWidth={2} dot={{ fill: "#1E3A5F" }} activeDot={{ r: 6, fill: "#D4A574" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
