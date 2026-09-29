"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, readError } from "@/lib/client-fetch";
import { LEVEL_LABEL, type Level } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { normalizeImei, validateImei } from "@/lib/imei";
import type { Check, CheckSummary } from "@/lib/types";
import { BALANCE_REFRESH } from "./BalanceBadge";
import { CheckActions } from "./CheckActions";
import { ImeiInput } from "./ImeiInput";
import { LoadingSteps } from "./LoadingSteps";
import { ReportCard } from "./ReportCard";

export function CheckPage() {
  const searchParams = useSearchParams();
  const [input, setInput] = useState(() => searchParams.get("imei") ?? "");
  const [loading, setLoading] = useState<Level | null>(null);
  const [result, setResult] = useState<{ check: Check; cached: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<CheckSummary | null>(null);

  const validation = validateImei(input);
  const imei = validation.ok ? validation.imei : null;

  // Aviso si este IMEI ya se revisó antes.
  useEffect(() => {
    if (!imei) return;
    const ctrl = new AbortController();
    apiFetch(`/api/checks?imei=${imei}&pageSize=1`, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items: CheckSummary[] } | null) => setRecent(data?.items[0] ?? null))
      .catch(() => {});
    return () => ctrl.abort();
  }, [imei]);

  function changeInput(value: string) {
    setInput(value);
    setError(null);
    setRecent(null);
    if (result && normalizeImei(value) !== result.check.imei) setResult(null);
  }

  async function run(level: Level, force = false) {
    if (!imei || loading) return;
    setLoading(level);
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imei, level, force }),
      });
      const data = (await res.json().catch(() => null)) as
        | { cached?: boolean; check?: Check; error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? "No se pudo completar la consulta.");
        if (data?.check?.report) setResult({ check: data.check, cached: false });
      } else if (data?.check) {
        setResult({ check: data.check, cached: !!data.cached });
        setRecent(null);
        if (!data.cached) window.dispatchEvent(new Event(BALANCE_REFRESH));
      }
    } catch {
      setError("No se pudo conectar con el servidor. Revisa tu conexión.");
    } finally {
      setLoading(null);
    }
  }

  async function showRecent() {
    if (!recent) return;
    const res = await apiFetch(`/api/checks/${recent.id}`);
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    const data = (await res.json()) as { check: Check };
    setResult({ check: data.check, cached: true });
    setRecent(null);
  }

  return (
    <div className="space-y-4">
      <ImeiInput value={input} onChange={changeInput} disabled={!!loading} />

      {recent && !loading && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">
          <p>
            Ya revisaste este IMEI el {formatDateTime(recent.createdAt)} ({LEVEL_LABEL[recent.level].toLowerCase()}).
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={showRecent} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-accent-fg">
              Ver resultado
            </button>
            <button
              type="button"
              onClick={() => run(recent.level, true)}
              className="rounded-lg border border-line bg-card px-3 py-1.5 font-medium"
            >
              Consultar de nuevo (cobra)
            </button>
          </div>
        </div>
      )}

      <CheckActions disabled={!imei || !!loading} loading={loading} onRun={(level) => run(level)} />

      {loading && <LoadingSteps level={loading} />}

      {error && (
        <p role="alert" className="rounded-xl bg-bad-bg px-4 py-3 text-bad">
          {error}
        </p>
      )}

      {result && (
        <ReportCard
          check={result.check}
          cached={result.cached}
          busy={!!loading}
          onProcedencia={() => run("procedencia")}
          onRecheck={result.cached ? () => run(result.check.level, true) : undefined}
        />
      )}
    </div>
  );
}
