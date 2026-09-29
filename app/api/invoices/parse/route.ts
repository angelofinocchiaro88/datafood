import { NextResponse } from "next/server";

/**
 * Parse SDI FatturaPA XML format
 * The SDI (Sistema Di Interscambio) format is the Italian electronic invoice standard
 * based on FatturaPA XML schema
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { xmlContent } = body;

    if (!xmlContent) {
      return NextResponse.json(
        { error: "XML content is required" },
        { status: 400 }
      );
    }

    // Parse the XML (basic parsing - in production use a proper XML parser)
    const parsed = parseSdiXml(xmlContent);

    if (!parsed) {
      return NextResponse.json(
        { error: "Failed to parse XML" },
        { status: 400 }
      );
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (error) {
    console.error("Error parsing SDI XML:", error);
    return NextResponse.json(
      { error: "Failed to parse SDI XML" },
      { status: 500 }
    );
  }
}

interface ParsedInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  senderVat: string;
  senderName: string;
  recipientVat: string;
  recipientName: string;
  totalAmount: number;
  taxAmount: number;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    vatRate: number;
  }>;
}

function parseSdiXml(xml: string): ParsedInvoice | null {
  try {
    // Extract relevant fields from SDI XML using regex patterns
    // In production, use a proper XML parser like fast-xml-parser

    // FatturaPA uses specific XML namespaces and element names
    // Common patterns for FatturaPA v1.2

    // Invoice number (NumeroFattura)
    const invoiceNumberMatch = xml.match(/<NumeroFattura>([^<]+)<\/NumeroFattura>/i);
    const invoiceNumber = invoiceNumberMatch ? invoiceNumberMatch[1].trim() : "";

    // Invoice date (DataFattura)
    const invoiceDateMatch = xml.match(/<DataFattura>([^<]+)<\/DataFattura>/i);
    const invoiceDate = invoiceDateMatch ? invoiceDateMatch[1].trim() : "";

    // Due date (DataScadenzaPagamento)
    const dueDateMatch = xml.match(/<DataScadenzaPagamento>([^<]+)<\/DataScadenzaPagamento>/i);
    const dueDate = dueDateMatch ? dueDateMatch[1].trim() : undefined;

    // Sender VAT (IdFiscaleIVA inside CedentePrestatore)
    const senderVatMatch = xml.match(/<CedentePrestatore[^>]*>[\s\S]*?<IdFiscaleIVA[^>]*>[\s\S]*?<IdCodice>([^<]+)<\/IdCodice>/i);
    const senderVat = senderVatMatch ? senderVatMatch[1].trim() : "";

    // Sender Name (Denominazione inside CedentePrestatore)
    const senderNameMatch = xml.match(/<CedentePrestatore[^>]*>[\s\S]*?<Denominazione>([^<]+)<\/Denominazione>/i);
    const senderName = senderNameMatch ? senderNameMatch[1].trim() : "Unknown";

    // Recipient VAT (IdFiscaleIVA inside CessionarioCommittente)
    const recipientVatMatch = xml.match(/<CessionarioCommittente[^>]*>[\s\S]*?<IdFiscaleIVA[^>]*>[\s\S]*?<IdCodice>([^<]+)<\/IdCodice>/i);
    const recipientVat = recipientVatMatch ? recipientVatMatch[1].trim() : "";

    // Recipient Name (Denominazione inside CessionarioCommittente)
    const recipientNameMatch = xml.match(/<CessionarioCommittente[^>]*>[\s\S]*?<Denominazione>([^<]+)<\/Denominazione>/i);
    const recipientName = recipientNameMatch ? recipientNameMatch[1].trim() : "Unknown";

    // Total amount (ImportoPagamento in DatiPagamento)
    const totalMatch = xml.match(/<ImportoPagamento>([^<]+)<\/ImportoPagamento>/i);
    const totalAmount = totalMatch ? parseFloat(totalMatch[1].replace(",", ".")) : 0;

    // Tax amount (Imposte in DatiRiepilogo)
    const taxMatch = xml.match(/<Imposte>([^<]+)<\/Imposte>/i);
    const taxAmount = taxMatch ? parseFloat(taxMatch[1].replace(",", ".")) : 0;

    // Line items (DettaglioLinee)
    const items: ParsedInvoice["items"] = [];
    const lineMatches = xml.match(/<DettaglioLinee>([\s\S]*?)<\/DettaglioLinee>/gi);

    if (lineMatches) {
      for (const line of lineMatches) {
        const descMatch = line.match(/<Descrizione>([^<]+)<\/Descrizione>/i);
        const qtyMatch = line.match(/<Quantita>([^<]+)<\/Quantita>/i);
        const priceMatch = line.match(/<PrezzoUnitario>([^<]+)<\/PrezzoUnitario>/i);
        const totalLineMatch = line.match(/<PrezzoTotale>([^<]+)<\/PrezzoTotale>/i);
        const vatMatch = line.match(/<AliquotaIVA>([^<]+)<\/AliquotaIVA>/i);

        if (descMatch) {
          items.push({
            description: descMatch[1].trim(),
            quantity: qtyMatch ? parseFloat(qtyMatch[1].replace(",", ".")) : 1,
            unitPrice: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : 0,
            totalPrice: totalLineMatch ? parseFloat(totalLineMatch[1].replace(",", ".")) : 0,
            vatRate: vatMatch ? parseFloat(vatMatch[1].replace(",", ".")) : 10,
          });
        }
      }
    }

    // Fallback: if no line items found, try to extract from generic XML structure
    if (items.length === 0) {
      const descMatches = xml.match(/<Descrizione>([^<]+)<\/Descrizione>/gi);
      const qtyMatches = xml.match(/<Quantita>([^<]+)<\/Quantita>/gi);

      if (descMatches) {
        descMatches.forEach((desc, i) => {
          items.push({
            description: desc.replace(/<\/?Descrizione>/gi, "").trim(),
            quantity: qtyMatches && qtyMatches[i] ? parseFloat(qtyMatches[i].replace(/<\/?Quantita>/gi, "").replace(",", ".")) : 1,
            unitPrice: 0,
            totalPrice: 0,
            vatRate: 10,
          });
        });
      }
    }

    if (!invoiceNumber && !invoiceDate) {
      return null;
    }

    return {
      invoiceNumber,
      invoiceDate,
      dueDate,
      senderVat,
      senderName,
      recipientVat,
      recipientName,
      totalAmount,
      taxAmount,
      items,
    };
  } catch (error) {
    console.error("XML parse error:", error);
    return null;
  }
}