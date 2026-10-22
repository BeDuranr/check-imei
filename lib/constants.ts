// Constantes compartidas entre cliente y servidor (sin secretos).

export type Level = "descarte" | "procedencia";

export const LEVELS: Level[] = ["descarte", "procedencia"];

/**
 * Marca/sistema del equipo. "android" = cualquier otra marca, por ahora solo con blacklist
 * (el plan Android agrega Xiaomi y otras: docs/plan-android.md).
 */
export type Platform = "iphone" | "samsung" | "huawei" | "android";

export const PLATFORMS: Platform[] = ["iphone", "samsung", "huawei", "android"];

export const PLATFORM_LABEL: Record<Platform, string> = {
  iphone: "iPhone",
  samsung: "Samsung",
  huawei: "Huawei",
  android: "Otra marca",
};

/** Blacklist GSMA: sirve para todas las marcas y devuelve la marca y el modelo. */
export const BLACKLIST_SERVICE = 5;

export const SERVICES: Record<number, { name: string; price: number }> = {
  1: { name: "Find My", price: 0.01 },
  5: { name: "Blacklist", price: 0.02 },
  4: { name: "iCloud", price: 0.02 },
  47: { name: "Apple Ultimate", price: 0.75 },
  37: { name: "Samsung Info y Knox Guard", price: 0.08 },
  17: { name: "Huawei Info", price: 0.07 },
};

/**
 * Servicios por plataforma y nivel, en orden. Lista vacía = nivel no disponible.
 * El blacklist (5) va primero: con la marca que devuelve se elige la plataforma (`runAuto`).
 * El "chequeo completo" de cada marca se guarda como `procedencia`. En iPhone: blacklist, iCloud perdido (el 47 no
 * lo trae) y Apple Ultimate al final, para que el servicio lento tenga el máximo de tiempo.
 * El descarte de iPhone (5 → 1 → 4) ya no se ofrece; queda para leer chequeos antiguos.
 */
export const PLATFORM_LEVEL_SERVICES: Record<Platform, Record<Level, number[]>> = {
  iphone: { descarte: [5, 1, 4], procedencia: [5, 4, 47] },
  samsung: { descarte: [], procedencia: [5, 37] },
  huawei: { descarte: [], procedencia: [5, 17] },
  android: { descarte: [5], procedencia: [] },
};

/** Plataforma según la marca que reporta el blacklist ("Apple Inc", "Samsung Korea", "Huawei Device Company Limited"). */
export function detectPlatform(brand: string | undefined): Platform {
  if (brand && /apple/i.test(brand)) return "iphone";
  if (brand && /samsung/i.test(brand)) return "samsung";
  if (brand && /huawei/i.test(brand)) return "huawei";
  return "android";
}

/** Nivel que corre el chequeo automático ("Revisar") para cada marca. */
const BASE_LEVEL: Record<Platform, Level> = {
  iphone: "procedencia",
  samsung: "procedencia",
  huawei: "procedencia",
  android: "descarte",
};

export function baseLevel(platform: Platform): Level {
  return BASE_LEVEL[platform];
}

/** Nombre del nivel para mostrar. `procedencia` es el "Chequeo completo" de cada marca. */
export function levelLabel(platform: Platform, level: Level): string {
  if (level === "procedencia") return "Chequeo completo";
  return platform === "iphone" ? "Descarte rápido" : "Solo blacklist";
}

export function levelPrice(platform: Platform, level: Level): number {
  const total = PLATFORM_LEVEL_SERVICES[platform][level].reduce((sum, s) => sum + SERVICES[s].price, 0);
  return Math.round(total * 100) / 100;
}

/** "US$0,10" */
export function formatPrice(usd: number): string {
  return `US$${usd.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function levelPriceLabel(platform: Platform, level: Level): string {
  return formatPrice(levelPrice(platform, level));
}

/** Días que un chequeo exitoso se reutiliza sin volver a cobrar. */
export const CACHE_DAYS = 7;

/** Bajo este saldo (USD) el header muestra una alerta. */
export const LOW_BALANCE_USD = 1;
