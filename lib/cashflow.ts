// DATAFOOD - Cash Flow Engine (categorizzazione + forecast + alert)

// ─── CATEGORIZZAZIONE ───
// Regole deterministiche basate su parole chiave nella descrizione/controparte

const CATEGORY_RULES: { keywords: string[]; category: string }[] = [
  { keywords: ["affitto", "locazione", "canone", "immobiliare"], category: "Affitti" },
  { keywords: ["stipendio", "salario", "busta paga", "paghe", "personale", "inps", "inail"], category: "Personale" },
  { keywords: ["enel", "enel energia", "gas", "luce", "energia", "acqua", "telecom", "internet", "fibra", "vodafone", "tim"], category: "Utenze" },
  { keywords: ["iva", "tasse", "tributi", "f24", "imposta", "acconto", "agenzia entrate", "inps"], category: "Tasse" },
  { keywords: ["finanziamento", "mutuo", "rata", "leasing", "prestito", "banca", "rate"], category: "Finanziamenti (rate)" },
  { keywords: ["prelievo socio", "prelievo", "socio", "dividendo"], category: "Prelievi socio" },
  { keywords: ["commissione", "pos", "bancaria", "canone conto", "nexi", "sumup"], category: "Commissioni bancarie" },
  { keywords: ["marketing", "pubblicità", "ads", "facebook", "google", "meta", "influencer"], category: "Marketing" },
  { keywords: ["investimento", "attrezzatura", "forno", "frigo", "cucina", "arredo"], category: "Investimenti" },
  { keywords: ["glovo", "deliveroo", "just eat", "uber eats"], category: "Fornitori bevande" },
  { keywords: ["vino", "birra", "bibita", "bevanda", "drink", "partesa", "diageo"], category: "Fornitori bevande" },
  { keywords: ["carne", "pesce", "verdura", "ortofrutta", "alimentari", "gross", "latticini", "formaggi", "metro", "pasta", "riso"], category: "Fornitori alimentari" },
  { keywords: ["catering", "evento", "banqueting", "fattura cliente", "incasso"], category: "Incassi catering/eventi" },
  { keywords: ["bonifico", "incasso", "accredito", "vendita", "corrispettivo"], category: "Incassi vendite" },
  { keywords: ["finanziamento", "prestito", "mutuo", "credito"], category: "Finanziamenti" },
  { keywords: ["versamento socio", "conferimento", "socio"], category: "Contributi soci" },
];

export function categorizeTransaction(description: string, counterparty: string): { category: string; confidence: number } {
  const text = `${description || ""} ${counterparty || ""}`.toLowerCase();
  let bestCategory = "";
  let bestScore = 0;

  for (const rule of CATEGORY_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (text.includes(kw.toLowerCase())) score += kw.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = rule.category;
    }
  }

  if (bestCategory && bestScore > 3) {
    return { category: bestCategory, confidence: Math.min(100, bestScore * 4) };
  }
  return { category: "", confidence: 0 };
}

// ─── FORECAST 13 SETTIMANE ───
export interface ForecastWeek {
  weekStart: Date;
  weekEnd: Date;
  inflow: number;
  outflow: number;
  net: number;
  endingBalance: number;
  atRisk: boolean;
}

export function generateForecast(
  startingBalance: number,
  scheduledItems: { dueDate: Date; amount: number; type: "payment" | "income"; probability: number }[],
  weeks: number = 13
): ForecastWeek[] {
  const result: ForecastWeek[] = [];
  let balance = startingBalance;

  // Trova il prossimo lunedì
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 1=Mon
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);

  // Media uscite settimanali (stima base se non ci sono dati)
  const baseWeeklyOutflow = 6000;
  const baseWeeklyInflow = 7500;

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(monday);
    weekStart.setDate(monday.getDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    let inflow = baseWeeklyInflow;
    let outflow = baseWeeklyOutflow;

    // Applica le scadenze previste in questa settimana
    for (const item of scheduledItems) {
      const d = new Date(item.dueDate);
      if (d >= weekStart && d <= weekEnd) {
        const weighted = item.amount * (item.probability / 100);
        if (item.type === "income") inflow += weighted;
        else outflow += weighted;
      }
    }

    const net = inflow - outflow;
    balance += net;

    result.push({
      weekStart,
      weekEnd,
      inflow: Math.round(inflow),
      outflow: Math.round(outflow),
      net: Math.round(net),
      endingBalance: Math.round(balance),
      atRisk: balance < 0 || balance < baseWeeklyOutflow * 0.5,
    });
  }

  return result;
}

export function calculateRunway(forecast: ForecastWeek[], weeklyOutflow: number): number {
  if (weeklyOutflow <= 0) return Infinity;
  for (let i = 0; i < forecast.length; i++) {
    if (forecast[i].endingBalance < 0) return i;
  }
  return forecast.length;
}