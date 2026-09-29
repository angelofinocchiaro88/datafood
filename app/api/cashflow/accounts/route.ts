import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const accounts = await prisma.account.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  const { name, iban, type, currency } = await request.json();
  const account = await prisma.account.create({ data: { name, iban, type, currency } });
  return NextResponse.json(account);
}