# Plan: soporte para teléfonos Android

Extensión de la página de chequeo IMEI (hoy solo iPhone) para revisar también equipos Android antes de comprarlos
para reventa. Reutiliza todo lo que ya existe: login, validación de IMEI, historial agrupado por IMEI, caché, bloqueo de
duplicados, imagen exportable e importación de órdenes.

Estado: **propuesta**. Los IDs y precios de los servicios Android están marcados como _por confirmar_ (etapa 0).

---

## 1. Objetivo

Responder para un Android las mismas preguntas que para un iPhone:

> ¿El equipo se compró **liberado (retail)** o **con compañía**, viene de **Chile**, y tiene algún **bloqueo** actual
> (blacklist, financiamiento, cuenta del dueño, MDM)?

Marcas prioritarias (las más comunes en reventa en Chile): **Samsung** y **Xiaomi**. El resto (Motorola, Huawei,
Honor, Oppo, Pixel, etc.) entra como **"Otro Android"** con un chequeo genérico.

---

## 2. Diferencias clave con iPhone

| Tema | iPhone (hoy) | Android |
|---|---|---|
| Bloqueo de cuenta | iCloud / Find My (se consulta por IMEI) | **Google FRP**: en general **no se puede consultar por IMEI**. Se verifica en persona. |
| Bloqueo del fabricante | — | Samsung: **Reactivation Lock** (Find My Mobile). Xiaomi: **Mi Account / Mi Cloud lock**. |
| Bloqueo por financiamiento | — | Samsung: **Knox Guard (KG)**, lo usan compañías y financieras. Equipo con KG activo queda bloqueado si no se paga. |
| MDM empresa | MDM Lock / DEP | Samsung: **Knox Manage / Knox Mobile Enrollment**; Android Enterprise. |
| Origen compañía/retail | `Sold By` del servicio 47 | Samsung: **código CSC / sales code** (p. ej. `CHO` = Chile liberado; códigos de compañía = Entel, Claro, Movistar, WOM). Otras marcas: según el servicio, puede no existir. |
| País de compra | `Purchase Country` | Samsung: país del CSC / "Sold country". Otras marcas: según el servicio. |
| Blacklist | Servicio 5 (GSMA) | **El mismo servicio 5** (GSMA no depende de la marca). Además devuelve `Brand` y `Model`. |

Consecuencia importante: **un Android nunca puede quedar 100 % verde solo por IMEI**, porque FRP no se ve. La página
siempre debe mostrar la razón: _"Verifica en persona que el vendedor elimine su cuenta de Google y restablezca el equipo
frente a ti"_.

---

## 3. Servicios del proveedor (por confirmar en la etapa 0)

La API no tiene un endpoint que liste servicios (`/services` devuelve la web), así que el catálogo hay que sacarlo del
panel de imeicheck.com.

| Uso | Servicio buscado (nombre aproximado) | ID | Precio | Trae `object` |
|---|---|---|---|---|
| Todas las marcas | Blacklist GSMA (ya se usa) | 5 | US$0,02 | sí (`blacklistStatus`, `brand`, `model`) |
| Samsung descarte | Samsung Knox Guard / KG lock status | _?_ | _?_ | _?_ |
| Samsung procedencia | Samsung Info (CSC/carrier, país, garantía, fecha de fabricación/activación) | _?_ | _?_ | _?_ |
| Samsung (opcional) | Samsung Reactivation Lock / Find My Mobile ON/OFF | _?_ | _?_ | _?_ |
| Xiaomi | Xiaomi Mi Account / Mi Lock ON/OFF (+ país de venta si lo trae) | _?_ | _?_ | _?_ |
| Otro Android | Brand & Model / IMEI info genérico (si existe y es barato) | _?_ | _?_ | _?_ |

Criterio para elegir entre servicios parecidos: **precio bajo y que responda en la misma petición** (sin quedar
pendiente). Si un servicio tarda más de ~50 s no sirve con `maxDuration = 60`.

---

## 4. Niveles de chequeo propuestos

Se mantienen los dos niveles. Lo que cambia es qué servicios corre cada uno según la **plataforma/marca**.

| Marca | Descarte rápido | Procedencia completa |
|---|---|---|
| iPhone | 1 → 5 → 4 (sin cambios) | 47 (sin cambios) |
| Samsung | 5 → KG lock (→ Reactivation Lock si es barato) | Samsung Info (CSC, país, garantía) |
| Xiaomi | 5 → Mi Lock | Si existe un servicio con país/región de venta; si no, no hay procedencia |
| Otro Android | 5 | No disponible (se oculta el botón) |

Se mantiene la regla de **2,5 s de espera** entre servicios del mismo IMEI.

### Cómo se elige la marca

1. En la página **Chequear**, antes de los botones, un selector: **iPhone · Samsung · Xiaomi · Otro Android**
   (por defecto iPhone, se recuerda la última elección). Quien revisa el equipo lo tiene en la mano, así que elegirlo es
   más barato y rápido que adivinarlo.
2. Validación cruzada: el servicio 5 devuelve `Brand`. Si no calza con lo elegido (p. ej. elegiste Samsung y dice
   Apple), se agrega la razón amarilla _"La marca reportada (X) no coincide con la elegida"_.
3. Opcional, sin costo: precargar la marca a partir del TAC (primeros 8 dígitos del IMEI) con una tabla pequeña de
   TAC conocidos. Solo como sugerencia, no reemplaza el selector.

---

## 5. Base de datos

Nueva migración `supabase/migrations/002_android.sql` (no se edita la 001):

```sql
alter table public.checks add column platform text not null default 'iphone'
  check (platform in ('iphone', 'samsung', 'xiaomi', 'android'));
create index checks_platform_idx on public.checks (platform);
-- `level` y `services` siguen igual; los servicios dependen de (platform, level).
```

- Los chequeos existentes quedan como `iphone`.
- El índice único de pendientes `(imei, level)` sigue sirviendo: un IMEI pertenece a un solo equipo.
- La caché de 7 días se busca por `(imei, level)` como hoy; si el chequeo encontrado es de otra plataforma, se ignora.
- `devices` no cambia (opcional: columna `platform` para filtrar el historial).

---

## 6. Cambios en el código

| Archivo | Cambio |
|---|---|
| `lib/constants.ts` | `Platform` (`iphone`/`samsung`/`xiaomi`/`android`), `PLATFORM_LABEL`, y `LEVEL_SERVICES` pasa a `PLATFORM_LEVEL_SERVICES[platform][level]` (lista vacía = nivel no disponible). Precios por plataforma para los botones. |
| `lib/types.ts` | `DeviceReport` agrega: `brand`, `salesCode` (CSC), `knoxGuard`, `reactivationLock`, `miLock`, `simLock`, `manufactureDate`. `Check` agrega `platform`. |
| `lib/parse-result.ts` | Nuevas claves en `FIELD_KEYS` según los formatos reales (etapa 0) y `BOOLEAN_LABELS` para los booleanos de `object`. |
| `lib/classify.ts` | Reglas por plataforma (sección 7). `CSC_CARRIER_CODES` editable, igual que `CARRIER_SELLERS`. |
| `lib/run-check.ts` | Recibe `platform` y toma los servicios de `PLATFORM_LEVEL_SERVICES`. Sin otros cambios. |
| `app/api/check/route.ts` | Body: `{ imei, level, platform, force? }`. Validar que el nivel exista para esa plataforma (400 si no). |
| `lib/import-order.ts` | `serviceFromName` reconoce los servicios Android de procedencia (Samsung Info). |
| `lib/combine.ts` | Sin cambios de lógica; `classify` recibe la plataforma del chequeo. |
| `lib/export-fields.ts` | Filas según plataforma: en Android, "Código de venta (CSC)", "Knox Guard", "Cuenta Mi", etc. Sin filas de iCloud/Find My. |
| `components/CheckPage.tsx` + `CheckActions.tsx` | Selector de marca y botones con el precio de esa marca; ocultar "Procedencia" donde no exista. |
| `components/ReportCard.tsx` | Datos clave según plataforma. Aviso fijo de FRP en Android. |
| `components/ChecksTable.tsx` | Mostrar la marca en cada fila y filtro por marca. |
| `AGENTS.md` | Quitar "Otras marcas" de fuera de alcance, documentar servicios y formatos Android verificados. |

---

## 7. Clasificación Android

### Rojo (no comprar), cualquiera de:
- `blacklist` existe y no es limpio (igual que iPhone).
- `knoxGuard` activo / bloqueado (equipo financiado o bloqueado por la compañía).
- MDM / Knox Manage / Android Enterprise inscrito.
- Xiaomi: Mi Account en **modo perdido**.

### Amarillo (precaución), cualquiera de:
- Siempre en Android: _"Verifica en persona que el vendedor elimine su cuenta de Google y restablezca el equipo frente a
  ti (FRP)"_.
- `origin === "compañia"` (CSC de compañía en Samsung).
- País de venta distinto de Chile.
- Samsung Reactivation Lock ON o Xiaomi Mi Account ON (el vendedor debe cerrar sesión en persona, como FMI en iPhone).
- `simLock` bloqueado a una compañía.
- La marca reportada no coincide con la elegida.
- Servicio fallido o falta procedencia (si la marca tiene procedencia).

### Verde
Ninguna roja, y las únicas amarillas son la de FRP; origen retail cuando la marca permite saberlo.
Como la de FRP siempre está, **en Android el mejor resultado es amarillo "Apto, verificar FRP en persona"**. Propuesta:
mostrarlo como **verde con aviso** (título "Apto para comprar · revisar cuenta Google") para no perder la diferencia con
un equipo realmente dudoso. _Decidir en la etapa 2._

### Origen Samsung por CSC (por confirmar con respuestas reales)

| CSC | Significado |
|---|---|
| `CHO` | Chile, liberado (retail) |
| `CHE` | Entel |
| `CHL` | Claro |
| `CHT` | Movistar |
| `CHX` | WOM (ex Nextel) |

Si el servicio entrega el nombre de la compañía en vez del código, se usa `CARRIER_SELLERS` igual que en iPhone.

---

## 8. Frontend

- **Chequear:** selector de marca con botones grandes (mobile-first). Los botones de nivel muestran el precio de esa
  marca. Ayuda del IMEI: `*#06#` funciona igual en Android; en Samsung también en Ajustes → Acerca del teléfono.
- **Tarjeta de resultado (Android):** Modelo, Marca, Código de venta / compañía, País, Knox Guard, Reactivation Lock o
  Cuenta Mi, Blacklist, Garantía (si existe). Aviso fijo de FRP.
- **Historial:** marca visible en cada fila y filtro por marca.
- **Imagen exportable:** mismas secciones (Equipo, Compra, Bloqueos y estado) con los campos de Android.

---

## 9. Etapas de trabajo

Cada etapa queda funcionando antes de pasar a la siguiente.

0. **Inventario de servicios (sin código).** Desde el panel de imeicheck.com, sacar ID, nombre y precio de los servicios
   de la tabla de la sección 3. Luego, **una prueba real por servicio** con un IMEI Android conocido (costo estimado
   US$0,10–0,50 en total) y guardar las respuestas como fixtures enmascarados en `tests/fixtures/`.
   _Listo cuando:_ la tabla de la sección 3 está completa y hay un fixture real por servicio.
1. **Datos y tipos:** migración 002, `Platform`, `PLATFORM_LEVEL_SERVICES`, campos nuevos de `DeviceReport`.
   _Listo cuando:_ los tests actuales siguen pasando y los chequeos viejos quedan como `iphone`.
2. **Parser y clasificación Android** con tests sobre los fixtures reales.
   _Listo cuando:_ cada fixture da el veredicto y origen esperados (incluido un caso con KG activo y uno de compañía).
3. **API:** `/api/check` con `platform`; importación de órdenes de Samsung Info.
4. **UI:** selector de marca, tarjeta, historial con marca, imagen exportable Android.
5. **Prueba real de punta a punta** con un Samsung y un Xiaomi (descarte + procedencia) en local y luego en Vercel.

---

## 10. Pendientes por verificar

- Qué servicios Android ofrece realmente imeicheck.com, IDs, precios y si traen `object`.
- Si Samsung Info entrega CSC, nombre de compañía, o ambos; y los códigos CSC reales de Chile.
- Si existe algún servicio que muestre el **estado de FRP** de forma confiable (casi ningún proveedor lo tiene).
- Si Xiaomi tiene un servicio con país/región de venta (para tener "procedencia" en Xiaomi).
- Si la regla de "mismo IMEI en menos de 2 s" aplica igual a los servicios Android.
- Tiempos de respuesta de cada servicio (deben caber en 60 s).

---

## 11. Fuera de alcance (por ahora)

- Chequeos específicos de Huawei, Motorola, Oppo, Honor o Pixel más allá del blacklist (quedan como "Otro Android").
- Detección automática de la marca con un servicio pagado.
- Verificación de FRP por IMEI (salvo que la etapa 0 encuentre un servicio confiable).
- Tablets, relojes y otros dispositivos.
