import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (params.id === "default") return NextResponse.json({ error: "Cannot delete default client" }, { status: 400 });
    await prisma.client.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}