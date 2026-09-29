import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(suppliers);
}

export async function POST(request: NextRequest) {
  const { name, vat, email, phone, address, notes } = await request.json();
  const supplier = await prisma.supplier.create({
    data: { name, vat, email, phone, address, notes },
  });
  return NextResponse.json(supplier);
}