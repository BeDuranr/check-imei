import { describe, expect, it } from "vitest";
import { buildReport, decodeEntities, htmlToLines, parseResultHtml } from "../lib/parse-result";
import service1 from "./fixtures/service1.json";
import service4 from "./fixtures/service4.json";
import service5 from "./fixtures/service5.json";
import service47 from "./fixtures/service47.json";

describe("parseResultHtml", () => {
  const pairs = parseResultHtml(service47.result);

  it("se queda con la primera aparición de claves repetidas", () => {
    expect(pairs["Model"]).toBe("iPhone 16 Pro Max");
    expect(pairs["IMEI"]).toBe("35556484XXXXXXX");
  });

  it("recorta espacios antes de los dos puntos", () => {
    expect(pairs["Replacement History"]).toBe("No Replacment");
    expect(pairs["Chimaera Locked"]).toBe("OFF");
  });

  it("quita el punto final y las etiquetas", () => {
    expect(pairs["Applied Activation Policy"]).toBe("Unlock");
    expect(pairs["FMI"]).toBe("ON");
  });

  it("guarda la línea sin dos puntos como modelo", () => {
    expect(parseResultHtml("iPhone 13 [Global]<br>IMEI: 1")).toEqual({ Model: "iPhone 13 [Global]", IMEI: "1" });
  });

  it("decodifica entidades HTML y acepta variantes de <br>", () => {
    expect(decodeEntities("A &amp; B &#233; &#x41; &nbsp;")).toBe("A & B é A  ");
    expect(htmlToLines("a<br/>b<BR />c<br>")).toEqual(["a", "b", "c"]);
  });
});

describe("buildReport", () => {
  it("extrae los campos clave del servicio 47", () => {
    const report = buildReport([{ html: service47.result, object: null }]);
    expect(report.soldBy).toBe("AMERICA MOVIL PERU SAC");
    expect(report.purchaseCountry).toBe("Peru");
    expect(report.fmi).toBe("ON");
    expect(report.mdm).toBe("OFF");
    expect(report.blacklist).toBe("Blacklisted");
    expect(report.model).toBe("iPhone 16 Pro Max");
    expect(report.purchaseDate).toBe("2025-01-04");
    expect(report.carrier).toBe("entel");
    expect(report.activationPolicy).toBe("Unlock");
    expect(report.replacementHistory).toBe("No Replacment");
    expect(report.loaner).toBe("No");
    expect(report.raw["Sold By"]).toBe("AMERICA MOVIL PERU SAC");
  });

  it("usa primero `object` y completa con el HTML (servicio 1)", () => {
    const report = buildReport([{ html: service1.result, object: service1.object }]);
    expect(report.model).toBe("iPhone 16 Pro Max (A3296) [Global]");
    expect(report.fmi).toBe("ON");
    expect(report.soldBy).toBeUndefined();
  });

  it("descarte real (1 → 5 → 4): booleanos de object con su significado", () => {
    const report = buildReport([service1, service5, service4].map((s) => ({ html: s.result, object: s.object })));
    expect(report.blacklist).toBe("Blacklisted");
    expect(report.icloudStatus).toBe("Clean");
    expect(report.fmi).toBe("ON");
    expect(report.model).toBe("iPhone 16 Pro Max (A3296) [Global]");
  });

  it("lostMode: true sin texto de iCloud se reporta como perdido", () => {
    const report = buildReport([{ html: "", object: { lostMode: true, blacklistStatus: false } }]);
    expect(report.icloudStatus).toBe("Lost Mode");
    expect(report.blacklist).toBe("Clean");
  });

  it("combina varios servicios sin pisar la primera aparición", () => {
    const report = buildReport([
      { html: service1.result, object: service1.object },
      { html: "Blacklist Status: Clean<br>Model: otro", object: null },
      { html: "iCloud Status: Lost Mode", object: null },
    ]);
    expect(report.model).toBe("iPhone 16 Pro Max (A3296) [Global]");
    expect(report.blacklist).toBe("Clean");
    expect(report.icloudStatus).toBe("Lost Mode");
  });
});
