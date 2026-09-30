// Convierte una orden ya pagada en imeicheck.com (consultada con /history) en un chequeo del
// historial. Lógica pura para poder testearla.

import { classify } from "./classify";
import type { OrderResult } from "./imeicheck";
import { validateImei } from "./imei";
import { buildReport } from "./parse-result";
import type { RunResult } from "./run-check";

/** `/history` no trae el ID del servicio, solo su nombre. */
export function serviceFromName(name: string): number | null {
  if (/apple ultimate|sold\s*\//i.test(name)) return 47;
  if (/icloud|clean\s*\/\s*lost/i.test(name)) return 4;
  if (/find my|\bfmi\b/i.test(name)) return 1;
  if (/blacklist|gsma/i.test(name)) return 5;
  return null;
}

export type ImportPlan =
  | { ok: true; imei: string; level: "procedencia"; createdAt: string; result: RunResult }
  | { ok: false; error: string };

export function planImport(order: Extract<OrderResult, { ok: true }>): ImportPlan {
  if (order.status.toUpperCase() !== "SUCCESS") {
    return { ok: false, error: "Esa orden no terminó con éxito en imeicheck.com, no hay resultado para importar." };
  }
  if (serviceFromName(order.serviceName) !== 47) {
    return {
      ok: false,
      error: `Solo se pueden importar órdenes de Procedencia completa (Apple Ultimate). Esta orden es de otro servicio: ${order.serviceName}.`,
    };
  }
  const imei = validateImei(order.imei);
  if (!imei.ok) return { ok: false, error: "La orden no tiene un IMEI válido." };

  const report = buildReport([{ html: order.resultHtml }]);
  const classification = classify(report, { level: "procedencia" });
  return {
    ok: true,
    imei: imei.imei,
    level: "procedencia",
    createdAt: order.createdAt,
    result: {
      status: "success",
      entries: [{ service: 47, ok: true, orderId: order.orderId, price: order.price, raw: order.raw }],
      orderIds: [order.orderId],
      costUsd: Math.round(order.price * 100) / 100,
      report,
      classification,
      errorMessage: null,
      firstError: null,
    },
  };
}
