import "server-only";
import type { ProviderErrorKind } from "./errors";

// Cliente de imeicheck.com. La API key va como parámetro `?key=` en la URL, por eso:
// - este módulo solo se usa en el servidor,
// - nunca se loguea la URL,
// - las respuestas crudas se limpian de la key antes de guardarlas.

const DEFAULT_BASE_URL = "https://alpha.imeicheck.com/api/php-api";
export const PROVIDER_TIMEOUT_MS = 55_000;

export type ProviderResult =
  | {
      ok: true;
      orderId: number;
      price: number;
      resultHtml: string;
      object: Record<string, unknown> | null;
      durationMs: number;
      raw: unknown;
    }
  | { ok: false; kind: ProviderErrorKind; message: string; raw: unknown };

type CallResult = { ok: true; json: Record<string, unknown> } | { ok: false; kind: ProviderErrorKind; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Quita cualquier rastro de la key (propiedades `key` y strings que la contengan). */
export function redactKey(value: unknown, key: string | undefined): unknown {
  if (typeof value === "string") return key && value.includes(key) ? value.split(key).join("[redacted]") : value;
  if (Array.isArray(value)) return value.map((v) => redactKey(v, key));
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (/^(api)?key$/i.test(k)) continue;
      out[k] = redactKey(v, key);
    }
    return out;
  }
  return value;
}

async function call(path: string, params: Record<string, string>, timeoutMs: number): Promise<CallResult> {
  const key = process.env.IMEICHECK_API_KEY;
  if (!key) return { ok: false, kind: "error", message: "Missing ApiKey (IMEICHECK_API_KEY)" };
  const base = (process.env.IMEICHECK_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");

  const url = new URL(`${base}/${path}`);
  url.searchParams.set("key", key);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  } catch (err) {
    // No se incluye err.message: algunos errores de red podrían contener la URL.
    const name = err instanceof Error ? err.name : "";
    return { ok: false, kind: "network", message: name === "TimeoutError" ? "Timeout" : "Network error" };
  }

  const text = await res.text().catch(() => "");
  try {
    const json: unknown = JSON.parse(text);
    if (isRecord(json)) return { ok: true, json };
  } catch {
    // cae abajo
  }
  return { ok: false, kind: "error", message: `Respuesta inesperada del proveedor (HTTP ${res.status})` };
}

export async function createOrder(
  service: number,
  imei: string,
  timeoutMs = PROVIDER_TIMEOUT_MS,
): Promise<ProviderResult> {
  const started = Date.now();
  const r = await call("create", { service: String(service), imei }, timeoutMs);
  if (!r.ok) return { ok: false, kind: r.kind, message: r.message, raw: null };

  const raw = redactKey(r.json, process.env.IMEICHECK_API_KEY);
  const j = r.json;
  const status = String(j.status ?? "").toLowerCase();

  if (status === "success") {
    const price = parseFloat(String(j.price ?? "0"));
    return {
      ok: true,
      orderId: Number(j.orderId),
      price: Number.isFinite(price) ? price : 0,
      resultHtml: typeof j.result === "string" ? j.result : "",
      object: isRecord(j.object) ? j.object : null,
      durationMs: Date.now() - started,
      raw,
    };
  }

  const message = String(j.response ?? j.message ?? `Estado desconocido: ${status || "sin estado"}`);
  return { ok: false, kind: status === "failed" ? "failed" : "error", message, raw };
}

export type OrderResult =
  | {
      ok: true;
      orderId: number;
      serviceName: string;
      imei: string;
      status: string;
      price: number;
      resultHtml: string;
      createdAt: string; // ISO en UTC
      raw: unknown;
    }
  | { ok: false; kind: ProviderErrorKind; message: string; raw: unknown };

/**
 * Consulta una orden ya pagada (`/history`, no cobra). Usa otros nombres que `/create`:
 * `order_id`, `credit`, `status` en mayúsculas, y no trae `object`.
 */
export async function getOrder(orderId: number): Promise<OrderResult> {
  const r = await call("history", { orderId: String(orderId) }, 20_000);
  if (!r.ok) return { ok: false, kind: r.kind, message: r.message, raw: null };

  const raw = redactKey(r.json, process.env.IMEICHECK_API_KEY);
  const j = r.json;
  if (String(j.status ?? "").toLowerCase() === "error" || j.order_id === undefined) {
    return { ok: false, kind: "error", message: String(j.response ?? "Orden no encontrada"), raw };
  }

  const price = parseFloat(String(j.credit ?? "0"));
  // El proveedor entrega "2026-09-29 19:01:57" en UTC.
  const created = String(j.created_at ?? "").replace(" ", "T");
  return {
    ok: true,
    orderId: Number(j.order_id),
    serviceName: String(j.service_name ?? ""),
    imei: String(j.imei ?? ""),
    status: String(j.status ?? ""),
    price: Number.isFinite(price) ? price : 0,
    resultHtml: typeof j.result === "string" ? j.result : "",
    createdAt: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(created) ? `${created}Z` : new Date().toISOString(),
    raw,
  };
}

export type BalanceResult = { ok: true; balance: number } | { ok: false; kind: ProviderErrorKind; message: string };

export async function getBalance(): Promise<BalanceResult> {
  const r = await call("balance", {}, 15_000);
  if (!r.ok) return r;
  const balance = parseFloat(String(r.json.balance));
  if (Number.isFinite(balance)) return { ok: true, balance };
  return { ok: false, kind: "error", message: String(r.json.response ?? "Saldo no disponible") };
}
