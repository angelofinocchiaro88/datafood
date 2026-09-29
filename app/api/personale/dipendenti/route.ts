import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const dipendenti = await prisma.dipendente.findMany({
    include: { contratti: true, buste: true },
    orderBy: { cognome: "asc" },
  });
  return NextResponse.json(dipendenti);
}

export async function POST(request: NextRequest) {
  const data = await request.json();

  // Crea dipendente + contratto insieme
  const dipendente = await prisma.dipendente.create({
    data: {
      codice: data.codice,
      nome: data.nome,
      cognome: data.cognome,
      dataNascita: data.dataNascita ? new Date(data.dataNascita) : null,
      codiceFiscale: data.codiceFiscale,
      qualifica: data.qualifica,
      dataAssunzione: data.dataAssunzione ? new Date(data.dataAssunzione) : new Date(),
      tipoContratto: data.tipoContratto,
      contratti: {
        create: {
          tipo: data.tipoContratto || "tempo_indeterminato",
          ccnl: data.ccnl || "pubblici_esercizi",
          livello: data.livello || "4",
          oreSettimanali: data.oreSettimanali || 40,
          retribuzioneLordaMensile: data.retribuzioneLordaMensile || 0,
          mensilita: data.mensilita || 13,
        },
      },
    },
    include: { contratti: true },
  });

  return NextResponse.json(dipendente);
}