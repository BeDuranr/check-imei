import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userMessage } from "../lib/errors";
import { createOrder, getBalance, redactKey } from "../lib/imeicheck";
import service1 from "./fixtures/service1.json";
import service47 from "./fixtures/service47.json";

const KEY = "test-key-123";

function mockFetch(body: unknown) {
  const fetchMock = vi.fn(async (..._args: [URL]) => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("IMEICHECK_API_KEY", KEY);
  vi.stubEnv("IMEICHECK_BASE_URL", "https://example.test/api/");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("createOrder", () => {
  it("normaliza una respuesta exitosa", async () => {
    const fetchMock = mockFetch(service1);
    const r = await createOrder(1, "490154203237518");
    const url = fetchMock.mock.calls[0][0];
    expect(url.pathname).toBe("/api/create");
    expect(url.searchParams.get("service")).toBe("1");
    expect(r).toMatchObject({ ok: true, orderId: 111622059, price: 0.01, object: service1.object });
  });

  it("convierte object: false en null", async () => {
    mockFetch(service47);
    const r = await createOrder(47, "490154203237518");
    expect(r.ok && r.object).toBeNull();
    expect(r.ok && r.price).toBe(0.75);
  });

  it("distingue failed y error", async () => {
    mockFetch({ status: "failed", imei: "123", cost: 0, response: "Invalid IMEI/SN" });
    expect(await createOrder(1, "123")).toMatchObject({ ok: false, kind: "failed", message: "Invalid IMEI/SN" });

    mockFetch({ status: "error", response: "Invalid ApiKey" });
    expect(await createOrder(1, "123")).toMatchObject({ ok: false, kind: "error", message: "Invalid ApiKey" });
  });

  it("errores de red → network, sin exponer la URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError(`fetch failed https://example.test/api/create?key=${KEY}`);
      }),
    );
    const r = await createOrder(1, "490154203237518");
    expect(r).toMatchObject({ ok: false, kind: "network" });
    expect(JSON.stringify(r)).not.toContain(KEY);
  });

  it("nunca guarda la key en raw", async () => {
    mockFetch({ status: "error", response: `bad key ${KEY}`, key: KEY });
    const r = await createOrder(1, "1");
    expect(JSON.stringify(r.raw)).not.toContain(KEY);
    expect(redactKey({ apiKey: "x", nested: [KEY] }, KEY)).toEqual({ nested: ["[redacted]"] });
  });
});

describe("getBalance", () => {
  it("convierte el saldo a número", async () => {
    mockFetch({ balance: "0.05" });
    expect(await getBalance()).toEqual({ ok: true, balance: 0.05 });
  });

  it("propaga error de key", async () => {
    mockFetch({ status: "error", response: "Invalid ApiKey" });
    expect(await getBalance()).toMatchObject({ ok: false, kind: "error" });
  });
});

describe("userMessage", () => {
  it("traduce los errores conocidos", () => {
    expect(userMessage("failed", "Invalid IMEI/SN")).toBe("El IMEI no es válido. Revísalo y vuelve a intentar.");
    expect(userMessage("error", "Invalid ApiKey")).toContain("configuración");
    expect(userMessage("error", "Wrong IP address")).toContain("configuración");
    expect(userMessage("error", "Insufficient balance")).toContain("saldo");
    expect(userMessage("network", "Timeout")).toContain("tardó demasiado");
    expect(userMessage("error", "Something weird")).toBe("No se pudo completar la consulta.");
  });
});
