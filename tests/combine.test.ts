import { describe, expect, it } from "vitest";
import { classify } from "../lib/classify";
import { combineChecks, groupChecks, latestPerLevel } from "../lib/combine";
import { buildReport } from "../lib/parse-result";
import type { Check, DeviceReport } from "../lib/types";
import service1 from "./fixtures/service1.json";
import service4 from "./fixtures/service4.json";
import service5 from "./fixtures/service5.json";
import service47 from "./fixtures/service47.json";

let seq = 0;
function makeCheck(level: Check["level"], report: DeviceReport | null, overrides: Partial<Check> = {}): Check {
  const c = report ? classify(report, { level }) : null;
  seq += 1;
  return {
    id: `00000000-0000-0000-0000-${String(seq).padStart(12, "0")}`,
    imei: "355564840000000",
    level,
    status: report ? "success" : "failed",
    model: report?.model ?? null,
    orderIds: [seq],
    services: level === "descarte" ? [1, 5, 4] : [47],
    costUsd: report ? (level === "descarte" ? 0.05 : 0.75) : 0,
    report,
    verdict: c?.verdict ?? null,
    origin: c?.origin ?? null,
    reasons: c?.reasons ?? [],
    issues: [],
    createdAt: "2026-09-29T12:00:00.000Z",
    ...overrides,
  };
}

const descarteReport = buildReport([service1, service5, service4].map((s) => ({ html: s.result, object: s.object })));
const procedenciaReport = buildReport([{ html: service47.result }]);

describe("latestPerLevel", () => {
  it("toma el último de cada nivel, procedencia primero, e ignora los fallidos", () => {
    const viejo = makeCheck("descarte", descarteReport, { createdAt: "2026-09-01T00:00:00Z" });
    const nuevo = makeCheck("descarte", descarteReport, { createdAt: "2026-09-20T00:00:00Z" });
    const proc = makeCheck("procedencia", procedenciaReport, { createdAt: "2026-09-10T00:00:00Z" });
    const fallido = makeCheck("procedencia", null, { createdAt: "2026-09-25T00:00:00Z" });
    expect(latestPerLevel([viejo, nuevo, proc, fallido]).map((c) => c.id)).toEqual([proc.id, nuevo.id]);
  });
});

describe("combineChecks", () => {
  it("une descarte y procedencia: datos de ambos, costo total y fecha más reciente", () => {
    const descarte = makeCheck("descarte", descarteReport, { createdAt: "2026-09-29T20:06:23Z" });
    const proc = makeCheck("procedencia", procedenciaReport, { createdAt: "2026-09-29T19:01:57Z" });
    const combined = combineChecks([descarte, proc])!;

    expect(combined.level).toBe("procedencia");
    expect(combined.report?.soldBy).toBe("AMERICA MOVIL PERU SAC"); // de la procedencia
    expect(combined.report?.icloudStatus).toBe("Clean"); // del descarte
    expect(combined.costUsd).toBe(0.8);
    expect(combined.createdAt).toBe("2026-09-29T20:06:23Z");
    expect(combined.verdict).toBe("rojo");
    expect(combined.origin).toBe("compañia");
    expect(combined.reasons).not.toContain("Falta chequeo de procedencia");
  });

  it("con un solo chequeo lo devuelve tal cual; sin datos, null", () => {
    const solo = makeCheck("descarte", descarteReport);
    expect(combineChecks([solo])).toBe(solo);
    expect(combineChecks([makeCheck("descarte", null)])).toBeNull();
  });

  it("el veredicto combinado puede ser más grave que el de la procedencia sola", () => {
    const limpio: DeviceReport = { ...procedenciaReport, blacklist: "Clean", fmi: "OFF", purchaseCountry: "Chile", soldBy: "FALABELLA" };
    const proc = makeCheck("procedencia", limpio);
    const perdido = makeCheck("descarte", { fmi: "OFF", blacklist: "Clean", icloudStatus: "Lost Mode", raw: {} });
    expect(proc.verdict).toBe("verde");
    expect(combineChecks([proc, perdido])?.verdict).toBe("rojo");
  });
});

describe("groupChecks", () => {
  it("una fila por IMEI, ordenadas por el chequeo más reciente", () => {
    const a1 = makeCheck("descarte", descarteReport, { createdAt: "2026-09-29T20:06:23Z" });
    const a2 = makeCheck("procedencia", procedenciaReport, { createdAt: "2026-09-29T19:01:57Z" });
    const b1 = makeCheck("descarte", null, { imei: "490154203237518", createdAt: "2026-09-30T10:00:00Z" });

    const groups = groupChecks([a1, a2, b1]);
    expect(groups.map((g) => g.imei)).toEqual(["490154203237518", "355564840000000"]);

    const [soloFallido, completo] = groups;
    expect(soloFallido).toMatchObject({ verdict: null, levels: [], count: 1, totalCostUsd: 0 });
    expect(completo).toMatchObject({
      model: "iPhone 16 Pro Max",
      verdict: "rojo",
      origin: "compañia",
      levels: ["descarte", "procedencia"],
      count: 2,
      totalCostUsd: 0.8,
      lastAt: "2026-09-29T20:06:23Z",
      openId: a1.id,
    });
  });
});
