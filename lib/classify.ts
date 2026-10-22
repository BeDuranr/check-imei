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

/** Recordatorio fijo en Android: FRP y las cuentas del fabricante no se pueden consultar por IMEI. */
export const ANDROID_ACCOUNTS_REASON =
  "Verifica en persona que el vendedor cierre sus cuentas de Google y Samsung y restablezca el equipo frente a ti";

function accountsReason(platform: Platform): string {
  if (platform === "samsung") return ANDROID_ACCOUNTS_REASON;
  if (platform === "huawei") {
    return "Verifica en persona que el vendedor cierre su HUAWEI ID (y Google, si tiene) y restablezca el equipo frente a ti";
  }
  return "Verifica en persona que el vendedor cierre su cuenta de Google y restablezca el equipo frente a ti";
}

/** Knox Guard: "OFF" o "not registered" = limpio; cualquier otro valor = inscrito/activo. */
export function isKnoxGuardActive(value: string): boolean {
  return !/^off$|not\s*registered|no\s*registrado/i.test(value.trim());
}

/**
 * Android (Samsung, Huawei y otras marcas): no se sabe si fue compañía o retail, así que el origen queda
 * desconocido y no resta. Huawei sí trae el país de la garantía: fuera de Chile es amarillo, como en iPhone.
 * El mejor resultado es verde con el recordatorio de cuentas (no se puede verificar por IMEI).
 * "Otra marca" solo tiene blacklist: queda amarillo para que se note que el chequeo es parcial.
 */
function classifyAndroid(report: DeviceReport, platform: Platform, missingServices: string[]): Classification {
  const red: string[] = [];
  const yellow: string[] = [];
  if (report.blacklist && !isClean(report.blacklist)) red.push(`Reportado en blacklist (${report.blacklist})`);
  if (report.knoxGuard && isKnoxGuardActive(report.knoxGuard)) {
    red.push(`Knox Guard activo (${report.knoxGuard}): equipo financiado o bloqueable por la compañía`);
  }
  if (platform === "android") {
    yellow.push(`Marca sin chequeo completo todavía${report.brand ? ` (${report.brand})` : ""}: solo se revisó el blacklist`);
  }
  if (report.purchaseCountry && simplify(report.purchaseCountry) !== "CHILE") {
    yellow.push(`Garantía de otro país (${report.purchaseCountry})`);
  }
  for (const name of missingServices) yellow.push(`No se pudo revisar ${name}`);

  const origin: Origin = "desconocido";
  const accounts = accountsReason(platform);
  if (red.length) return { verdict: "rojo", origin, reasons: [...red, ...yellow, accounts] };
  if (yellow.length) return { verdict: "amarillo", origin, reasons: [...yellow, accounts] };
  const clean = platform === "samsung" ? "Sin blacklist ni Knox Guard" : "Sin blacklist";
  const country = report.purchaseCountry ? ` · garantía de ${report.purchaseCountry}` : "";
  return { verdict: "verde", origin, reasons: [clean + country, accounts] };
}

export function classify(
  report: DeviceReport,
  { level, platform = "iphone", missingServices = [] }: ClassifyOptions,
): Classification {
  if (platform !== "iphone") return classifyAndroid(report, platform, missingServices);
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
