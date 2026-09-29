import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const days = parseInt(request.nextUrl.searchParams.get("days") || "90");
  const now = new Date();
  const limit = new Date(now);
  limit.setDate(now.getDate() + days);

  const schedules = await prisma.paymentSchedule.findMany({
    where: { status: "open", dueDate: { gte: now, lte: limit } },
    include: { category: true },
    orderBy: { dueDate: "asc" },
  });
  return NextResponse.json(schedules);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const schedule = await prisma.paymentSchedule.create({
    data: { ...data, dueDate: new Date(data.dueDate), nextDueDate: new Date(data.dueDate) },
    include: { category: true },
  });
  return NextResponse.json(schedule);
}