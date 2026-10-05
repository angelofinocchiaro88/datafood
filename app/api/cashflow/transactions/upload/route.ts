import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseStatementCSV, parseStatementText } from "@/lib/statement-parser";
import { categorizeTransaction } from "@/lib/cashflow";
import { recordClientAudit, requireClientAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { contentType, content, accountId } = await request.json();

    let parsed: any[] = [];

    if (contentType === "csv") {
      parsed = parseStatementCSV(content);
    } else if (contentType === "text") {
      parsed = parseStatementText(content);
    } else if (contentType === "pdf") {
      // Estrai testo dal PDF (base64)
      const { PDFParse } = await import("pdf-parse");
      const buffer = Buffer.from(content, "base64");
      const parser = new PDFParse({ data: buffer });
      const pdfData = await parser.getText();
      parsed = parseStatementText(pdfData.text);
    } else {
      return NextResponse.json({ error: "Tipo non supportato" }, { status: 400 });
    }

    if (parsed.length === 0) {
      return NextResponse.json({ success: true, total: 0, transactions: [], warning: "Nessuna transazione riconosciuta" });
    }

    // Validazione e deduplicazione
    const unique = new Map<string, any>();
    for (const tx of parsed) {
      const key = `${tx.date}-${Math.round(tx.amount * 100)}-${tx.description.slice(0, 20)}`;
      if (!unique.has(key)) unique.set(key, tx);
    }

    // Categorizza ogni transazione
    const withCategory = Array.from(unique.values()).map(tx => {
      const suggestion = categorizeTransaction(tx.description, tx.counterparty);
      return { ...tx, category: suggestion.category, confidence: suggestion.confidence };
    });

    return NextResponse.json({
      success: true,
      total: withCategory.length,
      transactions: withCategory,
    });
  } catch (error) {
    console.error("Upload statement error:", error);
    return NextResponse.json({ error: "Errore parsing" }, { status: 500 });
  }
}

// Endpoint per salvare le transazioni parsate dopo revisione
export async function PUT(request: NextRequest) {
  try {
    const accessResult = await requireClientAccess(request, true);
    if ("response" in accessResult) return accessResult.response;
    const { access } = accessResult;
    const { accountId, transactions } = await request.json();
    if (!accountId || !Array.isArray(transactions)) return NextResponse.json({ error: "Seleziona un conto e transazioni valide" }, { status: 400 });
    const account = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true, clientId: true } });
    if (!account) return NextResponse.json({ error: "Conto non trovato" }, { status: 404 });
    let saved = 0;
    let skipped = 0;

    for (const tx of transactions) {
      const amount = Number(tx.amount);
      const date = new Date(tx.date);
      if (!Number.isFinite(amount) || amount === 0 || Number.isNaN(date.getTime())) { skipped++; continue; }
      // Dedup: verifica esistente
      const exists = await prisma.cashTransaction.findFirst({
        where: { accountId: account.id, date, amount, description: tx.description || "" },
      });
      if (exists) { skipped++; continue; }

      let categoryId = null;
      if (tx.category) {
        const cat = await prisma.cashFlowCategory.findFirst({ where: { clientId: account.clientId, name: tx.category } });
        if (cat) categoryId = cat.id;
      }

      await prisma.cashTransaction.create({
        data: {
          accountId: account.id,
          clientId: account.clientId,
          date,
          amount,
          description: tx.description || "",
          counterparty: tx.counterparty || "",
          categoryId,
          source: "bank_upload",
          isReconciled: true,
        },
      });
      saved++;
    }

    if (saved > 0) await recordClientAudit(access, "bank_statement_imported", "CashTransaction", undefined, { accountId: account.id, saved, skipped });
    return NextResponse.json({ success: true, saved, skipped });
  } catch (error) {
    return NextResponse.json({ error: "Errore salvataggio" }, { status: 500 });
  }
}
