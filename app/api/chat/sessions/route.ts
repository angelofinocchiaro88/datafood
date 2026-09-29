import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const userId = request.nextUrl.searchParams.get("userId") || "default";
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");

    if (sessionId) {
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: { messages: { orderBy: { createdAt: "asc" }, take: limit } },
      });
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      return NextResponse.json(session);
    }

    const sessions = await prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    return NextResponse.json(sessions);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId = "default", title } = await request.json();

    const session = await prisma.chatSession.create({
      data: {
        userId,
        title: title || "Nuova conversazione",
      },
    });

    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { sessionId, title } = await request.json();

    const session = await prisma.chatSession.update({
      where: { id: sessionId },
      data: { title },
    });

    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    await prisma.chatSession.delete({ where: { id: sessionId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}