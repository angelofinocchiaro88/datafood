import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordClientAudit, requireClientAccess } from "@/lib/auth";
import { syncIssuedInvoiceSchedule } from "@/lib/financial-schedules";

export async function GET() {
  const fatture = await prisma.fatturaEmessa.findMany({ orderBy: { data: "desc" } });
  return NextResponse.json(fatture);
}

export async function POST(request: NextRequest) {
  const accessResult = await requireClientAccess(request, true);
  if ("response" in accessResult) return accessResult.response;
  const { access } = accessResult;
  const data = await request.json();
  const amount = Number(data.importo);
  const vat = Number(data.iva ?? 0);
  const date = data.data ? new Date(data.data) : new Date();
  const dueDate = data.scadenza ? new Date(data.scadenza) : null;
  if (!data.numero?.trim() || !data.cliente?.trim() || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(vat) || vat < 0 || Number.isNaN(date.getTime()) || (dueDate && Number.isNaN(dueDate.getTime()))) {
    return NextResponse.json({ error: "Numero, cliente, importo, IVA e date devono essere validi" }, { status: 400 });
  }
  const fattura = await prisma.fatturaEmessa.create({ data: { ...data, numero: data.numero.trim(), importo: amount, iva: vat, data: date, scadenza: dueDate } });
  await syncIssuedInvoiceSchedule(fattura);
  await recordClientAudit(access, "issued_invoice_registered", "FatturaEmessa", fattura.id, { numero: fattura.numero, importo: fattura.importo, dueDate: fattura.scadenza });
  return NextResponse.json(fattura);
}
