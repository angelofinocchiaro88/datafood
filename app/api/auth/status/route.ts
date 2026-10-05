import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const users = await prisma.user.count();
  return NextResponse.json({ needsBootstrap: users === 0, bootstrapConfigured: Boolean(process.env.DATAFOOD_BOOTSTRAP_TOKEN && process.env.DATAFOOD_SESSION_SECRET) });
}
