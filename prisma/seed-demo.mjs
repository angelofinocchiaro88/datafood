// DATAFOOD - Seed demo completo
// Crea: ristorante, utente admin, categorie/piatti/ricette/ingredienti, fornitori,
// ordini, vendite (120 giorni), fatture ricevute classificate, fatture emesse,
// personale (dipendenti, contratti, buste paga), cash flow (conti, transazioni,
// scadenziario, forecast 13 settimane), ammortamenti, budget, anno fiscale.
//
// Uso: node scripts/seed-demo.mjs
import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const prisma = new PrismaClient();

const CREDENTIALS = {
  email: "admin@datafood.it",
  password: "datafood2026!",
  name: "Angelo Demo",
};

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

// PRNG deterministico (mulberry32) per uno seed riproducibile
function makeRandom(seed = 42) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = makeRandom(20260425);
const rand = (min, max) => min + rnd() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[randInt(0, arr.length - 1)];
const round2 = (n) => Math.round(n * 100) / 100;

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const daysAgo = (n) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d;
};
const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function main() {
  console.log("→ Reset tabelle demo...");
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.dailySummary.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.fatturaEmessa.deleteMany();
  await prisma.bustaPaga.deleteMany();
  await prisma.contratto.deleteMany();
  await prisma.dipendente.deleteMany();
  await prisma.cashTransaction.deleteMany();
  await prisma.cashFlowForecast.deleteMany();
  await prisma.paymentSchedule.deleteMany();
  await prisma.forecastRule.deleteMany();
  await prisma.cashFlowCategory.deleteMany();
  await prisma.account.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.movement.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.category.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.posConfig.deleteMany();
  await prisma.yearlySummary.deleteMany();
  await prisma.fiscalYear.deleteMany();
  await prisma.budgetTarget.deleteMany();
  await prisma.clientAuditLog.deleteMany();

  // ─────────── CLIENTE (upsert: mantiene l'id, così le sessioni aperte restano valide) ───────────
  const existingClient = await prisma.client.findFirst({ where: { name: "Trattoria La Lanterna" } });
  const clientData = {
    name: "Trattoria La Lanterna",
    sdiCode: "KRRH6B",
    pecAddress: "trattorialalanterna@pec.it",
    vatNumber: "IT01234567890",
    address: "Via Roma 42, 20121 Milano",
    phone: "+39 02 1234567",
    email: "info@trattorialalanterna.it",
    notes: "Ristorante demo - 60 posti, apertura pranzo e cena.",
    isActive: true,
    serviceMode: "self_service",
    licenseStatus: "active",
    licensePlan: "demo",
    licenseStartsAt: daysAgo(120),
    licenseEndsAt: new Date(TODAY.getTime() + 300 * 86400000),
    managedServiceEnabled: false,
  };
  const client = existingClient
    ? await prisma.client.update({ where: { id: existingClient.id }, data: clientData })
    : await prisma.client.create({ data: clientData });
  const clientId = client.id;
  console.log(`✓ Ristorante: ${client.name}`);

  // ─────────── UTENTE (upsert: mantiene l'id e le sessioni) ───────────
  const passwordHash = await hashPassword(CREDENTIALS.password);
  const user = await prisma.user.upsert({
    where: { email: CREDENTIALS.email },
    update: { name: CREDENTIALS.name, passwordHash, platformRole: "datafood_admin", isActive: true },
    create: { email: CREDENTIALS.email, name: CREDENTIALS.name, passwordHash, platformRole: "datafood_admin", isActive: true },
  });
  await prisma.clientMembership.upsert({
    where: { userId_clientId: { userId: user.id, clientId } },
    update: { role: "owner", managedAccess: false },
    create: { userId: user.id, clientId, role: "owner", managedAccess: false },
  });
  console.log(`✓ Utente: ${CREDENTIALS.email} / ${CREDENTIALS.password}`);

  // ─────────── CATEGORIE E PIATTI ───────────
  const categoryDefs = [
    { name: "Antipasti", dishes: [
      ["Bruschetta al pomodoro", 6.5, 4], ["Burrata con pomodorini e basilico", 12, 4], ["Tagliere di salumi e formaggi", 16, 6], ["Carpaccio di manzo e rucola", 14, 4],
    ]},
    { name: "Primi", dishes: [
      ["Risotto ai porcini", 16, 4], ["Tagliatelle al ragù", 14, 4], ["Spaghetti alle vongole", 18, 4], ["Risotto alla zucca e salvia", 15, 4], ["Gnocchi di patate al ragù", 15, 4],
    ]},
    { name: "Secondi", dishes: [
      ["Branzino al forno", 24, 4], ["Costoletta alla milanese", 22, 4], ["Vitello tonnato", 20, 4], ["Tagliata di manzo al rosso", 26, 4],
    ]},
    { name: "Contorni", dishes: [
      ["Patate al forno", 5, 4], ["Insalata mista", 6, 4], ["Verdure grigliate", 7, 4],
    ]},
    { name: "Dolci", dishes: [
      ["Tiramisù", 7, 6], ["Panna cotta con frutti di bosco", 6.5, 6], ["Crostata al limone", 6, 6],
    ]},
    { name: "Bevande", dishes: [
      ["Acqua minerale 1L", 3, 1], ["Caffè espresso", 1.5, 1], ["Cappuccino", 2.5, 1], ["Bottiglia di vino rosso", 18, 1], ["Bottiglia di vino bianco", 17, 1], ["Birra media 33cl", 5, 1],
    ]},
  ];

  const dishes = [];
  for (const cat of categoryDefs) {
    const category = await prisma.category.create({ data: { name: cat.name, clientId } });
    for (const [name, price, yieldPortions] of cat.dishes) {
      const dish = await prisma.dish.create({
        data: {
          name,
          description: `${name} - ricetta demo`,
          price,
          vatRate: cat.name === "Bevande" ? 22 : 10,
          yieldPortions,
          preparation: cat.name === "Primi" ? "Cottura in padella, 8 min" : "Preparazione in cucina",
          clientId,
          categoryId: category.id,
        },
      });
      dishes.push({ ...dish, categoryName: cat.name });
    }
  }
  console.log(`✓ ${dishes.length} piatti in ${categoryDefs.length} categorie`);

  // ─────────── INGREDIENTI E RICETTE ───────────
  const ingredientDefs = [
    ["Pomodori pelati", "kg", "Verdure e ortaggi", 20, 3.4], ["Passata di pomodoro", "kg", "Verdure e ortaggi", 30, 1.6],
    ["Riso carnaroli", "kg", "Pasta, riso, farine e cereali", 25, 6.5], ["Farina 00", "kg", "Pasta, riso, farine e cereali", 40, 1.1],
    ["Pasta fresca tagliatelle", "kg", "Pasta, riso, farine e cereali", 15, 8.0], ["Gnocchi di patate", "kg", "Pasta, riso, farine e cereali", 12, 7.0],
    ["Manzo", "kg", "Carni", 20, 26.0], ["Pollo", "kg", "Carni", 20, 9.0], ["Branzino", "kg", "Pesce e prodotti ittici", 12, 26.0],
    ["Vongole", "kg", "Molluschi e crostacei", 8, 18.0], ["Mozzarella fiordilatte", "kg", "Latticini e formaggi", 10, 8.5],
    ["Parmigiano Reggiano", "kg", "Latticini e formaggi", 6, 24.0], ["Burro", "kg", "Latticini e formaggi", 8, 11.0],
    ["Funghi porcini", "kg", "Funghi e tartufi", 4, 45.0], ["Zucchine", "kg", "Verdure e ortaggi", 15, 3.0],
    ["Patate", "kg", "Verdure e ortaggi", 50, 1.4], ["Cipolle", "kg", "Verdure e ortaggi", 20, 1.5],
    ["Aglio", "kg", "Verdure e ortaggi", 4, 7.0], ["Basilico", "kg", "Verdure e ortaggi", 2, 28.0],
    ["Olio extravergine", "l", "Condimenti, spezie e basi", 18, 11.0], ["Sale", "kg", "Condimenti, spezie e basi", 25, 0.6],
    ["Pepe nero", "kg", "Condimenti, spezie e basi", 3, 22.0], ["Farina per panature", "kg", "Pane, bakery e pizza", 15, 1.0],
    ["Uova fresche", "pz", "Altri alimentari", 360, 0.28], ["Mascarpone", "kg", "Latticini e formaggi", 5, 10.0],
    ["Caffè in grani", "kg", "Altri alimentari", 4, 22.0], ["Zucchero", "kg", "Altri alimentari", 12, 1.1],
    ["Acqua minerale", "l", "Acque e bibite", 120, 0.60], ["Vino rosso", "l", "Vini rossi", 40, 8.0],
    ["Vino bianco", "l", "Vini bianchi", 40, 7.5], ["Birra", "l", "Acque e bibite", 60, 2.2],
    ["Limoni", "kg", "Frutta e dessert", 10, 2.6], ["Zucca", "kg", "Verdure e ortaggi", 15, 2.0],
    ["Pane", "kg", "Pane e forno", 8, 3.6], ["Latte fresco", "l", "Latte e derivati", 20, 1.6],
    ["Salumi misti", "kg", "Suino", 6, 16.0], ["Frutti di bosco", "kg", "Frutta e dessert", 4, 12.0],
    ["Rucola", "kg", "Verdure fresche", 5, 8.0], ["Capperi", "kg", "Conserve", 3, 18.0],
  ];
  const ingredients = [];
  for (const [name, unit, categoria, minStock, unitPrice] of ingredientDefs) {
    const ingredient = await prisma.ingredient.create({
      data: {
        name,
        unit,
        categoria,
        minStock,
        currentStock: round2(rand(minStock * 0.4, minStock * 1.8)),
        unitPrice,
        clientId,
      },
    });
    ingredients.push(ingredient);
  }
  console.log(`✓ ${ingredients.length} ingredienti a magazzino`);

  const byName = (name) => ingredients.find(i => i.name === name);
  const recipePlan = {
    "Bruschetta al pomodoro": [["Pomodori pelati", 0.06], ["Aglio", 0.005], ["Pane", 0.04]],
    "Burrata con pomodorini e basilico": [["Mozzarella fiordilatte", 0.15], ["Pomodori pelati", 0.08], ["Basilico", 0.005]],
    "Tagliere di salumi e formaggi": [["Parmigiano Reggiano", 0.06], ["Salumi misti", 0.08], ["Pane", 0.03]],
    "Carpaccio di manzo e rucola": [["Manzo", 0.10], ["Rucola", 0.02], ["Limoni", 0.01]],
    "Risotto ai porcini": [["Riso carnaroli", 0.10], ["Funghi porcini", 0.07], ["Burro", 0.02], ["Parmigiano Reggiano", 0.02]],
    "Tagliatelle al ragù": [["Pasta fresca tagliatelle", 0.10], ["Passata di pomodoro", 0.15], ["Manzo", 0.08], ["Cipolle", 0.02]],
    "Spaghetti alle vongole": [["Pasta fresca tagliatelle", 0.10], ["Vongole", 0.15], ["Aglio", 0.01], ["Olio extravergine", 0.015]],
    "Gnocchi di patate al ragù": [["Gnocchi di patate", 0.25], ["Passata di pomodoro", 0.12], ["Manzo", 0.05]],
    "Risotto alla zucca e salvia": [["Riso carnaroli", 0.12], ["Zucca", 0.15], ["Burro", 0.02], ["Parmigiano Reggiano", 0.03]],
    "Branzino al forno": [["Branzino", 0.18], ["Patate", 0.10], ["Olio extravergine", 0.01]],
    "Costoletta alla milanese": [["Pollo", 0.30], ["Farina per panature", 0.05], ["Olio extravergine", 0.02]],
    "Vitello tonnato": [["Manzo", 0.12], ["Uova fresche", 2], ["Farina 00", 0.02], ["Capperi", 0.01]],
    "Tagliata di manzo al rosso": [["Manzo", 0.18], ["Zucchine", 0.08]],
    "Patate al forno": [["Patate", 0.20], ["Olio extravergine", 0.01]],
    "Insalata mista": [["Zucchine", 0.08], ["Pomodori pelati", 0.06], ["Rucola", 0.02]],
    "Verdure grigliate": [["Zucchine", 0.12], ["Cipolle", 0.03], ["Olio extravergine", 0.01]],
    "Tiramisù": [["Mascarpone", 0.06], ["Uova fresche", 2], ["Zucchero", 0.03], ["Caffè in grani", 0.01]],
    "Panna cotta con frutti di bosco": [["Latte fresco", 0.12], ["Zucchero", 0.02], ["Frutti di bosco", 0.05]],
    "Crostata al limone": [["Farina 00", 0.06], ["Burro", 0.04], ["Limoni", 0.05], ["Uova fresche", 1.5]],
    "Acqua minerale 1L": [["Acqua minerale", 1]],
    "Caffè espresso": [["Caffè in grani", 0.015]],
    "Cappuccino": [["Caffè in grani", 0.015], ["Latte fresco", 0.15]],
    "Bottiglia di vino rosso": [["Vino rosso", 0.1875]],
    "Bottiglia di vino bianco": [["Vino bianco", 0.1875]],
    "Birra media 33cl": [["Birra", 0.33]],
  };
  let recipeCount = 0;
  for (const dish of dishes) {
    const plan = recipePlan[dish.name];
    if (!plan) continue;
    for (const [ingName, qty] of plan) {
      const ingredient = byName(ingName);
      if (!ingredient || qty === 0) continue;
      // le quantità sono per porzione: il batch copre le porzioni dichiarate nella ricetta
      const batchQuantity = Math.round(qty * dish.yieldPortions * 10000) / 10000;
      await prisma.recipe.create({
        data: {
          clientId,
          quantity: batchQuantity,
          unit: ingredient.unit,
          wastePct: round2(rand(2, 12)),
          dishId: dish.id,
          ingredientId: ingredient.id,
        },
      });
      recipeCount++;
    }
  }
  console.log(`✓ ${recipeCount} ingredienti in ricetta`);

  // ─────────── FORNITORI ───────────
  const supplierDefs = [
    ["Verdura e Orto SRL", "IT09876543210", "ordini@verduraorto.it", "+39 02 9988771", "Via del Campo 10, Milano"],
    ["Mare Fresco Distribuzione", "IT11223344556", "vendite@marefresco.it", "+39 02 5566778", "Via del Porto 5, Genova"],
    ["Caseificio Del Tuscanò", "IT12345678901", "info@caseificiodeltuscano.it", "+39 0571 123456", "Via del Latte 3, Toscana"],
    ["Enoteca La Bottega", "IT23456789012", "ordini@enotecalabottega.it", "+39 02 4455667", "Via dei Vini 12, Milano"],
    ["Pulizia Professionale S.p.A.", "IT34567890123", "servizi@puliziaprof.it", "+39 02 7788990", "Via Edison 22, Milano"],
    ["Energy & Gas Utilities", "IT45678901234", "servizi@energygas.it", "+39 02 3344556", "Corso Italia 100, Milano"],
  ];
  const suppliers = [];
  for (const [name, vat, email, phone, address] of supplierDefs) {
    suppliers.push(await prisma.supplier.create({ data: { name, vat, email, phone, address, clientId } }));
  }
  console.log(`✓ ${suppliers.length} fornitori`);

  // ─────────── ORDINI DI ACQUISTO ───────────
  const orderStatuses = ["DRAFT", "ORDERED", "RECEIVED", "RECEIVED", "RECEIVED"];
  for (let i = 0; i < 14; i++) {
    const supplier = pick(suppliers);
    const items = [];
    let total = 0;
    for (let k = 0; k < randInt(3, 6); k++) {
      const ingredient = pick(ingredients);
      const quantity = round2(rand(2, 25));
      const unitPrice = ingredient.unitPrice;
      items.push({ ingredient, quantity, unitPrice });
      total += quantity * unitPrice;
    }
    const date = daysAgo(randInt(1, 75));
    const status = pick(orderStatuses);
    const order = await prisma.order.create({
      data: {
        date,
        status,
        total: round2(total),
        clientId,
        supplierId: supplier.id,
        items: {
          create: items.map(item => ({
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            received: status === "RECEIVED" ? item.quantity : 0,
            clientId,
            ingredientId: item.ingredient.id,
          })),
        },
      },
    });
    if (status === "RECEIVED") {
      for (const item of items) {
        await prisma.movement.create({
          data: {
            type: "INGRESSO",
            quantity: item.quantity,
            clientId,
            date: order.date,
            reference: `ORD-${dateKey(order.date)}-${order.id.slice(-4)}`,
            ingredientId: item.ingredient.id,
          },
        });
        await prisma.ingredient.update({
          where: { id: item.ingredient.id },
          data: { currentStock: { increment: item.quantity } },
        });
      }
    }
  }
  console.log("✓ 14 ordini di acquisto con movimenti di magazzino");

  // ─────────── VENDITE (120 giorni) ───────────
  const operators = ["Mario Rossi", "Giulia Bianchi", "Luca Ferri", "Sara Conti"];
  const paymentMethods = ["CASH", "CARD", "CARD", "CASH", "TICKET RESTAURANT"];
  const saleRows = [];
  const saleItemRows = [];
  const summaryRows = [];
  let externalCounter = 0;

  for (let d = 119; d >= 0; d--) {
    const date = daysAgo(d);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const baseCovers = weekend ? 95 : 58;
    const seasonal = 1 + Math.sin((date.getMonth() + 1) / 12 * Math.PI * 2) * 0.12;
    const covers = Math.max(12, Math.round(baseCovers * seasonal * rand(0.85, 1.15)));
    const avgTicket = round2(rand(19, 27));
    const revenue = round2(covers * avgTicket);
    const tax = round2(revenue * 0.1);
    const cashRatio = rand(0.28, 0.45);

    const summary = await prisma.dailySummary.create({
      data: {
        date,
        totalRevenue: revenue,
        totalTax: tax,
        totalCash: round2(revenue * cashRatio),
        totalCard: round2(revenue * (1 - cashRatio)),
        coverCount: covers,
        transactionCount: Math.round(covers / 0.95),
        averageTicket: avgTicket,
      },
    });
    summaryRows.push(summary);

    const saleCount = Math.max(3, Math.round(covers / rand(4, 7)));
    let dailyTotal = 0;
    let dailyTax = 0;
    for (let s = 0; s < saleCount; s++) {
      const hour = pick([12, 12, 13, 13, 14, 19, 19, 20, 20, 21]);
      const saleDate = new Date(date);
      saleDate.setHours(hour, randInt(0, 59), 0, 0);
      const items = [];
      let saleTotal = 0;
      let saleTax = 0;
      const itemCount = randInt(1, 4);
      for (let k = 0; k < itemCount; k++) {
        const dish = pick(dishes);
        const quantity = randInt(1, 3);
        const totalPrice = round2(dish.price * quantity);
        items.push({ dish, quantity, totalPrice });
        saleTotal += totalPrice;
        saleTax += round2((totalPrice * dish.vatRate) / 110);
      }
      saleTotal = round2(saleTotal);
      saleTax = round2(saleTax);
      dailyTotal += saleTotal;
      dailyTax += saleTax;
      externalCounter++;
      saleRows.push({
        date: saleDate,
        total: saleTotal,
        taxAmount: saleTax,
        taxAmountKnown: true,
        paymentMethod: pick(paymentMethods),
        coverCount: randInt(1, 6),
        operatorName: pick(operators),
        tableNumber: String(randInt(1, 24)),
        externalId: `POS-${dateKey(date)}-${externalCounter}`,
        type: "MANUAL",
        source: "corrispettivi_csv",
        clientId,
        quantity: items.length,
      });
      saleItemRows.push({ items, saleIndex: saleRows.length - 1 });
    }
    // allineamento riepilogo giornaliero
    await prisma.dailySummary.update({
      where: { id: summary.id },
      data: { totalRevenue: round2(dailyTotal), totalTax: dailyTax },
    });
  }

  const createdSales = [];
  for (const row of saleRows) {
    createdSales.push(await prisma.sale.create({ data: row }));
  }
  let itemCount = 0;
  for (const { items, saleIndex } of saleItemRows) {
    const sale = createdSales[saleIndex];
    await prisma.saleItem.createMany({
      data: items.map(item => ({
        quantity: item.quantity,
        unitPrice: item.dish.price,
        totalPrice: item.totalPrice,
        vatRate: item.dish.vatRate,
        vatRateKnown: true,
        clientId,
        dishId: item.dish.id,
        saleId: sale.id,
        productName: item.dish.name,
      })),
    });
    itemCount += items.length;
  }
  console.log(`✓ ${createdSales.length} vendite, ${itemCount} righe vendita, 120 riepiloghi giornalieri`);

  // ─────────── FATTURE RICEVUTE ───────────
  const invoiceTemplates = [
    { macroArea: "COSTO DEL VENDUTO FOOD", categoria: "Carni", sotto: "Bovino", voce: "vitello", conto: "Food Cost", desc: "Manzo e vitello", vat: 10 },
    { macroArea: "COSTO DEL VENDUTO FOOD", categoria: "Pesce e prodotti ittici", sotto: "Pesce fresco", voce: "branzino", conto: "Food Cost", desc: "Branzino fresco", vat: 10 },
    { macroArea: "COSTO DEL VENDUTO FOOD", categoria: "Verdure e ortaggi", sotto: "Verdure fresche", voce: "zucchine", conto: "Food Cost", desc: "Verdura fresca assortita", vat: 10 },
    { macroArea: "COSTO DEL VENDUTO FOOD", categoria: "Latticini e formaggi", sotto: "Formaggi stagionati", voce: "parmigiano", conto: "Food Cost", desc: "Parmigiano Reggiano", vat: 10 },
    { macroArea: "COSTO DEL VENDUTO BEVERAGE", categoria: "Vini", sotto: "Vini rossi", voce: "vino rosso fermo", conto: "Beverage Cost", desc: "Vino rosso in bottiglia", vat: 22 },
    { macroArea: "PACKAGING E MATERIALI DI VENDITA", categoria: "Materiali di vendita", sotto: "Consumabili", voce: "tovaglioli", conto: "Packaging", desc: "Servizi, posate e tovaglioli", vat: 22 },
    { macroArea: "PERSONALE", categoria: "Contributi", sotto: "Contributi aziendali", voce: "contributi", conto: "Personale", desc: "Contributi INPS e INAIL", vat: 0 },
    { macroArea: "OCCUPAZIONE E STRUTTURA", categoria: "Canoni immobiliari", sotto: "Locazione", voce: "affitto locale", conto: "Occupancy", desc: "Canone di locazione locale", vat: 22 },
    { macroArea: "UTENZE", categoria: "Energia e servizi", sotto: "Energia", voce: "energia elettrica", conto: "Utilities", desc: "Fornitura energia elettrica", vat: 10 },
    { macroArea: "SERVIZI DIGITALI E SOFTWARE", categoria: "Software gestionali", sotto: "Gestionale", voce: "food cost", conto: "Software", desc: "Canone software gestionale", vat: 22 },
    { macroArea: "CONSULENZE E SERVIZI PROFESSIONALI", categoria: "Consulenze amministrative", sotto: "Amministrazione", voce: "commercialista", conto: "Professional Services", desc: "Servizi commercialista", vat: 22 },
    { macroArea: "ONERI FINANZIARI E BANCARI", categoria: "Banche", sotto: "Commissioni", voce: "commissioni pos", conto: "Financial Charges", desc: "Commissioni bancarie e POS", vat: 22 },
  ];
  const supplierPool = suppliers;
  let invoiceTotal = 0;
  for (let i = 0; i < 42; i++) {
    const tpl = pick(invoiceTemplates);
    const supplier = pick(supplierPool);
    const invoiceDate = daysAgo(randInt(2, 110));
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + pick([15, 30, 30, 60]));
    const total = round2(rand(180, 4200));
    const tax = round2((total * tpl.vat) / 110);
    const status = invoiceDate < daysAgo(30) ? "PROCESSED" : pick(["PENDING", "PENDING", "PROCESSED"]);
    const paymentStatus = invoiceDate < daysAgo(45) ? "paid" : pick(["open", "open", "paid"]);
    invoiceTotal += total;
    await prisma.invoice.create({
      data: {
        invoiceNumber: `FT${invoiceDate.getFullYear()}-${String(1000 + i)}`,
        invoiceDate,
        dueDate,
        senderVat: supplier.vat || "IT00000000000",
        senderName: supplier.name,
        recipientVat: "IT01234567890",
        recipientName: "Trattoria La Lanterna",
        totalAmount: total,
        taxAmount: tax,
        status,
        supplierId: supplier.id,
        macroArea: tpl.macroArea,
        categoria: tpl.categoria,
        sottocategoria: tpl.sotto,
        voceDettaglio: tpl.voce,
        contoGestionale: tpl.conto,
        clientId,
        paymentStatus,
        paidAt: paymentStatus === "paid" ? dueDate : null,
        items: {
          create: [{
            description: tpl.desc,
            quantity: 1,
            unitPrice: total,
            totalPrice: total,
            vatRate: tpl.vat,
            clientId,
          }],
        },
      },
    });
  }
  console.log(`✓ 42 fatture ricevute classificate (${round2(invoiceTotal)} € totali)`);

  // ─────────── FATTURE EMESSE (catering/eventi) ───────────
  const cateringClients = [
    ["Eventi Srl", "IT09998887766"], ["Conferenze SpA", "IT08887776655"], ["Hotel Bella Vista", "IT07776665544"],
    ["Comune di Milano", "IT00111122233"], ["Studio Legale Ferri", "IT00222233344"],
  ];
  for (let i = 0; i < 9; i++) {
    const [cliente, partitaIva] = cateringClients[i % cateringClients.length];
    const data = daysAgo(randInt(3, 120));
    const scadenza = new Date(data);
    scadenza.setDate(scadenza.getDate() + 30);
    const importo = round2(rand(450, 4800));
    const stato = data < daysAgo(35) ? "INCASSATA" : pick(["EMESSA", "EMESSA", "PAGATA"]);
    const paymentStatus = stato === "INCASSATA" || stato === "PAGATA" ? "paid" : "open";
    await prisma.fatturaEmessa.create({
      data: {
        numero: `FE${data.getFullYear()}-${String(200 + i)}`,
        data,
        scadenza,
        cliente,
        partitaIva,
        importo,
        iva: round2((importo * 10) / 110),
        tipologia: pick(["catering", "evento", "banco", "delivery"]),
        descrizione: pick(["Servizio catering aziendale", "Cena di gala - 40 coperti", "Servizio banco e consociati", "Delivery evento privato"]),
        stato,
        paymentStatus,
        paidAt: paymentStatus === "paid" ? scadenza : null,
        clientId,
      },
    });
  }
  console.log("✓ 9 fatture emesse (catering/eventi)");

  // ─────────── PERSONALE ───────────
  const employeeDefs = [
    ["Mario Rossi", "cuoco", 2400, "DL", 42, "1983-05-12"],
    ["Luca Ferri", "cuoco capo", 2600, "DL", 40, "1980-11-03"],
    ["Giulia Bianchi", "commesso/a", 1900, "DL", 40, "1990-03-22"],
    ["Sara Conti", "commesso/a", 1900, "PT", 30, "1995-07-14"],
    ["Paolo Gentile", "chef de rang", 2200, "DL", 42, "1986-01-30"],
    ["Elena Ricci", "cameriere/a", 1850, "DL", 40, "1993-09-08"],
    ["Davide Marino", "lavapiaggio", 1750, "DL", 42, "1988-06-19"],
    ["Marco Greco", "commesso/a", 1850, "DL", 40, "1998-02-25"],
  ];
  const dipendenti = [];
  let codice = 1;
  for (const [nome, qualifica, lordo, ccnl, ore, dataNascita] of employeeDefs) {
    const [nomeSolo, cognome] = nome.split(" ");
    const assunzione = daysAgo(randInt(200, 2400));
    const dip = await prisma.dipendente.create({
      data: {
        codice: `DIP-${String(codice).padStart(3, "0")}`,
        nome: nomeSolo,
        cognome,
        dataNascita: new Date(dataNascita),
        codiceFiscale: `${cognome.slice(0, 3).toUpperCase()}${nomeSolo.slice(0, 3).toUpperCase()}${String(80 + randInt(0, 20))}A${String(randInt(10, 99))}B${String(randInt(10, 99))}C`,
        qualifica,
        dataAssunzione: assunzione,
        tipoContratto: ccnl === "PT" ? "part_time" : "tempo_indeterminato",
        stato: "attivo",
        clientId,
      },
    });
    dipendenti.push({ ...dip, lordo, ccnl, ore });
    await prisma.contratto.create({
      data: {
        dipendenteId: dip.id,
        tipo: ccnl === "PT" ? "part_time" : "tempo_indeterminato",
        ccnl: "pubblici_esercizi",
        livello: qualifica.includes("capo") ? "2" : qualifica.includes("chef") ? "3" : "1",
        oreSettimanali: ore,
        pagaOraria: round2(lordo / 173),
        retribuzioneLordaMensile: lordo,
        mensilita: 13,
        dataInizio: assunzione,
        clientId,
      },
    });
    codice++;
  }
  console.log(`✓ ${dipendenti.length} dipendenti con contratto CCNL`);

  // buste paga ultimi 6 mesi
  const bustaRows = [];
  for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo--) {
    const ref = new Date(TODAY.getFullYear(), TODAY.getMonth() - monthsAgo, 1);
    for (const dip of dipendenti) {
      const lordo = dip.lordo;
      const straordinari = round2(rand(0, 180));
      const contributiDip = round2(lordo * 0.094);
      const irpef = round2(lordo * 0.14);
      const contributiAzienda = round2(lordo * 0.238);
      const inail = round2(lordo * 0.007);
      const tfr = round2(lordo * 0.043);
      const tredicesima = monthsAgo === 0 ? round2(lordo / 12) : 0;
      const ferie = round2(lordo * 0.05);
      const permessi = round2(lordo * 0.02);
      const netto = round2(lordo - contributiDip - irpef);
      bustaRows.push({
        dipendenteId: dip.id,
        mese: ref.getMonth() + 1,
        anno: ref.getFullYear(),
        retribuzioneLorda: lordo,
        straordinari,
        indennita: 0,
        contributiDip,
        irpef,
        contributiAzienda,
        inailAzienda: inail,
        tfrMaturato: tfr,
        rateiTredicesima: tredicesima,
        rateiQuattordicesima: 0,
        rateiFerie: ferie,
        rateiPermessi: permessi,
        altriRatei: 0,
        nettoDipendente: netto,
        costoAzienda: round2(lordo + straordinari + contributiAzienda + inail + tfr),
        differitoTotale: round2(ferie + permessi),
        clientId,
      });
    }
  }
  await prisma.bustaPaga.createMany({ data: bustaRows });
  console.log(`✓ ${bustaRows.length} buste paga (6 mesi)`);

  // ─────────── CASH FLOW ───────────
  const accountCassa = await prisma.account.create({
    data: {
      name: "Cassa contanti", iban: null, currency: "EUR", type: "cash", status: "active",
      openingBalance: 1500, openingBalanceDate: daysAgo(120), openingBalanceConfirmed: true,
      minimumBalance: 300, clientId,
    },
  });
  const accountBanca = await prisma.account.create({
    data: {
      name: "Conto corrente Intesa", iban: "IT60X0542811101000000123456", currency: "EUR", type: "current", status: "active",
      openingBalance: 28000, openingBalanceDate: daysAgo(120), openingBalanceConfirmed: true,
      minimumBalance: 5000, clientId,
    },
  });
  const accountCarta = await prisma.account.create({
    data: {
      name: "Conto carte POS", iban: null, currency: "EUR", type: "card", status: "active",
      openingBalance: 0, openingBalanceDate: daysAgo(120), openingBalanceConfirmed: true,
      minimumBalance: 0, clientId,
    },
  });

  const catIncassi = await prisma.cashFlowCategory.create({ data: { name: "Incassi sala", type: "inflow", orderIndex: 1, clientId } });
  const catIncassiB = await prisma.cashFlowCategory.create({ data: { name: "Incassi catering", type: "inflow", orderIndex: 2, clientId } });
  const catUsciteFood = await prisma.cashFlowCategory.create({ data: { name: "Fornitori food", type: "outflow", orderIndex: 1, clientId } });
  const catUscitePersonale = await prisma.cashFlowCategory.create({ data: { name: "Personale", type: "outflow", orderIndex: 2, clientId } });
  const catUsciteFisco = await prisma.cashFlowCategory.create({ data: { name: "Fisco e contributi", type: "outflow", orderIndex: 3, clientId } });
  const catUsciteUtenze = await prisma.cashFlowCategory.create({ data: { name: "Utenze", type: "outflow", orderIndex: 4, clientId } });

  const txRows = [];
  let bankBalance = 28000;
  for (let d = 119; d >= 0; d--) {
    const date = daysAgo(d);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const incasso = round2(rand(900, 2100) * (weekend ? 1.35 : 1));
    txRows.push({
      accountId: accountCassa.id, date, amount: incasso, currency: "EUR",
      description: "Incasso giornaliero sala", counterparty: null, categoryId: catIncassi.id,
      source: "manual", isReconciled: d < 100, externalId: `INC-${dateKey(date)}`, clientId,
    });
    if (weekend && rnd() > 0.5) {
      txRows.push({
        accountId: accountBanca.id, date, amount: round2(rand(400, 1200)), currency: "EUR",
        description: "Bonifico catering aziendale", counterparty: "Eventi Srl", categoryId: catIncassiB.id,
        source: "bank_upload", isReconciled: true, externalId: `CAT-${dateKey(date)}`, clientId,
      });
    }
    if (d % 3 === 0) {
      const out = round2(rand(600, 2600));
      txRows.push({
        accountId: accountBanca.id, date, amount: -out, currency: "EUR",
        description: "Bonifico fornitore", counterparty: pick(suppliers).name, categoryId: catUsciteFood.id,
        source: "bank_upload", isReconciled: d < 90, externalId: `FOR-${dateKey(date)}`, clientId,
      });
    }
    if (date.getDate() === 27) {
      txRows.push({
        accountId: accountBanca.id, date, amount: -round2(rand(3800, 5200)), currency: "EUR",
        description: "Paghe e contributi", counterparty: null, categoryId: catUscitePersonale.id,
        source: "bank_upload", isReconciled: true, externalId: `PAG-${dateKey(date)}`, clientId,
      });
    }
    if (date.getDate() === 16) {
      txRows.push({
        accountId: accountBanca.id, date, amount: -round2(rand(900, 1600)), currency: "EUR",
        description: "Fisco - IVA e IRAP", counterparty: "Agenzia delle Entrate", categoryId: catUsciteFisco.id,
        source: "bank_upload", isReconciled: true, externalId: `FIS-${dateKey(date)}`, clientId,
      });
    }
    if (date.getDate() === 5) {
      txRows.push({
        accountId: accountBanca.id, date, amount: -round2(rand(400, 900)), currency: "EUR",
        description: "Bolletta energia elettrica", counterparty: "Energy & Gas Utilities", categoryId: catUsciteUtenze.id,
        source: "bank_upload", isReconciled: true, externalId: `UTE-${dateKey(date)}`, clientId,
      });
    }
  }
  await prisma.cashTransaction.createMany({ data: txRows });
  console.log(`✓ ${txRows.length} transazioni di cassa su 3 conti`);

  // scadenziario: 13 settimane future
  const scheduleRows = [];
  const scheduleTemplates = [
    ["Fornitori food", "FOOD", catUsciteFood.id, "outflow", 1800, 4200],
    ["Affitto locale", "AFFITTO", catUsciteFood.id, "outflow", 2200, 2200],
    ["Utenze e gas", "UTENZE", catUsciteUtenze.id, "outflow", 350, 900],
    ["Paghe", "PAGHE", catUscitePersonale.id, "outflow", 9000, 14000],
    ["Commercialista", "CONSULENZE", catUsciteFisco.id, "outflow", 400, 900],
  ];
  for (let week = 0; week < 13; week++) {
    for (const [description, sourceType, categoryId, type, min, max] of scheduleTemplates) {
      if (rnd() > 0.72) continue;
      const dueDate = new Date(TODAY);
      dueDate.setDate(dueDate.getDate() + week * 7 + randInt(0, 6));
      const amount = round2(rand(min, max));
      scheduleRows.push({
        accountId: accountBanca.id,
        type,
        categoryId,
        counterparty: description,
        description,
        amount,
        currency: "EUR",
        dueDate,
        recurrence: pick(["none", "monthly", "monthly", "quarterly"]),
        nextDueDate: dueDate,
        probability: randInt(70, 100),
        sourceType,
        sourceId: `${sourceType}-${week}`,
        notes: null,
        status: "open",
        clientId,
      });
    }
  }
  await prisma.paymentSchedule.createMany({ data: scheduleRows });
  console.log(`✓ ${scheduleRows.length} scadenze pianificate (13 settimane)`);

  // forecast 13 settimane
  const forecastRows = [];
  let saldo = 32000;
  for (let week = 0; week < 13; week++) {
    const weekStart = new Date(TODAY);
    weekStart.setDate(weekStart.getDate() + week * 7);
    const inflow = round2(rand(9000, 15000));
    const outflow = round2(rand(7500, 13000));
    saldo += inflow - outflow;
    forecastRows.push({
      accountId: accountBanca.id,
      weekStartDate: weekStart,
      projectedInflow: inflow,
      projectedOutflow: outflow,
      projectedNet: round2(inflow - outflow),
      projectedEndingBalance: round2(saldo),
      status: week === 0 ? "final" : "draft",
      clientId,
    });
  }
  await prisma.cashFlowForecast.createMany({ data: forecastRows });
  console.log(`✓ ${forecastRows.length} settimane di forecast cash flow`);

  await prisma.forecastRule.createMany({
    data: [
      { ruleType: "fixed_cost", description: "Affitto locale fisso mensile", parameters: JSON.stringify({ amount: 2200, day: 1 }), active: true, clientId },
      { ruleType: "seasonality", description: "Stagionalità estate +25% ricavi", parameters: JSON.stringify({ months: [6, 7, 8], factor: 1.25 }), active: true, clientId },
      { ruleType: "variable_cost", description: "Food cost 32% dei ricavi", parameters: JSON.stringify({ pct: 32 }), active: true, clientId },
    ],
  });

  await prisma.alert.createMany({
    data: [
      { alertType: "low_balance", accountId: accountBanca.id, message: "Saldo conto corrente sotto la soglia minima (5.000 €)", threshold: JSON.stringify({ min: 5000 }), isResolved: false, clientId },
      { alertType: "upcoming_large_payment", accountId: accountBanca.id, message: "Pagamento paghe in arrivo per 12.400 € tra 5 giorni", threshold: JSON.stringify({ amount: 10000 }), isResolved: false, clientId },
      { alertType: "unusual_transaction", accountId: accountCassa.id, message: "Incasso cassa superiore alla media settimanale del 40%", threshold: JSON.stringify({ pct: 40 }), isResolved: false, clientId },
    ],
  });

  // ─────────── AMMORTAMENTI ───────────
  const assetDefs = [
    ["ATT-001", "Forno combinato 6 livelli", "Attrezzature cucina", 20, 18000, "Fornitori", "Ristorante - attrezzature"],
    ["ATT-002", "Cella frigo + congelatore", "Attrezzature cucina", 20, 9500, "Fornitori", "Ristorante - attrezzature"],
    ["ATT-003", "Lavastoviglie industriale", "Attrezzature cucina", 20, 7200, "Fornitori", "Ristorante - attrezzature"],
    ["ATT-004", "Impianto climatizzazione", "Impianti", 20, 12500, "Fornitori", "Ristorante - impianti"],
    ["ATT-005", "Arredo sala - 24 posti", "Arredi", 20, 16000, "Arredamenti Srl", "Ristorante - arredi"],
    ["ATT-006", "Cassa POS + stampante", "Attrezzature bar", 20, 2400, "Fornitori", "Ristorante - attrezzature"],
    ["ATT-007", "Software gestionale (licenza)", "Software", 33, 4200, "Datafood", "Ristorante - software"],
    ["ATT-008", "Veicolo per delivery", "Automezzi", 20, 11000, "Fornitori", "Ristorante - automezzi"],
  ];
  for (const [code, description, category, coefficient, costoStorico, fornitore, centroCosto] of assetDefs) {
    const dataAcquisto = daysAgo(randInt(200, 2000));
    const quotaAnnua = round2((costoStorico * coefficient) / 100);
    await prisma.asset.create({
      data: {
        code,
        description,
        category,
        coefficient,
        costoStorico,
        dataAcquisto,
        dataEntrataFunzione: dataAcquisto,
        fornitore,
        numFattura: `FT${dataAcquisto.getFullYear()}-${code}`,
        fondoAmmIniziale: 0,
        quotaAnnua,
        quotaMensile: round2(quotaAnnua / 12),
        primoAnnoRidotto: true,
        percentualePrimoAnno: 50,
        stato: "attivo",
        centroCosto,
        contoEconomico: category.includes("Software") ? "Software" : "Ammortamenti",
        clientId,
      },
    });
  }
  console.log("✓ 8 cespiti con piano di ammortamento");

  // ─────────── ANNO FISCALE E BUDGET ───────────
  const year = TODAY.getFullYear();
  const fiscalYear = await prisma.fiscalYear.create({
    data: {
      year,
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31),
      isActive: true,
      totalRevenue: 0,
      totalCosts: 0,
      totalMargin: 0,
      clientId,
    },
  });

  const yearRows = [];
  let yearRevenue = 0;
  for (let m = 1; m <= 12; m++) {
    const seasonal = 1 + Math.sin((m / 12) * Math.PI * 2) * 0.12;
    const revenue = round2(42000 * seasonal * rand(0.92, 1.08));
    const foodCost = round2(revenue * rand(0.29, 0.34));
    const laborCost = round2(revenue * rand(0.26, 0.32));
    const otherCosts = round2(revenue * rand(0.1, 0.15));
    const margin = round2(revenue - foodCost - laborCost - otherCosts);
    yearRevenue += revenue;
    yearRows.push({
      fiscalYearId: fiscalYear.id,
      month: m,
      clientId,
      year,
      revenue,
      foodCost,
      laborCost,
      otherCosts,
      margin,
      transactionCount: Math.round(revenue / 23),
      coverCount: Math.round(revenue / 22),
    });
  }
  await prisma.yearlySummary.createMany({ data: yearRows });
  await prisma.fiscalYear.update({
    where: { id: fiscalYear.id },
    data: {
      totalRevenue: round2(yearRevenue),
      totalCosts: round2(yearRows.reduce((acc, r) => acc + r.foodCost + r.laborCost + r.otherCosts, 0)),
      totalMargin: round2(yearRows.reduce((acc, r) => acc + r.margin, 0)),
    },
  });

  const budgetRows = [];
  for (let m = 1; m <= 12; m++) {
    const seasonal = 1 + Math.sin((m / 12) * Math.PI * 2) * 0.12;
    budgetRows.push({
      year,
      month: m,
      revenueTarget: round2(42000 * seasonal),
      foodCostPct: 32,
      laborCostPct: 29,
      otherCostPct: 12,
      coverTarget: Math.round((42000 * seasonal) / 22),
      avgTicketTarget: 22,
      clientId,
    });
  }
  await prisma.budgetTarget.createMany({ data: budgetRows });
  console.log(`✓ Anno fiscale ${year} con 12 mesi e budget`);

  await prisma.posConfig.create({
    data: {
      name: "Cassa Sala 1",
      type: "Scontrino elettronico",
      apiEndpoint: "http://127.0.0.1:9000/api",
      apiKey: null,
      isActive: true,
      lastSync: daysAgo(0),
      clientId,
    },
  });

  await prisma.clientAuditLog.create({
    data: {
      clientId,
      actorUserId: user.id,
      action: "seed_demo",
      entity: "Client",
      entityId: client.id,
      source: "datafood_admin",
      detailsJson: JSON.stringify({ note: "Popolamento dati demo" }),
    },
  });

  console.log("\n✔ Seed demo completato.");
  console.log(`   Login: ${CREDENTIALS.email} / ${CREDENTIALS.password}`);
}

main()
  .catch(error => {
    console.error("Seed fallito:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
