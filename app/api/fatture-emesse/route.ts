import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const fatture = await prisma.fatturaEmessa.findMany({ orderBy: { data: "desc" } });
  return NextResponse.json(fatture);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const fattura = await prisma.fatturaEmessa.create({ data });
  return NextResponse.json(fattura);
}