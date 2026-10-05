import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const categories = await prisma.cashFlowCategory.findMany({ orderBy: [{ type: "asc" }, { orderIndex: "asc" }] });
  return NextResponse.json(categories);
}
