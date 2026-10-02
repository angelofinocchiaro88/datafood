import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const include = request.nextUrl.searchParams.get("include") || "";
  const orders = await prisma.order.findMany({
    include: {
      supplier: true,
      items: { include: { ingredient: true } },
    },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ orders });
}

export async function POST(request: NextRequest) {
  const { supplierId, items } = await request.json();
  const total = (items as any[]).reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const order = await prisma.order.create({
    data: {
      supplierId,
      total,
      status: "DRAFT",
      items: {
        create: items.map((i: any) => ({
          ingredientId: i.ingredientId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          received: 0,
        })),
      },
    },
    include: { supplier: true, items: { include: { ingredient: true } } },
  });

  return NextResponse.json(order);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, status, action } = body;
  if (!id) return NextResponse.json({ error: "ID ordine obbligatorio" }, { status: 400 });

  if (action === "RECEIVE_PARTIAL" || status === "RECEIVED") {
    const partialItems = body.receivedItems as { orderItemId: string; quantity: number }[] | undefined;
    if (action === "RECEIVE_PARTIAL" && (!Array.isArray(partialItems) || partialItems.length === 0)) {
      return NextResponse.json({ error: "Indica almeno una quantità ricevuta" }, { status: 400 });
    }

    try {
      const result = await prisma.$transaction(async tx => {
        // Blocca l'ordine durante la registrazione per serializzare arrivi concorrenti.
        const lock = await tx.order.updateMany({
          where: { id, status: { in: ["SENT", "PARTIAL"] } },
          data: { status: "RECEIVING" },
        });
        if (lock.count !== 1) {
          const current = await tx.order.findUnique({ where: { id }, select: { status: true } });
          if (!current) throw new Error("ORDINE_NON_TROVATO");
          if (current.status === "RECEIVED") return { status: "RECEIVED", alreadyReceived: true };
          throw new Error("ORDINE_NON_INVIATO");
        }

        const order = await tx.order.findUnique({
          where: { id },
          include: { items: true, supplier: true },
        });
        if (!order) throw new Error("ORDINE_NON_TROVATO");

        const receiptByItem = new Map<string, number>();
        if (action === "RECEIVE_PARTIAL") {
          for (const received of partialItems || []) {
            const quantity = Number(received.quantity);
            if (!received.orderItemId || !Number.isFinite(quantity) || quantity <= 0 || receiptByItem.has(received.orderItemId)) {
              throw new Error("QUANTITA_RICEVUTA_NON_VALIDA");
            }
            receiptByItem.set(received.orderItemId, quantity);
          }
        } else {
          for (const item of order.items) {
            const remaining = Math.max(0, item.quantity - item.received);
            if (remaining > 0) receiptByItem.set(item.id, remaining);
          }
        }

        const receipts = [];
        for (const [orderItemId, quantity] of receiptByItem) {
          const item = order.items.find(row => row.id === orderItemId);
          if (!item || quantity > item.quantity - item.received + 1e-8) throw new Error("QUANTITA_SUPERIORE_ORDINATO");
          receipts.push({ item, quantity });
        }
        if (receipts.length === 0) throw new Error("NESSUNA_QUANTITA_DA_RICEVERE");

        const receivedAt = new Date();
        for (const { item, quantity } of receipts) {
          const update = await tx.orderItem.updateMany({
            where: { id: item.id, received: { lte: item.quantity - quantity + 1e-8 } },
            data: { received: { increment: quantity } },
          });
          if (update.count !== 1) throw new Error("RICEZIONE_MODIFICATA_CONCORRENTEMENTE");
          await tx.ingredient.update({ where: { id: item.ingredientId }, data: { currentStock: { increment: quantity } } });
          await tx.movement.create({
            data: {
              ingredientId: item.ingredientId,
              type: "IN",
              quantity,
              reference: `Ordine #${order.id.slice(-4)} · ricezione ${receivedAt.toLocaleDateString("it-IT")}`,
              date: receivedAt,
            },
          });
        }

        const receivedTotals = new Map(receipts.map(({ item, quantity }) => [item.id, item.received + quantity]));
        const complete = order.items.every(item => (receivedTotals.get(item.id) ?? item.received) >= item.quantity - 1e-8);
        const newStatus = complete ? "RECEIVED" : "PARTIAL";
        await tx.order.update({ where: { id }, data: { status: newStatus } });

        return { status: newStatus, alreadyReceived: false };
      });

      if (result.alreadyReceived) return NextResponse.json({ success: true, status: result.status, message: "Ordine già ricevuto; nessun movimento duplicato creato" });
      return NextResponse.json({
        success: true,
        status: result.status,
        message: result.status === "RECEIVED"
          ? "Ricezione completata: magazzino aggiornato. Registra o collega la fattura reale in Accounting."
          : "Ricezione parziale registrata: quantità e magazzino aggiornati",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "ERRORE_RICEZIONE";
      const statusCode = message === "ORDINE_NON_TROVATO" ? 404 : message === "ORDINE_NON_INVIATO" ? 409 : 400;
      const errors: Record<string, string> = {
        ORDINE_NON_TROVATO: "Ordine non trovato",
        ORDINE_NON_INVIATO: "Puoi registrare una ricezione solo per un ordine inviato",
        QUANTITA_RICEVUTA_NON_VALIDA: "Una o più quantità ricevute non sono valide",
        QUANTITA_SUPERIORE_ORDINATO: "La quantità ricevuta supera quella ancora da consegnare",
        NESSUNA_QUANTITA_DA_RICEVERE: "Non ci sono quantità da registrare",
        RICEZIONE_MODIFICATA_CONCORRENTEMENTE: "Ordine aggiornato da un'altra operazione; ricarica i dati e riprova",
      };
      return NextResponse.json({ error: errors[message] || "Impossibile registrare la ricezione" }, { status: statusCode });
    }
  }

  if (status !== "SENT") return NextResponse.json({ error: "Stato ordine non valido" }, { status: 400 });
  const order = await prisma.order.update({ where: { id }, data: { status } });
  return NextResponse.json(order);
}
