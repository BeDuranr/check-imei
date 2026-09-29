import { describe, expect, it } from "vitest";
import { luhnValid, normalizeImei, validateImei } from "../lib/imei";

describe("imei", () => {
  it("quita espacios, guiones y otros caracteres", () => {
    expect(normalizeImei(" 49-015420 323751/8 ")).toBe("490154203237518");
  });

  it("acepta un IMEI válido con formato", () => {
    expect(validateImei("49-015420-323751-8")).toEqual({ ok: true, imei: "490154203237518" });
  });

  it("rechaza largo distinto de 15", () => {
    const r = validateImei("49015420323751");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("14");
  });

  it("rechaza dígito verificador incorrecto", () => {
    expect(luhnValid("490154203237519")).toBe(false);
    expect(validateImei("490154203237519").ok).toBe(false);
  });

  it("rechaza entradas vacías o que no son texto", () => {
    expect(validateImei("").ok).toBe(false);
    expect(validateImei(undefined).ok).toBe(false);
    expect(validateImei(490154203237518).ok).toBe(false);
  });
});
