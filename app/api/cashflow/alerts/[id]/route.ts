import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { isResolved, notes } = await request.json();
  const alert = await prisma.alert.update({
    where: { id: params.id },
    data: { isResolved, notes, resolvedAt: isResolved ? new Date() : null },
  });
  return NextResponse.json(alert);
}