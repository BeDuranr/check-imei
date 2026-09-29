import type { Verdict } from "@/lib/types";

export const VERDICT_TITLE: Record<Verdict, string> = {
  verde: "Apto para comprar",
  amarillo: "Revisar con cuidado",
  rojo: "No comprar",
};

const STYLE: Record<Verdict, string> = {
  verde: "bg-green-600 text-white",
  amarillo: "bg-yellow-400 text-black",
  rojo: "bg-red-600 text-white",
};

const ICON: Record<Verdict, string> = { verde: "✓", amarillo: "!", rojo: "✕" };

export function VerdictBanner({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) {
    return (
      <div className="flex items-center gap-3 bg-line px-4 py-4 text-fg">
        <span className="text-2xl font-bold">?</span>
        <span className="text-xl font-bold">Sin resultado</span>
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-3 px-4 py-4 ${STYLE[verdict]}`}>
      <span className="flex size-8 items-center justify-center rounded-full bg-black/15 text-lg font-bold">
        {ICON[verdict]}
      </span>
      <span className="text-xl font-bold">{VERDICT_TITLE[verdict]}</span>
    </div>
  );
}

export function VerdictBadge({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return <span className="rounded-full bg-line px-2 py-0.5 text-xs font-semibold">Falló</span>;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STYLE[verdict]}`}>
      {verdict === "verde" ? "Verde" : verdict === "amarillo" ? "Amarillo" : "Rojo"}
    </span>
  );
}
