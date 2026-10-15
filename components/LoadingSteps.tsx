"use client";

import { useEffect, useState } from "react";

// El servidor hace todo en una sola petición; los pasos avanzan según el tiempo típico.
const STEP_MS = 3_000;
const STEPS = ["Detectando la marca y revisando blacklist", "Revisando bloqueos y procedencia según la marca"];

function Spinner() {
  return (
    <span
      className="inline-block size-4 animate-spin rounded-full border-2 border-muted/40 border-t-accent"
      aria-hidden
    />
  );
}

export function LoadingSteps() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 250);
    return () => clearInterval(timer);
  }, []);

  const current = Math.min(STEPS.length - 1, Math.floor(elapsed / STEP_MS));
  return (
    <div className="rounded-xl border border-line bg-card p-4" role="status">
      <ol className="space-y-2">
        {STEPS.map((name, i) => (
          <li key={name} className={`flex items-center gap-3 ${i > current ? "text-muted" : ""}`}>
            {i < current ? <span className="w-4 text-center text-ok">✓</span> : i === current ? <Spinner /> : <span className="w-4 text-center">·</span>}
            {name}…
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-muted">
        En iPhone se consulta con Apple y puede tardar hasta 45 segundos ·{" "}
        <span className="tabular-nums">{Math.floor(elapsed / 1000)} s</span>
      </p>
    </div>
  );
}
