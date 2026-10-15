import type { Level, Platform } from "./constants";
import type { Classification, DeviceReport, Origin } from "./types";

/**
 * Vendedores que indican compra con compañía (se compara en mayúsculas, sin tildes y por
 * palabra completa). Edita esta lista para agregar o quitar compañías.
 */
export const CARRIER_SELLERS = [
  "ENTEL",
  "MOVISTAR",
  "TELEFONICA",
  "CLARO",
  "AMERICA MOVIL",
  "WOM",
  "VTR",
  "NEXTEL",
];

function simplify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function detectOrigin(soldBy: string | undefined): Origin {
  if (!soldBy?.trim()) return "desconocido";
  const seller = simplify(soldBy);
  const isCarrier = CARRIER_SELLERS.some((c) => new RegExp(`\\b${escapeRegex(simplify(c))}\\b`).test(seller));
  return isCarrier ? "compañia" : "retail";
}

function isClean(blacklist: string): boolean {
  return /\bclean\b|not\s*blacklisted|limpio|^no$|^ok$/i.test(blacklist.trim());
}

function isLost(icloudStatus: string): boolean {
  return /lost|erased|stolen|perdid|robad|borrad/i.test(icloudStatus);
}

function hasReplacement(history: string | undefined): boolean {
  if (!history?.trim()) return false;
  return !/^(no|none|n\/a|sin)\b/i.test(history.trim());
}

function isYes(value: string | undefined): boolean {
  return !!value && /^(yes|si|sí|true)$/i.test(value.trim());
}

export interface ClassifyOptions {
  level: Level;
  platform?: Platform;
  /** Nombres de servicios que no se pudieron completar (chequeo parcial). */
  missingServices?: string[];
}

/** Recordatorio fijo en Android: FRP y la cuenta Samsung no se pueden consultar por IMEI. */
export const ANDROID_ACCOUNTS_REASON =
  "Verifica en persona que el vendedor cierre sus cuentas de Google y Samsung y restablezca el equipo frente a ti";

function isKnoxGuardActive(value: string): boolean {
  return !/^off$|nots*registered|nos*registrado/i.test(value.trim());
}

/**
 * Samsung: el servicio 37 no trae país ni compañía, así que el origen queda desconocido y no resta.
 * El mejor resultado es verde con el recordatorio de cuentas (no se puede verificar por IMEI).
 */
function classifySamsung(report: DeviceReport, missingServices: string[]): Classification {
  const red: string[] = [];
  const yellow: string[] = [];
  if (report.blacklist && !isClean(report.blacklist)) red.push(`Reportado en blacklist (${report.blacklist})`);
  if (report.knoxGuard && isKnoxGuardActive(report.knoxGuard)) {
    red.push(`Knox Guard activo (${report.knoxGuard}): equipo financiado o bloqueable por la compañía`);
  }
  if (report.brand && !/samsung/i.test(report.brand)) {
    yellow.push(`La marca reportada (${report.brand}) no es Samsung`);
  }
  for (const name of missingServices) yellow.push(`No se pudo revisar ${name}`);

  const origin: Origin = "desconocido";
  if (red.length) return { verdict: "rojo", origin, reasons: [...red, ...yellow, ANDROID_ACCOUNTS_REASON] };
  if (yellow.length) return { verdict: "amarillo", origin, reasons: [...yellow, ANDROID_ACCOUNTS_REASON] };
  return { verdict: "verde", origin, reasons: ["Sin blacklist ni Knox Guard", ANDROID_ACCOUNTS_REASON] };
}

export function classify(
  report: DeviceReport,
  { level, platform = "iphone", missingServices = [] }: ClassifyOptions,
): Classification {
  if (platform === "samsung") return classifySamsung(report, missingServices);
  const origin = detectOrigin(report.soldBy);
  const red: string[] = [];
  const yellow: string[] = [];

  // Rojo
  if (report.blacklist && !isClean(report.blacklist)) red.push(`Reportado en blacklist (${report.blacklist})`);
  if (report.icloudStatus && isLost(report.icloudStatus)) {
    red.push(`iCloud lo reporta como perdido o borrado (${report.icloudStatus})`);
  }
  if (report.mdm === "ON") red.push("Tiene bloqueo MDM (equipo de empresa)");

  // Amarillo
  if (origin === "compañia") yellow.push(`Comprado con compañía (${report.soldBy})`);
  if (report.purchaseCountry && simplify(report.purchaseCountry) !== "CHILE") {
    yellow.push(`Comprado fuera de Chile (${report.purchaseCountry})`);
  }
  if (report.fmi === "ON") {
    yellow.push("Find My activado: el vendedor debe cerrar sesión de iCloud frente a ti antes de pagar");
  }
  if (hasReplacement(report.replacementHistory)) {
    yellow.push(`Tiene historial de reemplazo (${report.replacementHistory})`);
  }
  if (isYes(report.loaner)) yellow.push("Es un equipo de préstamo de Apple (loaner)");
  for (const name of missingServices) yellow.push(`No se pudo revisar ${name}`);
  if (!report.soldBy) {
    yellow.push(level === "descarte" ? "Falta chequeo de procedencia" : "No se pudo determinar quién vendió el equipo");
  }

  if (red.length) return { verdict: "rojo", origin, reasons: [...red, ...yellow] };
  if (yellow.length) return { verdict: "amarillo", origin, reasons: yellow };
  if (origin === "retail") return { verdict: "verde", origin, reasons: [`Comprado en retail (${report.soldBy})`] };
  return { verdict: "amarillo", origin, reasons: ["No se pudo determinar el origen"] };
}
