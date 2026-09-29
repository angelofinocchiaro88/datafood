import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const ingredients = await prisma.ingredient.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(ingredients);
}

export async function POST(request: NextRequest) {
  const { name, unit, currentStock, minStock, unitPrice } = await request.json();
  const ingredient = await prisma.ingredient.create({
    data: { name, unit, currentStock: currentStock || 0, minStock: minStock || 0, unitPrice: unitPrice || 0 },
  });
  return NextResponse.json(ingredient);
}