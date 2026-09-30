import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { groupChecks } from "./combine";
import { CACHE_DAYS, LEVEL_SERVICES, SERVICES, type Level } from "./constants";
import { userMessage } from "./errors";
import type { RunResult, ServiceEntry } from "./run-check";
import type { Check, CheckStatus, CheckSummary, Decision, Device, DeviceReport, Origin, Verdict } from "./types";

/** Un `pending` más viejo que esto se considera abandonado (la función murió o se cortó). */
const STALE_PENDING_MS = 2 * 60_000;
export const PAGE_SIZE = 20;

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

interface CheckRow {
  id: string;
  imei: string;
  level: Level;
  status: CheckStatus;
  model: string | null;
  order_ids: number[] | null;
  services: number[] | null;
  cost_usd: number | string | null;
  raw_responses: ServiceEntry[] | null;
  report: DeviceReport | null;
  verdict: Verdict | null;
  origin: Origin | null;
  reasons: string[] | null;
  error_message: string | null;
  created_at: string;
}

interface DeviceRow {
  imei: string;
  model: string | null;
  purchase_price_clp: number | null;
  decision: Decision;
  notes: string | null;
  updated_at: string | null;
}

const SUMMARY_COLUMNS = "id, imei, level, status, model, verdict, origin, cost_usd, created_at";

function issuesFor(row: CheckRow): Check["issues"] {
  if (row.status === "success" || row.status === "pending") return [];
  const entries = row.raw_responses ?? [];
  return LEVEL_SERVICES[row.level]
    .filter((service) => !entries.some((e) => e.service === service && e.ok))
    .map((service) => {
      const entry = entries.find((e) => e.service === service);
      return {
        service,
        name: SERVICES[service]?.name ?? `Servicio ${service}`,
        message: entry
          ? userMessage(entry.kind ?? "error", entry.message ?? "")
          : "No se ejecutó porque falló un servicio anterior.",
      };
    });
}

function toCheck(row: CheckRow): Check {
  return {
    id: row.id,
    imei: row.imei,
    level: row.level,
    status: row.status,
    model: row.model,
    orderIds: row.order_ids ?? [],
    services: row.services ?? [],
    costUsd: Number(row.cost_usd ?? 0),
    report: row.report,
    verdict: row.verdict,
    origin: row.origin,
    reasons: row.reasons ?? [],
    issues: issuesFor(row),
    createdAt: row.created_at,
  };
}

function toSummary(row: Pick<CheckRow, "id" | "imei" | "level" | "status" | "model" | "verdict" | "origin" | "cost_usd" | "created_at">): CheckSummary {
  return {
    id: row.id,
    imei: row.imei,
    level: row.level,
    status: row.status,
    model: row.model,
    verdict: row.verdict,
    origin: row.origin,
    costUsd: Number(row.cost_usd ?? 0),
    createdAt: row.created_at,
  };
}

function toDevice(row: DeviceRow): Device {
  return {
    imei: row.imei,
    model: row.model,
    purchasePriceClp: row.purchase_price_clp,
    decision: row.decision,
    notes: row.notes ?? "",
    updatedAt: row.updated_at,
  };
}

export async function findRecentSuccess(imei: string, level: Level): Promise<Check | null> {
  const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();
  const { data, error } = await db()
    .from("checks")
    .select("*")
    .eq("imei", imei)
    .eq("level", level)
    .eq("status", "success")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<CheckRow>();
  if (error) throw error;
  return data ? toCheck(data) : null;
}

/** Marca como fallidos los `pending` abandonados para que no bloqueen nuevas consultas. */
export async function expireStalePending(imei: string, level: Level): Promise<void> {
  const before = new Date(Date.now() - STALE_PENDING_MS).toISOString();
  const { error } = await db()
    .from("checks")
    .update({ status: "failed", error_message: "Abandoned: pending timeout" })
    .eq("imei", imei)
    .eq("level", level)
    .eq("status", "pending")
    .lt("created_at", before);
  if (error) throw error;
}

/** Crea el registro `pending`. Devuelve null si ya hay una consulta en curso (índice único). */
export async function insertPending(imei: string, level: Level): Promise<string | null> {
  const { data, error } = await db()
    .from("checks")
    .insert({ imei, level, status: "pending", services: LEVEL_SERVICES[level] })
    .select("id")
    .single<{ id: string }>();
  if (error) {
    if (error.code === "23505") return null;
    throw error;
  }
  return data.id;
}

function resultColumns(result: RunResult) {
  return {
    status: result.status,
    model: result.report?.model ?? null,
    order_ids: result.orderIds,
    cost_usd: result.costUsd,
    raw_responses: result.entries,
    report: result.report,
    verdict: result.classification?.verdict ?? null,
    origin: result.classification?.origin ?? null,
    reasons: result.classification?.reasons ?? [],
    error_message: result.errorMessage,
  };
}

export async function finishCheck(id: string, result: RunResult): Promise<Check> {
  const { data, error } = await db()
    .from("checks")
    .update(resultColumns(result))
    .eq("id", id)
    .select("*")
    .single<CheckRow>();
  if (error) throw error;
  return toCheck(data);
}

/** Busca un chequeo que ya incluya esa orden del proveedor (para no importarla dos veces). */
export async function findCheckIdByOrderId(orderId: number): Promise<string | null> {
  const { data, error } = await db()
    .from("checks")
    .select("id")
    .contains("order_ids", [orderId])
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return data?.id ?? null;
}

/** Guarda un chequeo ya terminado (orden importada), con la fecha real de la orden. */
export async function insertCompletedCheck(imei: string, level: Level, createdAt: string, result: RunResult): Promise<Check> {
  const { data, error } = await db()
    .from("checks")
    .insert({ imei, level, services: LEVEL_SERVICES[level], created_at: createdAt, ...resultColumns(result) })
    .select("*")
    .single<CheckRow>();
  if (error) throw error;
  return toCheck(data);
}

export async function failCheck(id: string, message: string): Promise<void> {
  await db().from("checks").update({ status: "failed", error_message: message }).eq("id", id);
}

/** Crea el equipo en seguimiento o actualiza su modelo, sin tocar decisión, precio ni notas. */
export async function upsertDeviceModel(imei: string, model: string | null): Promise<void> {
  const { data: existing, error } = await db().from("devices").select("imei").eq("imei", imei).maybeSingle();
  if (error) throw error;
  if (existing) {
    if (!model) return;
    const { error: e } = await db()
      .from("devices")
      .update({ model, updated_at: new Date().toISOString() })
      .eq("imei", imei);
    if (e) throw e;
  } else {
    const { error: e } = await db().from("devices").insert({ imei, model });
    if (e && e.code !== "23505") throw e;
  }
}

export interface ListParams {
  page: number;
  pageSize?: number;
  q?: string;
  verdict?: Verdict;
  imei?: string;
  onlyUsable?: boolean;
}

export async function listChecks({ page, pageSize = PAGE_SIZE, q, verdict, imei, onlyUsable }: ListParams) {
  let query = db()
    .from("checks")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .neq("status", "pending")
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (imei) query = query.eq("imei", imei);
  if (verdict) query = query.eq("verdict", verdict);
  if (onlyUsable) query = query.in("status", ["success", "partial"]);
  if (q) {
    // Solo letras, números, espacios y guiones: evita inyectar sintaxis de filtros de PostgREST.
    const safe = q.replace(/[^\p{L}\p{N} \-]/gu, "").trim().slice(0, 60);
    if (safe) query = query.or(`imei.ilike."*${safe}*",model.ilike."*${safe}*"`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { items: (data ?? []).map((row) => toSummary(row as CheckRow)), total: count ?? 0 };
}

/** Máximo de chequeos que se leen para agrupar el historial (un solo usuario, volumen bajo). */
const GROUP_SCAN_LIMIT = 2000;

export interface GroupParams {
  page: number;
  pageSize?: number;
  q?: string;
  verdict?: Verdict;
}

/** Historial agrupado por IMEI, con el veredicto de los datos combinados. */
export async function listCheckGroups({ page, pageSize = PAGE_SIZE, q, verdict }: GroupParams) {
  const { data, error } = await db()
    .from("checks")
    .select("*")
    .neq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(GROUP_SCAN_LIMIT);
  if (error) throw error;

  const needle = q?.trim().toLowerCase();
  const groups = groupChecks((data ?? []).map((row) => toCheck(row as CheckRow))).filter(
    (g) =>
      (!verdict || g.verdict === verdict) &&
      (!needle || g.imei.includes(needle) || (g.model ?? "").toLowerCase().includes(needle)),
  );
  return { groups: groups.slice((page - 1) * pageSize, page * pageSize), total: groups.length };
}

/** Inicio del mes actual en hora de Chile, como instante UTC. */
function startOfMonthChile(now = new Date()): Date {
  const tz = "America/Santiago";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const guess = new Date(`${y}-${m}-01T00:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")!
    .value.replace("GMT", "");
  return new Date(`${y}-${m}-01T00:00:00${offset || "Z"}`);
}

export async function monthTotalUsd(): Promise<number> {
  const { data, error } = await db()
    .from("checks")
    .select("cost_usd")
    .gte("created_at", startOfMonthChile().toISOString());
  if (error) throw error;
  const total = (data ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
  return Math.round(total * 100) / 100;
}

export interface CheckWithRelated {
  check: Check;
  device: Device | null;
  /** Todos los chequeos terminados del mismo IMEI (incluido este), del más reciente al más antiguo. */
  related: Check[];
}

export async function getCheck(id: string): Promise<CheckWithRelated | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db().from("checks").select("*").eq("id", id).maybeSingle<CheckRow>();
  if (error) throw error;
  if (!data) return null;
  const { data: device, error: e } = await db()
    .from("devices")
    .select("*")
    .eq("imei", data.imei)
    .maybeSingle<DeviceRow>();
  if (e) throw e;
  const { data: related, error: e2 } = await db()
    .from("checks")
    .select("*")
    .eq("imei", data.imei)
    .neq("status", "pending")
    .order("created_at", { ascending: false });
  if (e2) throw e2;
  return {
    check: toCheck(data),
    device: device ? toDevice(device) : null,
    related: (related ?? []).map((row) => toCheck(row as CheckRow)),
  };
}

export interface DevicePatch {
  notes?: string;
  purchasePriceClp?: number | null;
  decision?: Decision;
}

export async function updateDevice(imei: string, model: string | null, patch: DevicePatch): Promise<Device> {
  const row: Partial<DeviceRow> & { imei: string } = { imei, updated_at: new Date().toISOString() };
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.purchasePriceClp !== undefined) row.purchase_price_clp = patch.purchasePriceClp;
  if (patch.decision !== undefined) row.decision = patch.decision;

  const { data: existing } = await db().from("devices").select("model").eq("imei", imei).maybeSingle();
  if (!existing?.model && model) row.model = model;

  const { data, error } = await db().from("devices").upsert(row, { onConflict: "imei" }).select("*").single<DeviceRow>();
  if (error) throw error;
  return toDevice(data);
}
