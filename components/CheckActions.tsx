"use client";

import { formatPrice, levelPrice } from "@/lib/constants";

interface Props {
  disabled: boolean;
  loading: boolean;
  /** Chequeo automático: detecta la marca y corre lo básico de esa marca. */
  onAuto: () => void;
  /** Procedencia de iPhone directa (Apple Ultimate), sin pasar por el chequeo básico. */
  onIphoneProcedencia: () => void;
}

export function CheckActions({ disabled, loading, onAuto, onIphoneProcedencia }: Props) {
  const prices = [
    `iPhone ${formatPrice(levelPrice("iphone", "descarte"))}`,
    `Samsung ${formatPrice(levelPrice("samsung", "procedencia"))}`,
    `otras ${formatPrice(levelPrice("android", "descarte"))}`,
  ].join(" · ");

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled}
        onClick={onAuto}
        className="w-full rounded-xl bg-accent px-4 py-3.5 text-left font-semibold text-accent-fg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Consultando…" : "Revisar"}
        <span className="block text-sm font-normal opacity-85">Detecta la marca sola · {prices}</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onIphoneProcedencia}
        className="text-sm text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        Ir directo a procedencia de iPhone (Vendido por, MDM) · {formatPrice(levelPrice("iphone", "procedencia"))}
      </button>
    </div>
  );
}
