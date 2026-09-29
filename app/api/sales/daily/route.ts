import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");

  const where: Record<string, unknown> = {};

  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) (where.date as Record<string, unknown>).gte = new Date(fromDate);
    if (toDate) (where.date as Record<string, unknown>).lte = new Date(toDate);
  }

  const summaries = await prisma.dailySummary.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return NextResponse.json(summaries);
}