import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.dailySummary.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();

  // Create daily summaries for the last 30 days
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    // Generate realistic data with some variance
    const baseRevenue = 2500 + Math.random() * 1500;
    const weekendBoost = (date.getDay() === 0 || date.getDay() === 6) ? 1.4 : 1;
    const revenue = baseRevenue * weekendBoost;
    const taxAmount = revenue * 0.1;
    const cashRatio = 0.4 + Math.random() * 0.2;
    const covers = Math.floor(40 + Math.random() * 60);
    const transactions = Math.floor(covers * 0.9);
    const averageTicket = revenue / transactions;

    await prisma.dailySummary.create({
      data: {
        date,
        totalRevenue: Math.round(revenue * 100) / 100,
        totalTax: Math.round(taxAmount * 100) / 100,
        totalCash: Math.round(revenue * cashRatio * 100) / 100,
        totalCard: Math.round(revenue * (1 - cashRatio) * 100) / 100,
        coverCount: covers,
        transactionCount: transactions,
        averageTicket: Math.round(averageTicket * 100) / 100,
      },
    });
  }

  // Get first category for dishes
  let category = await prisma.category.findFirst();
  if (!category) {
    category = await prisma.category.create({
      data: { name: "Primo" },
    });
  }

  // Create some sample sales for today
  const today = new Date();
  const salesData = [
    { hour: 12, total: 145.50, covers: 4, items: [
      { name: "Risotto ai Funghi Porcini", qty: 2, price: 16 },
      { name: "Tagliatelle al Ragù", qty: 2, price: 14 },
      { name: "Acqua 1L", qty: 2, price: 3 },
      { name: "Caffè", qty: 2, price: 1.50 },
    ]},
    { hour: 13, total: 232.00, covers: 6, items: [
      { name: "Vitello Tonnato", qty: 1, price: 12 },
      { name: "Branzino al Forno", qty: 2, price: 24 },
      { name: "Risotto ai Funghi Porcini", qty: 2, price: 16 },
      { name: "Insalata Mista", qty: 2, price: 6 },
      { name: "Tiramisù", qty: 2, price: 8 },
      { name: "Acqua 1L", qty: 3, price: 3 },
      { name: "Caffè", qty: 2, price: 1.50 },
    ]},
    { hour: 19, total: 387.50, covers: 8, items: [
      { name: "Antipasto della Casa", qty: 2, price: 10 },
      { name: "Risotto ai Funghi Porcini", qty: 3, price: 16 },
      { name: "Tagliatelle al Ragù", qty: 2, price: 14 },
      { name: "Branzino al Forno", qty: 2, price: 24 },
      { name: "Patate al Forno", qty: 2, price: 5 },
      { name: "Tiramisù", qty: 3, price: 8 },
      { name: "Bottiglia Vino Rosso", qty: 1, price: 18 },
    ]},
    { hour: 20, total: 275.00, covers: 5, items: [
      { name: "Risotto ai Funghi Porcini", qty: 2, price: 16 },
      { name: "Vitello Tonnato", qty: 2, price: 12 },
      { name: "Branzino al Forno", qty: 1, price: 24 },
      { name: "Tiramisù", qty: 2, price: 8 },
      { name: "Bottiglia Acqua", qty: 1, price: 4 },
    ]},
  ];

  for (const saleData of salesData) {
    const saleDate = new Date(today);
    saleDate.setHours(saleData.hour, Math.floor(Math.random() * 30), 0, 0);

    const sale = await prisma.sale.create({
      data: {
        date: saleDate,
        total: saleData.total,
        taxAmount: saleData.total * 0.1,
        paymentMethod: Math.random() > 0.3 ? "CASH" : "CARD",
        coverCount: saleData.covers,
        operatorName: "Mario Rossi",
        items: {
          create: saleData.items.map((item) => ({
            productName: item.name,
            quantity: item.qty,
            unitPrice: item.price,
            totalPrice: item.price * item.qty,
            vatRate: item.price >= 10 ? 10 : 5,
          })),
        },
      },
    });
  }

  // Create some sample invoices (from suppliers)
  const suppliers = await prisma.supplier.findMany({ take: 3 });
  if (suppliers.length > 0) {
    const invoiceData = [
      { supplier: suppliers[0], number: "FT24-001", amount: 450, items: ["Olio Extravergine 10L", "Parmigiano Reggiano 5kg", "Basilico 10 mazzetti"] },
      { supplier: suppliers[1], number: "FT24-002", amount: 280, items: ["Fiorentina 3kg", "Costata 2kg"] },
      { supplier: suppliers[2], number: "FT24-003", amount: 320, items: ["Branzino 5kg", "Orata 3kg", "Gamberi 2kg"] },
    ];

    for (const inv of invoiceData) {
      const invoiceDate = new Date();
      invoiceDate.setDate(invoiceDate.getDate() - Math.floor(Math.random() * 14));

      await prisma.invoice.create({
        data: {
          invoiceNumber: inv.number,
          invoiceDate,
          senderVat: inv.supplier.vat || "IT00000000000",
          senderName: inv.supplier.name,
          recipientVat: "IT12345678901",
          recipientName: "RistoGest SRL",
          totalAmount: inv.amount,
          taxAmount: inv.amount * 0.1,
          status: "PROCESSED",
          supplierId: inv.supplier.id,
          items: {
            create: inv.items.map((desc, i) => ({
              description: desc,
              quantity: 1 + Math.floor(Math.random() * 5),
              unitPrice: Math.round((inv.amount / inv.items.length) * 100) / 100,
              totalPrice: Math.round((inv.amount / inv.items.length) * 100) / 100,
              vatRate: 10,
            })),
          },
        },
      });
    }
  }

  console.log("Seed completed!");
  console.log("- Created 30 days of daily summaries");
  console.log("- Created", salesData.length, "sales for today");
  console.log("- Created 3 sample invoices");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });