"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, readError } from "@/lib/client-fetch";
import { LEVEL_LABEL } from "@/lib/constants";
import { formatDateTime, formatUsd, maskImei } from "@/lib/format";
import type { CheckGroup } from "@/lib/combine";
import type { Origin, Verdict } from "@/lib/types";
import { VerdictBadge } from "./VerdictBanner";

const ORIGIN_LABEL: Record<Origin, string> = { retail: "Retail", compañia: "Compañía", desconocido: "Origen ?" };

interface ListResponse {
  groups: CheckGroup[];
  total: number;
  page: number;
  pageSize: number;
  monthTotalUsd: number | null;
}

export function ChecksTable() {
  const [page, setPage] = useState(1);
  const [verdict, setVerdict] = useState<Verdict | "">("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Espera a que se deje de escribir antes de buscar.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (verdict) params.set("verdict", verdict);
    if (q) params.set("q", q);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- indicador de carga al cambiar filtros
    setLoading(true);
    apiFetch(`/api/checks?${params}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res, "No se pudo cargar el historial."));
        setData((await res.json()) as ListResponse);
        setError(null);
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [page, verdict, q]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Historial</h1>
        {data?.monthTotalUsd != null && (
          <p className="text-sm text-muted">
            Gastado este mes: <span className="font-semibold text-fg">{formatUsd(data.monthTotalUsd)}</span>
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar IMEI o modelo"
          className="min-w-0 flex-1 rounded-xl border border-line bg-field px-3 py-2.5 outline-none focus:ring-2 focus:ring-accent/40"
        />
        <select
          value={verdict}
          onChange={(e) => {
            setVerdict(e.target.value as Verdict | "");
            setPage(1);
          }}
          className="rounded-xl border border-line bg-field px-3 py-2.5"
          aria-label="Filtrar por veredicto"
        >
          <option value="">Todos</option>
          <option value="verde">Verde</option>
          <option value="amarillo">Amarillo</option>
          <option value="rojo">Rojo</option>
        </select>
      </div>

      {error && <p className="rounded-xl bg-bad-bg px-4 py-3 text-bad">{error}</p>}

      {(data || !error) && (
      <ul className={`divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card ${loading ? "opacity-60" : ""}`}>
        {data?.groups.map((group) => (
          <li key={group.imei}>
            <Link href={`/historial/${group.openId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg/50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <VerdictBadge verdict={group.verdict} />
                  <span className="truncate font-medium">{group.model ?? "Modelo desconocido"}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-sm text-muted">
                  <span className="font-mono">{maskImei(group.imei)}</span>
                  {group.origin && group.origin !== "desconocido" && <span>· {ORIGIN_LABEL[group.origin]}</span>}
                  {group.partial && <span>· incompleto</span>}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {group.levels.map((level) => (
                    <span key={level} className="rounded-md bg-bg px-1.5 py-0.5 text-xs text-muted">
                      {LEVEL_LABEL[level]}
                    </span>
                  ))}
                  {group.count > group.levels.length && (
                    <span className="rounded-md bg-bg px-1.5 py-0.5 text-xs text-muted">{group.count} chequeos</span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right text-sm">
                <div className="tabular-nums">{formatUsd(group.totalCostUsd)}</div>
                <div className="text-xs text-muted">{formatDateTime(group.lastAt)}</div>
              </div>
            </Link>
          </li>
        ))}
        {data && data.groups.length === 0 && <li className="px-4 py-8 text-center text-muted">No hay chequeos.</li>}
        {!data && <li className="px-4 py-8 text-center text-muted">Cargando…</li>}
      </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-line px-3 py-2 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-muted">
            Página {page} de {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-line px-3 py-2 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
