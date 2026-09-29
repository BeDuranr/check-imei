import type { DeviceReport } from "./types";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Convierte el `result` HTML del proveedor en líneas de texto plano. */
export function htmlToLines(html: string): string[] {
  const text = html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "");
  return decodeEntities(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * Parsea el HTML en pares clave/valor. Se queda con la primera aparición de cada clave
 * (sin distinguir mayúsculas). Las líneas sin ":" se guardan como `Model` si aún no existe.
 */
export function parseResultHtml(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const seen = new Set<string>();
  const add = (key: string, value: string) => {
    const k = key.toLowerCase();
    if (!key || !value || seen.has(k)) return;
    seen.add(k);
    out[key] = value;
  };

  for (const line of htmlToLines(html)) {
    const i = line.indexOf(":");
    if (i === -1) {
      add("Model", line);
      continue;
    }
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim().replace(/\.$/, "");
    add(key, value);
  }
  return out;
}

/** Clave normalizada: minúsculas y solo letras/números ("MDM Lock" → "mdmlock"). */
function normKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Claves posibles del proveedor para cada campo, en orden de prioridad.
const FIELD_KEYS = {
  model: ["model", "modelname", "modeldescription"],
  serial: ["serialnumber", "serial", "sn"],
  soldBy: ["soldby"],
  purchaseCountry: ["purchasecountry"],
  purchaseDate: ["purchasedate", "estimatedpurchasedate"],
  firstActivationDate: ["firstactivationdate"],
  carrier: ["carrier", "lockedcarrier"],
  activationPolicy: ["appliedactivationpolicy", "activationpolicy"],
  warrantyStatus: ["warrantystatus"],
  fmi: ["fmion", "fmi", "findmyiphone", "findmyiphonestatus", "fmistatus", "icloudlock"],
  mdm: ["mdmlock", "mdm", "mdmstatus"],
  blacklist: ["blackliststatus", "blacklist", "gsmablackliststatus", "gsmablacklist", "gsmastatus"],
  icloudStatus: ["icloudstatus", "icloudcleanlost", "lostmode", "lostmodestatus", "icloud"],
  replacementHistory: ["replacementhistory", "replaced"],
  loaner: ["loanerdevice", "loaner"],
} as const satisfies Record<string, readonly string[]>;

function toOnOff(value: string | undefined): "ON" | "OFF" | undefined {
  if (!value) return undefined;
  const v = value.trim().toUpperCase();
  if (/\bON\b/.test(v) || v === "YES" || v === "TRUE") return "ON";
  if (/\bOFF\b/.test(v) || v === "NO" || v === "FALSE") return "OFF";
  return undefined;
}

export interface ReportSource {
  html?: string | null;
  object?: Record<string, unknown> | null;
}

/**
 * Combina las respuestas de uno o más servicios en un DeviceReport.
 * Para cada fuente se usa primero `object` y se completa con el parser del HTML.
 */
export function buildReport(sources: ReportSource[]): DeviceReport {
  const raw: Record<string, string> = {};
  const byNorm = new Map<string, string>();
  const add = (key: string, value: string) => {
    const n = normKey(key);
    if (!n || !value || byNorm.has(n)) return;
    byNorm.set(n, value);
    raw[key] = value;
  };

  for (const source of sources) {
    if (source.object) {
      for (const [key, value] of Object.entries(source.object)) {
        if (typeof value === "string" || typeof value === "number") add(key, String(value).trim());
        else if (typeof value === "boolean") add(key, value ? "Yes" : "No");
      }
    }
    if (source.html) {
      for (const [key, value] of Object.entries(parseResultHtml(source.html))) add(key, value);
    }
  }

  const pick = (field: keyof typeof FIELD_KEYS): string | undefined => {
    for (const key of FIELD_KEYS[field]) {
      const value = byNorm.get(key);
      if (value) return value;
    }
    return undefined;
  };

  const purchaseDate = pick("purchaseDate");
  const report: DeviceReport = {
    model: pick("model"),
    serial: pick("serial"),
    soldBy: pick("soldBy"),
    purchaseCountry: pick("purchaseCountry"),
    purchaseDate: purchaseDate?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? purchaseDate,
    firstActivationDate: pick("firstActivationDate"),
    carrier: pick("carrier"),
    activationPolicy: pick("activationPolicy"),
    warrantyStatus: pick("warrantyStatus"),
    fmi: toOnOff(pick("fmi")),
    mdm: toOnOff(pick("mdm")),
    blacklist: pick("blacklist"),
    icloudStatus: pick("icloudStatus"),
    replacementHistory: pick("replacementHistory"),
    loaner: pick("loaner"),
    raw,
  };

  // Quitar campos vacíos para que el JSON guardado quede limpio.
  for (const key of Object.keys(report) as (keyof DeviceReport)[]) {
    if (report[key] === undefined) delete report[key];
  }
  return report;
}
