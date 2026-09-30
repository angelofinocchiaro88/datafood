"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Save } from "lucide-react";

const MONTHS = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
type TargetForm = { revenueTarget: string; foodCostPct: string; laborCostPct: string; otherCostPct: string; coverTarget: string; avgTicketTarget: string };
const emptyTarget = (): TargetForm => ({ revenueTarget: "", foodCostPct: "", laborCostPct: "", otherCostPct: "", coverTarget: "", avgTicketTarget: "" });

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `€ ${Math.round(value).toLocaleString("it-IT")}`;
}

function percentage(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`;
}

export default function BudgetPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [targets, setTargets] = useState<Record<number, TargetForm>>(() => Object.fromEntries(MONTHS.map((_, index) => [index + 1, emptyTarget()])));
  const [control, setControl] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingMonth, setSavingMonth] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const end = year === today.getFullYear()
        ? `${year}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
        : `${year}-12-31`;
      const [targetResponse, controlResponse] = await Promise.all([
        fetch(`/api/budget-targets?year=${year}`),
        fetch(`/api/cost-control?period=custom&from=${year}-01-01&to=${end}`),
      ]);
      const [targetData, controlData] = await Promise.all([targetResponse.json(), controlResponse.json()]);
      if (!targetResponse.ok) throw new Error(targetData.error || "Caricamento budget non riuscito");
      if (!controlResponse.ok) throw new Error(controlData.error || "Caricamento consuntivi non riuscito");
      const nextTargets: Record<number, TargetForm> = Object.fromEntries(MONTHS.map((_, index) => [index + 1, emptyTarget()]));
      for (const row of targetData.targets || []) nextTargets[row.month] = {
        revenueTarget: String(row.revenueTarget ?? ""),
        foodCostPct: String(row.foodCostPct ?? ""),
        laborCostPct: String(row.laborCostPct ?? ""),
        otherCostPct: String(row.otherCostPct ?? ""),
        coverTarget: String(row.coverTarget ?? ""),
        avgTicketTarget: String(row.avgTicketTarget ?? ""),
      };
      setTargets(nextTargets);
      setControl(controlData);
      setMessage(null);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Errore di caricamento", error: true });
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { void load(); }, [load]);

  const update = (month: number, key: keyof TargetForm, value: string) => {
    setTargets(current => ({ ...current, [month]: { ...current[month], [key]: value } }));
  };

  const saveMonth = async (month: number) => {
    const row = targets[month];
    if (!row.revenueTarget || !row.foodCostPct || !row.laborCostPct) {
      setMessage({ text: `Per salvare ${MONTHS[month - 1]} inserisci ricavi, target Food Cost e target personale.`, error: true });
      return;
    }
    setSavingMonth(month);
    try {
      const response = await fetch("/api/budget-targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          month,
          revenueTarget: Number(row.revenueTarget),
          foodCostPct: Number(row.foodCostPct),
          laborCostPct: Number(row.laborCostPct),
          otherCostPct: Number(row.otherCostPct || 0),
          coverTarget: Number(row.coverTarget || 0),
          avgTicketTarget: Number(row.avgTicketTarget || 0),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Salvataggio obiettivo non riuscito");
      await load();
      setMessage({ text: `Obiettivi di ${MONTHS[month - 1]} ${year} salvati.` });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Errore di salvataggio", error: true });
    } finally {
      setSavingMonth(null);
    }
  };

  const trend = new Map<number, any>((control?.trends || []).map((item: any) => [Number(item.month.slice(5, 7)), item]));
  const payrollMonths = new Map<number, any>((control?.sources?.payroll?.months || []).map((item: any) => [Number(item.label.slice(5, 7)), item]));
  const configuredMonths = MONTHS.map((_, index) => index + 1).filter(month => Boolean(targets[month].revenueTarget || targets[month].foodCostPct || targets[month].laborCostPct));
  const annualTarget = configuredMonths.reduce((sum, month) => sum + Number(targets[month].revenueTarget || 0), 0);
  const actualYearToDate = (control?.trends || []).reduce((sum: number, item: any) => sum + (item.totalRevenue ?? item.revenue + (item.issuedRevenue || 0)), 0);
  const achievedPct = annualTarget > 0 ? actualYearToDate / annualTarget * 100 : null;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const targetToDate = MONTHS.reduce((sum, _, index) => {
    const month = index + 1;
    const target = Number(targets[month].revenueTarget || 0);
    if (year < now.getFullYear() || (year === now.getFullYear() && month < currentMonth)) return sum + target;
    if (year === now.getFullYear() && month === currentMonth) return sum + target * now.getDate() / new Date(year, month, 0).getDate();
    return sum;
  }, 0);
  const comparableActual = (control?.trends || []).filter((item: any) => Number(item.month.slice(5, 7)) <= currentMonth).reduce((sum: number, item: any) => sum + item.revenue, 0);
  const targetAchievement = targetToDate > 0 ? comparableActual / targetToDate * 100 : null;

  const years = useMemo(() => Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 3 + index), []);

  if (loading && !control) return <div className="p-8 text-center text-slate-400">Caricamento budget e consuntivi…</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">DATAFOOD · Pianificazione e controllo</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Budget e scostamenti</h1><p className="mt-1 text-sm text-slate-500">Obiettivi mensili salvati e confrontati con vendite, Food Cost e personale.</p></div>
        <div className="flex items-center gap-2"><label className="text-xs text-slate-500">Anno <select value={year} onChange={event => setYear(Number(event.target.value))} className="ml-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">{years.map(value => <option key={value}>{value}</option>)}</select></label><Link href="/controllo-gestione" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-emerald-400">Controllo di gestione →</Link></div>
      </header>

      {message && <div className={`rounded-lg border px-3 py-2 text-sm ${message.error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{message.text}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary label={`Budget ricavi ${year}`} value={money(annualTarget)} detail={`${configuredMonths.length} mesi con target salvati`} />
        <Summary label={`Ricavi consuntivi ${year}`} value={money(actualYearToDate)} detail={`${control?.period?.from || ""} – ${control?.period?.to || ""}`} />
        <Summary label="Raggiungimento YTD" value={percentage(targetAchievement)} detail={targetAchievement == null ? "Imposta i target mensili" : `${money(comparableActual)} su ${money(targetToDate)} pianificati`} />
        <Summary label="Stato piano annuale" value={configuredMonths.length === 12 ? "Completo" : `${configuredMonths.length}/12 mesi`} detail="Obiettivi salvati nel database" />
      </div>

      {!control && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Dati di controllo non disponibili.</div>}
      {control && control.sources?.sales?.receipts === 0 && <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/><p>Nel periodo non risultano scontrini. Le colonne consuntive restano vuote: non vengono sostituite da stime di ricavo.</p></div>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4"><div><h2 className="font-semibold text-slate-900">Piano mensile</h2><p className="text-xs text-slate-500">Imposta gli obiettivi per mese; consuntivi e scostamenti arrivano dai moduli collegati.</p></div><div className="text-xs text-slate-500">Salva ogni riga dopo aver definito il target.</div></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500"><tr>
              <th className="px-3 py-2 text-left">Mese</th><th className="px-3 py-2 text-right">Ricavi target</th><th className="px-3 py-2 text-right">Ricavi effettivi</th><th className="px-3 py-2 text-right">Scostamento</th><th className="px-3 py-2 text-right">FC target</th><th className="px-3 py-2 text-right">FC effettivo</th><th className="px-3 py-2 text-right">Labor target</th><th className="px-3 py-2 text-right">Labor effettivo</th><th className="px-3 py-2 text-right">Coperti target</th><th className="px-3 py-2 text-right">Coperti effettivi</th><th className="px-3 py-2 text-center">Stato</th><th className="px-3 py-2 text-right">Azione</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {MONTHS.map((monthName, index) => {
                const month = index + 1;
                const budget = targets[month];
                const actual = trend.get(month);
                const actualRevenue = actual ? (actual.totalRevenue ?? actual.revenue + (actual.issuedRevenue || 0)) : null;
                const payroll = payrollMonths.get(month);
                const actualLaborPct = (actual?.totalRevenue ?? actual?.revenue ?? 0) > 0 && payroll?.amount > 0 ? payroll.amount / (actual.totalRevenue ?? actual.revenue) * 100 : null;
                const delta = budget?.revenueTarget && actualRevenue != null ? actualRevenue - Number(budget.revenueTarget) : null;
                const hasActual = Boolean(actual);
                const hasTargets = Boolean(budget?.revenueTarget || budget?.foodCostPct || budget?.laborCostPct);
                return <tr key={month} className="hover:bg-slate-50">
                  <td className="px-3 py-3 font-medium text-slate-800">{monthName}</td>
                  <td className="px-2 py-2"><input aria-label={`${monthName} ricavi target`} type="number" min="0" step="100" value={budget.revenueTarget} onChange={event => update(month, "revenueTarget", event.target.value)} placeholder="€ target" className="w-28 rounded border border-slate-300 px-2 py-1.5 text-right text-xs" /></td>
                  <td className="px-3 py-3 text-right tabular-nums">{hasActual ? money(actualRevenue) : "—"}</td>
                  <td className={`px-3 py-3 text-right tabular-nums ${delta == null ? "text-slate-400" : delta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{delta == null ? "—" : `${delta >= 0 ? "+" : "−"}${money(Math.abs(delta))}`}</td>
                  <td className="px-2 py-2"><InputPct aria={`${monthName} Food Cost target`} value={budget.foodCostPct} onChange={value => update(month, "foodCostPct", value)} /></td>
                  <td className="px-3 py-3 text-right tabular-nums">{percentage(actual?.foodCostPct)}{actual?.foodCostCoveragePct != null && <span className="block text-[10px] text-slate-400">copertura {percentage(actual.foodCostCoveragePct)}</span>}</td>
                  <td className="px-2 py-2"><InputPct aria={`${monthName} Labor Cost target`} value={budget.laborCostPct} onChange={value => update(month, "laborCostPct", value)} /></td>
                  <td className="px-3 py-3 text-right tabular-nums">{percentage(actualLaborPct)}{payroll && payroll.source !== "consuntivo" && <span className="ml-1 text-[10px] text-amber-700">{payroll.source === "stima" ? "stima" : "parziale"}</span>}</td>
                  <td className="px-2 py-2"><input aria-label={`${monthName} coperti target`} type="number" min="0" step="10" value={budget.coverTarget} onChange={event => update(month, "coverTarget", event.target.value)} placeholder="—" className="w-24 rounded border border-slate-300 px-2 py-1.5 text-right text-xs" /></td>
                  <td className="px-3 py-3 text-right tabular-nums">{hasActual ? actual.covers.toLocaleString("it-IT") : "—"}</td>
                  <td className="px-3 py-3 text-center"><span className={`rounded-full px-2 py-1 text-[10px] ${hasTargets ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{hasTargets ? "Target salvato" : "Da pianificare"}</span></td>
                  <td className="px-3 py-2 text-right"><button onClick={() => void saveMonth(month)} disabled={savingMonth === month} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-emerald-400 disabled:opacity-50"><Save className="mr-1 inline h-3.5 w-3.5"/>{savingMonth === month ? "Salvo" : "Salva"}</button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">Food Cost effettivo è teorico da ricette e vendite collegate; Labor effettivo usa buste paga se presenti, altrimenti è marcato come stima. Per il controllo del risultato completo usa <Link href="/controllo-gestione" className="font-semibold text-emerald-700 underline">Controllo di Gestione</Link>.</div>
      </section>
    </div>
  );
}

function InputPct({ aria, value, onChange }: { aria: string; value: string; onChange: (value: string) => void }) {
  return <div className="relative mx-auto w-20"><input aria-label={aria} type="number" min="0" max="100" step="0.5" value={value} onChange={event => onChange(event.target.value)} placeholder="%" className="w-full rounded border border-slate-300 px-2 py-1.5 pr-6 text-right text-xs"/><span className="absolute right-2 top-1.5 text-xs text-slate-400">%</span></div>;
}

function Summary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3.5"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p><p className="mt-0.5 text-xs text-slate-400">{detail}</p></div>;
}
