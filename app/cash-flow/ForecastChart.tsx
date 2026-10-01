"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type CashWeek = { weekStart: string | Date; weekEnd: string | Date; inflow: number; outflow: number; net: number; endingBalance: number; movementCount?: number; scheduleCount?: number };

function weekLabel(start: string | Date) {
  return new Date(start).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function euro(value: number) { return `€ ${Math.round(value).toLocaleString("it-IT")}`; }

export function ForecastChart({ forecast = [], history = [], minimumBalance = 0 }: { forecast?: CashWeek[]; history?: CashWeek[]; minimumBalance?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const balanceData = useMemo(() => [
    ...history.map(week => ({ week: weekLabel(week.weekStart), saldoAttuale: week.endingBalance, saldoProgramma: null, kind: "actual" })),
    ...forecast.map(week => ({ week: weekLabel(week.weekStart), saldoAttuale: null, saldoProgramma: week.endingBalance, kind: "scheduled" })),
  ], [history, forecast]);

  const flowData = useMemo(() => [
    ...history.map(week => ({ week: weekLabel(week.weekStart), entrateRegistrate: week.inflow, usciteRegistrate: week.outflow, entrateProgrammate: 0, usciteProgrammate: 0 })),
    ...forecast.map(week => ({ week: weekLabel(week.weekStart), entrateRegistrate: 0, usciteRegistrate: 0, entrateProgrammate: week.inflow, usciteProgrammate: week.outflow })),
  ], [history, forecast]);

  const tooltip = (value: any, name: any) => [euro(Number(value) || 0), name];
  const hasActual = history.some(week => week.movementCount && week.movementCount > 0);
  const hasScheduled = forecast.some(week => week.scheduleCount && week.scheduleCount > 0);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <div>
        <div className="mb-2 flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-800">Saldo: storico e scadenze note</h3><p className="text-xs text-slate-500">Lo storico è registrato; la proiezione include solo scadenze programmate.</p></div><span className="text-[10px] text-slate-400">tratteggiato: previsione</span></div>
        <div className="h-[260px] w-full">
          {mounted && balanceData.length > 0 && <ResponsiveContainer width="100%" height="100%"><LineChart data={balanceData} margin={{ top: 8, right: 12, left: 2, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis dataKey="week" fontSize={10} stroke="#64748b"/><YAxis fontSize={10} stroke="#64748b" tickFormatter={value => `€${Math.round(value/1000)}k`}/><Tooltip formatter={tooltip}/>
            <ReferenceLine y={0} stroke="#e11d48" strokeDasharray="4 4"/><ReferenceLine y={minimumBalance} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "soglia minima", fill: "#b45309", fontSize: 10 }}/>
            <Line type="monotone" dataKey="saldoAttuale" name="Saldo consuntivo" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 2 }}/><Line type="monotone" dataKey="saldoProgramma" name="Saldo previsto da scadenze" stroke="#2563eb" strokeWidth={2.5} strokeDasharray="6 4" connectNulls dot={{ r: 2 }}/>
          </LineChart></ResponsiveContainer>}
          {mounted && balanceData.length === 0 && <Empty text="Nessun periodo disponibile da tracciare."/>}
        </div>
      </div>

      <div>
        <div className="mb-2"><h3 className="text-sm font-semibold text-slate-800">Movimenti e flussi programmati</h3><p className="text-xs text-slate-500">Il forecast non aggiunge entrate o uscite automatiche.</p></div>
        <div className="h-[260px] w-full">
          {mounted && flowData.length > 0 && <ResponsiveContainer width="100%" height="100%"><BarChart data={flowData} margin={{ top: 8, right: 12, left: 2, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis dataKey="week" fontSize={10} stroke="#64748b"/><YAxis fontSize={10} stroke="#64748b" tickFormatter={value => `€${Math.round(value/1000)}k`}/><Tooltip formatter={tooltip}/><Legend wrapperStyle={{ fontSize: 10 }}/>
            <Bar dataKey="entrateRegistrate" name="Entrate registrate" fill="#059669"/><Bar dataKey="usciteRegistrate" name="Uscite registrate" fill="#e11d48"/><Bar dataKey="entrateProgrammate" name="Entrate programmate · ponderate" fill="#6ee7b7"/><Bar dataKey="usciteProgrammate" name="Uscite programmate · ponderate" fill="#fda4af"/>
          </BarChart></ResponsiveContainer>}
          {mounted && flowData.length === 0 && <Empty text="Importa movimenti o inserisci scadenze per costruire l’andamento."/>}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-400"><span>{hasActual ? "✓ movimenti storici presenti" : "! nessuno storico nel periodo"}</span><span>{hasScheduled ? "✓ scadenze future presenti" : "! nessuna scadenza futura: saldo proiettato piatto"}</span></div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">{text}</div>;
}
