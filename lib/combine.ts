// Une los chequeos de un mismo IMEI (descarte + procedencia) en una sola vista y agrupa el
// historial por IMEI. Lógica pura, usable en cliente y servidor.

import { classify } from "./classify";
import type { Level } from "./constants";
import type { Check, DeviceReport, Origin, Verdict } from "./types";

/** Procedencia primero (trae más datos), luego el más reciente. */
function byPriority(a: Check, b: Check): number {
  if (a.level !== b.level) return a.level === "procedencia" ? -1 : 1;
  return b.createdAt.localeCompare(a.createdAt);
}

/** Combina reportes: cada campo se toma del primer reporte que lo tenga. */
export function mergeReports(reports: DeviceReport[]): DeviceReport {
  const merged: DeviceReport = { raw: {} };
  const seen = new Set<string>();
  for (const report of reports) {
    for (const [key, value] of Object.entries(report) as [keyof DeviceReport, unknown][]) {
      if (key === "raw" || value === undefined || merged[key] !== undefined) continue;
      (merged as unknown as Record<string, unknown>)[key] = value;
    }
    for (const [key, value] of Object.entries(report.raw ?? {})) {
      const norm = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(norm)) continue;
      seen.add(norm);
      merged.raw[key] = value;
    }
  }
  return merged;
}

/** El último chequeo con datos de cada nivel, procedencia primero. */
export function latestPerLevel(checks: Check[]): Check[] {
  const out: Check[] = [];
  for (const check of [...checks].filter((c) => c.report).sort(byPriority)) {
    if (!out.some((c) => c.level === check.level)) out.push(check);
  }
  return out;
}

/**
 * Une el último descarte y la última procedencia de un IMEI en un solo chequeo "virtual", con
 * el veredicto recalculado sobre los datos combinados. Si hay uno solo, lo devuelve tal cual.
 */
export function combineChecks(checks: Check[]): Check | null {
  const parts = latestPerLevel(checks);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];

  const report = mergeReports(parts.map((c) => c.report!));
  const level: Level = parts.some((c) => c.level === "procedencia") ? "procedencia" : "descarte";
  const issues = parts.flatMap((c) => c.issues);
  const { verdict, origin, reasons } = classify(report, { level, missingServices: issues.map((i) => i.name) });
  const main = parts[0];

  return {
    ...main,
    level,
    status: parts.some((c) => c.status === "partial") ? "partial" : "success",
    model: report.model ?? main.model,
    orderIds: parts.flatMap((c) => c.orderIds),
    services: parts.flatMap((c) => c.services),
    costUsd: Math.round(parts.reduce((sum, c) => sum + c.costUsd, 0) * 100) / 100,
    report,
    verdict,
    origin,
    reasons,
    issues,
    createdAt: parts.reduce((latest, c) => (c.createdAt > latest ? c.createdAt : latest), main.createdAt),
  };
}

/** Una fila del historial: todos los chequeos de un IMEI. */
export interface CheckGroup {
  imei: string;
  model: string | null;
  verdict: Verdict | null;
  origin: Origin | null;
  levels: Level[];
  count: number;
  totalCostUsd: number;
  lastAt: string;
  /** Chequeo que se abre al hacer clic (el más reciente con datos, o el más reciente). */
  openId: string;
  partial: boolean;
}

/** Agrupa chequeos por IMEI, del más reciente al más antiguo. */
export function groupChecks(checks: Check[]): CheckGroup[] {
  const byImei = new Map<string, Check[]>();
  for (const check of checks) byImei.set(check.imei, [...(byImei.get(check.imei) ?? []), check]);

  const groups: CheckGroup[] = [];
  for (const [imei, list] of byImei) {
    const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const combined = combineChecks(sorted);
    const usable = sorted.filter((c) => c.report);
    groups.push({
      imei,
      model: combined?.model ?? sorted.find((c) => c.model)?.model ?? null,
      verdict: combined?.verdict ?? null,
      origin: combined?.origin ?? null,
      levels: (["descarte", "procedencia"] as Level[]).filter((l) => usable.some((c) => c.level === l)),
      count: sorted.length,
      totalCostUsd: Math.round(sorted.reduce((sum, c) => sum + c.costUsd, 0) * 100) / 100,
      lastAt: sorted[0].createdAt,
      openId: (usable[0] ?? sorted[0]).id,
      partial: combined?.status === "partial",
    });
  }
  return groups.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}
