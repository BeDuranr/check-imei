import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userMessage } from "../lib/errors";
import { getOrder, type OrderResult } from "../lib/imeicheck";
import { planImport, serviceFromName } from "../lib/import-order";
import history47 from "./fixtures/history47.json";

const KEY = "test-key-123";

function mockFetch(body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
}

beforeEach(() => vi.stubEnv("IMEICHECK_API_KEY", KEY));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function loadOrder(body: unknown) {
  mockFetch(body);
  const order = await getOrder(111622833);
  if (!order.ok) throw new Error("se esperaba ok");
  return order;
}

describe("serviceFromName", () => {
  it("reconoce los servicios por nombre", () => {
    expect(serviceFromName("APPLE ULTIMATE INFO — SOLD / CHIMAERA / MDM/BLACKLIST")).toBe(47);
    expect(serviceFromName("Find My iPhone [ FMI ] (ON/OFF)")).toBe(1);
    expect(serviceFromName("iCloud Clean/Lost Check")).toBe(4);
    expect(serviceFromName("Blacklist Status - GSMA")).toBe(5);
    expect(serviceFromName("Samsung Info")).toBeNull();
  });
});

describe("getOrder", () => {
  it("normaliza /history (credit, order_id, fecha en UTC)", async () => {
    const order = await loadOrder(history47);
    expect(order).toMatchObject({
      orderId: 111622833,
      price: 0.75,
      status: "SUCCESS",
      imei: "490154203237518",
      createdAt: "2026-09-29T19:01:57Z",
    });
    expect(JSON.stringify(order.raw)).not.toContain(KEY);
  });

  it("orden inexistente → error traducido", async () => {
    mockFetch({ status: "error", orderId: "999", response: "Invalid OrderId" });
    const order = await getOrder(999);
    expect(order.ok).toBe(false);
    if (!order.ok) expect(userMessage(order.kind, order.message)).toBe("No existe una orden con ese número en imeicheck.com.");
  });
});

describe("planImport", () => {
  it("convierte la orden real del servicio 47 en un chequeo de procedencia", async () => {
    const plan = planImport(await loadOrder(history47));
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.level).toBe("procedencia");
    expect(plan.createdAt).toBe("2026-09-29T19:01:57Z");
    expect(plan.result.costUsd).toBe(0.75);
    expect(plan.result.orderIds).toEqual([111622833]);
    // El HTML de /history trae comillas escapadas (\") dentro de las etiquetas: igual se limpia.
    expect(plan.result.report).toMatchObject({
      soldBy: "AMERICA MOVIL PERU SAC",
      purchaseCountry: "Peru",
      activationPolicy: "Unlock",
      fmi: "ON",
      mdm: "OFF",
      blacklist: "Blacklisted",
    });
    expect(plan.result.classification).toMatchObject({ verdict: "rojo", origin: "compañia" });
  });

  it("rechaza otros servicios y órdenes sin éxito", async () => {
    const other = await loadOrder({ ...history47, service_name: "Find My iPhone [ FMI ] (ON/OFF)" });
    expect(planImport(other)).toMatchObject({ ok: false });

    const pending = await loadOrder({ ...history47, status: "PENDING" });
    const plan = planImport(pending as Extract<OrderResult, { ok: true }>);
    expect(plan.ok).toBe(false);
  });
});
