export function parseFatturaPA(xmlContent: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const getElementText = (tagName: string): string => {
    const regex = new RegExp(`<[^>]*:${tagName}[^>]*>([^<]*)</[^>]*:${tagName}>`, "gi");
    const match = xmlContent.match(regex);
    return match ? match[1].trim() : "";
  };

  try {
    result.invoiceNumber = getElementText("Numero") || getElementText("NumeroFattura");
    result.invoiceDate = getElementText("Data") || getElementText("DataFattura");

    const senderVatRegex = /<CodiceFiscale>([^<]*)<\/CodiceFiscale>|<IdFiscaleIVA>[^<]*<IdPaese>([^<]*)<\/IdPaese><IdCodice>([^<]*)<\/IdCodice>/gi;
    const senderVatMatch = senderVatRegex.exec(xmlContent);
    if (senderVatMatch) {
      result.senderVat = senderVatMatch[2] + senderVatMatch[3];
    }

    result.senderName = getElementText("Denominazione") || getElementText("DenominazioneVenditore");
    result.recipientVat = getElementText("CodiceDestinatario") || getElementText("CodiceFiscale");

    const amountRegex = /<ImportoTotaleDocumento>([^<]*)<\/ImportoTotaleDocumento>|<DatiGeneraliDocumento>[\s\S]*?<ImponibileImporto>([^<]*)<\/ImponibileImporto>/gi;
    const amountMatch = amountRegex.exec(xmlContent);
    if (amountMatch) {
      const parsed = parseFloat(amountMatch[1] || amountMatch[2] || "0");
      result.totalAmount = isNaN(parsed) ? 0 : parsed;
    } else {
      result.totalAmount = 0;
    }

    const taxRegex = /<AliquotaIVA>([^<]*)<\/AliquotaIVA>/gi;
    const taxMatch = taxRegex.exec(xmlContent);
    if (taxMatch) {
      const total = result.totalAmount as number;
      const taxRate = parseFloat(taxMatch[1]) || 0;
      result.taxAmount = total ? total * (taxRate / 100) : 0;
    } else {
      result.taxAmount = 0;
    }

    result.items = [];

    const linesRegex = /<DettaglioLinee>([\s\S]*?)<\/DettaglioLinee>/gi;
    const linesMatch = linesRegex.exec(xmlContent);
    if (linesMatch) {
      const lineRegex = /<Linea>[\s\S]*?<Descrizione>([^<]*)<\/Descrizione>[\s\S]*?<Quantita>([^<]*)<\/Quantita>[\s\S]*?<PrezzoUnitario>([^<]*)<\/PrezzoUnitario>[\s\S]*?<PrezzoTotale>([^<]*)<\/PrezzoTotale>/gi;
      let lineMatch;
      while ((lineMatch = lineRegex.exec(linesMatch[1])) !== null) {
        (result.items as unknown[]).push({
          description: lineMatch[1],
          quantity: parseFloat(lineMatch[2]) || 1,
          unitPrice: parseFloat(lineMatch[3]) || 0,
          totalPrice: parseFloat(lineMatch[4]) || 0,
          vatRate: 22,
        });
      }
    }
  } catch (error) {
    console.error("FatturaPA parse error:", error);
  }

  return result;
}