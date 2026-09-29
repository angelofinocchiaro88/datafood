import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const resolved = request.nextUrl.searchParams.get("resolved");
  const alerts = await prisma.alert.findMany({
    where: resolved === "true" ? { isResolved: true } : resolved === "false" ? { isResolved: false } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(alerts);
}

export async function POST(request: NextRequest) {
  const { alertType, message, threshold } = await request.json();
  const alert = await prisma.alert.create({ data: { alertType, message, threshold: threshold ? JSON.stringify(threshold) : null } });
  return NextResponse.json(alert);
}