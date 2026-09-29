"use client";

import { useState } from "react";
import { apiFetch, readError } from "@/lib/client-fetch";
import { DECISIONS, type Decision, type Device } from "@/lib/types";

const DECISION_LABEL: Record<Decision, string> = {
  pendiente: "Pendiente",
  comprado: "Comprado",
  descartado: "Descartado",
};

export function DeviceForm({ checkId, device }: { checkId: string; device: Device | null }) {
  const [decision, setDecision] = useState<Decision>(device?.decision ?? "pendiente");
  const [price, setPrice] = useState(device?.purchasePriceClp != null ? String(device.purchasePriceClp) : "");
  const [notes, setNotes] = useState(device?.notes ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const priceDigits = price.replace(/\D/g, "");
  const priceLabel = priceDigits ? Number(priceDigits).toLocaleString("es-CL") : "";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError(null);
    const res = await apiFetch(`/api/checks/${checkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, notes, purchasePrice: priceDigits ? Number(priceDigits) : null }),
    }).catch(() => null);
    if (!res?.ok) {
      setError(res ? await readError(res, "No se pudo guardar.") : "No se pudo conectar con el servidor.");
      setState("idle");
      return;
    }
    setState("saved");
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-2xl border border-line bg-card p-4">
      <h2 className="font-semibold">Seguimiento</h2>

      <fieldset>
        <legend className="mb-1.5 text-sm text-muted">Decisión</legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-bg p-1">
          {DECISIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDecision(d)}
              aria-pressed={decision === d}
              className={`rounded-lg px-2 py-2 text-sm font-medium ${
                decision === d ? "bg-card shadow-sm" : "text-muted hover:text-fg"
              }`}
            >
              {DECISION_LABEL[d]}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">Precio de compra (CLP)</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
          <input
            type="text"
            inputMode="numeric"
            value={priceLabel}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-line bg-field py-2.5 pl-7 pr-3 tabular-nums outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">Notas</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Estado de batería, detalles, vendedor…"
          className="w-full rounded-xl border border-line bg-field px-3 py-2.5 outline-none focus:ring-2 focus:ring-accent/40"
        />
      </label>

      {error && <p className="text-sm text-bad">{error}</p>}

      <button
        type="submit"
        disabled={state === "saving"}
        className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-accent-fg hover:brightness-110 disabled:opacity-60"
      >
        {state === "saving" ? "Guardando…" : state === "saved" ? "Guardado ✓" : "Guardar"}
      </button>
    </form>
  );
}
