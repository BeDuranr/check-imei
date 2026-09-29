import "server-only";
import { NextResponse } from "next/server";

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Loguea el error del servidor (sin datos sensibles) y responde un mensaje genérico. */
export function serverError(context: string, err: unknown) {
  const detail = err instanceof Error ? err.message : typeof err === "object" ? JSON.stringify(err) : String(err);
  console.error(`[${context}]`, detail);
  return jsonError("Error interno del servidor. Revisa la configuración de la base de datos.", 500);
}
