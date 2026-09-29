import { NextResponse, type NextRequest } from "next/server";
import { checkPassword, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_S, verifySessionToken } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** ¿La cookie actual es válida? (la usa /login para saltarse el formulario). */
export async function GET(req: NextRequest) {
  return NextResponse.json({ authenticated: await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value) });
}

export async function POST(req: NextRequest) {
  if (!process.env.APP_PASSWORD) return jsonError("APP_PASSWORD no está configurada en el servidor.", 500);

  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  if (!(await checkPassword(body?.password))) {
    // Frena intentos de fuerza bruta.
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    return jsonError("Contraseña incorrecta.", 401);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  return res;
}
