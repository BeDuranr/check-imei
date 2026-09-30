// Selecciona y traduce solo los datos importantes de un chequeo para la imagen exportable.
// Lógica pura (sin canvas) para poder testearla.

import { formatDate, formatProviderDate } from "./format";
import type { Check, Verdict } from "./types";

export type ExportTone = "ok" | "warn" | "bad";

export interface ExportRow {
  label: string;
  value: string;
  tone?: ExportTone;
}

export interface ExportSection {
  title: string;
  rows: ExportRow[];
}

export interface ExportData {
  model: string;
  verdict: Verdict | null;
  sections: ExportSection[];
  footer: string;
}

/** Descarta valores vacíos o de relleno como "..." o "-". */
function present(value: string | undefined | null): value is string {
  return !!value && !/^[.\-\s]*$/.test(value);
}

function rawValue(raw: Record<string, string>, ...keys: string[]): string | undefined {
  const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");
  const wanted = keys.map(norm);
  for (const key of wanted) {
    const found = Object.entries(raw).find(([k]) => norm(k) === key);
    if (found && present(found[1])) return found[1];
  }
  return undefined;
}

function capacity(configDescription: string | undefined): string | undefined {
  const m = configDescription?.match(/(\d+)\s*(GB|TB)\b/i);
  return m ? `${m[1]} ${m[2].toUpperCase()}` : undefined;
}

function warrantyLabel(status: string): string {
  if (/out of warranty|no coverage|expired/i.test(status)) return "Sin garantía (vencida)";
  if (/applecare/i.test(status)) return status;
  if (/limited warranty|in warranty/i.test(status)) return "Garantía limitada de Apple (vigente)";
  return status;
}

function onOff(value: "ON" | "OFF" | undefined, labels: [on: string, off: string], onTone: ExportTone) {
  if (!value) return undefined;
  return value === "ON" ? { value: labels[0], tone: onTone } : { value: labels[1], tone: "ok" as const };
}

export function buildExportData(check: Check): ExportData {
  const r = check.report ?? { raw: {} };
  const raw = r.raw ?? {};
  const rows = (items: (ExportRow | false | undefined)[]) =>
    items.filter((row): row is ExportRow => !!row && present(row.value));

  const equipo = rows([
    { label: "Capacidad", value: capacity(rawValue(raw, "Config Description")) ?? "" },
    { label: "IMEI", value: check.imei },
    { label: "IMEI 2", value: rawValue(raw, "IMEI2", "IMEI 2") ?? "" },
    { label: "N° de serie", value: r.serial ?? "" },
  ]);

  const compra = rows([
    { label: "Lugar de compra", value: r.soldBy ?? "" },
    { label: "País de compra", value: r.purchaseCountry ?? "", tone: r.purchaseCountry ? (/^chile$/i.test(r.purchaseCountry) ? "ok" : "warn") : undefined },
    { label: "Fecha de compra", value: r.purchaseDate ? formatProviderDate(r.purchaseDate) : "" },
    { label: "Primera activación", value: r.firstActivationDate ? formatProviderDate(r.firstActivationDate) : "" },
    { label: "Garantía", value: r.warrantyStatus ? warrantyLabel(r.warrantyStatus) : "" },
    !!r.activationPolicy && {
      label: "Liberado",
      value: /unlock/i.test(r.activationPolicy) ? "Sí" : r.activationPolicy,
      tone: /unlock/i.test(r.activationPolicy) ? "ok" : "warn",
    },
  ]);

  const fmi = onOff(r.fmi, ["Activado", "Desactivado"], "warn");
  const mdm = onOff(r.mdm, ["Sí", "No"], "bad");
  const isClean = (v: string) => /\bclean\b|not\s*blacklisted/i.test(v);
  const bloqueos = rows([
    fmi && { label: "Find My", ...fmi },
    mdm && { label: "Bloqueo MDM", ...mdm },
    !!r.blacklist && {
      label: "Blacklist",
      value: isClean(r.blacklist) ? "Limpio" : "Reportado",
      tone: isClean(r.blacklist) ? "ok" : "bad",
    },
    !!r.icloudStatus && {
      label: "iCloud",
      value: /lost|erased|stolen/i.test(r.icloudStatus) ? "Perdido / borrado" : /clean/i.test(r.icloudStatus) ? "Limpio" : r.icloudStatus,
      tone: /lost|erased|stolen/i.test(r.icloudStatus) ? "bad" : /clean/i.test(r.icloudStatus) ? "ok" : undefined,
    },
  ]);

  return {
    model: r.model ?? check.model ?? "iPhone",
    verdict: check.verdict,
    sections: [
      { title: "Equipo", rows: equipo },
      { title: "Compra", rows: compra },
      { title: "Bloqueos", rows: bloqueos },
    ].filter((s) => s.rows.length > 0),
    footer: `Revisado el ${formatDate(check.createdAt)}`,
  };
}
