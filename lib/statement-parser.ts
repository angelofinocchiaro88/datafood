// DATAFOOD - Parser estratti conto (CSV + testo PDF)

export interface ParsedTx {
  date: string;
  description: string;
  amount: number; // positivo = incasso, negativo = uscita
  counterparty: string;
}

// Parser CSV: riconosce colonne data, descrizione, importo
export function parseStatementCSV(csv: string): ParsedTx[] {
  const lines = csv.split("\n").filter(l => l.trim());
  const results: ParsedTx[] = [];

  for (const line of lines) {
    // Salta header
    if (line.toLowerCase().includes("data") && line.toLowerCase().includes("importo")) continue;

    const cols = line.split(/[,;\t]/).map(c => c.trim().replace(/"/g, ""));
    if (cols.length < 2) continue;

    // Trova data (dd/mm/yyyy o yyyy-mm-dd)
    const dateCol = cols.find(c => /^\d{2}\/\d{2}\/\d{4}$/.test(c) || /^\d{4}-\d{2}-\d{2}$/.test(c));
    if (!dateCol) continue;

    // Trova importo (con €, virgola o punto)
    const amountCol = cols.find(c => /[-+]?[\d.,]+(,|\.)\d{2}/.test(c) && /[€€]/.test(c) || /^[-+]?[\d.,]+$/.test(c.replace(/[€\s]/g, "")));
    if (!amountCol) continue;

    // Descrizione = le altre colonne unite
    const descCols = cols.filter(c => c !== dateCol && c !== amountCol);
    const description = descCols.join(" ");

    const amount = parseAmount(amountCol);
    if (isNaN(amount)) continue;

    results.push({
      date: parseDate(dateCol),
      description,
      amount,
      counterparty: "",
    });
  }

  return results;
}

// Parser testo estratto da PDF (righe tipo: data descrizione importo)
export function parseStatementText(text: string): ParsedTx[] {
  const lines = text.split("\n").filter(l => l.trim());
  const results: ParsedTx[] = [];

  for (const line of lines) {
    // Pattern: data (dd/mm/yyyy o dd/mm/yy) + descrizione + importo
    const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{2}\/\d{2})/);
    if (!dateMatch) continue;

    const date = dateMatch[0];
    const rest = line.replace(date, "").trim();

    // Trova importo alla fine (numero con virgola, preceduto da + o -)
    const amountMatch = rest.match(/([-+]?[\d.,]+,?\d{2})\s*$/);
    if (!amountMatch) continue;

    const amount = parseAmount(amountMatch[1]);
    if (isNaN(amount)) continue;

    const description = rest.replace(amountMatch[1], "").trim();

    results.push({
      date: parseDate(date),
      description: description || "Movimento",
      amount,
      counterparty: "",
    });
  }

  return results;
}

function parseAmount(str: string): number {
  let s = str.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
  const sign = s.startsWith("-") ? -1 : 1;
  s = s.replace(/^[+-]/, "");
  const n = parseFloat(s);
  return isNaN(n) ? NaN : sign * n;
}

function parseDate(dateStr: string): string {
  // dd/mm/yyyy → yyyy-mm-dd
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split("/");
    return `${y}-${m}-${d}`;
  }
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split("/");
    const fullYear = parseInt(y) > 50 ? `19${y}` : `20${y}`;
    return `${fullYear}-${m}-${d}`;
  }
  return dateStr;
}