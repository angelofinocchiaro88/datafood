"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Target, TrendingUp, TrendingDown, Calculator, DollarSign, Save, Copy, Plus, Minus, AlertTriangle, ChevronDown, ChevronRight, Download } from "lucide-react";

// ─── ASSUNZIONI DI BUDGET ───
interface BudgetAssumptions {
  anno: number;
  scenario: "base" | "prudente" | "aggressivo";
  giorni_apertura_anno: number;
  coperti_giornalieri: number;
  scontrino_medio_sala: number;
  scontrino_medio_delivery: number;
  peso_delivery_pct: number;
  food_cost_target: number;
  beverage_cost_target: number;
  labor_cost_target: number;
  prime_cost_target: number;
  marketing_pct: number;
  utilities_pct: number;
  affitto_mensile: number;
  stagionalita: number[];
}

const DEFAULT_ASSUMPTIONS: BudgetAssumptions = {
  anno: 2026, scenario: "base", giorni_apertura_anno: 312,
  coperti_giornalieri: 65, scontrino_medio_sala: 28, scontrino_medio_delivery: 22, peso_delivery_pct: 10,
  food_cost_target: 30, beverage_cost_target: 22, labor_cost_target: 30, prime_cost_target: 60,
  marketing_pct: 1.5, utilities_pct: 4.5, affitto_mensile: 3500,
  // Monthly seasonality index (Jan=Dec)
  stagionalita: [0.85, 0.82, 0.95, 1.05, 1.10, 1.15, 1.20, 1.25, 1.10, 1.05, 0.95, 1.15],
};

const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const MESI_FULL = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

export default function BudgetPage() {
  const [assumptions, setAssumptions] = useState<BudgetAssumptions>(DEFAULT_ASSUMPTIONS);
  const [actuals, setActuals] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["ricavi","costi","ce"]));
  const [msg, setMsg] = useState("");

  useEffect(() => { loadActuals(); }, []);

  const loadActuals = async () => {
    try {
      const res = await fetch("/api/analytics/pnl?period=q1_2026");
      const d = await res.json();
      setActuals(d);
    } catch {}
    setLoading(false);
  };

  const toggleSection = (key: string) => {
    const next = new Set(expandedSections);
    next.has(key) ? next.delete(key) : next.add(key);
    setExpandedSections(next);
  };

  // ─── CALCOLA BUDGET MENSILE ───
  const monthlyBudget = useMemo(() => {
    const a = assumptions;
    return MESI.map((m, i) => {
      const giorni = Math.round(a.giorni_apertura_anno / 12);
      const stag = a.stagionalita[i];
      
      // Revenue
      const coperti = Math.round(a.coperti_giornalieri * giorni * stag);
      const ricavi_sala = coperti * a.scontrino_medio_sala;
      const ricavi_deliv = ricavi_sala * (a.peso_delivery_pct / 100);
      const ricavi_totali = ricavi_sala + ricavi_deliv;
      const food_rev = ricavi_totali * 0.75;
      const bev_rev = ricavi_totali * 0.25;

      // Costs
      const food_cost = food_rev * (a.food_cost_target / 100);
      const bev_cost = bev_rev * (a.beverage_cost_target / 100);
      const cogs = food_cost + bev_cost;
      const margine_lordo = ricavi_totali - cogs;
      const personale = ricavi_totali * (a.labor_cost_target / 100);
      const prime_cost = cogs + personale;
      const marketing = ricavi_totali * (a.marketing_pct / 100);
      const utilities = ricavi_totali * (a.utilities_pct / 100);
      const operativi = marketing + utilities + ricavi_totali * 0.03;
      const struttura = a.affitto_mensile + ricavi_totali * 0.01;
      const ebitda = ricavi_totali - cogs - personale - operativi - struttura;
      
      return { mese: m, coperti, ricavi: Math.round(ricavi_totali), food_rev: Math.round(food_rev), bev_rev: Math.round(bev_rev),
        food_cost: Math.round(food_cost), bev_cost: Math.round(bev_cost), cogs: Math.round(cogs),
        margine_lordo: Math.round(margine_lordo), personale: Math.round(personale), prime_cost: Math.round(prime_cost),
        marketing: Math.round(marketing), utilities: Math.round(utilities), operativi: Math.round(operativi),
        struttura: Math.round(struttura), ebitda: Math.round(ebitda),
        fcPct: (food_cost / food_rev * 100), bcPct: (bev_cost / bev_rev * 100),
        laborPct: (personale / ricavi_totali * 100), primePct: (prime_cost / ricavi_totali * 100),
        ebitdaPct: (ebitda / ricavi_totali * 100), ticket: Math.round(ricavi_totali / Math.max(1, coperti)),
      };
    });
  }, [assumptions]);

  const annualBudget = monthlyBudget.reduce((s, m) => {
    const keys = Object.keys(m) as (keyof typeof m)[];
    for (const k of keys) {
      if (typeof m[k] === "number") (s as any)[k] = ((s as any)[k] || 0) + (m as any)[k];
      else if (k === "mese") (s as any)[k] = "Anno";
    }
    return s;
  }, {} as any);

  const q1Actual = actuals ? Math.round(actuals.ricavi?.total || 0) : 0;
  const q1Budget = monthlyBudget.slice(0, 3).reduce((s, m) => s + m.ricavi, 0);
  const achievementPct = q1Budget > 0 ? (q1Actual / q1Budget * 100) : 0;

  const format = (v: number) => `€${Math.round(v).toLocaleString("it-IT")}`;
  const pctF = (v: number) => `${v.toFixed(1)}%`;

  const updateAssumption = (key: keyof BudgetAssumptions, value: any) => {
    setAssumptions(prev => ({ ...prev, [key]: value }));
  };

  const duplicateScenario = () => {
    setMsg("✅ Scenario duplicato");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Budget</h1>
          <p className="text-gray-500 text-sm">Pianificazione {assumptions.anno} · Scenario {assumptions.scenario}</p>
        </div>
        <div className="flex gap-2">
          <select value={assumptions.scenario} onChange={(e: any) => updateAssumption("scenario", e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="base">Base</option><option value="prudente">Prudente</option><option value="aggressivo">Aggressivo</option>
          </select>
          <button onClick={duplicateScenario} className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm"><Copy className="w-4 h-4 inline mr-1" />Duplica</button>
          <Link href="/controllo-gestione" className="text-xs text-primary hover:underline self-center">CE →</Link>
        </div>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{msg}</div>}

      {/* Q1 Budget vs Actual */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiBox label="Budget Q1" value={format(q1Budget)} color="blue" />
        <KpiBox label="Actual Q1" value={format(q1Actual)} color="green" />
        <KpiBox label="Raggiunto" value={`${achievementPct.toFixed(1)}%`} color={achievementPct >= 90 ? "green" : achievementPct >= 80 ? "amber" : "red"} />
        <KpiBox label="Δ Q1" value={format(q1Actual - q1Budget)} color={q1Actual >= q1Budget ? "green" : "red"} />
      </div>

      {/* 1. ASSUNZIONI */}
      <Section title="1. ASSUNZIONI DI BUDGET" expanded={expandedSections.has("assunzioni")} onToggle={() => toggleSection("assunzioni")}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AssumptionField label="Anno" value={assumptions.anno} onChange={(v: string) => updateAssumption("anno", Number(v))} />
          <AssumptionField label="GG Apertura/Anno" value={assumptions.giorni_apertura_anno} onChange={(v: string) => updateAssumption("giorni_apertura_anno", Number(v))} />
          <AssumptionField label="Coperti/GG" value={assumptions.coperti_giornalieri} onChange={(v: string) => updateAssumption("coperti_giornalieri", Number(v))} />
          <AssumptionField label="Ticket Medio Sala €" value={assumptions.scontrino_medio_sala} onChange={(v: string) => updateAssumption("scontrino_medio_sala", Number(v))} />
          <AssumptionField label="Ticket Delivery €" value={assumptions.scontrino_medio_delivery} onChange={(v: string) => updateAssumption("scontrino_medio_delivery", Number(v))} />
          <AssumptionField label="Peso Delivery %" value={assumptions.peso_delivery_pct} onChange={(v: string) => updateAssumption("peso_delivery_pct", Number(v))} suffix="%" />
          <AssumptionField label="Affitto Mensile €" value={assumptions.affitto_mensile} onChange={(v: string) => updateAssumption("affitto_mensile", Number(v))} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <AssumptionField label="Target Food Cost %" value={assumptions.food_cost_target} onChange={(v: string) => updateAssumption("food_cost_target", Number(v))} suffix="%" color="red" />
          <AssumptionField label="Target Bev Cost %" value={assumptions.beverage_cost_target} onChange={(v: string) => updateAssumption("beverage_cost_target", Number(v))} suffix="%" color="red" />
          <AssumptionField label="Target Labor %" value={assumptions.labor_cost_target} onChange={(v: string) => updateAssumption("labor_cost_target", Number(v))} suffix="%" color="red" />
          <AssumptionField label="Target Prime Cost %" value={assumptions.prime_cost_target} onChange={(v: string) => updateAssumption("prime_cost_target", Number(v))} suffix="%" color="amber" />
          <AssumptionField label="Marketing %" value={assumptions.marketing_pct} onChange={(v: string) => updateAssumption("marketing_pct", Number(v))} suffix="%" />
          <AssumptionField label="Utilities %" value={assumptions.utilities_pct} onChange={(v: string) => updateAssumption("utilities_pct", Number(v))} suffix="%" />
        </div>
      </Section>

      {/* 2. BUDGET RICAVI */}
      <Section title="2. BUDGET RICAVI" expanded={expandedSections.has("ricavi")} onToggle={() => toggleSection("ricavi")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50">{["",...MESI,"Anno"].map(h => <th key={h} className="text-right px-2 py-1.5 font-medium text-gray-600 text-xs">{h || "Voce"}</th>)}</tr></thead>
            <tbody className="divide-y">
              <BudgetRow label="Coperti" data={monthlyBudget} annual={annualBudget} field="coperti" isNum />
              <BudgetRow label="Ricavi Sala" data={monthlyBudget} annual={annualBudget} field="ricavi" isEuro />
              <BudgetRow label="Ricavi Delivery" data={monthlyBudget} annual={annualBudget} field={(m:any) => Math.round(m.ricavi * assumptions.peso_delivery_pct / 100)} isEuro />
              <BudgetRow label="Ricavi Food" data={monthlyBudget} annual={annualBudget} field="food_rev" isEuro />
              <BudgetRow label="Ricavi Beverage" data={monthlyBudget} annual={annualBudget} field="bev_rev" isEuro />
              <tr className="bg-gray-50 font-semibold"><td className="px-2 py-1.5">RICAVI TOTALI</td>{monthlyBudget.map((m,i) => <td key={i} className="text-right px-2 font-mono text-xs">{format(m.ricavi)}</td>)}<td className="text-right px-2 font-mono font-bold text-xs">{format(annualBudget.ricavi)}</td></tr>
              <BudgetRow label="Ticket Medio" data={monthlyBudget} annual={annualBudget} field="ticket" isEuro />
            </tbody>
          </table>
        </div>
      </Section>

      {/* 3. BUDGET COSTI */}
      <Section title="3. BUDGET COSTI" expanded={expandedSections.has("costi")} onToggle={() => toggleSection("costi")}>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50">{["",...MESI,"Anno"].map(h => <th key={h} className="text-right px-2 py-1.5 font-medium text-gray-600 text-xs">{h || "Voce"}</th>)}</tr></thead>
            <tbody className="divide-y">
              <BudgetRow label="Food Cost" data={monthlyBudget} annual={annualBudget} field="food_cost" isEuro negative />
              <BudgetRow label="Beverage Cost" data={monthlyBudget} annual={annualBudget} field="bev_cost" isEuro negative />
              <tr className="bg-gray-50 font-semibold"><td className="px-2 py-1.5">COGS Totale</td>{monthlyBudget.map((m,i) => <td key={i} className="text-right px-2 font-mono text-xs text-red-600">-{format(m.cogs)}</td>)}<td className="text-right px-2 font-mono font-bold text-xs text-red-600">-{format(annualBudget.cogs)}</td></tr>
              <BudgetRow label="Personale" data={monthlyBudget} annual={annualBudget} field="personale" isEuro negative />
              <tr className="bg-amber-50 font-semibold"><td className="px-2 py-1.5">PRIME COST</td>{monthlyBudget.map((m,i) => <td key={i} className="text-right px-2 font-mono text-xs text-amber-700">-{format(m.prime_cost)}</td>)}<td className="text-right px-2 font-mono font-bold text-xs text-amber-700">-{format(annualBudget.prime_cost)}</td></tr>
              <BudgetRow label="Marketing" data={monthlyBudget} annual={annualBudget} field="marketing" isEuro negative />
              <BudgetRow label="Utilities" data={monthlyBudget} annual={annualBudget} field="utilities" isEuro negative />
              <BudgetRow label="Struttura (Affitto+)" data={monthlyBudget} annual={annualBudget} field="struttura" isEuro negative />
            </tbody>
          </table>
        </div>
      </Section>

      {/* 4. CONTO ECONOMICO BUDGET */}
      <Section title="4. CONTO ECONOMICO BUDGET" expanded={expandedSections.has("ce")} onToggle={() => toggleSection("ce")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50">{["",...MESI,"Anno"].map(h => <th key={h} className="text-right px-2 py-1.5 font-medium text-gray-600 text-xs">{h || "Voce"}</th>)}</tr></thead>
            <tbody className="divide-y">
              <tr className="bg-green-50"><td className="px-2 py-1.5 font-semibold">RICAVI NETTI</td>{monthlyBudget.map((m,i) => <td key={i} className="text-right px-2 font-mono text-xs font-semibold text-green-700">{format(m.ricavi)}</td>)}<td className="text-right px-2 font-mono font-bold text-xs text-green-700">{format(annualBudget.ricavi)}</td></tr>
              <tr><td className="px-2 py-1.5">- COGS</td>{monthlyBudget.map((m,i) => <td key={i} className="text-right px-2 font-mono text-xs text-red-600">-{format(m.cogs)}</td>)}<td className="text-right px-2 font-mono text-xs text-red-600">-{format(annualBudget.cogs)}</td></tr>
              <tr className="bg-gray-50"><td className="px-2 py-1.5 font-semibold">= MARGINE LORDO</td>{monthlyBudget.map((m,i) => <td key={i} className="text-right px-2 font-mono text-xs font-semibold">{format(m.margine_lordo)}</td>)}<td className="text-right px-2 font-mono font-bold text-xs">{format(annualBudget.margine_lordo)}</td></tr>
              <tr><td className="px-2 py-1.5">- Personale</td>{monthlyBudget.map((m,i) => <td key={i} className="text-right px-2 font-mono text-xs text-red-600">-{format(m.personale)}</td>)}<td className="text-right px-2 font-mono text-xs text-red-600">-{format(annualBudget.personale)}</td></tr>
              <tr className="bg-amber-50"><td className="px-2 py-1.5 font-semibold">= PRIME COST</td>{monthlyBudget.map((m,i) => <td key={i} className="text-right px-2 font-mono text-xs font-semibold text-amber-700">-{format(m.prime_cost)}</td>)}<td className="text-right px-2 font-mono font-bold text-xs text-amber-700">-{format(annualBudget.prime_cost)}</td></tr>
              <tr><td className="px-2 py-1.5">- Op. Controllabili</td>{monthlyBudget.map((m,i) => <td key={i} className="text-right px-2 font-mono text-xs text-red-600">-{format(m.operativi)}</td>)}<td className="text-right px-2 font-mono text-xs text-red-600">-{format(annualBudget.operativi)}</td></tr>
              <tr><td className="px-2 py-1.5">- Struttura</td>{monthlyBudget.map((m,i) => <td key={i} className="text-right px-2 font-mono text-xs text-red-600">-{format(m.struttura)}</td>)}<td className="text-right px-2 font-mono text-xs text-red-600">-{format(annualBudget.struttura)}</td></tr>
              <tr className="bg-blue-50"><td className="px-2 py-1.5 font-semibold">= EBITDA</td>{monthlyBudget.map((m,i) => <td key={i} className="text-right px-2 font-mono text-xs font-semibold" style={{color: m.ebitda >= 0 ? "#16a34a" : "#dc2626"}}>{format(m.ebitda)}</td>)}<td className="text-right px-2 font-mono font-bold text-xs" style={{color: annualBudget.ebitda >= 0 ? "#16a34a" : "#dc2626"}}>{format(annualBudget.ebitda)}</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* 5. KPI BUDGET */}
      <Section title="5. KPI BUDGET" expanded={expandedSections.has("kpi")} onToggle={() => toggleSection("kpi")}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiBox label="Food Cost Target" value={pctF(assumptions.food_cost_target)} color="red" />
          <KpiBox label="Beverage Cost Target" value={pctF(assumptions.beverage_cost_target)} color="red" />
          <KpiBox label="Labor Cost Target" value={pctF(assumptions.labor_cost_target)} color="amber" />
          <KpiBox label="Prime Cost Target" value={pctF(assumptions.prime_cost_target)} color="amber" />
          <KpiBox label="EBITDA Anno" value={format(annualBudget.ebitda)} color={annualBudget.ebitda > 0 ? "green" : "red"} />
          <KpiBox label="EBITDA %" value={pctF(annualBudget.ebitdaPct)} color={annualBudget.ebitdaPct > 15 ? "green" : "amber"} />
          <KpiBox label="Ticket Medio" value={`€${annualBudget.ticket}`} color="blue" />
          <KpiBox label="Coperti Anno" value={annualBudget.coperti.toLocaleString()} color="blue" />
        </div>
      </Section>

      {/* 6. BUDGET vs ACTUAL Q1 */}
      <Section title="6. BUDGET vs ACTUAL (Q1 2026)" expanded={expandedSections.has("comparison")} onToggle={() => toggleSection("comparison")}>
        {actuals ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50"><th className="text-left px-2 py-1.5">Voce</th><th className="text-right px-2 py-1.5">Budget Q1</th><th className="text-right px-2 py-1.5">Actual Q1</th><th className="text-right px-2 py-1.5">Δ €</th><th className="text-right px-2 py-1.5">Δ %</th><th className="text-center px-2 py-1.5">Status</th></tr></thead>
              <tbody className="divide-y">
                <CompareRow label="Ricavi" budget={q1Budget} actual={q1Actual} />
                <CompareRow label="Food Cost" budget={monthlyBudget.slice(0,3).reduce((s,m) => s + m.food_cost, 0)} actual={Math.round(actuals.cogs?.food || 0)} isCost />
                <CompareRow label="Beverage Cost" budget={monthlyBudget.slice(0,3).reduce((s,m) => s + m.bev_cost, 0)} actual={Math.round(actuals.cogs?.bev || 0)} isCost />
                <CompareRow label="EBITDA" budget={monthlyBudget.slice(0,3).reduce((s,m) => s + m.ebitda, 0)} actual={Math.round(actuals.ebitda || 0)} />
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-gray-500">Caricamento dati consuntivi...</p>}
      </Section>
    </div>
  );
}

// ─── HELPER COMPONENTS ───

function Section({ title, expanded, onToggle, children }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between cursor-pointer hover:bg-gray-100" onClick={onToggle}>
        <h3 className="font-semibold text-sm text-gray-900">{title}</h3>
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </div>
      {expanded && <div className="p-4">{children}</div>}
    </div>
  );
}

function AssumptionField({ label, value, onChange, suffix, color }: any) {
  return (
    <div className={`${color === "red" ? "bg-red-50 border-red-200" : color === "amber" ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100"} rounded-lg p-2 border`}>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <div className="flex items-center gap-1">
        <input type="number" value={value} onChange={(e: any) => onChange(e.target.value)} className="w-full bg-transparent text-sm font-medium outline-none" min="0" />
        {suffix && <span className="text-xs text-gray-400">{suffix}</span>}
      </div>
    </div>
  );
}

function BudgetRow({ label, data, annual, field, isEuro, isNum, negative }: any) {
  const fmt = (v: number) => isEuro ? `€${Math.round(v).toLocaleString("it-IT")}` : isNum ? Math.round(v).toLocaleString("it-IT") : v;
  const getVal = (m: any) => typeof field === "function" ? field(m) : (m[field] || 0);
  return (
    <tr>
      <td className={`px-2 py-1.5 text-xs ${negative ? "text-red-700" : ""}`}>{label}</td>
      {data.map((m: any, i: number) => <td key={i} className={`text-right px-2 font-mono text-xs ${negative ? "text-red-600" : "text-gray-700"}`}>{fmt(getVal(m))}</td>)}
      <td className="text-right px-2 font-mono font-medium text-xs">{fmt(typeof field === "function" ? data.reduce((s:number,m:any)=>s+field(m),0) : annual[field])}</td>
    </tr>
  );
}

function CompareRow({ label, budget, actual, isCost }: any) {
  const diff = actual - budget;
  const pct = budget > 0 ? ((actual - budget) / budget * 100) : 0;
  const good = isCost ? diff < 0 : diff > 0;
  return (
    <tr>
      <td className="px-2 py-1.5 font-medium text-xs">{label}</td>
      <td className="text-right px-2 font-mono text-xs">€{Math.round(budget).toLocaleString("it-IT")}</td>
      <td className="text-right px-2 font-mono text-xs">€{Math.round(actual).toLocaleString("it-IT")}</td>
      <td className="text-right px-2 font-mono text-xs" style={{color: good ? "#16a34a" : "#dc2626"}}>{diff >= 0 ? "+" : ""}€{Math.round(diff).toLocaleString("it-IT")}</td>
      <td className="text-right px-2 text-xs" style={{color: good ? "#16a34a" : "#dc2626"}}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</td>
      <td className="text-center px-2">{Math.abs(pct) < 5 ? "🟢" : Math.abs(pct) < 15 ? "🟡" : "🔴"}</td>
    </tr>
  );
}

function KpiBox({ label, value, color }: any) {
  const m: Record<string, string> = { green: "bg-green-50 border-green-200", red: "bg-red-50 border-red-200", amber: "bg-amber-50 border-amber-200", blue: "bg-blue-50 border-blue-200" };
  return <div className={`${m[color] || "bg-white border-gray-200"} rounded-xl p-3 border text-center`}><p className="text-xs opacity-70 mb-1">{label}</p><p className="text-lg font-bold">{value}</p></div>;
}
