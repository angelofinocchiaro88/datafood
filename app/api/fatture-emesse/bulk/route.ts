import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordClientAudit, requireClientAccess } from "@/lib/auth";
import { syncIssuedInvoiceSchedule } from "@/lib/financial-schedules";

// Parser FatturaPA per FATTURE EMESSE (attive)
// CedentePrestatore = noi (ristorante) · CessionarioCommittente = cliente
function parseFatturaEmessa(xml: string) {
  const get = (tag: string) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i"));
    return m ? m[1].trim() : "";
  };

  // Cliente = CessionarioCommittente (chi compra da noi)
  const clienteBlock = xml.match(/<CessionarioCommittente>[\s\S]*?<\/CessionarioCommittente>/i);
  let cliente = "", partitaIva = "";
  if (clienteBlock) {
    const nome = clienteBlock[0].match(/<Denominazione>([^<]*)<\/Denominazione>/i) || clienteBlock[0].match(/<Nome>([^<]*)<\/Nome>/i);
    cliente = nome ? nome[1].trim() : "";
    const iva = clienteBlock[0].match(/<IdCodice>([^<]*)<\/IdCodice>/i);
    partitaIva = iva ? iva[1].trim() : "";
  }

  const numero = get("Numero");
  const data = get("Data");
  const dueDate = get("DataScadenzaPagamento") || get("DataScadenza");
  const imponibile = parseFloat(get("ImponibileImporto").replace(",", ".")) || 0;
  const imposta = parseFloat(get("Imposta").replace(",", ".")) || 0;
  const ivaPct = parseFloat(get("AliquotaIVA").replace(",", ".")) || 0;

  return {
    numero: numero || `FE-${Date.now()}`,
    data: data ? new Date(data) : new Date(),
    scadenza: dueDate ? new Date(dueDate) : null,
    cliente: cliente || "Cliente",
    partitaIva,
    importo: imponibile,
    iva: ivaPct,
    descrizione: `Importata da XML · IVA €${imposta.toFixed(2)}`,
  };
}

export async function POST(request: NextRequest) {
  const accessResult = await requireClientAccess(request, true);
  if ("response" in accessResult) return accessResult.response;
  const { access } = accessResult;
  try {
    const { files } = await request.json();
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Nessun file" }, { status: 400 });
    }

    let imported = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const file of files) {
      try {
        const parsed = parseFatturaEmessa(file.content);

        const exists = await prisma.fatturaEmessa.findFirst({ where: { numero: parsed.numero } });
        if (exists) { skipped++; results.push({ filename: file.filename, status: "skip", reason: "duplicato" }); continue; }

        const invoice = await prisma.fatturaEmessa.create({ data: parsed });
        await syncIssuedInvoiceSchedule(invoice);
        await recordClientAudit(access, "issued_invoice_imported", "FatturaEmessa", invoice.id, { numero: invoice.numero, source: "xml" });
        imported++;
        results.push({ filename: file.filename, status: "ok", numero: parsed.numero, cliente: parsed.cliente });
      } catch (e) {
        skipped++;
        results.push({ filename: file.filename, status: "error", reason: "parse fallito" });
      }
    }

    return NextResponse.json({ success: true, imported, skipped, results });
  } catch (error) {
    return NextResponse.json({ error: "Errore import" }, { status: 500 });
  }
}
