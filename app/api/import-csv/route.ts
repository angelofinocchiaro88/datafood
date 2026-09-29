import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function parseCSV(csv: string): string[][] {
  const lines = csv.split("\n").filter((l) => l.trim());
  return lines.map((line) => {
    const vals: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line.trim()) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { vals.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    vals.push(current.trim());
    return vals;
  });
}

function clean(v: string): string {
  return v.replace(/^["\s]+|["\s]+$/g, "").trim();
}

export async function POST(request: NextRequest) {
  try {
    const { type, data } = await request.json();
    const rows = parseCSV(data);
    const headers = rows[0];
    const results = { created: 0, updated: 0, skipped: 0, errors: 0 };

    if (type === "fornitori") {
      for (let i = 1; i < rows.length; i++) {
        try {
          const r = rows[i];
          const code = clean(r[0]);
          const name = clean(r[1]);
          const category = clean(r[2]);
          const address = clean(r[3]);
          const phone = clean(r[4]);
          const email = clean(r[5]);
          const vat = clean(r[6]).replace(/\s/g, "");
          const paymentTerms = clean(r[7]);
          const deliveryHours = clean(r[8]);
          const contact = clean(r[9]);

          const existing = await prisma.supplier.findFirst({ where: { OR: [{ vat }, { name }] } });
          if (existing) {
            await prisma.supplier.update({ where: { id: existing.id }, data: { name, vat, email, phone, address, notes: JSON.stringify({ category, paymentTerms, deliveryHours, contact, code }) } });
            results.updated++;
          } else {
            await prisma.supplier.create({ data: { name, vat, email, phone, address, notes: JSON.stringify({ category, paymentTerms, deliveryHours, contact, code }) } });
            results.created++;
          }
        } catch { results.errors++; }
      }
    }

    if (type === "ingredienti") {
      for (let i = 1; i < rows.length; i++) {
        try {
          const r = rows[i];
          const code = clean(r[0]);
          const name = clean(r[1]);
          const category = clean(r[2]);
          const unit = clean(r[3]);
          const cost = parseFloat(clean(r[4]).replace(",", ".")) || 0;
          const vat = parseFloat(clean(r[5])) || 4;
          const supplierCode = clean(r[6]);
          const supplierName = clean(r[7]);
          const packaging = clean(r[8]);
          const notes = clean(r[9]);

          let supplierId = null;
          if (supplierCode && supplierCode !== "—") {
            const supplier = await prisma.supplier.findFirst({ where: { name: supplierName } });
            if (supplier) supplierId = supplier.id;
          }

          const existing = await prisma.ingredient.findFirst({ where: { name } });
          if (existing) {
            await prisma.ingredient.update({ where: { id: existing.id }, data: { unit, unitPrice: cost, minStock: 0, currentStock: 0 } });
            results.updated++;
          } else {
            await prisma.ingredient.create({ data: { name, unit, unitPrice: cost, minStock: 0, currentStock: 0 } });
            results.created++;
          }
        } catch { results.errors++; }
      }
    }

    if (type === "ricette") {
      for (let i = 1; i < rows.length; i++) {
        try {
          const r = rows[i];
          const dishName = clean(r[0]);
          const ingName = clean(r[1]);
          const ingCode = clean(r[2]);
          const qty = parseFloat(clean(r[3]).replace(",", ".")) || 0;
          const unit = clean(r[4]);
          const unitPrice = parseFloat(clean(r[5]).replace(",", ".")) || 0;
          const ingCost = parseFloat(clean(r[6]).replace(",", ".")) || 0;
          const fcPct = parseFloat(clean(r[9]).replace(",", ".")) || 0;

          const dish = await prisma.dish.findFirst({ where: { name: dishName } });
          if (!dish) { results.skipped++; continue; }

          let ingredient = await prisma.ingredient.findFirst({ where: { name: ingName } });
          if (!ingredient) {
            ingredient = await prisma.ingredient.create({ data: { name: ingName, unit, unitPrice, minStock: 0, currentStock: 0 } });
          }

          const existing = await prisma.recipe.findFirst({ where: { dishId: dish.id, ingredientId: ingredient.id } });
          if (existing) {
            await prisma.recipe.update({ where: { id: existing.id }, data: { quantity: qty, unit: unit || null } });
            results.updated++;
          } else {
            await prisma.recipe.create({ data: { dishId: dish.id, ingredientId: ingredient.id, quantity: qty, unit: unit || null } });
            results.created++;
          }
        } catch { results.errors++; }
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
