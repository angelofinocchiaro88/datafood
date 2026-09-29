import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const data = await request.json();
  if (data.dueDate) data.dueDate = new Date(data.dueDate);
  const schedule = await prisma.paymentSchedule.update({ where: { id: params.id }, data });
  return NextResponse.json(schedule);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.paymentSchedule.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}