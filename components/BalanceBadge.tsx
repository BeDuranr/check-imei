"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, readError } from "@/lib/client-fetch";
import { LOW_BALANCE_USD } from "@/lib/constants";
import { formatUsd } from "@/lib/format";

/** Otros componentes piden refrescar el saldo con `window.dispatchEvent(new Event(BALANCE_REFRESH))`. */
export const BALANCE_REFRESH = "balance:refresh";

export function BalanceBadge() {
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (fresh: boolean) => {
    try {
      const res = await apiFetch(`/api/balance${fresh ? "?fresh=1" : ""}`);
      if (!res.ok) {
        setError(await readError(res, "Saldo no disponible"));
        return;
      }
      const data = (await res.json()) as { balance: number };
      setBalance(data.balance);
      setError(null);
    } catch {
      setError("Saldo no disponible");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
    void load(false);
    const onRefresh = () => void load(true);
    window.addEventListener(BALANCE_REFRESH, onRefresh);
    return () => window.removeEventListener(BALANCE_REFRESH, onRefresh);
  }, [load]);

  if (error) {
    return (
      <span className="rounded-full bg-bad-bg px-2.5 py-1 text-xs font-medium text-bad" title={error}>
        Saldo: error
      </span>
    );
  }
  if (balance === null) {
    return <span className="rounded-full bg-card px-2.5 py-1 text-xs text-muted">Saldo…</span>;
  }

  const low = balance < LOW_BALANCE_USD;
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
        low ? "bg-bad-bg text-bad" : "bg-card text-fg"
      }`}
      title={low ? "Saldo bajo: recarga créditos en imeicheck.com" : "Saldo en imeicheck.com"}
    >
      {low && "⚠ "}
      {formatUsd(balance)}
    </span>
  );
}
