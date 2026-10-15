import { NextResponse, type NextRequest } from "next/server";
import { LEVELS, PLATFORM_LABEL, PLATFORM_LEVEL_SERVICES, PLATFORMS, type Level, type Platform } from "@/lib/constants";
import { expireStalePending, failCheck, findRecentSuccess, finishCheck, insertPending, upsertDeviceModel } from "@/lib/db";
import { userMessage } from "@/lib/errors";
import { jsonError, serverError } from "@/lib/http";
import { createOrder } from "@/lib/imeicheck";
import { validateImei } from "@/lib/imei";
import { runServices } from "@/lib/run-check";

export const dynamic = "force-dynamic";
// El servicio 47 tarda ~30 s; el descarte son 3 llamadas con 2,5 s de espera; Samsung son 2 llamadas.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    imei?: unknown;
    level?: unknown;
    platform?: unknown;
    force?: unknown;
  } | null;
  if (!body) return jsonError("Solicitud inválida.", 400);

  const level = body.level as Level;
  if (!LEVELS.includes(level)) return jsonError("Nivel de chequeo inválido.", 400);

  const platform = (body.platform ?? "iphone") as Platform;
  if (!PLATFORMS.includes(platform)) return jsonError("Marca no soportada.", 400);
  if (PLATFORM_LEVEL_SERVICES[platform][level].length === 0) {
    return jsonError(`Ese chequeo no está disponible para ${PLATFORM_LABEL[platform]}.`, 400);
  }

  const validation = validateImei(body.imei);
  if (!validation.ok) return jsonError(validation.error, 400);
  const { imei } = validation;

  let checkId: string | null = null;
  try {
    if (body.force !== true) {
      const cached = await findRecentSuccess(imei, level, platform);
      if (cached) return NextResponse.json({ cached: true, check: cached });
    }

    await expireStalePending(imei, level);
    checkId = await insertPending(imei, level, platform);
    if (!checkId) return jsonError("Ya hay una consulta en curso para este IMEI.", 409);

    const result = await runServices(level, imei, { createOrder }, platform);
    const check = await finishCheck(checkId, result);

    if (result.status !== "failed") {
      await upsertDeviceModel(imei, check.model).catch((err) => console.error("[check] upsert device", err));
    }

    if (result.brandMismatch) {
      return jsonError(
        `Este IMEI es de un equipo ${result.brandMismatch}, no ${PLATFORM_LABEL[platform]}. Cambia la marca y vuelve a intentar (solo se cobró el blacklist).`,
        422,
        { check },
      );
    }
    if (result.status === "failed") {
      const { kind, message } = result.firstError ?? { kind: "error" as const, message: "" };
      console.error("[check] provider failed", { service: result.entries.at(-1)?.service, kind, message });
      return jsonError(userMessage(kind, message), 502, { check });
    }
    return NextResponse.json({ cached: false, check });
  } catch (err) {
    if (checkId) await failCheck(checkId, err instanceof Error ? err.message : "Unexpected error").catch(() => {});
    return serverError("check", err);
  }
}
