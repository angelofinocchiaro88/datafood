import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkOllama, getChatResponse, getRecommendedModel } from "@/lib/ollama";

async function getDbContext(message: string): Promise<string> {
  const lower = message.toLowerCase();
  const ctx: string[] = [];

  if (lower.includes("food cost") || lower.includes("costo") || lower.includes("margine")) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sales = await prisma.sale.aggregate({
      where: { date: { gte: monthStart } },
      _sum: { total: true },
      _count: true,
    });
    ctx.push(`Vendite mese: ${sales._count} transazioni, €${(sales._sum.total || 0).toFixed(2)}`);
  }

  if (lower.includes("menu") || lower.includes("piatto")) {
    const dishes = await prisma.dish.count();
    ctx.push(`Piatti nel menu: ${dishes}`);
  }

  if (lower.includes("magazzino") || lower.includes("ingredienti") || lower.includes("scorte")) {
    const ingredients = await prisma.ingredient.count();
    const lowStock = await prisma.ingredient.count({ where: { currentStock: { lte: prisma.ingredient.fields.minStock } } });
    ctx.push(`Ingredienti: ${ingredients}, Scorte basse: ${lowStock}`);
  }

  if (lower.includes("fornitori")) {
    const suppliers = await prisma.supplier.count();
    ctx.push(`Fornitori registrati: ${suppliers}`);
  }

  if (lower.includes("fatture") || lower.includes("sdi")) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const invoices = await prisma.invoice.count({ where: { invoiceDate: { gte: monthStart } } });
    ctx.push(`Fatture questo mese: ${invoices}`);
  }

  return ctx.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId, userId = "default", model: requestedModel } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ response: "Scrivi un messaggio." }, { status: 400 });
    }

    const ollamaStatus = await checkOllama();
    if (!ollamaStatus.running) {
      return NextResponse.json({
        response: "⚠️ **Ollama non rilevato!**\n\nPer usare la chat AI devi installare Ollama:\n\n1. Vai su https://ollama.com\n2. Scarica e installa Ollama\n3. Apri un terminale e scrivi: `ollama pull llama3.2`\n4. Riavvia questa chat\n\nDopo aver installato, puoi configurare il modello nelle Impostazioni.",
        sessionId,
      });
    }

    if (!ollamaStatus.models || ollamaStatus.models.length === 0) {
      return NextResponse.json({
        response: "⚠️ **Nessun modello trovato!**\n\nApri il terminale e scrivi:\n```\nollama pull llama3.2\n```\nPoi aggiorna la pagina.",
        sessionId,
      });
    }

    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const session = await prisma.chatSession.create({
        data: { userId, title: message.slice(0, 50) },
      });
      activeSessionId = session.id;
    } else {
      await prisma.chatSession.update({
        where: { id: activeSessionId },
        data: { updatedAt: new Date() },
      });
    }

    const history = await prisma.chatMessage.findMany({
      where: { sessionId: activeSessionId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    await prisma.chatMessage.create({
      data: { sessionId: activeSessionId, role: "user", content: message },
    });

    const model = requestedModel || getRecommendedModel(ollamaStatus.models);
    const dbContext = await getDbContext(message);

    const responseStream = await getChatResponse(
      model,
      message,
      history.map((m) => ({ role: m.role, content: m.content })),
      dbContext,
    );

    await prisma.chatMessage.create({
      data: {
        sessionId: activeSessionId,
        role: "assistant",
        content: responseStream,
      },
    });

    return NextResponse.json({
      response: responseStream,
      sessionId: activeSessionId,
      model,
      historyLength: history.length,
    });
  } catch (error) {
    console.error("AI Chat error:", error);
    return NextResponse.json({
      response: "⚠️ **Errore**: " + (error instanceof Error ? error.message : "Il server AI non risponde"),
    }, { status: 500 });
  }
}