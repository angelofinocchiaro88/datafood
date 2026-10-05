import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { createUserSession, hashPassword, setSessionCookie } from "@/lib/auth";

function secureEquals(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const bootstrapSecret = process.env.DATAFOOD_BOOTSTRAP_TOKEN;
  if (!bootstrapSecret) return NextResponse.json({ error: "Bootstrap non configurato" }, { status: 503 });
  const body = await request.json();
  if (typeof body.token !== "string" || !secureEquals(body.token, bootstrapSecret)) return NextResponse.json({ error: "Token di bootstrap non valido" }, { status: 401 });

  const email = String(body.email || "").trim().toLocaleLowerCase("it-IT");
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  if (!/^\S+@\S+\.\S+$/.test(email) || !name || password.length < 12) {
    return NextResponse.json({ error: "Inserisci nome, email valida e password di almeno 12 caratteri" }, { status: 400 });
  }
  let user;
  try {
    user = await prisma.$transaction(async tx => {
      if (await tx.user.count() !== 0) throw new Error("BOOTSTRAP_GIA_USATO");
      return tx.user.create({ data: { email, name, passwordHash: await hashPassword(password), platformRole: "datafood_admin" } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Error && error.message === "BOOTSTRAP_GIA_USATO") return NextResponse.json({ error: "Il bootstrap è già stato usato" }, { status: 409 });
    return NextResponse.json({ error: "Creazione amministratore iniziale non riuscita" }, { status: 500 });
  }
  const session = await createUserSession(user.id);
  const response = NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name, platformRole: user.platformRole } }, { status: 201 });
  setSessionCookie(response, session.token, session.expiresAt);
  return response;
}
