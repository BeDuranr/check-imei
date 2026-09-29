import { describe, expect, it } from "vitest";
import { classify, detectOrigin } from "../lib/classify";
import { buildReport } from "../lib/parse-result";
import type { DeviceReport } from "../lib/types";
import service1 from "./fixtures/service1.json";
import service4 from "./fixtures/service4.json";
import service5 from "./fixtures/service5.json";
import service47 from "./fixtures/service47.json";

const clean: DeviceReport = {
  model: "iPhone 15",
  soldBy: "FALABELLA RETAIL S.A.",
  purchaseCountry: "Chile",
  fmi: "OFF",
  mdm: "OFF",
  blacklist: "Clean",
  replacementHistory: "No Replacment",
  loaner: "No",
  raw: {},
};

describe("detectOrigin", () => {
  it("detecta compañías sin importar mayúsculas ni tildes", () => {
    expect(detectOrigin("America Movil Peru SAC")).toBe("compañia");
    expect(detectOrigin("Telefónica Móviles Chile")).toBe("compañia");
    expect(detectOrigin("ENTEL PCS")).toBe("compañia");
  });

  it("compara por palabra completa", () => {
    expect(detectOrigin("WOMEN STORE SPA")).toBe("retail");
  });

  it("retail y desconocido", () => {
    expect(detectOrigin("APPLE DISTRIBUTION INTERNATIONAL")).toBe("retail");
    expect(detectOrigin(undefined)).toBe("desconocido");
    expect(detectOrigin("  ")).toBe("desconocido");
  });
});

describe("classify", () => {
  it("el fixture del servicio 47 es rojo por blacklist y comprado con compañía", () => {
    const report = buildReport([{ html: service47.result, object: null }]);
    const result = classify(report, { level: "procedencia" });
    expect(result.verdict).toBe("rojo");
    expect(result.origin).toBe("compañia");
    expect(result.reasons).toContain("Reportado en blacklist (Blacklisted)");
    expect(result.reasons).toContain("Comprado con compañía (AMERICA MOVIL PERU SAC)");
    expect(result.reasons).toContain("Comprado fuera de Chile (Peru)");
  });

  it("descarte real con blacklist: rojo y razón legible", () => {
    const report = buildReport([service1, service5, service4].map((s) => ({ html: s.result, object: s.object })));
    const result = classify(report, { level: "descarte" });
    expect(result.verdict).toBe("rojo");
    expect(result.reasons[0]).toBe("Reportado en blacklist (Blacklisted)");
  });

  it("lostMode: true es rojo", () => {
    const report = buildReport([{ object: { lostMode: true } }]);
    expect(classify(report, { level: "descarte" }).verdict).toBe("rojo");
  });

  it("verde cuando es retail, de Chile y sin bloqueos", () => {
    expect(classify(clean, { level: "procedencia" })).toEqual({
      verdict: "verde",
      origin: "retail",
      reasons: ["Comprado en retail (FALABELLA RETAIL S.A.)"],
    });
  });

  it("rojo por MDM o iCloud perdido", () => {
    expect(classify({ ...clean, mdm: "ON" }, { level: "procedencia" }).verdict).toBe("rojo");
    expect(classify({ ...clean, icloudStatus: "LOST" }, { level: "procedencia" }).verdict).toBe("rojo");
    expect(classify({ ...clean, icloudStatus: "Clean" }, { level: "procedencia" }).verdict).toBe("verde");
  });

  it("amarillo por FMI, reemplazo, loaner o compra fuera de Chile", () => {
    expect(classify({ ...clean, fmi: "ON" }, { level: "procedencia" }).verdict).toBe("amarillo");
    expect(classify({ ...clean, replacementHistory: "Replaced 2024-02-01" }, { level: "procedencia" }).verdict).toBe(
      "amarillo",
    );
    expect(classify({ ...clean, loaner: "Yes" }, { level: "procedencia" }).verdict).toBe("amarillo");
    expect(classify({ ...clean, purchaseCountry: "United States" }, { level: "procedencia" }).verdict).toBe(
      "amarillo",
    );
  });

  it("solo descarte: amarillo pidiendo procedencia", () => {
    const report: DeviceReport = { model: "iPhone 15", fmi: "OFF", blacklist: "Clean", raw: {} };
    const result = classify(report, { level: "descarte" });
    expect(result.verdict).toBe("amarillo");
    expect(result.origin).toBe("desconocido");
    expect(result.reasons).toEqual(["Falta chequeo de procedencia"]);
  });

  it("agrega los servicios que fallaron", () => {
    const report: DeviceReport = { fmi: "OFF", raw: {} };
    const result = classify(report, { level: "descarte", missingServices: ["Blacklist"] });
    expect(result.reasons).toContain("No se pudo revisar Blacklist");
  });
});
