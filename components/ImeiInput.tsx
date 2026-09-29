"use client";

import { normalizeImei, validateImei } from "@/lib/imei";

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ImeiInput({ value, onChange, disabled }: Props) {
  const digits = normalizeImei(value);
  const validation = validateImei(value);
  // Solo mostrar el error cuando ya hay 15+ dígitos o hay caracteres de más.
  const showError = !validation.ok && digits.length >= 15;

  return (
    <div>
      <label htmlFor="imei" className="mb-1.5 block text-sm font-medium">
        IMEI
      </label>
      <div className="relative">
        <input
          id="imei"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          maxLength={24}
          placeholder="15 dígitos"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={showError}
          aria-describedby="imei-help"
          className={`w-full rounded-xl border bg-field px-4 py-3.5 font-mono text-2xl tracking-wider outline-none transition focus:ring-2 disabled:opacity-60 ${
            showError
              ? "border-bad focus:ring-bad/40"
              : validation.ok
                ? "border-ok focus:ring-ok/40"
                : "border-line focus:ring-accent/40"
          }`}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm tabular-nums text-muted">
          {validation.ok ? <span className="text-ok">✓</span> : `${digits.length}/15`}
        </span>
      </div>
      <p id="imei-help" className={`mt-1.5 text-sm ${showError ? "text-bad" : "text-muted"}`}>
        {showError && !validation.ok ? validation.error : "Marca *#06# en el iPhone para ver el IMEI."}
      </p>
    </div>
  );
}
