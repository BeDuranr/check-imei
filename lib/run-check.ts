import { classify } from "./classify";
import {
  baseLevel,
  BLACKLIST_SERVICE,
  detectPlatform,
  PLATFORM_LEVEL_SERVICES,
  SERVICES,
  type Level,
  type Platform,
} from "./constants";
import type { ProviderErrorKind } from "./errors";
import type { ProviderResult } from "./imeicheck";
import { buildReport, type ReportSource } from "./parse-result";
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
  /** Marca y nivel con que se guarda el chequeo (en el modo automático, los detectados). */
  platform: Platform;
  level: Level;
  services: number[];
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

/** Estado de una ejecución: se comparte entre etapas para respetar la espera y el presupuesto de tiempo. */
interface Progress {
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  started: number;
  entries: ServiceEntry[];
  sources: ReportSource[];
}

function startProgress(deps: RunDeps): Progress {
  const now = deps.now ?? Date.now;
  return { sleep: deps.sleep ?? defaultSleep, now, started: now(), entries: [], sources: [] };
}

/** Ejecuta servicios en secuencia. Se detiene ante errores que se repetirían (IMEI inválido, key, saldo). */
async function execute(services: number[], imei: string, deps: RunDeps, progress: Progress): Promise<void> {
  for (const service of services) {
    if (progress.entries.length > 0) await progress.sleep(SERVICE_GAP_MS);

    const remaining = TIME_BUDGET_MS - (progress.now() - progress.started);
    if (remaining < MIN_CALL_MS) {
      progress.entries.push({ service, ok: false, kind: "network", message: "Skipped: time budget exceeded", raw: null });
      return;
    }

    const r = await deps.createOrder(service, imei, Math.min(MAX_CALL_MS, remaining - 1_000));
    if (r.ok) {
      progress.entries.push({
        service,
        ok: true,
        orderId: r.orderId,
        price: r.price,
        durationMs: r.durationMs,
        raw: r.raw,
      });
      progress.sources.push({ html: r.resultHtml, object: r.object });
    } else {
      progress.entries.push({ service, ok: false, kind: r.kind, message: r.message, raw: r.raw });
      // Un IMEI inválido, key mala o falta de saldo se repetiría en los siguientes: no seguir.
      if (r.kind !== "network") return;
    }
  }
}

function finish(platform: Platform, level: Level, services: number[], progress: Progress): RunResult {
  const { entries } = progress;
  const ok = entries.filter((e) => e.ok);
  const okServices = new Set(ok.map((e) => e.service));
  const status: RunResult["status"] =
    services.every((s) => okServices.has(s)) ? "success" : ok.length > 0 ? "partial" : "failed";
  const failure = entries.find((e) => !e.ok);

  let report: DeviceReport | null = null;
  let classification: Classification | null = null;
  if (ok.length > 0) {
    report = buildReport(progress.sources);
    const missingServices = services.filter((s) => !okServices.has(s)).map((s) => SERVICES[s].name);
    classification = classify(report, { level, platform, missingServices });
  }

  return {
    platform,
    level,
    services,
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

/** Ejecuta los servicios de una marca y nivel conocidos (p. ej. la procedencia de un iPhone). */
export async function runServices(
  level: Level,
  imei: string,
  deps: RunDeps,
  platform: Platform = "iphone",
): Promise<RunResult> {
  const services = PLATFORM_LEVEL_SERVICES[platform][level];
  const progress = startProgress(deps);
  await execute(services, imei, deps, progress);
  return finish(platform, level, services, progress);
}

/**
 * Chequeo con detección automática de marca: el blacklist (5) va primero y devuelve la marca;
 * después se corren los servicios básicos de esa marca. Cuesta lo mismo que elegirla a mano.
 */
export async function runAuto(imei: string, deps: RunDeps): Promise<RunResult> {
  const progress = startProgress(deps);
  await execute([BLACKLIST_SERVICE], imei, deps, progress);

  const blacklistOk = progress.entries[0]?.ok === true;
  const platform = detectPlatform(blacklistOk ? buildReport(progress.sources).brand : undefined);
  const level = baseLevel(platform);
  const services = PLATFORM_LEVEL_SERVICES[platform][level];

  if (blacklistOk) {
    await execute(
      services.filter((s) => s !== BLACKLIST_SERVICE),
      imei,
      deps,
      progress,
    );
  }
  return finish(platform, level, services, progress);
}
