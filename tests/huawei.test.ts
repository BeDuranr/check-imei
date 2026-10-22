import { describe, expect, it, vi } from "vitest";
import { classify } from "../lib/classify";
import { detectPlatform } from "../lib/constants";
import { buildExportData } from "../lib/export-fields";
import type { ProviderResult } from "../lib/imeicheck";
import { buildReport, toDmy } from "../lib/parse-result";
import { runAuto } from "../lib/run-check";
import type { Check } from "../lib/types";
import huawei5 from "./fixtures/huawei-service5.json";
import service17 from "./fixtures/service17.json";

const real = buildReport([
  { html: huawei5.result, object: huawei5.object },
  { html: service17.result, object: null },
]);
const opts = { level: "procedencia" as const, platform: "huawei" as const };

describe("Huawei (servicios 5 → 17, respuestas reales)", () => {
  it("detecta la marca por el blacklist", () => {
    expect(detectPlatform(huawei5.object.brand)).toBe("huawei");
  });

  it("extrae nombre comercial, serie, garantía y país", () => {
    expect(real).toMatchObject({
      model: "Mate X6",
      brand: "Huawei Device Company Limited",
      blacklist: "Clean",
      serial: "4DC0XXXXXXXXXXXX",
      warrantyStatus: "Out of Warranty",
      warrantyStart: "10-01-2025",
      warrantyEnd: "11-01-2026",
      purchaseCountry: "Chile",
    });
  });

  it("normaliza fechas AAAA/M/D y deja igual las DD-MM-AAAA", () => {
    expect(toDmy("2025/1/10")).toBe("10-01-2025");
    expect(toDmy("23-01-2028")).toBe("23-01-2028");
  });

  it("limpio y con garantía de Chile: verde con recordatorio de HUAWEI ID", () => {
    const result = classify(real, opts);
    expect(result.verdict).toBe("verde");
    expect(result.reasons[0]).toBe("Sin blacklist · garantía de Chile");
    expect(result.reasons[1]).toContain("HUAWEI ID");
  });

  it("garantía de otro país: amarillo; blacklist: rojo", () => {
    expect(classify({ ...real, purchaseCountry: "Perú" }, opts).reasons[0]).toBe("Garantía de otro país (Perú)");
    expect(classify({ ...real, blacklist: "Blacklisted" }, opts).verdict).toBe("rojo");
  });

  it("runAuto: 5 → 17, US$0,09", async () => {
    const success = (orderId: number, price: number, resultHtml: string, object: Record<string, unknown> | null) =>
      ({ ok: true, orderId, price, resultHtml, object, durationMs: 10, raw: {} }) satisfies ProviderResult;
    const createOrder = vi.fn(async (service: number): Promise<ProviderResult> =>
      service === 5
        ? success(huawei5.orderId, 0.02, huawei5.result, huawei5.object)
        : success(service17.orderId, 0.07, service17.result, null),
    );
    const r = await runAuto("868958070414875", { createOrder, sleep: async () => {} });
    expect(createOrder.mock.calls.map((c) => c[0])).toEqual([5, 17]);
    expect(r).toMatchObject({ platform: "huawei", level: "procedencia", status: "success", costUsd: 0.09 });
    expect(r.classification?.verdict).toBe("verde");
  });

  it("imagen exportable: modelo con código, país y garantía vencida con fecha", () => {
    const check: Check = {
      id: "00000000-0000-0000-0000-000000000017",
      imei: "868958XXXXX4875",
      platform: "huawei",
      level: "procedencia",
      status: "success",
      model: real.model ?? null,
      orderIds: [],
      services: [5, 17],
      costUsd: 0.09,
      report: real,
      ...classify(real, opts),
      issues: [],
      createdAt: "2026-10-22T12:00:00.000Z",
    };
    const data = buildExportData([check]);
    const row = (label: string) => data.sections.flatMap((s) => s.rows).find((r) => r.label === label);
    expect(data.model).toBe("Mate X6");
    expect(row("Modelo")?.value).toBe("Mate X6 (ICL-LX9)");
    expect(row("País de la garantía")).toMatchObject({ value: "Chile", tone: "ok" });
    expect(row("Inicio de garantía")?.value).toBe("10-01-2025");
    expect(row("Garantía")?.value).toBe("Vencida el 11-01-2026");
    expect(row("Blacklist")?.value).toBe("Limpio");
    expect(row("Knox Guard")).toBeUndefined();
  });
});
