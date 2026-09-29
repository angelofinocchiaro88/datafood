import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const categories = await prisma.cashFlowCategory.findMany({ orderBy: [{ type: "asc" }, { orderIndex: "asc" }] });
  return NextResponse.json(categories);
}