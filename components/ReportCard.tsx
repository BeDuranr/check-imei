"use client";

import { useState } from "react";
import { LEVEL_LABEL } from "@/lib/constants";
import { formatDate, formatDateTime, formatUsd } from "@/lib/format";
import type { Check, DeviceReport, Origin } from "@/lib/types";
import { ReportTable } from "./ReportTable";
import { VERDICT_TITLE, VerdictBanner } from "./VerdictBanner";

const ORIGIN_LABEL: Record<Origin, string> = {
  retail: "Retail",
  compañia: "Compañía",
  desconocido: "Desconocido",
};

type Tone = "ok" | "warn" | "bad" | undefined;

function Field({ label, value, tone, strong }: { label: string; value?: string; tone?: Tone; strong?: boolean }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "";
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`truncate ${strong ? "font-semibold" : ""} ${color}`} title={value}>
        {value || <span className="text-muted">—</span>}
      </dd>
    </div>
  );
}

function onOffTone(value: string | undefined, onTone: Tone): Tone {
  return value === "ON" ? onTone : value === "OFF" ? "ok" : undefined;
}

function blacklistTone(value: string | undefined): Tone {
  if (!value) return undefined;
  return /clean|not\s*blacklisted/i.test(value) ? "ok" : "bad";
}

export function buildSummary(check: Check): string {
  const r: Partial<DeviceReport> = check.report ?? {};
  const lines = [
    `IMEI: ${check.imei}`,
    `Modelo: ${r.model ?? check.model ?? "—"}`,
    `Veredicto: ${check.verdict ? VERDICT_TITLE[check.verdict] : "Sin resultado"}`,
    ...check.reasons.map((reason) => `- ${reason}`),
  ];
  if (r.soldBy) lines.push(`Vendido por: ${r.soldBy}`);
  if (r.purchaseCountry) lines.push(`País de compra: ${r.purchaseCountry}`);
  if (r.purchaseDate) lines.push(`Fecha de compra: ${r.purchaseDate}`);
  lines.push(`Find My: ${r.fmi ?? "—"} | MDM: ${r.mdm ?? "—"} | Blacklist: ${r.blacklist ?? "—"}`);
  if (r.warrantyStatus) lines.push(`Garantía: ${r.warrantyStatus}`);
  lines.push(`Revisado: ${formatDateTime(check.createdAt)} (${LEVEL_LABEL[check.level].toLowerCase()})`);
  return lines.join("\n");
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

interface Props {
  check: Check;
  cached?: boolean;
  onProcedencia?: () => void;
  onRecheck?: () => void;
  busy?: boolean;
}

export function ReportCard({ check, cached, onProcedencia, onRecheck, busy }: Props) {
  const [copied, setCopied] = useState(false);
  const r: Partial<DeviceReport> = check.report ?? {};
  const isDescarte = check.level === "descarte";

  async function copy() {
    await copyText(buildSummary(check));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-card">
      <VerdictBanner verdict={check.verdict} />

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm text-muted">
          <span className="font-mono">{check.imei}</span>
          <span>
            {LEVEL_LABEL[check.level]} · {formatDateTime(check.createdAt)}
          </span>
        </div>

        {cached && (
          <p className="rounded-lg bg-accent/10 px-3 py-2 text-sm">
            Resultado guardado del {formatDate(check.createdAt)}. No se cobró de nuevo.
          </p>
        )}

        {check.reasons.length > 0 && (
          <ul className="space-y-1.5">
            {check.reasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <span className="text-muted">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        )}

        {check.issues.length > 0 && (
          <div className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">
            {check.status === "partial" && <p className="font-semibold">Chequeo incompleto</p>}
            {check.issues.map((issue) => (
              <p key={issue.service}>
                {issue.name}: {issue.message}
              </p>
            ))}
          </div>
        )}

        {check.report && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
            <div className="col-span-2">
              <Field label="Modelo" value={r.model} strong />
            </div>
            <div className="col-span-2">
              <Field
                label="Vendido por"
                value={r.soldBy ? `${r.soldBy} (${ORIGIN_LABEL[check.origin ?? "desconocido"]})` : isDescarte ? "Requiere chequeo de procedencia" : undefined}
                tone={check.origin === "retail" ? "ok" : check.origin === "compañia" ? "warn" : undefined}
                strong
              />
            </div>
            <Field
              label="País de compra"
              value={r.purchaseCountry}
              tone={r.purchaseCountry ? (/^chile$/i.test(r.purchaseCountry) ? "ok" : "warn") : undefined}
            />
            <Field label="Fecha de compra" value={r.purchaseDate} />
            <Field label="Find My" value={r.fmi} tone={onOffTone(r.fmi, "warn")} />
            <Field label="MDM" value={r.mdm} tone={onOffTone(r.mdm, "bad")} />
            <Field label="Blacklist" value={r.blacklist} tone={blacklistTone(r.blacklist)} />
            <Field label="Garantía" value={r.warrantyStatus} />
            {r.icloudStatus && <Field label="iCloud" value={r.icloudStatus} />}
            {(r.carrier || r.activationPolicy) && (
              <>
                <Field label="Operador (informativo)" value={r.carrier} />
                <Field label="Política de activación" value={r.activationPolicy} />
              </>
            )}
          </dl>
        )}

        {check.report && Object.keys(check.report.raw).length > 0 && (
          <details className="group border-t border-line pt-3">
            <summary className="cursor-pointer list-none text-sm font-medium text-accent">
              <span className="group-open:hidden">Ver reporte completo ▾</span>
              <span className="hidden group-open:inline">Ocultar reporte completo ▴</span>
            </summary>
            <div className="mt-3">
              <ReportTable raw={check.report.raw} />
            </div>
          </details>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="mr-auto text-sm text-muted">Costo: {formatUsd(check.costUsd)}</span>
          <button
            type="button"
            onClick={copy}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:border-accent"
          >
            {copied ? "Copiado ✓" : "Copiar resumen"}
          </button>
          {onRecheck && (
            <button
              type="button"
              onClick={onRecheck}
              disabled={busy}
              className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:border-accent disabled:opacity-50"
            >
              Consultar de nuevo (cobra)
            </button>
          )}
        </div>

        {isDescarte && check.verdict !== "rojo" && check.verdict !== null && onProcedencia && (
          <button
            type="button"
            onClick={onProcedencia}
            disabled={busy}
            className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-accent-fg hover:brightness-110 disabled:opacity-50"
          >
            Hacer chequeo de procedencia · US$0,75
          </button>
        )}
      </div>
    </article>
  );
}
