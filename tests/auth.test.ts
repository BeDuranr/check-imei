import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkPassword, createSessionToken, SESSION_MAX_AGE_S, verifySessionToken } from "../lib/auth";

beforeEach(() => vi.stubEnv("APP_PASSWORD", "clave-de-prueba"));
afterEach(() => vi.unstubAllEnvs());

describe("auth", () => {
  it("firma y verifica el token", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("rechaza tokens alterados, vacíos o vencidos", async () => {
    const now = Date.now();
    const token = await createSessionToken(now);
    const [v, exp, sig] = token.split(".");
    expect(await verifySessionToken(`${v}.${Number(exp) + 1000}.${sig}`)).toBe(false);
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken("basura")).toBe(false);
    expect(await verifySessionToken(token, now + (SESSION_MAX_AGE_S + 1) * 1000)).toBe(false);
  });

  it("cambiar la contraseña invalida las sesiones", async () => {
    const token = await createSessionToken();
    vi.stubEnv("APP_PASSWORD", "otra");
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("compara la contraseña", async () => {
    expect(await checkPassword("clave-de-prueba")).toBe(true);
    expect(await checkPassword("clave-de-prueb")).toBe(false);
    expect(await checkPassword("")).toBe(false);
    vi.stubEnv("APP_PASSWORD", "");
    expect(await checkPassword("")).toBe(false);
  });
});
