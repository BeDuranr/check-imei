import { NextResponse, type NextRequest } from "next/server";
import { findCheckIdByOrderId, insertCompletedCheck, upsertDeviceModel } from "@/lib/db";
import { userMessage } from "@/lib/errors";
import { jsonError, serverError } from "@/lib/http";
import { getOrder } from "@/lib/imeicheck";
import { planImport } from "@/lib/import-order";

export const dynamic = "force-dynamic";

/** Importa al historial una orden ya pagada en imeicheck.com. Consultar `/history` no cobra. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { orderId?: unknown } | null;
  const text = String(body?.orderId ?? "").trim();
  const orderId = Number(text);
  // `order_ids` es integer[] en Postgres: un número más grande no puede ser una orden real.
  if (!/^\d{1,10}$/.test(text) || orderId < 1 || orderId > 2_147_483_647) {
    return jsonError("Ingresa un número de orden válido (solo dígitos).", 400);
  }

  try {
    const existing = await findCheckIdByOrderId(orderId);
    if (existing) return NextResponse.json({ id: existing, existing: true });

    const order = await getOrder(orderId);
    if (!order.ok) {
      console.error("[import] provider", { kind: order.kind, message: order.message });
      return jsonError(userMessage(order.kind, order.message), order.kind === "network" ? 502 : 400);
    }

    const plan = planImport(order);
    if (!plan.ok) return jsonError(plan.error, 400);

    const check = await insertCompletedCheck(plan.imei, plan.level, plan.createdAt, plan.result);
    await upsertDeviceModel(plan.imei, check.model).catch((err) => console.error("[import] upsert device", err));
    return NextResponse.json({ id: check.id, existing: false });
  } catch (err) {
    return serverError("import", err);
  }
}
