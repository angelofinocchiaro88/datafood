import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const assets = await prisma.asset.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(assets);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const quotaAnnua = (data.costoStorico * data.coefficient) / 100;
  const asset = await prisma.asset.create({
    data: { ...data, quotaAnnua, quotaMensile: quotaAnnua / 12 },
  });
  return NextResponse.json(asset);
}