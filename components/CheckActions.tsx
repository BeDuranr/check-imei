"use client";

import { baseLevel, formatPrice, levelPrice, type Platform } from "@/lib/constants";

const PRICE_PLATFORMS: [Platform, string][] = [
  ["iphone", "iPhone"],
  ["samsung", "Samsung"],
  ["android", "otras"],
];

interface Props {
  disabled: boolean;
  loading: boolean;
  /** Chequeo automático: detecta la marca y corre el chequeo completo de esa marca. */
  onRun: () => void;
}

export function CheckActions({ disabled, loading, onRun }: Props) {
  const prices = PRICE_PLATFORMS.map(([p, name]) => `${name} ${formatPrice(levelPrice(p, baseLevel(p)))}`).join(" · ");
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onRun}
      className="w-full rounded-xl bg-accent px-4 py-3.5 text-left font-semibold text-accent-fg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "Consultando…" : "Revisar"}
      <span className="block text-sm font-normal opacity-85">Detecta la marca sola · {prices}</span>
    </button>
  );
}
