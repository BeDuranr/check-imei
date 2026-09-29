"use client";

import { LEVEL_LABEL, LEVEL_PRICE_LABEL, type Level } from "@/lib/constants";

interface Props {
  disabled: boolean;
  loading: Level | null;
  onRun: (level: Level) => void;
}

export function CheckActions({ disabled, loading, onRun }: Props) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRun("descarte")}
        className="rounded-xl border border-line bg-card px-4 py-3.5 text-left font-semibold transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading === "descarte" ? "Revisando…" : LEVEL_LABEL.descarte}
        <span className="block text-sm font-normal text-muted">
          {LEVEL_PRICE_LABEL.descarte} · Find My, blacklist e iCloud
        </span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRun("procedencia")}
        className="rounded-xl bg-accent px-4 py-3.5 text-left font-semibold text-accent-fg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading === "procedencia" ? "Consultando…" : LEVEL_LABEL.procedencia}
        <span className="block text-sm font-normal opacity-85">
          {LEVEL_PRICE_LABEL.procedencia} · Vendido por, MDM, garantía
        </span>
      </button>
    </div>
  );
}
