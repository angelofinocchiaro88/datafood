import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordClientAudit, requireClientAccess } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const accessResult = await requireClientAccess(request, true);
  if ("response" in accessResult) return accessResult.response;
  const { access } = accessResult;
  const body = await request.json();
  const taxAmount = Number(body.taxAmount);
  if (!Number.isFinite(taxAmount) || taxAmount < 0) return NextResponse.json({ error: "Importo IVA non valido" }, { status: 400 });
  const sale = await prisma.sale.findFirst({ where: { id: params.id, clientId: access.client.id }, select: { id: true, total: true, items: { select: { id: true } } } });
  if (!sale) return NextResponse.json({ error: "Corrispettivo non trovato" }, { status: 404 });
  if (sale.items.length > 0) return NextResponse.json({ error: "Questo corrispettivo ha già righe prodotto: l’IVA si verifica sulle singole righe." }, { status: 409 });
  if (taxAmount > sale.total) return NextResponse.json({ error: "L’IVA non può superare l’incasso lordo" }, { status: 400 });
  const updated = await prisma.sale.update({ where: { id: sale.id }, data: { taxAmount, taxAmountKnown: true } });
  await recordClientAudit(access, "sales_tax_verified", "Sale", updated.id, { taxAmount });
  return NextResponse.json({ success: true, sale: updated });
}
