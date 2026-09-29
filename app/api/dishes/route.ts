import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const dishes = await prisma.dish.findMany({
    include: { category: true, recipes: { include: { ingredient: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(dishes);
}

export async function POST(request: NextRequest) {
  const { name, price, description, categoryId } = await request.json();
  if (!name || !price) return NextResponse.json({ error: "Nome e prezzo richiesti" }, { status: 400 });

  const dish = await prisma.dish.create({
    data: { name, price: parseFloat(price), description, categoryId },
    include: { category: true, recipes: { include: { ingredient: true } } },
  });
  return NextResponse.json(dish);
}