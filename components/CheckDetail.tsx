"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, readError } from "@/lib/client-fetch";
import { combineChecks, latestPerLevel } from "@/lib/combine";
import { LEVEL_LABEL } from "@/lib/constants";
import { formatDateTime, formatUsd } from "@/lib/format";
import type { Check, Device } from "@/lib/types";
import { DeviceForm } from "./DeviceForm";
import { ReportCard } from "./ReportCard";
import { VerdictBadge } from "./VerdictBanner";

interface DetailResponse {
  check: Check;
  device: Device | null;
  related: Check[];
}

export function CheckDetail({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/api/checks/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res, "No se pudo cargar el chequeo."));
        setData(await res.json());
      })
      .catch((err: Error) => setError(err.message));
  }, [id]);

  const parts = useMemo(() => (data ? latestPerLevel(data.related) : []), [data]);
  // Con descarte y procedencia se muestra el reporte combinado; si no, el chequeo abierto.
  const main = useMemo(() => (data ? (parts.length > 1 ? combineChecks(data.related) : null) ?? data.check : null), [data, parts]);

  return (
    <div className="space-y-4">
      <Link href="/historial" className="text-sm text-accent">
        ← Volver al historial
      </Link>
      {error && <p className="rounded-xl bg-bad-bg px-4 py-3 text-bad">{error}</p>}
      {!data && !error && <p className="text-muted">Cargando…</p>}
      {data && main && (
        <>
          <ReportCard
            check={main}
            combinedFrom={parts.length > 1 ? parts : undefined}
            related={data.related}
            // Lleva a Chequear con el IMEI cargado; la consulta paga se lanza desde ahí.
            onProcedencia={() => router.push(`/?imei=${main.imei}`)}
          />

          {data.related.length > 1 && (
            <section className="space-y-2">
              <h2 className="font-semibold">Chequeos de este IMEI</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
                {data.related.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(openId === c.id ? null : c.id)}
                      aria-expanded={openId === c.id}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-bg/50"
                    >
                      <VerdictBadge verdict={c.verdict} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{LEVEL_LABEL[c.level]}</span>
                        <span className="block text-sm text-muted">
                          {formatDateTime(c.createdAt)}
                          {c.status === "partial" && " · incompleto"}
                          {c.status === "failed" && " · falló"}
                        </span>
                      </span>
                      <span className="text-sm tabular-nums">{formatUsd(c.costUsd)}</span>
                      <span className="text-muted">{openId === c.id ? "▴" : "▾"}</span>
                    </button>
                    {openId === c.id && (
                      <div className="border-t border-line bg-bg/40 p-3">
                        <ReportCard check={c} related={data.related} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <DeviceForm checkId={data.check.id} device={data.device} />
        </>
      )}
    </div>
  );
}
