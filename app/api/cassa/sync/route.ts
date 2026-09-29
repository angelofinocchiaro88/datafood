import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CassaInCloudClient, parseDateParam } from '@/lib/cassa';

export async function POST(request: NextRequest) {
  try {
    const { apiKey, salesPointIds, dateFrom, dateTo } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 400 });
    }

    const client = new CassaInCloudClient({ apiKey });

    const fromDate = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = dateTo || new Date().toISOString().split('T')[0];

    const syncResults = {
      receipts: 0,
      products: 0,
      departments: 0,
    };

    if (!salesPointIds || salesPointIds.length === 0) {
      const soldByDept = await client.getSoldByDepartment({
        datetimeFrom: parseDateParam(fromDate),
        datetimeTo: parseDateParam(toDate),
      });

      for (const dept of soldByDept.sold) {
        await prisma.sale.upsert({
          where: {
            externalId_date: {
              externalId: `cassa_dept_${dept.idDepartment}_${toDate}`,
              date: new Date(toDate),
            },
          },
          create: {
            date: new Date(toDate),
            total: Number(dept.profit),
            quantity: Number(dept.quantity),
            type: 'POS',
            source: 'cassa_in_cloud',
            externalId: `cassa_dept_${dept.idDepartment}_${toDate}`,
            metadataJson: JSON.stringify({
              departmentId: dept.idDepartment,
              departmentName: dept.department.description,
            }),
          },
          update: {
            total: Number(dept.profit),
            quantity: Number(dept.quantity),
          },
        });
        syncResults.departments++;
      }
    }

    const soldProducts = await client.getSoldByProduct({
      datetimeFrom: parseDateParam(fromDate),
      datetimeTo: parseDateParam(toDate),
    });

    for (const product of soldProducts.sold) {
      await prisma.sale.upsert({
        where: {
          externalId_date: {
            externalId: `cassa_prod_${product.idProduct}_${toDate}`,
            date: new Date(toDate),
          },
        },
        create: {
          date: new Date(toDate),
          total: Number(product.profit),
          quantity: Number(product.quantity),
          type: 'POS',
          source: 'cassa_in_cloud',
          externalId: `cassa_prod_${product.idProduct}_${toDate}`,
          metadataJson: JSON.stringify({
            productId: product.idProduct,
            productName: product.product.description,
          }),
        },
        update: {
          total: Number(product.profit),
          quantity: Number(product.quantity),
        },
      });
      syncResults.products++;
    }

    let receiptsPage = 0;
    const receiptsLimit = 100;
    let hasMoreReceipts = true;

    while (hasMoreReceipts) {
      const receiptsResponse = await client.getReceipts({
        start: receiptsPage * receiptsLimit,
        limit: receiptsLimit,
        datetimeFrom: parseDateParam(fromDate),
        datetimeTo: parseDateParam(toDate),
      });

      if (receiptsResponse.receipts.length === 0) {
        hasMoreReceipts = false;
        break;
      }

      for (const receipt of receiptsResponse.receipts) {
        await prisma.sale.upsert({
          where: {
            externalId_date: {
              externalId: `cassa_receipt_${receipt.id}`,
              date: new Date(receipt.datetime),
            },
          },
          create: {
            date: new Date(receipt.datetime),
            total: Number(receipt.total),
            quantity: 1,
            type: 'RECEIPT',
            source: 'cassa_in_cloud',
            externalId: `cassa_receipt_${receipt.id}`,
            metadataJson: JSON.stringify({
              receiptId: receipt.id,
              receiptNumber: receipt.number,
              items: receipt.items,
            }),
          },
          update: {
            total: Number(receipt.total),
          },
        });
        syncResults.receipts++;
      }

      if (receiptsResponse.receipts.length < receiptsLimit) {
        hasMoreReceipts = false;
      } else {
        receiptsPage++;
      }
    }

    await prisma.posConfig.upsert({
      where: { id: 'cassa_in_cloud' },
      create: {
        id: 'cassa_in_cloud',
        name: 'Cassa in Cloud',
        type: 'cassa_in_cloud',
        apiKey,
        isActive: true,
        lastSync: new Date(),
      },
      update: {
        apiKey,
        lastSync: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Sync completed',
      results: syncResults,
    });
  } catch (error) {
    console.error('Cassa in Cloud sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}