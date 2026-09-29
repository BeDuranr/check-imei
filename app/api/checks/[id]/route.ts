import { NextResponse, type NextRequest } from "next/server";
import { getCheck, updateDevice, type DevicePatch } from "@/lib/db";
import { jsonError, serverError } from "@/lib/http";
import { DECISIONS, type Decision } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const found = await getCheck(id);
    if (!found) return jsonError("Chequeo no encontrado.", 404);
    return NextResponse.json(found);
  } catch (err) {
    return serverError("checks/[id] GET", err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Solicitud inválida.", 400);

  const patch: DevicePatch = {};
  if ("notes" in body) {
    if (typeof body.notes !== "string" || body.notes.length > 2000) return jsonError("Notas inválidas.", 400);
    patch.notes = body.notes;
  }
  if ("purchasePrice" in body) {
    const price = body.purchasePrice;
    if (price === null || price === "") patch.purchasePriceClp = null;
    else if (typeof price === "number" && Number.isInteger(price) && price >= 0 && price < 100_000_000) {
      patch.purchasePriceClp = price;
    } else return jsonError("El precio debe ser un número entero en pesos.", 400);
  }
  if ("decision" in body) {
    if (!DECISIONS.includes(body.decision as Decision)) return jsonError("Decisión inválida.", 400);
    patch.decision = body.decision as Decision;
  }

  try {
    const found = await getCheck(id);
    if (!found) return jsonError("Chequeo no encontrado.", 404);
    const device = await updateDevice(found.check.imei, found.check.model, patch);
    return NextResponse.json({ device });
  } catch (err) {
    return serverError("checks/[id] PATCH", err);
  }
}
