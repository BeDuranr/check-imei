// Firma y verificación de la cookie de sesión. Usa Web Crypto, así funciona tanto en el
// proxy como en las rutas de API.

export const SESSION_COOKIE = "imei_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 días

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data))));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET || process.env.APP_PASSWORD;
  // Cambiar APP_PASSWORD (o SESSION_SECRET) invalida todas las sesiones abiertas.
  return secret ? `session-v1:${secret}` : null;
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const secret = sessionSecret();
  if (!secret) throw new Error("APP_PASSWORD no está configurada");
  const payload = `v1.${Math.floor(now / 1000) + SESSION_MAX_AGE_S}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  const secret = sessionSecret();
  if (!token || !secret) return false;
  const [version, exp, signature, ...rest] = token.split(".");
  if (version !== "v1" || !signature || rest.length) return false;
  const expSeconds = Number(exp);
  if (!Number.isInteger(expSeconds) || expSeconds * 1000 <= now) return false;
  return safeEqual(await hmac(secret, `v1.${exp}`), signature);
}

export async function checkPassword(input: unknown): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected || typeof input !== "string" || !input) return false;
  // Comparar hashes de largo fijo evita filtrar el largo de la contraseña por tiempos.
  const [a, b] = await Promise.all([hmac("pw-compare", input), hmac("pw-compare", expected)]);
  return safeEqual(a, b);
}
