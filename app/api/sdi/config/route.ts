import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const config = await prisma.sdiConfig.findFirst({ where: { active: true } });
    
    if (!config) {
      return NextResponse.json({ configured: false });
    }

    return NextResponse.json({
      configured: true,
      recipientCode: config.recipientCode,
      pecAddress: config.pecAddress,
      pushEnabled: !!config.pushUrl,
      lastFetch: config.lastFetch,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch SDI config" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { recipientCode, pecAddress, pushUrl } = await request.json();

    if (!recipientCode || !pecAddress) {
      return NextResponse.json(
        { error: "Codice destinatario e PEC sono obbligatori" },
        { status: 400 }
      );
    }

    const existingConfig = await prisma.sdiConfig.findFirst();

    let config;
    if (existingConfig) {
      config = await prisma.sdiConfig.update({
        where: { id: existingConfig.id },
        data: {
          recipientCode,
          pecAddress,
          pushUrl: pushUrl || null,
          active: true,
        },
      });
    } else {
      config = await prisma.sdiConfig.create({
        data: {
          recipientCode,
          pecAddress,
          pushUrl: pushUrl || null,
          active: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      config: {
        recipientCode: config.recipientCode,
        pecAddress: config.pecAddress,
        pushEnabled: !!config.pushUrl,
      },
    });
  } catch (error) {
    console.error("SDI config error:", error);
    return NextResponse.json({ error: "Failed to save SDI config" }, { status: 500 });
  }
}