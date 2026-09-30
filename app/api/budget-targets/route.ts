import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const year = Number(request.nextUrl.searchParams.get("year") || new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2200) return NextResponse.json({ error: "Anno non valido" }, { status: 400 });
  const targets = await prisma.budgetTarget.findMany({ where: { clientId: "default", year }, orderBy: { month: "asc" } });
  return NextResponse.json({ year, targets });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const entries = Array.isArray(body.targets) ? body.targets : [body];
  if (entries.length === 0) return NextResponse.json({ error: "Nessun obiettivo da salvare" }, { status: 400 });

  const parsed = [];
  for (const entry of entries) {
    const year = Number(entry.year);
    const month = Number(entry.month);
    const revenueTarget = Number(entry.revenueTarget);
    const foodCostPct = Number(entry.foodCostPct);
    const laborCostPct = Number(entry.laborCostPct);
    const otherCostPct = Number(entry.otherCostPct ?? 0);
    const coverTarget = Number(entry.coverTarget ?? 0);
    const avgTicketTarget = Number(entry.avgTicketTarget ?? 0);

    if (!Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Anno o mese non valido" }, { status: 400 });
    }
    if (![revenueTarget, foodCostPct, laborCostPct, otherCostPct, coverTarget, avgTicketTarget].every(Number.isFinite) || revenueTarget < 0 || foodCostPct < 0 || foodCostPct > 100 || laborCostPct < 0 || laborCostPct > 100 || otherCostPct < 0 || otherCostPct > 100 || coverTarget < 0 || avgTicketTarget < 0) {
      return NextResponse.json({ error: `Valori non validi per ${month}/${year}` }, { status: 400 });
    }
    parsed.push({ year, month, revenueTarget, foodCostPct, laborCostPct, otherCostPct, coverTarget: Math.round(coverTarget), avgTicketTarget });
  }

  const saved = await prisma.$transaction(parsed.map(target => prisma.budgetTarget.upsert({
    where: { year_month_clientId: { year: target.year, month: target.month, clientId: "default" } },
    create: { ...target, clientId: "default" },
    update: target,
  })));
  return NextResponse.json({ success: true, targets: saved });
}
