import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Parser XML semplificato FatturaPA
function parseFattura(xml: string) {
  const get = (tag: string) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i"));
    return m ? m[1].trim() : "";
  };
  const getNome = (tag: string) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<Nome>([^<]*)<\\/Nome>`, "i"));
    return m ? m[1].trim() : "";
  };
  const numero = get("Numero") || get("NumeroFattura");
  const data = get("Data");
  const denominazione = get("Denominazione") || getNome("CedentePrestatore");
  // Partita IVA
  const ivaMatch = xml.match(/<IdCodice>([^<]*)<\/IdCodice>/);
  const iva = ivaMatch ? ivaMatch[1].trim() : "";
  const totale = parseFloat(get("ImportoTotaleDocumento").replace(",", ".")) || 0;
  const imponibile = parseFloat(get("ImponibileImporto").replace(",", ".")) || 0;
  const imposta = parseFloat(get("Imposta").replace(",", ".")) || 0;

  return {
    invoiceNumber: numero || `IMP-${Date.now()}`,
    invoiceDate: data ? new Date(data) : new Date(),
    senderName: denominazione || "Fornitore",
    senderVat: iva,
    totalAmount: imponibile || totale,
    taxAmount: imposta,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { files } = await request.json();
    // files = array di { content: string, filename: string }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Nessun file" }, { status: 400 });
    }

    let imported = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const file of files) {
      try {
        const parsed = parseFattura(file.content);

        // Trova o crea fornitore
        let supplierId = null;
        if (parsed.senderVat) {
          const supplier = await prisma.supplier.findFirst({ where: { vat: parsed.senderVat } });
          if (supplier) supplierId = supplier.id;
          else {
            const s = await prisma.supplier.create({ data: { name: parsed.senderName, vat: parsed.senderVat } });
            supplierId = s.id;
          }
        }

        // Verifica duplicato (stesso numero fattura)
        const exists = await prisma.invoice.findFirst({ where: { invoiceNumber: parsed.invoiceNumber } });
        if (exists) { skipped++; results.push({ filename: file.filename, status: "skip", reason: "duplicato" }); continue; }

        await prisma.invoice.create({
          data: {
            invoiceNumber: parsed.invoiceNumber,
            invoiceDate: parsed.invoiceDate,
            senderName: parsed.senderName,
            senderVat: parsed.senderVat,
            recipientVat: "",
            recipientName: "",
            totalAmount: parsed.totalAmount,
            taxAmount: parsed.taxAmount,
            status: "PENDING",
            supplierId,
            xmlContent: file.content,
          },
        });
        imported++;
        results.push({ filename: file.filename, status: "ok", invoiceNumber: parsed.invoiceNumber, supplier: parsed.senderName });
      } catch (e) {
        skipped++;
        results.push({ filename: file.filename, status: "error", reason: "parse fallito" });
      }
    }

    return NextResponse.json({ success: true, imported, skipped, results });
  } catch (error) {
    return NextResponse.json({ error: "Errore nel caricamento" }, { status: 500 });
  }
}