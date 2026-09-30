// Dibuja la imagen exportable con canvas (solo navegador). No usa librerías externas.

import type { ExportData, ExportTone } from "./export-fields";
import type { Verdict } from "./types";

const W = 1080;
const PAD = 64;
const LABEL_W = 340;

// Colores fijos (la imagen se ve igual en modo claro u oscuro y al compartirla).
const C = {
  bg: "#ffffff",
  headerBg: "#0f172a",
  headerKicker: "#94a3b8",
  headerText: "#ffffff",
  fg: "#0f172a",
  muted: "#64748b",
  line: "#e2e8f0",
  ok: "#15803d",
  warn: "#a16207",
  bad: "#b91c1c",
};

const VERDICT: Record<Verdict, { bg: string; fg: string; text: string }> = {
  verde: { bg: "#16a34a", fg: "#ffffff", text: "Apto para comprar" },
  amarillo: { bg: "#eab308", fg: "#000000", text: "Revisar con cuidado" },
  rojo: { bg: "#dc2626", fg: "#ffffff", text: "No comprar" },
};

function toneColor(tone: ExportTone | undefined): string {
  return tone ? C[tone] : C.fg;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** Dibuja (o solo mide, con draw = false) y devuelve el alto total. */
function paint(ctx: CanvasRenderingContext2D, data: ExportData, includeVerdict: boolean, family: string, draw: boolean) {
  const font = (size: number, weight: number) => (ctx.font = `${weight} ${size}px ${family}`);
  ctx.textBaseline = "top";

  if (draw) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, ctx.canvas.height);
  }

  // Encabezado: modelo y, opcionalmente, veredicto.
  font(56, 700);
  const titleLines = wrap(ctx, data.model, W - PAD * 2);
  const verdict = includeVerdict && data.verdict ? VERDICT[data.verdict] : null;
  const headerH = 64 + 28 + 20 + titleLines.length * 68 + (verdict ? 28 + 64 : 0) + 56;

  if (draw) {
    ctx.fillStyle = C.headerBg;
    ctx.fillRect(0, 0, W, headerH);
    font(24, 600);
    ctx.fillStyle = C.headerKicker;
    ctx.fillText("REPORTE DE IMEI", PAD, 64);
    font(56, 700);
    ctx.fillStyle = C.headerText;
    titleLines.forEach((line, i) => ctx.fillText(line, PAD, 64 + 28 + 20 + i * 68));
    if (verdict) {
      const top = 64 + 28 + 20 + titleLines.length * 68 + 28;
      font(30, 700);
      const w = ctx.measureText(verdict.text).width + 56;
      ctx.fillStyle = verdict.bg;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(PAD, top, w, 64, 32);
      else ctx.rect(PAD, top, w, 64);
      ctx.fill();
      ctx.fillStyle = verdict.fg;
      ctx.fillText(verdict.text, PAD + 28, top + 16);
    }
  }

  let y = headerH + 16;

  for (const section of data.sections) {
    y += 40;
    if (draw) {
      font(24, 700);
      ctx.fillStyle = C.muted;
      ctx.fillText(section.title.toUpperCase(), PAD, y);
    }
    y += 24 + 12;

    section.rows.forEach((row, i) => {
      font(30, 400);
      const labelLines = wrap(ctx, row.label, LABEL_W - 24);
      font(32, 600);
      const valueLines = wrap(ctx, row.value, W - PAD * 2 - LABEL_W);
      const rowH = Math.max(labelLines.length, valueLines.length) * 42 + 32;

      if (draw) {
        if (i > 0) {
          ctx.fillStyle = C.line;
          ctx.fillRect(PAD, y, W - PAD * 2, 2);
        }
        font(30, 400);
        ctx.fillStyle = C.muted;
        labelLines.forEach((line, j) => ctx.fillText(line, PAD, y + 18 + j * 42));
        font(32, 600);
        ctx.fillStyle = toneColor(row.tone);
        valueLines.forEach((line, j) => ctx.fillText(line, PAD + LABEL_W, y + 16 + j * 42));
      }
      y += rowH;
    });
  }

  y += 40;
  if (draw) {
    ctx.fillStyle = C.line;
    ctx.fillRect(PAD, y, W - PAD * 2, 2);
    font(24, 400);
    ctx.fillStyle = C.muted;
    ctx.fillText(data.footer, PAD, y + 28);
  }
  return y + 28 + 24 + 56;
}

export async function renderReportImage(data: ExportData, includeVerdict: boolean): Promise<Blob> {
  await document.fonts?.ready;
  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("Canvas no disponible");
  const height = Math.ceil(paint(measure, data, includeVerdict, family, false));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  paint(ctx, data, includeVerdict, family, true);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar la imagen"))), "image/png"),
  );
}
