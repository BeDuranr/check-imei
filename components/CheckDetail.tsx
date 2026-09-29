"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, readError } from "@/lib/client-fetch";
import type { Check, Device } from "@/lib/types";
import { DeviceForm } from "./DeviceForm";
import { ReportCard } from "./ReportCard";

export function CheckDetail({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<{ check: Check; device: Device | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/api/checks/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res, "No se pudo cargar el chequeo."));
        setData(await res.json());
      })
      .catch((err: Error) => setError(err.message));
  }, [id]);

  return (
    <div className="space-y-4">
      <Link href="/historial" className="text-sm text-accent">
        ← Volver al historial
      </Link>
      {error && <p className="rounded-xl bg-bad-bg px-4 py-3 text-bad">{error}</p>}
      {!data && !error && <p className="text-muted">Cargando…</p>}
      {data && (
        <>
          <ReportCard
            check={data.check}
            // Lleva a Chequear con el IMEI cargado; la consulta paga se lanza desde ahí.
            onProcedencia={() => router.push(`/?imei=${data.check.imei}`)}
          />
          <DeviceForm checkId={data.check.id} device={data.device} />
        </>
      )}
    </div>
  );
}
