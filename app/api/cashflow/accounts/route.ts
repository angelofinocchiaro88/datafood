import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const accounts = await prisma.account.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, iban, type = "current", currency = "EUR" } = body;
  const openingBalance = Number(body.openingBalance ?? 0);
  const minimumBalance = Number(body.minimumBalance ?? 0);
  const openingBalanceDate = body.openingBalanceDate ? new Date(body.openingBalanceDate) : null;
  const openingBalanceConfirmed = body.openingBalanceConfirmed === true;
  if (!name?.trim() || !Number.isFinite(openingBalance) || !Number.isFinite(minimumBalance) || minimumBalance < 0 || (openingBalanceDate && Number.isNaN(openingBalanceDate.getTime()))) {
    return NextResponse.json({ error: "Nome conto, saldo iniziale e soglia minima devono essere validi" }, { status: 400 });
  }
  if (!openingBalanceConfirmed && openingBalance !== 0) return NextResponse.json({ error: "Conferma il saldo iniziale o lascialo a zero" }, { status: 400 });
  if (openingBalanceConfirmed && !openingBalanceDate) return NextResponse.json({ error: "Indica la data del saldo iniziale" }, { status: 400 });
  const account = await prisma.account.create({ data: { name: name.trim(), iban, type, currency, openingBalance, minimumBalance, openingBalanceDate, openingBalanceConfirmed } });
  return NextResponse.json(account);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, name, iban, type, currency } = body;
  if (!id) return NextResponse.json({ error: "ID conto obbligatorio" }, { status: 400 });
  const data: any = {};
  if (name != null) data.name = String(name).trim();
  if (iban !== undefined) data.iban = iban || null;
  if (type != null) data.type = type;
  if (currency != null) data.currency = currency;
  if (body.openingBalance !== undefined) {
    data.openingBalance = Number(body.openingBalance);
    if (!Number.isFinite(data.openingBalance)) return NextResponse.json({ error: "Saldo iniziale non valido" }, { status: 400 });
  }
  if (body.minimumBalance !== undefined) {
    data.minimumBalance = Number(body.minimumBalance);
    if (!Number.isFinite(data.minimumBalance) || data.minimumBalance < 0) return NextResponse.json({ error: "Soglia minima non valida" }, { status: 400 });
  }
  if (body.openingBalanceDate !== undefined) {
    data.openingBalanceDate = body.openingBalanceDate ? new Date(body.openingBalanceDate) : null;
    if (data.openingBalanceDate && Number.isNaN(data.openingBalanceDate.getTime())) return NextResponse.json({ error: "Data saldo iniziale non valida" }, { status: 400 });
  }
  if (body.openingBalanceConfirmed !== undefined) data.openingBalanceConfirmed = Boolean(body.openingBalanceConfirmed);
  if (data.openingBalanceConfirmed === true && data.openingBalanceDate === null) return NextResponse.json({ error: "Per confermare il saldo indica anche la data di riferimento" }, { status: 400 });
  if (data.openingBalanceConfirmed === false && data.openingBalance !== undefined && data.openingBalance !== 0) return NextResponse.json({ error: "Conferma il saldo iniziale o inserisci zero" }, { status: 400 });
  try {
    const account = await prisma.account.update({ where: { id }, data });
    return NextResponse.json(account);
  } catch {
    return NextResponse.json({ error: "Conto non trovato" }, { status: 404 });
  }
}
