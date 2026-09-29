export function normalizeImei(input: string): string {
  return input.replace(/\D/g, "");
}

export function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export type ImeiValidation = { ok: true; imei: string } | { ok: false; error: string };

export function validateImei(input: unknown): ImeiValidation {
  const imei = typeof input === "string" ? normalizeImei(input) : "";
  if (!imei) return { ok: false, error: "Ingresa el IMEI." };
  if (imei.length !== 15) {
    return { ok: false, error: `El IMEI debe tener 15 dígitos (tiene ${imei.length}).` };
  }
  if (!luhnValid(imei)) {
    return { ok: false, error: "El IMEI no es válido (el dígito verificador no calza). Revísalo." };
  }
  return { ok: true, imei };
}
