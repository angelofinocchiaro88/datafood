"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Activity, AlertCircle, ArrowDownToLine, ArrowUpFromLine, Banknote, Calendar, Check, Clock3, FileSpreadsheet, Gauge, Landmark, Plus, RefreshCw, Save, Search, ShieldCheck, TrendingUp, Upload, Wallet, X } from "lucide-react";
import { ForecastChart } from "./ForecastChart";

type Account = { id: string; name: string; iban: string | null; type: string; currency: string; openingBalance: number; openingBalanceDate: string | null; openingBalanceConfirmed: boolean; minimumBalance: number };
type CashTransaction = { id: string; accountId: string; date: string; amount: number; description: string; counterparty: string | null; source: string; isReconciled: boolean; category: { id: string; name: string } | null };
type Category = { id: string; name: string; type: string };

const dateString = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const todayString = () => dateString(new Date());
const money = (value: number | null | undefined, digits = 0) => value == null || !Number.isFinite(value) ? "N/D" : `€ ${value.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const dateLabel = (value: string | null | undefined) => {
  if (!value) return "N/D";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "N/D" : date.toLocaleDateString("it-IT");
};
const F24_TIPI = [
  { code: "IVA", label: "IVA", period: "Mensile" },
  { code: "IRPEF", label: "Ritenute IRPEF", period: "Mensile" },
  { code: "INPS", label: "Contributi INPS", period: "Mensile" },
  { code: "IRES", label: "IRES", period: "Annuale" },
  { code: "IRAP", label: "IRAP", period: "Annuale" },
  { code: "ALTRO", label: "Altro tributo", period: "Mensile" },
];

export default function CashFlowPage() {
  const [tab, setTab] = useState<"panoramica" | "forecast" | "scadenziario" | "movimenti">("panoramica");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [forecast, setForecast] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [transactionsData, setTransactionsData] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [savedAlerts, setSavedAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [movementPeriod, setMovementPeriod] = useState("90d");
  const [dateFrom, setDateFrom] = useState(() => dateString(new Date(Date.now() - 89 * 86400000)));
  const [dateTo, setDateTo] = useState(todayString());
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountForm, setAccountForm] = useState({ name: "", iban: "", type: "current", currency: "EUR", openingBalance: "", openingBalanceDate: todayString(), openingBalanceConfirmed: false, minimumBalance: "" });
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactionForm, setTransactionForm] = useState({ date: todayString(), type: "payment", amount: "", description: "", counterparty: "", categoryId: "" });
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ type: "payment", description: "", counterparty: "", amount: "", dueDate: todayString(), recurrence: "none", probability: "100", categoryId: "" });
  const [showF24, setShowF24] = useState(false);
  const [f24Form, setF24Form] = useState({ tipo: "IVA", codiceTributo: "", periodo: "", anno: new Date().getFullYear(), importo: "", scadenza: todayString() });
  const [uploading, setUploading] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAccounts = async (preferredId?: string) => {
    const response = await fetch("/api/cashflow/accounts");
    const rows = await response.json();
    if (!response.ok) throw new Error(rows.error || "Impossibile caricare i conti");
    const list = Array.isArray(rows) ? rows : [];
    setAccounts(list);
    setAccountId(current => {
      const wanted = preferredId || current;
      return list.some(account => account.id === wanted) ? wanted : list[0]?.id || "";
    });
    return list;
  };

  useEffect(() => { void loadAccounts().catch(reason => { setError(reason.message || "Errore caricamento conti"); setLoading(false); }); }, []);

  const periodDates = () => {
    if (movementPeriod === "all") return { from: "", to: "" };
    if (movementPeriod === "custom") return { from: dateFrom, to: dateTo };
    const days = movementPeriod === "30d" ? 30 : movementPeriod === "6m" ? 183 : 365;
    return { from: dateString(new Date(Date.now() - (days - 1) * 86400000)), to: todayString() };
  };

  const loadTransactions = async (selectedAccount: string) => {
    if (!selectedAccount) { setTransactionsData(null); return; }
    const range = periodDates();
    const params = new URLSearchParams({ accountId: selectedAccount, limit: "500" });
    if (range.from) params.set("dateFrom", range.from);
    if (range.to) params.set("dateTo", range.to);
    if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
    const response = await fetch(`/api/cashflow/transactions?${params.toString()}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Impossibile caricare movimenti");
    setTransactionsData(result);
  };

  const loadOverview = async (selectedAccount: string) => {
    if (!selectedAccount) { setForecast(null); setSchedules([]); setSavedAlerts([]); return; }
    const [forecastResponse, scheduleResponse, categoryResponse, alertResponse] = await Promise.all([
      fetch(`/api/cashflow/forecast?accountId=${selectedAccount}&weeks=13`),
      fetch(`/api/cashflow/schedule?accountId=${selectedAccount}&days=180`),
      fetch("/api/cashflow/categories"),
      fetch("/api/cashflow/alerts?resolved=false"),
    ]);
    const [forecastData, scheduleData, categoryData, alertData] = await Promise.all([forecastResponse.json(), scheduleResponse.json(), categoryResponse.json(), alertResponse.json()]);
    if (!forecastResponse.ok) throw new Error(forecastData.error || "Impossibile calcolare il forecast");
    setForecast(forecastData);
    setSchedules(Array.isArray(scheduleData) ? scheduleData : []);
    setCategories(Array.isArray(categoryData) ? categoryData : []);
    setSavedAlerts(Array.isArray(alertData) ? alertData : []);
  };

  const refresh = async (selectedAccount = accountId) => {
    setLoading(true);
    setError("");
    try { await Promise.all([loadOverview(selectedAccount), loadTransactions(selectedAccount)]); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Errore aggiornamento cash flow"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (accountId) void refresh(accountId); else if (accounts.length === 0) setLoading(false); }, [accountId]);
  useEffect(() => { if (accountId) void loadTransactions(accountId).catch(reason => setError(reason.message || "Errore lettura movimenti")); }, [accountId, movementPeriod, dateFrom, dateTo, categoryFilter]);

  const openNewAccount = () => {
    setEditingAccount(null);
    setAccountForm({ name: "", iban: "", type: "current", currency: "EUR", openingBalance: "", openingBalanceDate: todayString(), openingBalanceConfirmed: false, minimumBalance: "" });
    setShowAccountForm(true);
  };

  const openAccountSetup = (account: Account) => {
    setEditingAccount(account);
    setAccountForm({ name: account.name, iban: account.iban || "", type: account.type, currency: account.currency, openingBalance: String(account.openingBalance), openingBalanceDate: account.openingBalanceDate ? dateString(new Date(account.openingBalanceDate)) : todayString(), openingBalanceConfirmed: account.openingBalanceConfirmed, minimumBalance: String(account.minimumBalance || 0) });
    setShowAccountForm(true);
  };

  const saveAccount = async () => {
    if (!accountForm.name.trim() || !Number.isFinite(Number(accountForm.openingBalance || 0)) || !Number.isFinite(Number(accountForm.minimumBalance || 0))) {
      setMessage({ text: "Controlla nome conto, saldo iniziale e soglia minima.", error: true }); return;
    }
    if (!accountForm.openingBalanceConfirmed && Number(accountForm.openingBalance || 0) !== 0) { setMessage({ text: "Conferma il saldo iniziale dall’estratto oppure inserisci zero.", error: true }); return; }
    if (accountForm.openingBalanceConfirmed && !accountForm.openingBalanceDate) { setMessage({ text: "Indica la data a cui si riferisce il saldo iniziale.", error: true }); return; }
    const response = await fetch("/api/cashflow/accounts", { method: editingAccount ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(editingAccount ? { id: editingAccount.id } : {}), ...accountForm, openingBalance: Number(accountForm.openingBalance || 0), minimumBalance: Number(accountForm.minimumBalance || 0), openingBalanceDate: accountForm.openingBalanceConfirmed ? accountForm.openingBalanceDate : null }) });
    const result = await response.json();
    if (!response.ok) { setMessage({ text: result.error || "Salvataggio conto non riuscito", error: true }); return; }
    const id = result.id || editingAccount?.id;
    setShowAccountForm(false);
    setMessage({ text: "Conto e saldo iniziale salvati." });
    await loadAccounts(id);
    if (editingAccount && id) await refresh(id);
  };

  const saveTransaction = async () => {
    if (!accountId || !transactionForm.description.trim() || !transactionForm.amount || Number(transactionForm.amount) <= 0) { setMessage({ text: "Conto, descrizione e importo positivo sono obbligatori.", error: true }); return; }
    const unsignedAmount = Number(transactionForm.amount);
    const response = await fetch("/api/cashflow/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId, date: transactionForm.date, amount: transactionForm.type === "income" ? unsignedAmount : -unsignedAmount, description: transactionForm.description.trim(), counterparty: transactionForm.counterparty, categoryId: transactionForm.categoryId || null, source: "manual" }) });
    const result = await response.json();
    if (!response.ok) { setMessage({ text: result.error || "Registrazione movimento non riuscita", error: true }); return; }
    setShowTransactionForm(false);
    setTransactionForm({ date: todayString(), type: "payment", amount: "", description: "", counterparty: "", categoryId: "" });
    setMessage({ text: "Movimento registrato nel conto selezionato." });
    await refresh();
  };

  const saveSchedule = async () => {
    if (!scheduleForm.description.trim() || Number(scheduleForm.amount) <= 0 || !scheduleForm.dueDate) { setMessage({ text: "Descrizione, importo e data sono obbligatori.", error: true }); return; }
    const response = await fetch("/api/cashflow/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...scheduleForm, accountId, amount: Number(scheduleForm.amount), probability: Number(scheduleForm.probability), categoryId: scheduleForm.categoryId || null }) });
    const result = await response.json();
    if (!response.ok) { setMessage({ text: result.error || "Scadenza non salvata", error: true }); return; }
    setShowScheduleForm(false);
    setScheduleForm({ type: "payment", description: "", counterparty: "", amount: "", dueDate: todayString(), recurrence: "none", probability: "100", categoryId: "" });
    setMessage({ text: "Scadenza aggiunta al forecast." });
    await refresh();
  };

  const settleSchedule = async (schedule: any) => {
    const response = await fetch(`/api/cashflow/schedule/${schedule.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "settle", accountId, actualDate: todayString() }) });
    const result = await response.json();
    if (!response.ok) { setMessage({ text: result.error || "Movimento non registrato", error: true }); return; }
    setMessage({ text: result.message || "Movimento registrato." });
    await refresh();
  };

  const assignSchedule = async (schedule: any) => {
    const response = await fetch(`/api/cashflow/schedule/${schedule.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign", accountId }) });
    const result = await response.json();
    if (!response.ok) { setMessage({ text: result.error || "Associazione al conto non riuscita", error: true }); return; }
    setMessage({ text: "Scadenza associata al conto e inclusa nella proiezione." });
    await refresh();
  };

  const updateTransaction = async (transaction: CashTransaction, changes: any) => {
    const response = await fetch(`/api/cashflow/transactions/${transaction.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
    const result = await response.json();
    if (!response.ok) { setMessage({ text: result.error || "Movimento non aggiornato", error: true }); return; }
    setMessage({ text: "Movimento aggiornato." });
    await loadTransactions(accountId);
  };

  const handleStatementFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!accountId || files.length === 0) { setMessage({ text: "Seleziona un conto prima di importare il rendiconto.", error: true }); return; }
    setUploading(true);
    const allParsed: any[] = [];
    try {
      for (const file of files) {
        let contentType = "";
        let content = "";
        if (file.name.toLowerCase().endsWith(".csv")) { contentType = "csv"; content = await file.text(); }
        else if (file.name.toLowerCase().endsWith(".pdf")) { contentType = "pdf"; content = await fileToBase64(file); }
        else if (file.name.toLowerCase().endsWith(".txt")) { contentType = "text"; content = await file.text(); }
        if (!contentType) continue;
        const response = await fetch("/api/cashflow/transactions/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType, content, accountId }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Parsing non riuscito per ${file.name}`);
        allParsed.push(...(result.transactions || []));
      }
      const deduplicated = new Map<string, any>();
      for (const tx of allParsed) deduplicated.set(`${tx.date}|${tx.amount}|${tx.description}`, tx);
      setParsedTransactions(Array.from(deduplicated.values()));
      setMessage(deduplicated.size > 0 ? { text: `${deduplicated.size} movimenti letti. Controlla importi, segni e categorie prima di confermare.` } : { text: "Nessun movimento riconosciuto. Controlla il formato del file.", error: true });
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : "Errore lettura estratto", error: true });
    } finally { setUploading(false); }
  };

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const saveParsedTransactions = async () => {
    if (!accountId || parsedTransactions.length === 0) return;
    const response = await fetch("/api/cashflow/transactions/upload", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId, transactions: parsedTransactions }) });
    const result = await response.json();
    if (!response.ok) { setMessage({ text: result.error || "Importazione non riuscita", error: true }); return; }
    setMessage({ text: `${result.saved} movimenti registrati · ${result.skipped} duplicati o non validi saltati.` });
    setParsedTransactions([]);
    await refresh();
  };

  const saveF24 = async () => {
    if (Number(f24Form.importo) <= 0 || !f24Form.scadenza) { setMessage({ text: "Importo e scadenza F24 sono obbligatori.", error: true }); return; }
    const taxCategory = categories.find(category => /tass|tribut/i.test(category.name));
    const info = F24_TIPI.find(item => item.code === f24Form.tipo);
    const response = await fetch("/api/cashflow/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId, type: "payment", description: `F24 ${f24Form.tipo} ${f24Form.periodo}`, counterparty: "Agenzia Entrate", amount: Number(f24Form.importo), dueDate: f24Form.scadenza, recurrence: info?.period === "Trimestrale" ? "quarterly" : info?.period === "Annuale" ? "yearly" : "monthly", probability: 100, categoryId: taxCategory?.id || null, notes: `Codice tributo: ${f24Form.codiceTributo || "-"} · Competenza: ${f24Form.periodo || "-"}/${f24Form.anno}` }) });
    const result = await response.json();
    if (!response.ok) { setMessage({ text: result.error || "F24 non programmato", error: true }); return; }
    setShowF24(false);
    setMessage({ text: "Scadenza F24 programmata nel forecast." });
    await refresh();
  };

  const resolveAlert = async (id: string) => {
    const response = await fetch(`/api/cashflow/alerts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isResolved: true }) });
    if (response.ok) await refresh();
  };

  const setPeriod = (value: string) => {
    setMovementPeriod(value);
    if (value === "30d") { setDateFrom(dateString(new Date(Date.now() - 29 * 86400000))); setDateTo(todayString()); }
    if (value === "90d") { setDateFrom(dateString(new Date(Date.now() - 89 * 86400000))); setDateTo(todayString()); }
    if (value === "6m") { const date = new Date(); date.setMonth(date.getMonth() - 6); setDateFrom(dateString(date)); setDateTo(todayString()); }
    if (value === "12m") { const date = new Date(); date.setFullYear(date.getFullYear() - 1); setDateFrom(dateString(date)); setDateTo(todayString()); }
  };

  const fmt = (value: number | null | undefined) => money(value);
  const selectedAccount = accounts.find(account => account.id === accountId) || null;
  const balance = forecast?.account?.balance ?? null;
  const movementSummary = transactionsData?.riepilogo;
  const allAlerts = [...(forecast?.alerts || []), ...savedAlerts.filter(alert => !alert.isResolved).map(alert => ({ type: alert.alertType, severity: "warning", message: alert.message, id: alert.id }))];
  const visibleTransactions: CashTransaction[] = (transactionsData?.transactions || []).filter((transaction: CashTransaction) => !search || `${transaction.description} ${transaction.counterparty || ""}`.toLocaleLowerCase("it-IT").includes(search.toLocaleLowerCase("it-IT")));

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">DATAFOOD · Tesoreria</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Cash Flow</h1><p className="mt-1 text-sm text-slate-500">Saldo iniziale, movimenti registrati, scadenze e forecast basato su eventi noti.</p></div>
        <div className="flex flex-wrap items-end gap-2">
          {accounts.length > 0 && <label className="text-xs text-slate-500">Conto<select value={accountId} onChange={event => { setParsedTransactions([]); setAccountId(event.target.value); }} className="mt-1 block min-w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>}
          <button onClick={() => selectedAccount ? openAccountForm(selectedAccount, setEditingAccount, setAccountForm, setShowAccountForm) : openAccountForm(null, setEditingAccount, setAccountForm, setShowAccountForm)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-emerald-400">{selectedAccount ? "Saldo iniziale" : "Crea conto"}</button>
          {accounts.length > 0 && <button onClick={openNewAccount} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-emerald-400"><Plus className="mr-1 inline h-4 w-4"/>Nuovo conto</button>}
        </div>
      </header>

      {message && <div className={`flex justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${message.error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}><span>{message.text}</span><button onClick={() => setMessage(null)}><X className="h-4 w-4"/></button></div>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {loading && <div className="text-xs text-emerald-700">Aggiornamento saldi e scadenze…</div>}

      {accounts.length === 0 && !loading ? <AccountOnboarding onCreate={openNewAccount}/> : selectedAccount && forecast && (
        <>
          {!forecast.account.openingBalanceConfirmed && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/><p><strong>Saldo iniziale non confermato.</strong> Il saldo visualizzato è la somma dei movimenti registrati, non un saldo bancario verificato. <button onClick={() => openAccountForm(selectedAccount, setEditingAccount, setAccountForm, setShowAccountForm)} className="font-semibold underline">Inserisci saldo e data estratto</button>.</p></div>}
          {forecast.alerts.length > 0 && <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{forecast.alerts.map((alert: any) => <div key={alert.type} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${alert.severity === "critical" ? "border-rose-200 bg-rose-50 text-rose-900" : alert.severity === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-sky-200 bg-sky-50 text-sky-900"}`}><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{alert.message}</div>)}</div>}

          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Metric label="Saldo disponibile" value={fmt(balance)} detail={forecast.account.openingBalanceConfirmed ? `aperto da ${dateLabel(forecast.account.openingBalanceDate)}` : "saldo da movimenti registrati"} icon={<Wallet className="h-4 w-4"/>} />
            <Metric label="Entrate registrate · 90gg" value={fmt(forecast.historySummary.actualInflows90d)} detail={`${forecast.historySummary.movementCount90d} movimenti nel periodo`} icon={<ArrowDownToLine className="h-4 w-4"/>} />
            <Metric label="Uscite registrate · 90gg" value={fmt(forecast.historySummary.actualOutflows90d)} detail="uscite con importo negativo" icon={<ArrowUpFromLine className="h-4 w-4"/>} />
            <Metric label="Flusso programmato · 13 sett." value={fmt(forecast.planned.net)} detail={`${fmt(forecast.planned.inflows)} entrate · ${fmt(forecast.planned.outflows)} uscite ponderate`} icon={<Calendar className="h-4 w-4"/>} warning={forecast.atRiskWeeks > 0}/>
          </section>

          <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5">
            {[{ key: "panoramica", label: "Panoramica" }, { key: "forecast", label: "Forecast 13 settimane" }, { key: "scadenziario", label: "Scadenziario" }, { key: "movimenti", label: "Movimenti e import" }].map(item => <button key={item.key} onClick={() => setTab(item.key as any)} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === item.key ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{item.label}</button>)}
            <button onClick={() => void refresh()} className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Aggiorna"><RefreshCw className="h-4 w-4"/></button>
          </div>

          {tab === "panoramica" && <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Cassa effettiva e saldo previsto</h2><p className="text-xs text-slate-500">Passato = movimenti registrati · futuro = scadenze aperte ponderate per probabilità.</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700">Nessun flusso base inventato</span></div><ForecastChart history={forecast.history} forecast={forecast.forecast} minimumBalance={forecast.account.minimumBalance}/></section>
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Movimenti per categoria</h2><p className="text-xs text-slate-500">Periodo storico selezionato nella scheda movimenti</p></div><button onClick={() => setTab("movimenti")} className="text-xs font-medium text-emerald-700 hover:underline">Dettagli</button></div>{transactionsData?.categories?.length ? <div className="space-y-2">{transactionsData.categories.slice(0,6).map((category: any) => <div key={category.id || category.name} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 text-sm"><span className="truncate text-slate-600">{category.name} <span className="text-[10px] text-slate-400">· {category.count}</span></span><span className="shrink-0 text-right"><span className="text-emerald-700">+{fmt(category.inflow)}</span><span className="mx-1 text-slate-300">/</span><span className="text-rose-700">−{fmt(category.outflow)}</span></span></div>)}</div> : <Empty text="Nessun movimento nel periodo selezionato."/>}</div>
          <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Scadenze imminenti e arretrate</h2><p className="text-xs text-slate-500">Controlla e registra quando avvengono gli incassi o i pagamenti.</p></div><button onClick={() => setTab("scadenziario")} className="text-xs font-medium text-emerald-700 hover:underline">Scadenziario</button></div><ScheduleList schedules={schedules.slice(0,5)} accountId={accountId} onSettle={settleSchedule} onAssign={assignSchedule}/></div>
            </section>
          </div>}

          {tab === "forecast" && <div className="space-y-4">
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950"><strong>Metodo forecast:</strong> saldo iniziale confermato + scadenze aperte (ricorrenze espanse, probabilità applicata). Senza scadenze non vengono aggiunti ricavi o costi medi ipotetici. <span className="text-sky-800">Fonte: {forecast.planned.eventCount} eventi programmati.</span></div>
             <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Saldo attuale" value={fmt(forecast.account.balance)} detail={forecast.account.openingBalanceConfirmed ? `saldo estratto al ${dateLabel(forecast.account.openingBalanceDate)} + movimenti successivi` : "stimato dai soli movimenti registrati"} icon={<Wallet className="h-4 w-4"/>}/><Metric label="Saldo finale previsto" value={fmt(forecast.forecast.at(-1)?.endingBalance ?? forecast.account.balance)} detail="dopo gli eventi programmati" icon={<TrendingUp className="h-4 w-4"/>}/><Metric label="Runway da scadenze" value={forecast.runway == null ? "N/D" : `${forecast.runway} sett.`} detail={forecast.runway === 0 ? "sotto soglia già ora" : `soglia minima ${fmt(forecast.account.minimumBalance)}`} icon={<Gauge className="h-4 w-4"/>} warning={forecast.atRiskWeeks>0}/><Metric label="Settimane sotto soglia" value={String(forecast.atRiskWeeks)} detail="saldo previsto inferiore al minimo conto" icon={<AlertCircle className="h-4 w-4"/>} warning={forecast.atRiskWeeks>0}/></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><ForecastChart history={forecast.history} forecast={forecast.forecast} minimumBalance={forecast.account.minimumBalance}/></div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b bg-slate-50 p-4"><h2 className="font-semibold text-slate-900">Dettaglio settimanale · flussi programmati</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2 text-left">Settimana</th><th className="px-3 py-2 text-right">Entrate programmate</th><th className="px-3 py-2 text-right">Uscite programmate</th><th className="px-3 py-2 text-right">Netto atteso</th><th className="px-3 py-2 text-right">Saldo fine settimana</th><th className="px-3 py-2 text-center">Rischio</th></tr></thead><tbody className="divide-y">{forecast.forecast.map((week: any, index: number) => <tr key={index} className={week.atRisk ? "bg-rose-50" : ""}><td className="px-3 py-2">{dateLabel(String(week.weekStart).slice(0,10))} – {dateLabel(String(week.weekEnd).slice(0,10))}<span className="ml-2 text-[10px] text-slate-400">{week.scheduleCount} eventi</span></td><td className="px-3 py-2 text-right text-emerald-700">+{fmt(week.inflow)}</td><td className="px-3 py-2 text-right text-rose-700">−{fmt(week.outflow)}</td><td className="px-3 py-2 text-right">{fmt(week.net)}</td><td className="px-3 py-2 text-right font-semibold">{fmt(week.endingBalance)}</td><td className="px-3 py-2 text-center">{week.atRisk ? <span className="rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-700">sotto soglia</span> : <span className="text-xs text-slate-400">—</span>}</td></tr>)}</tbody></table></div></div>
          </div>}

          {tab === "scadenziario" && <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-semibold text-slate-900">Scadenziario incassi e pagamenti</h2><p className="text-xs text-slate-500">Scadenze arretrate e future; saldandole vengono registrate tra i movimenti effettivi.</p></div><div className="flex gap-2"><button onClick={() => setShowF24(true)} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white"><Landmark className="mr-1 inline h-4 w-4"/>F24</button><button onClick={() => setShowScheduleForm(true)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white"><Plus className="mr-1 inline h-4 w-4"/>Nuova scadenza</button></div></div>
            <ScheduleList schedules={schedules} accountId={accountId} onSettle={settleSchedule} onAssign={assignSchedule}/>
            {showScheduleForm && <ScheduleForm form={scheduleForm} setForm={setScheduleForm} categories={categories} onSave={saveSchedule} onClose={() => setShowScheduleForm(false)}/>}
            {showF24 && <F24Form form={f24Form} setForm={setF24Form} onSave={saveF24} onClose={() => setShowF24(false)}/>}
          </div>}

          {tab === "movimenti" && <div className="space-y-4">
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Entrate registrate" value={fmt(movementSummary?.totaleEntrate)} detail={`${movementSummary?.count || 0} movimenti`} icon={<ArrowDownToLine className="h-4 w-4"/>}/><Metric label="Uscite registrate" value={fmt(movementSummary?.totaleUscite)} detail="movimenti con segno negativo" icon={<ArrowUpFromLine className="h-4 w-4"/>}/><Metric label="Saldo periodo" value={fmt(movementSummary?.saldoPeriodo)} detail={movementPeriodLabel(movementPeriod)} icon={<Activity className="h-4 w-4"/>} warning={(movementSummary?.saldoPeriodo || 0)<0}/><Metric label="Da riconciliare" value={String(movementSummary?.unReconciledCount || 0)} detail={`${movementSummary?.reconciledCount || 0} riconciliati`} icon={<ShieldCheck className="h-4 w-4"/>}/></section>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h2 className="font-semibold text-slate-900">Movimenti effettivi</h2><p className="text-xs text-slate-500">Fonte banca o registrazione manuale · riconciliazione per riga</p></div><button onClick={() => setShowTransactionForm(true)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><Plus className="mr-1 inline h-3.5 w-3.5"/>Registra movimento</button></div>
                <div className="mb-3 flex flex-wrap gap-2"><select value={movementPeriod} onChange={event => setPeriod(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"><option value="30d">Ultimi 30 giorni</option><option value="90d">Ultimi 90 giorni</option><option value="6m">Ultimi 6 mesi</option><option value="12m">Ultimi 12 mesi</option><option value="all">Tutto lo storico</option><option value="custom">Intervallo</option></select>{movementPeriod === "custom" && <><input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs"/><input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs"/></>}<select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"><option value="all">Tutte le categorie</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cerca movimento" className="min-w-[150px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs"/></div>
                {showTransactionForm && <TransactionForm form={transactionForm} setForm={setTransactionForm} categories={categories} onSave={saveTransaction} onClose={() => setShowTransactionForm(false)}/>}
                <div className="max-h-[520px] overflow-y-auto"><table className="w-full min-w-[700px] text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="px-2 py-2 text-left">Data / descrizione</th><th className="px-2 py-2 text-left">Controparte</th><th className="px-2 py-2 text-left">Categoria</th><th className="px-2 py-2 text-right">Importo</th><th className="px-2 py-2 text-center">Fonte</th><th className="px-2 py-2 text-center">Riconciliazione</th></tr></thead><tbody className="divide-y">{visibleTransactions.map(transaction => <tr key={transaction.id}><td className="px-2 py-2"><p className="font-medium text-slate-800">{transaction.description || "Movimento"}</p><p className="text-[10px] text-slate-400">{dateLabel(transaction.date.slice(0,10))}</p></td><td className="px-2 py-2 text-slate-500">{transaction.counterparty || "—"}</td><td className="px-2 py-2"><select value={transaction.category?.id || ""} onChange={event => void updateTransaction(transaction, { categoryId: event.target.value || null })} className="max-w-[170px] rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px]"><option value="">Non categorizzato</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></td><td className={`px-2 py-2 text-right font-mono font-semibold ${transaction.amount>=0?"text-emerald-700":"text-rose-700"}`}>{transaction.amount>=0?"+":"−"}{fmt(Math.abs(transaction.amount))}</td><td className="px-2 py-2 text-center text-[10px] text-slate-400">{transaction.source === "bank_upload" ? "Banca" : transaction.source === "schedule" ? "Scadenza" : transaction.source}</td><td className="px-2 py-2 text-center"><button onClick={() => void updateTransaction(transaction, { isReconciled: !transaction.isReconciled })} className={`rounded-full px-2 py-1 text-[10px] ${transaction.isReconciled?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800"}`}>{transaction.isReconciled?"Riconciliato":"Da verificare"}</button></td></tr>)}</tbody></table>{visibleTransactions.length===0 && <Empty text="Nessun movimento nel periodo selezionato."/>}</div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="mb-3 font-semibold text-slate-900">Importa rendiconto</h2><p className="mb-3 text-xs text-slate-500">L’importazione è associata al conto selezionato, deduplica i movimenti e richiede revisione prima di registrare.</p><input ref={fileInputRef} type="file" accept=".csv,.pdf,.txt" multiple className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-emerald-700" onChange={event => event.target.files && void handleStatementFiles(event.target.files)}/>{uploading && <p className="mt-2 text-xs text-emerald-700">Lettura file…</p>}
                  {parsedTransactions.length>0 && <div className="mt-3 space-y-2"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-700">Verifica {parsedTransactions.length} righe</span><button onClick={() => void saveParsedTransactions()} className="rounded-lg bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white">Conferma importazione</button></div><div className="max-h-72 space-y-1 overflow-y-auto">{parsedTransactions.map((transaction,index) => <div key={`${transaction.date}-${index}`} className="grid grid-cols-[1fr_90px_125px] items-center gap-1 rounded border border-slate-100 p-2"><div className="min-w-0"><p className="truncate text-xs text-slate-700">{transaction.description}</p><p className="text-[10px] text-slate-400">{transaction.date} · {transaction.counterparty || "controparte N/D"}</p></div><span className={`text-right font-mono text-xs ${transaction.amount>=0?"text-emerald-700":"text-rose-700"}`}>{transaction.amount>=0?"+":"−"}{fmt(Math.abs(transaction.amount))}</span><select value={transaction.category || ""} onChange={event => setParsedTransactions(rows => rows.map((row,i)=>i===index?{...row,category:event.target.value}:row))} className="rounded border border-slate-200 bg-white px-1 py-1 text-[10px]"><option value="">Non categ.</option>{categories.map(category=><option key={category.id} value={category.name}>{category.name}</option>)}</select></div>)}</div></div>}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-slate-900">Composizione periodo</h2><span className="text-[10px] text-slate-400">tutte le righe filtrate</span></div>{transactionsData?.categories?.length ? <div className="space-y-2">{transactionsData.categories.slice(0,8).map((category:any)=><div key={category.id||category.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-100 pb-2 text-xs"><div><p className="truncate font-medium text-slate-700">{category.name}</p><p className="text-[10px] text-slate-400">{category.count} movimenti</p></div><div className="text-right"><p className="text-emerald-700">+{fmt(category.inflow)}</p><p className="text-rose-700">−{fmt(category.outflow)}</p></div></div>)}</div>:<Empty text="Nessuna categoria con movimenti nel periodo."/>}</div>
              </div>
            </div>
          </div>}
        </>
      )}

      {showAccountForm && <AccountForm account={editingAccount} form={accountForm} setForm={setAccountForm} onSave={saveAccount} onClose={() => setShowAccountForm(false)}/>}
      {showScheduleForm && <Modal title="Nuova scadenza" onClose={() => setShowScheduleForm(false)}><ScheduleFields form={scheduleForm} setForm={setScheduleForm} categories={categories}/><div className="mt-4 flex justify-end gap-2"><button onClick={() => setShowScheduleForm(false)} className="rounded-lg border px-3 py-2 text-sm">Annulla</button><button onClick={() => void saveSchedule()} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Salva scadenza</button></div></Modal>}
      {showF24 && <Modal title="Programma F24" onClose={() => setShowF24(false)}><div className="grid grid-cols-2 gap-3"><Field label="Tipo"><select className="input" value={f24Form.tipo} onChange={event => setF24Form({...f24Form,tipo:event.target.value,periodo:F24_TIPI.find(item=>item.code===event.target.value)?.period||""})}>{F24_TIPI.map(item=><option key={item.code} value={item.code}>{item.label} · {item.period}</option>)}</select></Field><Field label="Codice tributo"><input className="input" value={f24Form.codiceTributo} onChange={event=>setF24Form({...f24Form,codiceTributo:event.target.value})}/></Field><Field label="Competenza"><input className="input" value={f24Form.periodo} onChange={event=>setF24Form({...f24Form,periodo:event.target.value})}/></Field><Field label="Anno"><input className="input" type="number" value={f24Form.anno} onChange={event=>setF24Form({...f24Form,anno:Number(event.target.value)})}/></Field><Field label="Importo"><input className="input" type="number" value={f24Form.importo} onChange={event=>setF24Form({...f24Form,importo:event.target.value})}/></Field><Field label="Scadenza"><input className="input" type="date" value={f24Form.scadenza} onChange={event=>setF24Form({...f24Form,scadenza:event.target.value})}/></Field></div><div className="mt-4 flex justify-end gap-2"><button onClick={()=>setShowF24(false)} className="rounded-lg border px-3 py-2 text-sm">Annulla</button><button onClick={()=>void saveF24()} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Programma F24</button></div></Modal>}
    </div>
  );
}

function AccountOnboarding({ onCreate }: { onCreate: () => void }) {
  return <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><Banknote className="mx-auto h-10 w-10 text-emerald-600"/><h2 className="mt-3 text-xl font-bold text-slate-900">Configura il primo conto</h2><p className="mt-2 text-sm text-slate-500">Inserisci saldo iniziale e data dell’estratto per partire da una disponibilità reale. Il forecast utilizzerà le scadenze che programmi, senza flussi settimanali preimpostati.</p><button onClick={onCreate} className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Crea conto</button></div>;
}

function openAccountForm(account: Account | null, setEditing: (value: Account | null) => void, setForm: (value: any) => void, setOpen: (value: boolean) => void) {
  setEditing(account);
  setForm(account ? { name: account.name, iban: account.iban || "", type: account.type, currency: account.currency, openingBalance: String(account.openingBalance), openingBalanceDate: account.openingBalanceDate ? dateString(new Date(account.openingBalanceDate)) : todayString(), openingBalanceConfirmed: account.openingBalanceConfirmed, minimumBalance: String(account.minimumBalance) } : { name: "", iban: "", type: "current", currency: "EUR", openingBalance: "", openingBalanceDate: todayString(), openingBalanceConfirmed: false, minimumBalance: "" });
  setOpen(true);
}

function Metric({ label, value, detail, icon, warning }: { label: string; value: string; detail: string; icon: React.ReactNode; warning?: boolean }) {
  return <div className={`rounded-xl border bg-white p-3.5 ${warning ? "border-amber-300" : "border-slate-200"}`}><div className="mb-1 flex items-center gap-2 text-xs text-slate-500"><span className="text-emerald-700">{icon}</span>{label}</div><p className="text-xl font-bold text-slate-900">{value}</p><p className="mt-0.5 text-xs text-slate-400">{detail}</p></div>;
}

function ScheduleList({ schedules, accountId, onSettle, onAssign }: { schedules: any[]; accountId: string; onSettle: (schedule: any) => void; onAssign: (schedule: any) => void }) {
  if (schedules.length === 0) return <Empty text="Nessuna scadenza aperta in questo intervallo."/>;
  return <div className="divide-y divide-slate-100">{schedules.map(schedule => {
    const due = schedule.displayDueDate || schedule.dueDate;
    const overdue = schedule.overdue || (schedule.recurrence === "none" && new Date(due) < new Date(new Date().setHours(0,0,0,0)));
    const canSettle = new Date(due) <= new Date(new Date().setHours(23,59,59,999));
    return <div key={schedule.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-medium text-slate-800">{schedule.description}</p>{overdue&&<span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700">arretrata</span>}{!schedule.accountId&&<span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">da assegnare</span>}</div><p className="text-xs text-slate-400">{dateLabel(String(due).slice(0,10))} · {schedule.counterparty||"controparte N/D"} · {schedule.account?.name || "conto non assegnato"} · {schedule.category?.name||"senza categoria"} · probabilità {schedule.probability}% {schedule.recurrence!=="none"&&`· ricorrente ${schedule.recurrence}`}</p></div><div className="flex items-center gap-2"><span className={`font-mono text-sm font-semibold ${schedule.type==="payment"?"text-rose-700":"text-emerald-700"}`}>{schedule.type==="payment"?"−":"+"}{money(schedule.amount)}</span>{!schedule.accountId&&<button onClick={()=>onAssign(schedule)} className="rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50">Assegna</button>}<button disabled={!canSettle} onClick={()=>onSettle(schedule)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 enabled:hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-40">{schedule.type==="payment"?"Segna pagata":"Segna incassata"}</button></div></div>;
  })}</div>;
}

function AccountForm({ account, form, setForm, onSave, onClose }: { account: Account | null; form: any; setForm: (form: any) => void; onSave: () => void; onClose: () => void }) {
  return <Modal title={account?"Saldo iniziale e soglia":"Crea conto cash flow"} onClose={onClose}><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Nome conto"><input className="input" value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder="Banca, cassa, conto aziendale"/></Field><Field label="IBAN (facoltativo)"><input className="input" value={form.iban} onChange={event=>setForm({...form,iban:event.target.value})}/></Field><Field label="Tipo"><select className="input" value={form.type} onChange={event=>setForm({...form,type:event.target.value})}><option value="current">Conto corrente</option><option value="cash">Cassa contanti</option><option value="card">Conto carta</option></select></Field><Field label="Valuta"><input className="input" value={form.currency} onChange={event=>setForm({...form,currency:event.target.value.toUpperCase()})}/></Field><Field label="Saldo disponibile all’estratto"><input type="number" step="0.01" className="input" value={form.openingBalance} onChange={event=>setForm({...form,openingBalance:event.target.value})}/></Field><Field label="Saldo riferito alla data"><input type="date" className="input" value={form.openingBalanceDate} onChange={event=>setForm({...form,openingBalanceDate:event.target.value,openingBalanceConfirmed:true})}/></Field><Field label="Soglia minima da proteggere"><input type="number" min="0" step="100" className="input" value={form.minimumBalance} onChange={event=>setForm({...form,minimumBalance:event.target.value})}/><span className="mt-1 block text-[11px] text-slate-400">Sotto questa liquidità le settimane previste sono segnalate a rischio.</span></Field><label className="flex items-center gap-2 self-center text-sm text-slate-700"><input type="checkbox" checked={form.openingBalanceConfirmed} onChange={event=>setForm({...form,openingBalanceConfirmed:event.target.checked})}/>Saldo iniziale verificato su estratto conto</label></div><div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">Annulla</button><button onClick={onSave} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Salva conto</button></div></Modal>;
}

function TransactionForm({ form, setForm, categories, onSave, onClose }: { form: any; setForm: (form:any)=>void; categories: Category[]; onSave: ()=>void; onClose: ()=>void }) {
  return <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><Field label="Movimento"><select className="input" value={form.type} onChange={event=>setForm({...form,type:event.target.value})}><option value="payment">Uscita / pagamento</option><option value="income">Entrata / incasso</option></select></Field><Field label="Data valuta"><input type="date" className="input" value={form.date} onChange={event=>setForm({...form,date:event.target.value})}/></Field><Field label="Importo positivo"><input type="number" min="0.01" step="0.01" className="input" value={form.amount} onChange={event=>setForm({...form,amount:event.target.value})}/></Field><Field label="Categoria"><select className="input" value={form.categoryId} onChange={event=>setForm({...form,categoryId:event.target.value})}><option value="">Suggerisci/nessuna</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></Field><Field label="Descrizione"><input className="input" value={form.description} onChange={event=>setForm({...form,description:event.target.value})}/></Field><Field label="Controparte"><input className="input" value={form.counterparty} onChange={event=>setForm({...form,counterparty:event.target.value})}/></Field></div><div className="mt-3 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border px-3 py-1.5 text-xs">Annulla</button><button onClick={onSave} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Registra movimento</button></div></div>;
}

function ScheduleForm({ form, setForm, categories, onSave, onClose }: { form: any; setForm: (form:any)=>void; categories: Category[]; onSave: ()=>void; onClose: ()=>void }) {
  return <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4"><ScheduleFields form={form} setForm={setForm} categories={categories}/><div className="mt-3 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border px-3 py-1.5 text-xs">Annulla</button><button onClick={onSave} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Salva scadenza</button></div></div>;
}

function ScheduleFields({ form, setForm, categories }: { form: any; setForm: (form:any)=>void; categories: Category[] }) {
  return <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"><Field label="Tipo"><select className="input" value={form.type} onChange={event=>setForm({...form,type:event.target.value})}><option value="payment">Pagamento / uscita</option><option value="income">Incasso / entrata</option></select></Field><Field label="Descrizione"><input className="input" value={form.description} onChange={event=>setForm({...form,description:event.target.value})}/></Field><Field label="Importo positivo"><input type="number" min="0.01" step="0.01" className="input" value={form.amount} onChange={event=>setForm({...form,amount:event.target.value})}/></Field><Field label="Scadenza"><input type="date" className="input" value={form.dueDate} onChange={event=>setForm({...form,dueDate:event.target.value})}/></Field><Field label="Controparte"><input className="input" value={form.counterparty} onChange={event=>setForm({...form,counterparty:event.target.value})}/></Field><Field label="Categoria"><select className="input" value={form.categoryId} onChange={event=>setForm({...form,categoryId:event.target.value})}><option value="">Non classificata</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></Field><Field label="Ricorrenza"><select className="input" value={form.recurrence} onChange={event=>setForm({...form,recurrence:event.target.value})}><option value="none">Singola</option><option value="weekly">Settimanale</option><option value="monthly">Mensile</option><option value="quarterly">Trimestrale</option><option value="yearly">Annuale</option></select></Field><Field label={`Probabilità ${form.probability}%`}><input type="range" min="0" max="100" value={form.probability} onChange={event=>setForm({...form,probability:event.target.value})} className="mt-2 w-full"/></Field></div>;
}

function F24Form({ form, setForm, onSave, onClose }: { form: any; setForm: (form:any)=>void; onSave: ()=>void; onClose: ()=>void }) {
  return <Modal title="Programma scadenza F24" onClose={onClose}><p className="mb-3 text-xs text-slate-500">La scadenza entra nel forecast; al pagamento dovrai registrare il movimento sul conto.</p><div className="grid grid-cols-2 gap-3"><Field label="Tipo"><select className="input" value={form.tipo} onChange={event=>setForm({...form,tipo:event.target.value,periodo:F24_TIPI.find(item=>item.code===event.target.value)?.period||""})}>{F24_TIPI.map(item=><option key={item.code} value={item.code}>{item.label} · {item.period}</option>)}</select></Field><Field label="Codice tributo"><input className="input" value={form.codiceTributo} onChange={event=>setForm({...form,codiceTributo:event.target.value})}/></Field><Field label="Competenza"><input className="input" value={form.periodo} onChange={event=>setForm({...form,periodo:event.target.value})}/></Field><Field label="Anno"><input className="input" type="number" value={form.anno} onChange={event=>setForm({...form,anno:Number(event.target.value)})}/></Field><Field label="Importo"><input className="input" type="number" value={form.importo} onChange={event=>setForm({...form,importo:event.target.value})}/></Field><Field label="Scadenza"><input className="input" type="date" value={form.scadenza} onChange={event=>setForm({...form,scadenza:event.target.value})}/></Field></div><div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">Annulla</button><button onClick={onSave} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Programma F24</button></div></Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">{title}</h2><button onClick={onClose}><X className="h-5 w-5 text-slate-500"/></button></div>{children}</div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-slate-600">{label}{children}</label>;
}

function Empty({ text }: { text: string }) { return <p className="py-6 text-center text-sm text-slate-400">{text}</p>; }
function movementPeriodLabel(period: string) { return period === "all" ? "tutto lo storico" : period === "custom" ? "intervallo personalizzato" : `ultimi ${period === "30d" ? 30 : period === "6m" ? 183 : 365} giorni`; }
