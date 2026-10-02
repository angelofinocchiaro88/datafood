import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CassaInCloudClient, parseDateParam } from "@/lib/cassa";

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("it-IT").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const { apiKey, salesPointIds, dateFrom, dateTo, clientId = "default" } = await request.json();
    if (!apiKey) return NextResponse.json({ error: "API key required" }, { status: 400 });

    const client = new CassaInCloudClient({ apiKey });
    const fromDate = dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const toDate = dateTo || new Date().toISOString().slice(0, 10);
    const apiSalesPointIds = Array.isArray(salesPointIds) ? salesPointIds.map(Number).filter(Number.isFinite) : [];
    const dateParams = { datetimeFrom: parseDateParam(fromDate), datetimeTo: parseDateParam(toDate), idsSalesPoint: apiSalesPointIds };

    // Department/product reports are aggregates; persisting them as Sale rows
    // alongside receipts multiplies the same turnover in every downstream KPI.
    const [productReport, departmentReport, dishes] = await Promise.all([
      client.getSoldByProduct(dateParams),
      apiSalesPointIds.length === 0 ? client.getSoldByDepartment(dateParams) : Promise.resolve({ sold: [] }),
      prisma.dish.findMany({ where: { clientId }, select: { id: true, name: true, vatRate: true } }),
    ]);
    const dishByName = new Map(dishes.map(dish => [normalized(dish.name), dish]));

    let receiptPage = 0;
    const receiptsLimit = 100;
    let importedReceipts = 0;
    let matchedItems = 0;
    let unlinkedItems = 0;
    while (true) {
      const response = await client.getReceipts({ start: receiptPage * receiptsLimit, limit: receiptsLimit, ...dateParams });
      if (response.receipts.length === 0) break;

      for (const receipt of response.receipts) {
        const receiptAny = receipt as typeof receipt & { taxAmount?: number; paymentMethod?: string; coverCount?: number };
        const items = receipt.items.map(item => {
          const dish = dishByName.get(normalized(item.product.description));
          const explicitVat = Number((item as any).vatRate);
          const vatKnown = Number.isFinite(explicitVat) && explicitVat >= 0 || Boolean(dish);
          const totalPrice = Number.isFinite(item.profit) && item.profit > 0 ? item.profit : item.price * item.quantity;
          if (dish) matchedItems++;
          else unlinkedItems++;
          return {
            productName: item.product.description,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice,
            vatRate: vatKnown ? explicitVat >= 0 ? explicitVat : dish!.vatRate : 10,
            vatRateKnown: vatKnown,
            dishId: dish?.id || null,
          };
        });
        const date = new Date(receipt.datetime);
        const taxAmountKnown = receiptAny.taxAmount != null && Number.isFinite(Number(receiptAny.taxAmount));
        await prisma.sale.upsert({
          where: { externalId_date: { externalId: `cassa_receipt_${receipt.id}`, date } },
          create: {
            clientId,
            date,
            total: Number(receipt.total),
            taxAmount: taxAmountKnown ? Number(receiptAny.taxAmount) : 0,
            taxAmountKnown,
            coverCount: Number.isInteger(receiptAny.coverCount) ? Number(receiptAny.coverCount) : 1,
            paymentMethod: receiptAny.paymentMethod || "N/D",
            type: "RECEIPT",
            source: "cassa_in_cloud",
            externalId: `cassa_receipt_${receipt.id}`,
            items: { create: items },
          },
          update: {
            total: Number(receipt.total),
            taxAmount: taxAmountKnown ? Number(receiptAny.taxAmount) : 0,
            taxAmountKnown,
            paymentMethod: receiptAny.paymentMethod || "N/D",
            items: { deleteMany: {}, create: items },
          },
        });
        importedReceipts++;
      }
      if (response.receipts.length < receiptsLimit) break;
      receiptPage++;
    }

    await prisma.posConfig.upsert({
      where: { id: `cassa_in_cloud_${clientId}` },
      create: { id: `cassa_in_cloud_${clientId}`, name: "Cassa in Cloud", type: "cassa_in_cloud", apiKey, isActive: true, lastSync: new Date() },
      update: { apiKey, lastSync: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: "Sincronizzazione completata: i corrispettivi vengono registrati una sola volta a livello scontrino.",
      results: { receipts: importedReceipts, matchedItems, unlinkedItems, aggregateProductRows: productReport.sold.length, aggregateDepartmentRows: departmentReport.sold.length },
    });
  } catch (error) {
    console.error("Cassa in Cloud sync error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sync failed" }, { status: 500 });
  }
}
