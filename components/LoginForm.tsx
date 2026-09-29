"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** Solo rutas internas, para no permitir redirecciones a otros sitios. */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/";
}

export function LoginForm() {
  const next = safeNext(useSearchParams().get("next"));
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // La cookie es sameSite=strict: al abrir un link desde otra app no se envía y se llega aquí
  // aunque la sesión siga activa. Desde esta página sí se envía, así que se revisa y se sigue.
  useEffect(() => {
    fetch("/api/login")
      .then((res) => res.json())
      .then((data: { authenticated?: boolean }) => {
        if (data.authenticated) window.location.replace(next);
      })
      .catch(() => {});
  }, [next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.replace(next);
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "No se pudo ingresar.");
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-card p-6">
      <h1 className="text-xl font-semibold">Chequeo IMEI</h1>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">Contraseña</span>
        <input
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-line bg-field px-3 py-3 outline-none focus:ring-2 focus:ring-accent/40"
        />
      </label>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button
        type="submit"
        disabled={loading || !password}
        className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-accent-fg hover:brightness-110 disabled:opacity-60"
      >
        {loading ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
