import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.fatturaEmessa.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}