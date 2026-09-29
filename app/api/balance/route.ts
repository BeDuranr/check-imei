import { NextResponse, type NextRequest } from "next/server";
import { userMessage } from "@/lib/errors";
import { getBalance } from "@/lib/imeicheck";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const CACHE_MS = 60_000;
let cache: { balance: number; at: number } | null = null;

export async function GET(req: NextRequest) {
  // `?fresh=1` se usa después de una consulta pagada para ver el saldo actualizado.
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json({ balance: cache.balance, cached: true });
  }

  const r = await getBalance();
  if (!r.ok) {
    console.error("[balance]", r.kind, r.message);
    return jsonError(userMessage(r.kind, r.message), 502);
  }
  cache = { balance: r.balance, at: Date.now() };
  return NextResponse.json({ balance: r.balance, cached: false });
}
