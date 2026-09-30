"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, readError } from "@/lib/client-fetch";

/** Trae al historial una Procedencia hecha fuera de la página (en imeicheck.com o por la API). */
export function ImportOrder() {
  const router = useRouter();
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderId.replace(/\D/g, "") }),
      });
      if (!res.ok) {
        setError(await readError(res, "No se pudo importar la orden."));
        return;
      }
      const { id } = (await res.json()) as { id: string };
      router.push(`/historial/${id}`);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="rounded-2xl border border-line bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-accent">
        Importar orden de imeicheck.com
      </summary>
      <form onSubmit={submit} className="space-y-2 border-t border-line p-4">
        <p className="text-sm text-muted">
          Para una Procedencia hecha fuera de esta página. Pega el Order ID; no se vuelve a cobrar.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="Ej: 111622833"
            className="min-w-0 flex-1 rounded-xl border border-line bg-field px-3 py-2.5 tabular-nums outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="submit"
            disabled={loading || !orderId.replace(/\D/g, "")}
            className="rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-fg hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Importando…" : "Importar"}
          </button>
        </div>
        {error && <p className="text-sm text-bad">{error}</p>}
      </form>
    </details>
  );
}
