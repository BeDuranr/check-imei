# AGENTS.md

Guía para agentes de IA (Claude Code, Codex, Cursor, Copilot, Gemini, etc.) que trabajen en este repo.

## Qué es

Página web privada (un solo usuario) para revisar el IMEI de iPhones usados **antes de comprarlos para reventa**.
Consulta la API de imeicheck.com **desde el servidor**, guarda cada resultado en Supabase y muestra un veredicto:
verde (apto), amarillo (revisar) o rojo (no comprar). La pregunta central es si el equipo se compró en **retail** o
con **compañía**, y si tiene bloqueos (blacklist, MDM, iCloud perdido).

La interfaz, los mensajes, los comentarios del código y los commits están en **español de Chile**. Mantén ese idioma.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4 (configuración en `app/globals.css`, sin `tailwind.config`)
- Supabase (Postgres), usado **solo desde el servidor** con la service role key
- Vitest para tests
- Deploy en Vercel (rama `main`, cada push despliega)

## Comandos

```bash
npm install
npm run dev         # http://localhost:3000
npm test            # vitest run
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm run build       # build de producción
```

Antes de dar un cambio por terminado, corre `npm test`, `npm run typecheck` y `npm run lint`. Los tres deben pasar sin errores.

## Estructura

```
proxy.ts                  # protección con contraseña de todas las rutas (en Next 16 reemplaza a middleware.ts)
app/
  layout.tsx              # html/body, tema oscuro por defecto
  (app)/                  # páginas con header: / (Chequear), /historial, /historial/[id]
  login/                  # página pública de login
  api/
    check/route.ts        # POST: ejecuta un chequeo (maxDuration = 60)
    balance/route.ts      # GET: saldo del proveedor (caché 60 s, ?fresh=1 la salta)
    checks/route.ts       # GET: historial agrupado por IMEI (page, q, verdict); con ?imei= lista chequeos sueltos
    checks/[id]/route.ts  # GET detalle + `related` (todos los chequeos del mismo IMEI), PATCH decisión/precio/notas
    import/route.ts       # POST: importa una orden ya pagada (servicio 47) vía /history, sin cobrar
    login/route.ts        # GET estado de sesión, POST login, DELETE logout
components/               # componentes de cliente (UI)
lib/
  constants.ts            # servicios, precios, niveles (sin secretos, usable en cliente)
  types.ts                # tipos compartidos (DeviceReport, Check, Device…)
  imei.ts                 # normalización y validación Luhn
  parse-result.ts         # HTML del proveedor → DeviceReport
  classify.ts             # veredicto y origen (lista CARRIER_SELLERS)
  run-check.ts            # orquesta los servicios de un nivel (inyección de dependencias, testeable)
  imeicheck.ts            # cliente HTTP del proveedor (server-only): createOrder, getOrder, getBalance
  import-order.ts         # convierte una orden de /history en un chequeo (lógica pura)
  errors.ts               # traduce errores del proveedor a mensajes para el usuario
  db.ts                   # acceso a Supabase (server-only)
  auth.ts                 # firma/verificación HMAC de la cookie de sesión (Web Crypto)
  combine.ts              # une descarte + procedencia del mismo IMEI y agrupa el historial (lógica pura)
  export-fields.ts        # elige y traduce los datos clave para la imagen exportable (lógica pura)
  report-image.ts         # dibuja la imagen exportable con canvas (solo navegador, sin librerías)
supabase/migrations/      # SQL del esquema; se ejecuta a mano en el SQL Editor de Supabase
tests/                    # tests de Vitest + fixtures con respuestas reales del proveedor
```

## Reglas de seguridad (obligatorias)

1. **La API key de imeicheck nunca llega al navegador.** Va como `?key=` en la URL, así que solo se usa en
   `lib/imeicheck.ts`, que importa `server-only`. Nada de variables `NEXT_PUBLIC_`.
2. **Nunca loguear URLs del proveedor ni `err.message` de fetch** (podrían contener la key). Las respuestas crudas se
   guardan pasadas por `redactKey`.
3. **Nunca mostrar al usuario el mensaje crudo del proveedor.** Usar `userMessage()` de `lib/errors.ts`; el mensaje real
   se guarda en `checks.error_message`.
4. **No renderizar el HTML del proveedor** (`dangerouslySetInnerHTML`). Siempre pasar por `parse-result.ts` y mostrar
   texto plano.
5. Todas las rutas (páginas y `/api/*`) están protegidas por `proxy.ts`, salvo `/login` y `/api/login`. Si agregas una
   ruta pública, justifícalo.
6. Supabase: solo con la service role desde el servidor (`lib/db.ts`). RLS activado y sin políticas públicas.
7. Nunca commitear `.env.local` ni pegar keys en código, tests, logs o commits. Los fixtures usan IMEIs enmascarados.

## Reglas de dominio

- **Niveles:** `descarte` = servicios 1 → 5 → 4 en secuencia, con **2,5 s de espera** entre cada uno (el proveedor
  rechaza el mismo IMEI dos veces en menos de 2 s). `procedencia` = servicio 47 (~30 s de respuesta).
- **Caché:** un chequeo `success` del mismo IMEI y nivel de los últimos 7 días se devuelve sin volver a cobrar,
  salvo con `force: true`.
- **Duplicados:** índice único parcial `(imei, level) where status = 'pending'`. Un `pending` de más de 2 minutos se da
  por abandonado.
- **Origen:** se decide **solo por `Sold By`** comparado con `CARRIER_SELLERS` en `lib/classify.ts`. El campo `Carrier`
  y la política de activación **no** sirven para esto en Chile (las compañías venden equipos liberados); se muestran
  solo como información.
- **Veredicto:** rojo = blacklist no limpia, iCloud perdido/borrado o MDM ON. Amarillo = compañía, comprado fuera de
  Chile, FMI ON, reemplazo, loaner, servicio fallido o falta procedencia. Verde = nada de lo anterior y retail.
- **Historial por IMEI:** se muestra una fila por equipo. El reporte combinado toma el último chequeo de cada
  nivel (procedencia manda, el descarte completa, p. ej. iCloud) y recalcula el veredicto con `combineChecks`.
- Cualquier cambio en `classify.ts` o `parse-result.ts` necesita tests nuevos o actualizados.

## Formatos reales del proveedor (verificados)

- `price` y `balance` vienen como **string** → `parseFloat`.
- Éxito: `status: "success"`, con `orderId`, `price`, `result` (HTML) y `object`.
  - Servicio 1: `object` con `model`, `fmiOn` (boolean).
  - Servicio 5: `object` con `blacklistStatus` y `gsmaBlacklisted` (**boolean**: `true` = blacklisted).
  - Servicio 4: `object` con `fmiOn` y `lostMode` (**boolean**), más `iCloud Status` en el HTML.
  - Servicio 47: `object: false`; todo se saca del HTML.
- Fallido (`status: "failed"`): usa `cost` y `response`, sin `price` ni `result`. No cobra.
- Error de sistema (`status: "error"`): `response` con el motivo (key inválida, IP, saldo).
- `/history` usa otros nombres (`order_id`, `credit`, `status` en mayúsculas), **no trae `object`** ni el ID del
  servicio (solo `service_name`); por eso todo se guarda en la base de datos al crear la orden. Sirve para importar
  órdenes hechas fuera de la página. Fechas en UTC. Orden inexistente → `status: "error"`, `response: "Invalid OrderId"`.
- En el HTML de `/history` los atributos traen comillas escapadas (`<font color=\"#008000\">`); el parser las limpia igual.
- En el HTML hay claves repetidas (`IMEI`, `Model`) y con espacio antes de `:`. El parser se queda con la **primera**
  aparición y quita el punto final de valores como `Unlock.`.

Los fixtures en `tests/fixtures/` son respuestas reales; úsalos como referencia antes de suponer un formato.

## Convenciones de código

- Next 16: `params` en páginas y route handlers es una **Promise** (`const { id } = await params`).
- Route handlers: `export const dynamic = "force-dynamic"`; validar el body y responder errores en español con
  `jsonError()` / `serverError()` de `lib/http.ts`.
- Lógica pura en `lib/` sin dependencias de Next, para poder testearla. Inyecta dependencias externas (ver `run-check.ts`).
- Componentes de cliente usan `apiFetch()` (`lib/client-fetch.ts`), que redirige al login si la sesión venció.
- Estilos con los tokens de `app/globals.css` (`bg-card`, `text-muted`, `border-line`, `text-ok`/`warn`/`bad`…), no con
  colores sueltos. Tema oscuro por defecto; cualquier UI nueva debe verse bien en ambos temas.
- Mobile-first: se usa desde el celular revisando equipos en persona.
- Imports con alias `@/` en `app/` y `components/`; imports relativos dentro de `lib/`.
- Formatos para Chile en `lib/format.ts` (`es-CL`, zona `America/Santiago`).

## Cambios de base de datos

Agrega un archivo nuevo numerado en `supabase/migrations/` (por ejemplo `002_...sql`); no edites los que ya se
aplicaron. Se ejecutan a mano en el SQL Editor de Supabase. Actualiza también `lib/db.ts` y `lib/types.ts`.

## Variables de entorno

Ver `.env.example`. Todas son solo de servidor: `IMEICHECK_API_KEY`, `IMEICHECK_BASE_URL`, `APP_PASSWORD`,
`SESSION_SECRET` (opcional), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. En Vercel se configuran en el panel del proyecto.

## Costos

Cada chequeo real cobra créditos (descarte US$0,05; procedencia US$0,75). **No ejecutes chequeos reales contra el
proveedor para probar** sin que el usuario lo pida; usa los tests y los fixtures. `/api/balance` es gratis.

## Fuera de alcance

Otras marcas (Samsung, etc.), múltiples usuarios, consultas masivas e integración de pagos.
