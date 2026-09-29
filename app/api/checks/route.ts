import { NextResponse, type NextRequest } from "next/server";
import { listChecks, monthTotalUsd, PAGE_SIZE } from "@/lib/db";
import { serverError } from "@/lib/http";
import { normalizeImei } from "@/lib/imei";
import type { Verdict } from "@/lib/types";

export const dynamic = "force-dynamic";

const VERDICTS: Verdict[] = ["verde", "amarillo", "rojo"];

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Math.floor(Number(params.get("page")) || 1));
  const pageSize = Math.min(PAGE_SIZE, Math.max(1, Math.floor(Number(params.get("pageSize")) || PAGE_SIZE)));
  const verdictParam = params.get("verdict") as Verdict | null;
  const verdict = verdictParam && VERDICTS.includes(verdictParam) ? verdictParam : undefined;
  const q = params.get("q")?.trim() || undefined;
  // `imei` exacto: lo usa la página Chequear para avisar si ya se revisó este equipo.
  const imei = params.get("imei") ? normalizeImei(params.get("imei")!) : undefined;

  try {
    const [list, monthTotal] = await Promise.all([
      listChecks({ page, pageSize, q, verdict, imei, onlyUsable: !!imei }),
      imei ? Promise.resolve(null) : monthTotalUsd(),
    ]);
    return NextResponse.json({ ...list, page, pageSize, monthTotalUsd: monthTotal });
  } catch (err) {
    return serverError("checks", err);
  }
}
