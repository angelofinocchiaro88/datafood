import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ clients });
}

export async function POST(request: NextRequest) {
  const { name, sdiCode, pecAddress, vatNumber, address, phone, email } = await request.json();
  const client = await prisma.client.create({
    data: { name, sdiCode, pecAddress, vatNumber, address, phone, email },
  });
  return NextResponse.json(client);
}