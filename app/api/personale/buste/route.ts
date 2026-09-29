import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calcolaCostoPersona } from "@/lib/payroll";

export const dynamic = "force-dynamic";

// Calcola e salva una busta paga con costo azienda reale
export async function POST(request: NextRequest) {
  try {
    const { dipendenteId, mese, anno, retribuzioneLorda, straordinari, indennita } = await request.json();

    const dipendente = await prisma.dipendente.findUnique({
      where: { id: dipendenteId },
      include: { contratti: true },
    });
    if (!dipendente) return NextResponse.json({ error: "Dipendente non trovato" }, { status: 404 });

    const contratto = dipendente.contratti[0];
    const lordo = retribuzioneLorda || contratto?.retribuzioneLordaMensile || 0;
    const mensilita = contratto?.mensilita || 13;

    // Calcolo costo persona
    const calc = calcolaCostoPersona({
      retribuzioneLorda: lordo,
      straordinari: straordinari || 0,
      indennita: indennita || 0,
      mensilita,
    });

    // Verifica se esiste già la busta per il mese
    const existing = await prisma.bustaPaga.findFirst({
      where: { dipendenteId, mese, anno },
    });

    const bustaData = {
      dipendenteId,
      mese,
      anno,
      retribuzioneLorda: calc.retribuzioneLorda,
      straordinari: straordinari || 0,
      indennita: indennita || 0,
      contributiDip: calc.contributiDipendente,
      irpef: calc.irpef,
      contributiAzienda: calc.contributiAzienda,
      inailAzienda: calc.inailAzienda,
      tfrMaturato: calc.tfrMaturato,
      rateiTredicesima: calc.rateoTredicesima,
      rateiQuattordicesima: calc.rateoQuattordicesima,
      rateiFerie: calc.rateiFerie,
      rateiPermessi: calc.rateiPermessi,
      altriRatei: 0,
      nettoDipendente: calc.nettoDipendente,
      costoAzienda: calc.costoAziendaMensile,
      differitoTotale: calc.totaleRateiDifferiti,
    };

    let busta;
    if (existing) {
      busta = await prisma.bustaPaga.update({ where: { id: existing.id }, data: bustaData });
    } else {
      busta = await prisma.bustaPaga.create({ data: bustaData });
    }

    return NextResponse.json({ busta, dettaglio: calc });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Errore calcolo" }, { status: 500 });
  }
}

// Riepilogo costi personale
export async function GET(request: NextRequest) {
  const anno = parseInt(request.nextUrl.searchParams.get("anno") || "2026");
  const buste = await prisma.bustaPaga.findMany({
    where: { anno },
    include: { dipendente: true },
    orderBy: { mese: "asc" },
  });

  const totaleCosto = buste.reduce((s, b) => s + b.costoAzienda, 0);
  const totaleLordo = buste.reduce((s, b) => s + b.retribuzioneLorda, 0);
  const totaleDifferiti = buste.reduce((s, b) => s + b.differitoTotale, 0);
  const totaleContributi = buste.reduce((s, b) => s + b.contributiAzienda + b.inailAzienda, 0);

  return NextResponse.json({
    anno,
    count: buste.length,
    totaleCosto: Math.round(totaleCosto),
    totaleLordo: Math.round(totaleLordo),
    totaleDifferiti: Math.round(totaleDifferiti),
    totaleContributi: Math.round(totaleContributi),
    buste,
  });
}