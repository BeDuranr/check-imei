import { describe, expect, it } from "vitest";
import { classify } from "../lib/classify";
import { buildExportData, type ExportData } from "../lib/export-fields";
import { buildReport } from "../lib/parse-result";
import type { Check, DeviceReport } from "../lib/types";
import service1 from "./fixtures/service1.json";
import service4 from "./fixtures/service4.json";
import service5 from "./fixtures/service5.json";
import service47 from "./fixtures/service47.json";

function makeCheck(level: Check["level"], report: DeviceReport): Check {
  const { verdict, origin, reasons } = classify(report, { level });
  return {
    id: "00000000-0000-0000-0000-000000000000",
    imei: "355564840000000",
    level,
    status: "success",
    model: report.model ?? null,
    orderIds: [],
    services: [],
    costUsd: 0,
    report,
    verdict,
    origin,
    reasons,
    issues: [],
    createdAt: "2026-09-29T19:00:00.000Z",
  };
}

function row(data: ExportData, label: string) {
  return data.sections.flatMap((s) => s.rows).find((r) => r.label === label);
}

describe("buildExportData", () => {
  const procedencia = buildExportData([makeCheck("procedencia", buildReport([{ html: service47.result }]))]);

  it("usa el modelo como título y agrupa en secciones", () => {
    expect(procedencia.model).toBe("iPhone 16 Pro Max");
    expect(procedencia.sections.map((s) => s.title)).toEqual(["Equipo", "Compra", "Bloqueos y estado"]);
    expect(procedencia.verdict).toBe("rojo");
  });

  it("extrae y traduce los datos de compra", () => {
    expect(row(procedencia, "Capacidad")?.value).toBe("256 GB");
    expect(row(procedencia, "IMEI")?.value).toBe("355564840000000");
    expect(row(procedencia, "N° de serie")?.value).toBe("XXXXXXXXXX");
    expect(row(procedencia, "Lugar de compra")?.value).toBe("AMERICA MOVIL PERU SAC");
    expect(row(procedencia, "País de compra")).toMatchObject({ value: "Peru", tone: "warn" });
    expect(row(procedencia, "Fecha de compra")?.value).toBe("04-01-2025");
    expect(row(procedencia, "Primera activación")?.value).toBe("04-01-2025");
    expect(row(procedencia, "Garantía")?.value).toBe("Sin garantía (vencida)");
    expect(row(procedencia, "Liberado")).toMatchObject({ value: "Sí", tone: "ok" });
  });

  it("traduce los bloqueos con su color", () => {
    expect(row(procedencia, "Find My")).toMatchObject({ value: "Activado", tone: "warn" });
    expect(row(procedencia, "Bloqueo MDM")).toMatchObject({ value: "No", tone: "ok" });
    expect(row(procedencia, "Blacklist")).toMatchObject({ value: "Reportado", tone: "bad" });
  });

  it("omite valores de relleno como '...'", () => {
    expect(row(procedencia, "IMEI 2")).toBeUndefined();
  });

  it("descarte: sin sección de compra, con iCloud", () => {
    const report = buildReport([service1, service5, service4].map((s) => ({ html: s.result, object: s.object })));
    const data = buildExportData([makeCheck("descarte", report)]);
    expect(data.sections.map((s) => s.title)).toEqual(["Equipo", "Bloqueos y estado"]);
    expect(row(data, "iCloud")).toMatchObject({ value: "Limpio", tone: "ok" });
    expect(row(data, "Blacklist")?.value).toBe("Reportado");
  });

  it("agrega operador y reemplazo", () => {
    expect(row(procedencia, "Operador")?.value).toBe("Entel");
    expect(row(procedencia, "Reemplazo")).toMatchObject({ value: "Sin reemplazos", tone: "ok" });

    const replaced = buildReport([{ html: "Sold By: FALABELLA<br>Replacement History : Replaced 2024-05-02" }]);
    expect(row(buildExportData([makeCheck("procedencia", replaced)]), "Reemplazo")).toMatchObject({
      value: "Replaced 2024-05-02",
      tone: "warn",
    });
  });

  it("une descarte y procedencia del mismo IMEI", () => {
    const descarteReport = buildReport([service1, service5, service4].map((s) => ({ html: s.result, object: s.object })));
    const descarte = { ...makeCheck("descarte", descarteReport), createdAt: "2026-09-29T10:00:00.000Z" };
    const proc = makeCheck("procedencia", buildReport([{ html: service47.result }]));

    // Da lo mismo cuál se abrió primero: la procedencia manda y el descarte completa.
    for (const data of [buildExportData([descarte, proc]), buildExportData([proc, descarte])]) {
      expect(data.model).toBe("iPhone 16 Pro Max");
      expect(row(data, "Lugar de compra")?.value).toBe("AMERICA MOVIL PERU SAC");
      expect(row(data, "iCloud")).toMatchObject({ value: "Limpio" }); // solo viene en el descarte
      expect(row(data, "Bloqueo MDM")?.value).toBe("No"); // solo viene en la procedencia
      expect(data.verdict).toBe("rojo");
      expect(data.sections.map((s) => s.title)).toEqual(["Equipo", "Compra", "Bloqueos y estado"]);
    }
  });

  it("no incluye el texto completo del reporte", () => {
    const labels = procedencia.sections.flatMap((s) => s.rows.map((r) => r.label));
    expect(labels).not.toContain("Config Code");
    expect(labels).not.toContain("Last Unbrick OS Build");
  });
});
