// Constantes compartidas entre cliente y servidor (sin secretos).

export type Level = "descarte" | "procedencia";

export const LEVELS: Level[] = ["descarte", "procedencia"];

export const SERVICES: Record<number, { name: string; price: number }> = {
  1: { name: "Find My", price: 0.01 },
  5: { name: "Blacklist", price: 0.02 },
  4: { name: "iCloud", price: 0.02 },
  47: { name: "Apple Ultimate", price: 0.75 },
};

/** Servicios que se ejecutan por nivel, en orden. */
export const LEVEL_SERVICES: Record<Level, number[]> = {
  descarte: [1, 5, 4],
  procedencia: [47],
};

export const LEVEL_LABEL: Record<Level, string> = {
  descarte: "Descarte rápido",
  procedencia: "Procedencia completa",
};

export const LEVEL_PRICE_LABEL: Record<Level, string> = {
  descarte: "US$0,05",
  procedencia: "US$0,75",
};

/** Días que un chequeo exitoso se reutiliza sin volver a cobrar. */
export const CACHE_DAYS = 7;

/** Bajo este saldo (USD) el header muestra una alerta. */
export const LOW_BALANCE_USD = 1;
