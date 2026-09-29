"use client";

import { useState, useEffect, useMemo } from "react";
import { Users, Plus, X, Save, Trash2, Calculator, TrendingDown, Wallet2, CalendarRange, FileSpreadsheet, ChevronDown, ChevronRight } from "lucide-react";
import { calcolaCostoPersona } from "@/lib/payroll";

const QUALIFICHE = ["chef", "sous chef", "cuoco", "aiuto cuoco", "pizzaiolo", "cameriere", "barista", "lavapiatti", "maitre", "sommelier"];
const LIVELLI = ["1", "2", "3", "3S", "4", "5", "6", "6L", "7"];

export default function PersonalePage() {
  const [dipendenti, setDipendenti] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Form dipendente
  const [form, setForm] = useState({
    codice: "", nome: "", cognome: "", codiceFiscale: "",
    qualifica: "cuoco", tipoContratto: "tempo_indeterminato",
    ccnl: "pubblici_esercizi", livello: "4", oreSettimanali: 40,
    retribuzioneLordaMensile: "1600", mensilita: 13,
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/personale/dipendenti");
      const data = await res.json();
      setDipendenti(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.nome || !form.cognome) { setMsg("Nome e cognome obbligatori"); return; }
    await fetch("/api/personale/dipendenti", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, retribuzioneLordaMensile: parseFloat(form.retribuzioneLordaMensile), oreSettimanali: Number(form.oreSettimanali), mensilita: Number(form.mensilita) }),
    });
    setShowForm(false);
    setMsg("✅ Dipendente aggiunto");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare il dipendente?")) return;
    await fetch(`/api/personale/dipendenti/${id}`, { method: "DELETE" });
    load();
  };

  const handleGeneraBusta = async (d: any) => {
    const contratto = d.contratti?.[0];
    const res = await fetch("/api/personale/buste", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dipendenteId: d.id, mese: 1, anno: 2026,
        retribuzioneLorda: contratto?.retribuzioneLordaMensile || 0,
        straordinari: 0, indennita: 0,
      }),
    });
    const data = await res.json();
    setMsg(`✅ Busta calcolata: costo azienda ${formatEuro(data.dettaglio?.costoAziendaMensile)}/mese`);
    load();
  };

  // Calcolo preview costo per il form
  const previewCosto = useMemo(() => {
    const lordo = parseFloat(form.retribuzioneLordaMensile) || 0;
    if (lordo <= 0) return null;
    return calcolaCostoPersona({ retribuzioneLorda: lordo, mensilita: form.mensilita });
  }, [form.retribuzioneLordaMensile, form.mensilita]);

  const totaleCostoAzienda = dipendenti.reduce((sum, d) => {
    const c = d.contratti?.[0];
    const lordo = c?.retribuzioneLordaMensile || 0;
    if (lordo <= 0) return sum;
    return sum + calcolaCostoPersona({ retribuzioneLorda: lordo, mensilita: c?.mensilita || 13 }).costoAziendaMensile;
  }, 0);

  const totaleLordo = dipendenti.reduce((sum, d) => sum + (d.contratti?.[0]?.retribuzioneLordaMensile || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Personale</h1>
          <p className="text-sm text-gray-500">{dipendenti.length} dipendenti · costo azienda reale</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4 inline mr-1" /> Nuovo Dipendente
        </button>
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">{msg}</div>}

      {/* KPI riepilogo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiBox label="Costo Azienda / mese" value={formatEuro(totaleCostoAzienda)} icon={<Calculator className="w-4 h-4" />} color="rose" />
        <KpiBox label="Retribuzione Lorda / mese" value={formatEuro(totaleLordo)} icon={<Users className="w-4 h-4" />} color="blue" />
        <KpiBox label="Moltiplicatore medio" value={`${totaleLordo > 0 ? (totaleCostoAzienda / totaleLordo).toFixed(2) : "0"}x`} sub="costo azienda / lordo" icon={<TrendingDown className="w-4 h-4" />} color="amber" />
      </div>

      {/* Form dipendente */}
      {showForm && (
        <div className="bg-white rounded-2xl border-2 border-emerald-300 p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Nuovo Dipendente</h3>
            <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Nome *</label><input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Cognome *</label><input value={form.cognome} onChange={e => setForm({...form, cognome: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Codice Fiscale</label><input value={form.codiceFiscale} onChange={e => setForm({...form, codiceFiscale: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Qualifica</label><select value={form.qualifica} onChange={e => setForm({...form, qualifica: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">{QUALIFICHE.map(q => <option key={q} value={q}>{q}</option>)}</select></div>
            <div><label className="text-xs text-gray-500 block mb-1">Tipo Contratto</label><select value={form.tipoContratto} onChange={e => setForm({...form, tipoContratto: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="tempo_indeterminato">Indeterminato</option><option value="tempo_determinato">Determinato</option><option value="apprendistato">Apprendistato</option></select></div>
            <div><label className="text-xs text-gray-500 block mb-1">Livello CCNL</label><select value={form.livello} onChange={e => setForm({...form, livello: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">{LIVELLI.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
            <div><label className="text-xs text-gray-500 block mb-1">Retribuzione Lorda/gg (€)</label><input type="number" value={form.retribuzioneLordaMensile} onChange={e => setForm({...form, retribuzioneLordaMensile: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Mensilità</label><select value={form.mensilita} onChange={e => setForm({...form, mensilita: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm"><option value={13}>13</option><option value={14}>14</option></select></div>
            <div><label className="text-xs text-gray-500 block mb-1">Ore Settimanali</label><input type="number" value={form.oreSettimanali} onChange={e => setForm({...form, oreSettimanali: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>

          {/* Preview costo */}
          {previewCosto && (
            <div className="mt-4 bg-gray-50 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-gray-500">Netto dipendente</p><p className="font-bold">{formatEuro(previewCosto.nettoDipendente)}</p></div>
              <div><p className="text-xs text-gray-500">Contributi azienda</p><p className="font-bold text-rose-600">{formatEuro(previewCosto.contributiAzienda)}</p></div>
              <div><p className="text-xs text-gray-500">TFR + Ratei</p><p className="font-bold text-amber-600">{formatEuro(previewCosto.totaleRateiDifferiti)}</p></div>
              <div><p className="text-xs text-gray-500">Costo azienda/mese</p><p className="font-bold text-red-600">{formatEuro(previewCosto.costoAziendaMensile)}</p></div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"><Save className="w-4 h-4 inline mr-1" /> Salva</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border text-gray-600 rounded-lg text-sm">Annulla</button>
          </div>
        </div>
      )}

      {/* Lista dipendenti con dettaglio costi */}
      <div className="space-y-3">
        {dipendenti.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3" /> Nessun dipendente. Aggiungi il primo.
          </div>
        ) : (
          dipendenti.map(d => {
            const contratto = d.contratti?.[0];
            const lordo = contratto?.retribuzioneLordaMensile || 0;
            const calc = lordo > 0 ? calcolaCostoPersona({ retribuzioneLorda: lordo, mensilita: contratto?.mensilita || 13 }) : null;
            return (
              <div key={d.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-700 font-bold">
                      {d.nome?.[0]}{d.cognome?.[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{d.nome} {d.cognome}</p>
                      <p className="text-xs text-gray-500">{d.qualifica} · Livello {contratto?.livello || "-"} · {contratto?.oreSettimanali || 40}h</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {calc && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{formatEuro(calc.costoAziendaMensile)}</p>
                        <p className="text-xs text-gray-400">costo azienda/mese</p>
                      </div>
                    )}
                    {expanded === d.id ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                {expanded === d.id && calc && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <DetailBox label="Lordo mensile" value={formatEuro(calc.retribuzioneLorda)} />
                      <DetailBox label="Netto dipendente" value={formatEuro(calc.nettoDipendente)} />
                      <DetailBox label="Contributi (INPS+INAIL)" value={formatEuro(calc.contributiAzienda + calc.inailAzienda)} color="rose" />
                      <DetailBox label="TFR maturato/mese" value={formatEuro(calc.tfrMaturato)} color="amber" />
                      <DetailBox label="Rateo 13a/14a" value={formatEuro(calc.rateoTredicesima + calc.rateoQuattordicesima)} color="amber" />
                      <DetailBox label="Ratei ferie+permessi" value={formatEuro(calc.rateiFerie + calc.rateiPermessi)} color="amber" />
                      <DetailBox label="Totale differiti" value={formatEuro(calc.totaleRateiDifferiti)} color="amber" />
                      <DetailBox label="Costo azienda/anno" value={formatEuro(calc.costoAziendaAnnuale)} color="red" />
                    </div>
                    <div className="mt-3 p-3 bg-white rounded-lg text-xs text-gray-500">
                      <strong className="text-gray-700">Moltiplicatore:</strong> {calc.rapportoCostoLordo}x — ogni €1 di lordo costa all'azienda €{calc.rapportoCostoLordo.toFixed(2)} includendo contributi, TFR e ratei.
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleGeneraBusta(d)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs"><FileSpreadsheet className="w-3.5 h-3.5 inline mr-1" /> Genera busta</button>
                      <button onClick={() => handleDelete(d.id)} className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs"><Trash2 className="w-3.5 h-3.5 inline mr-1" /> Elimina</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Nota metodologica */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>Calcolo costo del lavoro:</strong> il costo azienda reale = lordo + INPS carico azienda (~28%) + INAIL (~1,7% settore ristorazione) + TFR (~7,41%) + ratei 13a/14a + ratei ferie e permessi. Il costo reale è circa <strong>1,5x-1,6x</strong> la retribuzione lorda.
      </div>
    </div>
  );
}

function KpiBox({ label, value, sub, icon, color }: any) {
  const m: Record<string, string> = { rose: "from-rose-500 to-red-500", blue: "from-sky-500 to-blue-500", amber: "from-amber-500 to-orange-500" };
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${m[color] || "from-gray-500 to-slate-500"} flex items-center justify-center text-white`}>{icon}</div>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function DetailBox({ label, value, color }: any) {
  return (
    <div className="bg-white rounded-lg p-2.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`font-semibold ${color === "rose" ? "text-rose-600" : color === "amber" ? "text-amber-600" : color === "red" ? "text-red-600" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function formatEuro(v: number): string {
  return `€ ${v.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}