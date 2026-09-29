// Formatos para Chile. Seguro para cliente y servidor.

const TZ = "America/Santiago";

export function formatUsd(value: number): string {
  return `US$${value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatClp(value: number): string {
  return `$${value.toLocaleString("es-CL", { maximumFractionDigits: 0 })}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", { timeZone: TZ, dateStyle: "medium" });
}

export function maskImei(imei: string): string {
  return `•••• ${imei.slice(-4)}`;
}
