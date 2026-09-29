// DATAFOOD - Metriche centralizzate (formule unificate)
// Ogni KPI usa queste funzioni, senza duplicare formule nei componenti.

export interface PnlData {
  ricavi: { food_sala: number; bev_sala: number; delivery: number; takeaway: number; eventi: number; altri: number; total: number };
  cogs: { food: number; bev: number; packaging: number; total: number };
  margine_lordo: number;
  personale: { total: number; cucina: number; sala: number; bar: number; delivery: number; oneri: number; interinale: number; accessori: number };
  prime_cost: number;
  operativi: { total: number };
  struttura: { total: number };
  ebitda: number;
  ammortamenti: number;
  ebit: number;
  utile_netto: number;
  coperti: number;
}

// Formattazione italiana
export function formatEuro(v: number, decimals = 0): string {
  return `€ ${v.toLocaleString("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
export function formatPct(v: number, decimals = 1): string {
  return `${v.toLocaleString("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}
export function formatDateIt(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("it-IT");
}

// SaleItem.totalPrice è registrato IVA inclusa; i KPI economici usano i ricavi netti.
export function calcRicavoNettoRiga(totalPrice: number, vatRate: number): number {
  if (!Number.isFinite(totalPrice) || !Number.isFinite(vatRate) || vatRate < 0) return 0;
  return totalPrice / (1 + vatRate / 100);
}

// KPI economici
export function calcRicaviTotali(pnl: PnlData): number {
  return pnl.ricavi.total;
}

export function calcScontrinoMedio(ricavi: number, transazioni: number): number | null {
  if (transazioni <= 0) return null;
  return ricavi / transazioni;
}

export function calcRicaviPerCoperto(ricavi: number, coperti: number): number | null {
  if (coperti <= 0) return null;
  return ricavi / coperti;
}

export function calcRicaviMediGiornalieri(ricavi: number, giorniAperti: number): number | null {
  if (giorniAperti <= 0) return null;
  return ricavi / giorniAperti;
}

export function calcFoodCostPct(pnl: PnlData): number | null {
  const foodRev = pnl.ricavi.food_sala;
  const foodCost = pnl.cogs.food;
  if (foodRev <= 0) return null;
  return (foodCost / foodRev) * 100;
}

export function calcBeverageCostPct(pnl: PnlData): number | null {
  const bevRev = pnl.ricavi.bev_sala;
  const bevCost = pnl.cogs.bev;
  if (bevRev <= 0) return null;
  return (bevCost / bevRev) * 100;
}

export function calcLaborCostPct(pnl: PnlData): number | null {
  if (pnl.ricavi.total <= 0) return null;
  return (pnl.personale.total / pnl.ricavi.total) * 100;
}

export function calcPrimeCostPct(pnl: PnlData): number | null {
  if (pnl.ricavi.total <= 0) return null;
  return ((pnl.cogs.total + pnl.personale.total) / pnl.ricavi.total) * 100;
}

export function calcEbitdaMargin(pnl: PnlData): number | null {
  if (pnl.ricavi.total <= 0) return null;
  return (pnl.ebitda / pnl.ricavi.total) * 100;
}

export function calcMargineLordoPct(pnl: PnlData): number | null {
  if (pnl.ricavi.total <= 0) return null;
  return (pnl.margine_lordo / pnl.ricavi.total) * 100;
}

// Break-even: costi fissi / margine di contribuzione %
export function calcBreakEvenRevenue(costiFissi: number, mcPct: number): number | null {
  if (mcPct <= 0) return null;
  return costiFissi / (mcPct / 100);
}

// Cash flow
export function calcRunway(liquidita: number, usciteMedieSettimanali: number): number | null {
  if (usciteMedieSettimanali <= 0) return null;
  return liquidita / usciteMedieSettimanali;
}

// Variazione
export function calcVariazione(actual: number, riferimento: number): { assoluta: number; pct: number | null } {
  const assoluta = actual - riferimento;
  const pct = riferimento !== 0 ? (assoluta / Math.abs(riferimento)) * 100 : null;
  return { assoluta, pct };
}

// Scostamento vs budget
export function calcScostamento(actual: number, budget: number): { assoluta: number; pct: number | null } {
  return calcVariazione(actual, budget);
}
