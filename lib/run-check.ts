import { classify } from "./classify";
import { LEVEL_SERVICES, SERVICES, type Level } from "./constants";
import type { ProviderErrorKind } from "./errors";
import type { ProviderResult } from "./imeicheck";
import { buildReport } from "./parse-result";
import type { CheckStatus, Classification, DeviceReport } from "./types";

/** Espera entre servicios: el proveedor rechaza el mismo IMEI dos veces en menos de 2 s. */
export const SERVICE_GAP_MS = 2_500;
/** Presupuesto total para no pasarse de `maxDuration = 60` en Vercel. */
export const TIME_BUDGET_MS = 57_000;
const MAX_CALL_MS = 55_000;
const MIN_CALL_MS = 5_000;

/** Lo que se guarda en `raw_responses` por cada servicio. */
export interface ServiceEntry {
  service: number;
  ok: boolean;
  kind?: ProviderErrorKind;
  message?: string;
  orderId?: number;
  price?: number;
  durationMs?: number;
  raw: unknown;
}

export interface RunResult {
  status: Exclude<CheckStatus, "pending">;
  entries: ServiceEntry[];
  orderIds: number[];
  costUsd: number;
  report: DeviceReport | null;
  classification: Classification | null;
  /** Primer error real del proveedor (se guarda en la base de datos, no se muestra). */
  errorMessage: string | null;
  firstError: { kind: ProviderErrorKind; message: string } | null;
}

export interface RunDeps {
  createOrder: (service: number, imei: string, timeoutMs: number) => Promise<ProviderResult>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runServices(level: Level, imei: string, deps: RunDeps): Promise<RunResult> {
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  const services = LEVEL_SERVICES[level];
  const started = now();
  const entries: ServiceEntry[] = [];
  const successes: { html: string; object: Record<string, unknown> | null }[] = [];

  for (let i = 0; i < services.length; i++) {
    const service = services[i];
    if (i > 0) await sleep(SERVICE_GAP_MS);

    const remaining = TIME_BUDGET_MS - (now() - started);
    if (remaining < MIN_CALL_MS) {
      entries.push({ service, ok: false, kind: "network", message: "Skipped: time budget exceeded", raw: null });
      break;
    }

    const r = await deps.createOrder(service, imei, Math.min(MAX_CALL_MS, remaining - 1_000));
    if (r.ok) {
      entries.push({
        service,
        ok: true,
        orderId: r.orderId,
        price: r.price,
        durationMs: r.durationMs,
        raw: r.raw,
      });
      successes.push({ html: r.resultHtml, object: r.object });
    } else {
      entries.push({ service, ok: false, kind: r.kind, message: r.message, raw: r.raw });
      // Un IMEI inválido, key mala o falta de saldo se repetiría en los siguientes: no seguir.
      if (r.kind !== "network") break;
    }
  }

  const ok = entries.filter((e) => e.ok);
  const status: RunResult["status"] =
    ok.length === services.length ? "success" : ok.length > 0 ? "partial" : "failed";
  const failure = entries.find((e) => !e.ok);

  let report: DeviceReport | null = null;
  let classification: Classification | null = null;
  if (ok.length > 0) {
    report = buildReport(successes);
    const okServices = new Set(ok.map((e) => e.service));
    const missingServices = services.filter((s) => !okServices.has(s)).map((s) => SERVICES[s].name);
    classification = classify(report, { level, missingServices });
  }

  return {
    status,
    entries,
    orderIds: ok.map((e) => e.orderId!).filter((id) => Number.isFinite(id)),
    costUsd: Math.round(ok.reduce((sum, e) => sum + (e.price ?? 0), 0) * 100) / 100,
    report,
    classification,
    errorMessage: failure?.message ?? null,
    firstError: failure ? { kind: failure.kind ?? "error", message: failure.message ?? "" } : null,
  };
}
