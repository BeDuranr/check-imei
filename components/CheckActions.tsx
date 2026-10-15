"use client";

import { levelLabel, levelPriceLabel, levelsFor, PLATFORM_LABEL, PLATFORMS, type Level, type Platform } from "@/lib/constants";

// Qué revisa cada botón, para que se entienda qué se paga.
const LEVEL_DETAIL: Record<Platform, Partial<Record<Level, string>>> = {
  iphone: { descarte: "Blacklist, Find My e iCloud", procedencia: "Vendido por, MDM, garantía" },
  samsung: { procedencia: "Blacklist, Knox Guard y garantía" },
};

export function PlatformPicker({
  value,
  onChange,
  disabled,
}: {
  value: Platform;
  onChange: (platform: Platform) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Marca del equipo" className="grid grid-cols-2 gap-1 rounded-xl bg-card p-1">
      {PLATFORMS.map((platform) => (
        <button
          key={platform}
          type="button"
          role="radio"
          aria-checked={value === platform}
          disabled={disabled}
          onClick={() => onChange(platform)}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${
            value === platform ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
          }`}
        >
          {PLATFORM_LABEL[platform]}
        </button>
      ))}
    </div>
  );
}

interface Props {
  platform: Platform;
  disabled: boolean;
  loading: Level | null;
  onRun: (level: Level) => void;
}

export function CheckActions({ platform, disabled, loading, onRun }: Props) {
  const levels = levelsFor(platform);
  return (
    <div className={`grid grid-cols-1 gap-2 ${levels.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {levels.map((level) => {
        // El nivel más completo va destacado.
        const primary = level === "procedencia";
        return (
          <button
            key={level}
            type="button"
            disabled={disabled}
            onClick={() => onRun(level)}
            className={`rounded-xl px-4 py-3.5 text-left font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              primary ? "bg-accent text-accent-fg hover:brightness-110" : "border border-line bg-card hover:border-accent"
            }`}
          >
            {loading === level ? "Consultando…" : levelLabel(platform, level)}
            <span className={`block text-sm font-normal ${primary ? "opacity-85" : "text-muted"}`}>
              {levelPriceLabel(platform, level)} · {LEVEL_DETAIL[platform][level]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
