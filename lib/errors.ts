export type ProviderErrorKind = "failed" | "error" | "network";

/** Traduce un error del proveedor a un mensaje para el usuario. Nunca devuelve el texto crudo. */
export function userMessage(kind: ProviderErrorKind, message: string): string {
  if (kind === "network") return "El servicio tardó demasiado. Intenta de nuevo en unos minutos.";
  if (/invalid\s*imei/i.test(message)) return "El IMEI no es válido. Revísalo y vuelve a intentar.";
  if (/api\s*key|apikey|\bip\b/i.test(message)) {
    return "Error de configuración del servicio. Revisa las variables de entorno.";
  }
  if (/balance|insufficient|not enough|credit|fund|saldo/i.test(message)) {
    return "No hay saldo suficiente en imeicheck.com. Recarga créditos.";
  }
  return "No se pudo completar la consulta.";
}
