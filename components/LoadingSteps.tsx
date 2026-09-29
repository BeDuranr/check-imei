"use client";

import { useEffect, useState } from "react";
import { LEVEL_SERVICES, SERVICES, type Level } from "@/lib/constants";

// El servidor hace todo en una sola petición; los pasos avanzan según el tiempo típico
// (≈0,5 s por servicio + 2,5 s de espera entre cada uno).
const STEP_MS = 3_000;

function Spinner() {
  return (
    <span
      className="inline-block size-4 animate-spin rounded-full border-2 border-muted/40 border-t-accent"
      aria-hidden
    />
  );
}

export function LoadingSteps({ level }: { level: Level }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 250);
    return () => clearInterval(timer);
  }, []);

  const seconds = Math.floor(elapsed / 1000);

  if (level === "procedencia") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-card p-4" role="status">
        <Spinner />
        <div>
          <p className="font-medium">Consultando con Apple, puede tardar hasta 30 segundos</p>
          <p className="text-sm tabular-nums text-muted">{seconds} s</p>
        </div>
      </div>
    );
  }

  const steps = LEVEL_SERVICES.descarte.map((s) => SERVICES[s].name);
  const current = Math.min(steps.length - 1, Math.floor(elapsed / STEP_MS));

  return (
    <div className="rounded-xl border border-line bg-card p-4" role="status">
      <ol className="space-y-2">
        {steps.map((name, i) => (
          <li key={name} className={`flex items-center gap-3 ${i > current ? "text-muted" : ""}`}>
            {i < current ? <span className="w-4 text-center text-ok">✓</span> : i === current ? <Spinner /> : <span className="w-4 text-center">·</span>}
            Revisando {name}…
          </li>
        ))}
      </ol>
    </div>
  );
}
