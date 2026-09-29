# Chequeo IMEI

Página privada para revisar el IMEI de iPhones usados antes de comprarlos para reventa.
Consulta imeicheck.com desde el servidor, guarda cada resultado en Supabase y muestra un veredicto verde / amarillo / rojo.

## Puesta en marcha

1. `npm install`
2. Copia `.env.example` a `.env.local` y completa:
   - `IMEICHECK_API_KEY`: key de imeicheck.com (con la restricción de IP **desactivada**).
   - `APP_PASSWORD`: contraseña de acceso. Usa una larga, porque la página es pública en internet.
   - `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: en Supabase, *Project Settings → API*.
3. En Supabase, abre *SQL Editor* y ejecuta [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql)
   (o `supabase db push` si usas la CLI).
4. `npm run dev` y abre http://localhost:3000.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Tests (Vitest): IMEI, parser, veredicto, cliente del proveedor, sesión |
| `npm run typecheck` / `npm run lint` | Verificación de tipos y lint |
| `npm run build` | Build de producción |

## Deploy en Vercel

1. Importa el repo en Vercel.
2. Agrega las mismas variables de entorno (sin `NEXT_PUBLIC_`).
3. `/api/check` usa `maxDuration = 60`. Confirma que tu plan permite 60 s (el servicio 47 tarda ~30 s).

## Notas de diseño

- **Next.js 16**: el `middleware.ts` del plan ahora se llama [`proxy.ts`](proxy.ts); funciona igual.
- **Sesión**: cookie `httpOnly`, `sameSite=strict`, `secure` en producción, firmada con HMAC y con duración de 30 días.
  Si cambias `APP_PASSWORD` (o `SESSION_SECRET`), se cierran todas las sesiones.
- **Bloqueo de duplicados**: un índice único parcial (`status = 'pending'`) impide dos consultas simultáneas del mismo IMEI y nivel.
  Un `pending` de más de 2 minutos se da por abandonado.
- **Caché**: un chequeo `success` del mismo IMEI y nivel de los últimos 7 días se reutiliza sin cobrar (salvo con "Consultar de nuevo").
- **Lista de compañías**: `CARRIER_SELLERS` en [`lib/classify.ts`](lib/classify.ts).
- Se agregó la columna `checks.model` para buscar por modelo en el historial.
