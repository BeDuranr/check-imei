import { describe, expect, it, vi } from "vitest";
import type { ProviderResult } from "../lib/imeicheck";
import { runServices, SERVICE_GAP_MS } from "../lib/run-check";
import service1 from "./fixtures/service1.json";
import service47 from "./fixtures/service47.json";

const IMEI = "490154203237518";

function success(orderId: number, price: number, resultHtml: string, object: Record<string, unknown> | null = null) {
  return { ok: true, orderId, price, resultHtml, object, durationMs: 10, raw: {} } satisfies ProviderResult;
}

describe("runServices", () => {
  it("descarte: llama 1 → 5 → 4 esperando entre cada uno", async () => {
    const responses: Record<number, ProviderResult> = {
      1: success(1, 0.01, service1.result, service1.object),
      5: success(2, 0.02, "Blacklist Status: Clean"),
      4: success(3, 0.02, "iCloud Status: Clean"),
    };
    const createOrder = vi.fn(async (service: number) => responses[service]);
    const sleep = vi.fn(async () => {});

    const r = await runServices("descarte", IMEI, { createOrder, sleep });

    expect(createOrder.mock.calls.map((c) => c[0])).toEqual([1, 5, 4]);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(SERVICE_GAP_MS);
    expect(r.status).toBe("success");
    expect(r.costUsd).toBe(0.05);
    expect(r.orderIds).toEqual([1, 2, 3]);
    expect(r.report?.blacklist).toBe("Clean");
    expect(r.classification?.verdict).toBe("amarillo"); // FMI ON + falta procedencia
    expect(r.classification?.reasons).toContain("Falta chequeo de procedencia");
  });

  it("descarte parcial: se detiene ante error de sistema y guarda lo que funcionó", async () => {
    const createOrder = vi.fn(async (service: number): Promise<ProviderResult> =>
      service === 1
        ? success(1, 0.01, service1.result, service1.object)
        : { ok: false, kind: "error", message: "Insufficient balance", raw: {} },
    );
    const r = await runServices("descarte", IMEI, { createOrder, sleep: async () => {} });

    expect(createOrder).toHaveBeenCalledTimes(2);
    expect(r.status).toBe("partial");
    expect(r.costUsd).toBe(0.01);
    expect(r.errorMessage).toBe("Insufficient balance");
    expect(r.classification?.reasons).toContain("No se pudo revisar Blacklist");
    expect(r.classification?.reasons).toContain("No se pudo revisar iCloud");
  });

  it("un timeout de red no corta el resto del descarte", async () => {
    const createOrder = vi.fn(async (service: number): Promise<ProviderResult> =>
      service === 5
        ? { ok: false, kind: "network", message: "Timeout", raw: null }
        : success(service, 0.01, "FMI: OFF"),
    );
    const r = await runServices("descarte", IMEI, { createOrder, sleep: async () => {} });
    expect(createOrder).toHaveBeenCalledTimes(3);
    expect(r.status).toBe("partial");
  });

  it("IMEI rechazado: failed sin costo ni reporte", async () => {
    const createOrder = vi.fn(async (): Promise<ProviderResult> => ({
      ok: false,
      kind: "failed",
      message: "Invalid IMEI/SN",
      raw: { status: "failed", cost: 0 },
    }));
    const r = await runServices("descarte", IMEI, { createOrder, sleep: async () => {} });
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(r.status).toBe("failed");
    expect(r.costUsd).toBe(0);
    expect(r.report).toBeNull();
    expect(r.firstError).toEqual({ kind: "failed", message: "Invalid IMEI/SN" });
  });

  it("procedencia: usa solo el servicio 47", async () => {
    const createOrder = vi.fn(async (_service: number) => success(9, 0.75, service47.result));
    const r = await runServices("procedencia", IMEI, { createOrder });
    expect(createOrder.mock.calls.map((c) => c[0])).toEqual([47]);
    expect(r.classification?.verdict).toBe("rojo");
    expect(r.classification?.origin).toBe("compañia");
  });

  it("no inicia un servicio si no queda tiempo", async () => {
    let t = 0;
    const createOrder = vi.fn(async (service: number) => {
      t += 54_000;
      return success(service, 0.01, "FMI: OFF");
    });
    const r = await runServices("descarte", IMEI, { createOrder, sleep: async () => {}, now: () => t });
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(r.status).toBe("partial");
  });
});
