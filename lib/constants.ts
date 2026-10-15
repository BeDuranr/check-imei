// Constantes compartidas entre cliente y servidor (sin secretos).

export type Level = "descarte" | "procedencia";

export const LEVELS: Level[] = ["descarte", "procedencia"];

/** Marca/sistema del equipo. Por ahora iPhone y Samsung; el plan Android agrega más (docs/plan-android.md). */
export type Platform = "iphone" | "samsung";

export const PLATFORMS: Platform[] = ["iphone", "samsung"];

export const PLATFORM_LABEL: Record<Platform, string> = {
  iphone: "iPhone",
  samsung: "Samsung",
};

export const SERVICES: Record<number, { name: string; price: number }> = {
  1: { name: "Find My", price: 0.01 },
  5: { name: "Blacklist", price: 0.02 },
  4: { name: "iCloud", price: 0.02 },
  47: { name: "Apple Ultimate", price: 0.75 },
  37: { name: "Samsung Info y Knox Guard", price: 0.08 },
};

/**
 * Servicios por plataforma y nivel, en orden. Lista vacía = nivel no disponible.
 * El blacklist (5) va primero: devuelve la marca y permite detenerse si no coincide con la elegida.
 * Samsung tiene un solo "chequeo completo", que se guarda como `procedencia`.
 */
export const PLATFORM_LEVEL_SERVICES: Record<Platform, Record<Level, number[]>> = {
  iphone: { descarte: [5, 1, 4], procedencia: [47] },
  samsung: { descarte: [], procedencia: [5, 37] },
};

/** Texto que la marca reportada por el servicio 5 debe contener para cada plataforma. */
export const PLATFORM_BRAND_PATTERN: Record<Platform, RegExp> = {
  iphone: /apple/i,
  samsung: /samsung/i,
};

export function levelsFor(platform: Platform): Level[] {
  return LEVELS.filter((level) => PLATFORM_LEVEL_SERVICES[platform][level].length > 0);
}

/** Nombre del nivel para mostrar. En Samsung, `procedencia` es el "Chequeo completo". */
export function levelLabel(platform: Platform, level: Level): string {
  if (platform !== "iphone") return level === "procedencia" ? "Chequeo completo" : "Solo blacklist";
  return level === "descarte" ? "Descarte rápido" : "Procedencia completa";
}

export function levelPrice(platform: Platform, level: Level): number {
  const total = PLATFORM_LEVEL_SERVICES[platform][level].reduce((sum, s) => sum + SERVICES[s].price, 0);
  return Math.round(total * 100) / 100;
}

/** "US$0,10" */
export function levelPriceLabel(platform: Platform, level: Level): string {
  return `US$${levelPrice(platform, level).toLocaleString("es-CL", { minimumFractionDigits: 2 })}`;
}

/** Días que un chequeo exitoso se reutiliza sin volver a cobrar. */
export const CACHE_DAYS = 7;

/** Bajo este saldo (USD) el header muestra una alerta. */
export const LOW_BALANCE_USD = 1;
