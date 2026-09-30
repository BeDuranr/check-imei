"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/client-fetch";
import { LEVEL_LABEL, LEVELS } from "@/lib/constants";
import { buildExportData } from "@/lib/export-fields";
import { formatDate } from "@/lib/format";
import { renderReportImage } from "@/lib/report-image";
import type { Check, CheckSummary } from "@/lib/types";

interface Rendered {
  includeVerdict: boolean;
  file: File;
  url: string;
}

export function ExportImageDialog({ check, onClose }: { check: Check; onClose: () => void }) {
  const [includeVerdict, setIncludeVerdict] = useState(false);
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Chequeos del otro nivel para el mismo IMEI (p. ej. la procedencia si se abrió un descarte).
  const [others, setOthers] = useState<Check[]>([]);
  const checks = useMemo(() => [check, ...others], [check, others]);
  const data = useMemo(() => buildExportData(checks), [checks]);
  const hasProcedencia = checks.some((c) => c.level === "procedencia");

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const res = await apiFetch(`/api/checks?imei=${check.imei}&pageSize=20`, { signal: ctrl.signal });
      if (!res.ok) return;
      const { items } = (await res.json()) as { items: CheckSummary[] };
      // La lista viene ordenada de más nuevo a más antiguo: se usa el último de cada otro nivel.
      const wanted = LEVELS.filter((level) => level !== check.level)
        .map((level) => items.find((item) => item.level === level))
        .filter((item): item is CheckSummary => !!item);
      const details = await Promise.all(
        wanted.map(async (item) => {
          const r = await apiFetch(`/api/checks/${item.id}`, { signal: ctrl.signal });
          return r.ok ? ((await r.json()) as { check: Check }).check : null;
        }),
      );
      setOthers(details.filter((c): c is Check => !!c?.report));
    })().catch(() => {
      // sin datos extra: la imagen queda solo con este chequeo
    });
    return () => ctrl.abort();
  }, [check.imei, check.level]);
  const fileName = `iphone-${check.imei.slice(-4)}-${check.createdAt.slice(0, 10)}.png`;
  const generating = !error && rendered?.includeVerdict !== includeVerdict;

  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    renderReportImage(data, includeVerdict)
      .then((blob) => {
        if (cancelled) return;
        // La imagen anterior se libera recién cuando llega la nueva, para no dejar la vista previa en blanco.
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setRendered({ includeVerdict, file: new File([blob], fileName, { type: "image/png" }), url });
        setError(null);
      })
      .catch(() => !cancelled && setError("No se pudo generar la imagen."));
    return () => {
      cancelled = true;
    };
  }, [data, includeVerdict, fileName]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canShare =
    !!rendered && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [rendered.file] });

  async function share() {
    if (!rendered) return;
    try {
      await navigator.share({ files: [rendered.file], title: data.model });
    } catch {
      // cancelado por el usuario
    }
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Exportar imagen"
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-2xl bg-card p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Exportar imagen</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-muted hover:text-fg" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {checks.length > 1 && (
          <p className="text-sm text-muted">
            Combina:{" "}
            {checks.map((c) => `${LEVEL_LABEL[c.level]} (${formatDate(c.createdAt)})`).join(" + ")}
          </p>
        )}

        {!hasProcedencia && (
          <p className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">
            Este es un descarte rápido: no trae lugar, país ni fecha de compra, ni garantía. Para que la imagen los
            incluya, haz la <strong>Procedencia completa</strong> de este IMEI.
          </p>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeVerdict} onChange={(e) => setIncludeVerdict(e.target.checked)} />
          Incluir veredicto
        </label>

        <div className="relative min-h-40 overflow-hidden rounded-xl border border-line bg-bg">
          {rendered && (
            // eslint-disable-next-line @next/next/no-img-element -- imagen generada localmente (blob:)
            <img src={rendered.url} alt={`Reporte de ${data.model}`} className={`w-full ${generating ? "opacity-50" : ""}`} />
          )}
          {!rendered && !error && <p className="p-6 text-center text-sm text-muted">Generando…</p>}
          {error && <p className="p-6 text-center text-sm text-bad">{error}</p>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {canShare && (
            <button
              type="button"
              onClick={share}
              disabled={generating}
              className="rounded-xl bg-accent px-4 py-3 font-semibold text-accent-fg hover:brightness-110 disabled:opacity-50"
            >
              Compartir
            </button>
          )}
          <a
            href={rendered?.url}
            download={fileName}
            aria-disabled={!rendered || generating}
            className={`rounded-xl border border-line px-4 py-3 text-center font-semibold hover:border-accent ${
              canShare ? "" : "col-span-2"
            } ${!rendered || generating ? "pointer-events-none opacity-50" : ""}`}
          >
            Descargar
          </a>
        </div>
      </div>
    </div>
  );
}
