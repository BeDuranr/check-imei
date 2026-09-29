import type { Level } from "./constants";

export type Verdict = "verde" | "amarillo" | "rojo";
export type Origin = "retail" | "compañia" | "desconocido";
export type CheckStatus = "pending" | "success" | "partial" | "failed";
export type Decision = "pendiente" | "comprado" | "descartado";

export const DECISIONS: Decision[] = ["pendiente", "comprado", "descartado"];

export interface DeviceReport {
  model?: string;
  serial?: string;
  soldBy?: string;
  purchaseCountry?: string;
  purchaseDate?: string; // YYYY-MM-DD
  firstActivationDate?: string;
  carrier?: string;
  activationPolicy?: string; // "Applied Activation Policy"
  warrantyStatus?: string;
  fmi?: "ON" | "OFF";
  mdm?: "ON" | "OFF";
  blacklist?: string; // "Clean", "Blacklisted", etc.
  icloudStatus?: string; // servicio 4
  replacementHistory?: string;
  loaner?: string;
  raw: Record<string, string>; // todos los pares parseados
}

export interface Classification {
  verdict: Verdict;
  origin: Origin;
  reasons: string[];
}

/** Servicio que no se pudo completar, con mensaje ya traducido para el usuario. */
export interface ServiceIssue {
  service: number;
  name: string;
  message: string;
}

/** Chequeo tal como lo recibe el cliente (sin respuestas crudas del proveedor). */
export interface Check {
  id: string;
  imei: string;
  level: Level;
  status: CheckStatus;
  model: string | null;
  orderIds: number[];
  services: number[];
  costUsd: number;
  report: DeviceReport | null;
  verdict: Verdict | null;
  origin: Origin | null;
  reasons: string[];
  issues: ServiceIssue[];
  createdAt: string;
}

export type CheckSummary = Pick<
  Check,
  "id" | "imei" | "level" | "status" | "model" | "verdict" | "origin" | "costUsd" | "createdAt"
>;

export interface Device {
  imei: string;
  model: string | null;
  purchasePriceClp: number | null;
  decision: Decision;
  notes: string;
  updatedAt: string | null;
}
