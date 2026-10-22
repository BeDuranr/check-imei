# Plan: soporte para teléfonos Android

Extensión de la página de chequeo IMEI (hoy solo iPhone) para revisar también equipos Android antes de comprarlos
para reventa. Reutiliza todo lo que ya existe: login, validación de IMEI, historial agrupado por IMEI, caché, bloqueo de
duplicados, imagen exportable e importación de órdenes.

Estado: **Samsung (5 → 37) y Huawei (5 → 17) implementados** con **detección automática de marca** (sin selector, ver sección 4). Xiaomi y otras marcas: propuesta. IDs y precios confirmados con el catálogo del panel de imeicheck.com (15-10-2026). Falta probar
cada servicio con un IMEI real para conocer el formato de respuesta (etapa 0).

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

## 3. Servicios del proveedor

Catálogo copiado del panel de imeicheck.com el 15-10-2026 (la API no tiene un endpoint que lo liste). La columna
"Límite" viene del panel; su significado exacto está por confirmar (probablemente consultas simultáneas o por minuto).
Con un solo usuario y servicios en secuencia no debería afectar.

### Servicios elegidos

| Uso | ID | Servicio | Precio (USD) | Trae `object` |
|---|---|---|---|---|
| Todas las marcas: blacklist + marca/modelo | 5 | Blacklist Status (GSMA) | 0,02 | sí |
| Samsung: info + Knox Guard | **37** | Samsung Info & KNOX GUARD (S1) | 0,08 | **no** (parsear `result`) |
| Xiaomi: cuenta Mi + info | **25** | XIAOMI MI LOCK & INFO | 0,05 | **no** |
| Motorola | 63 | Motorola Info | 0,05 | no |
| Huawei | 17 | Huawei IMEI Info | 0,07 | sí |
| Honor | 58 | Honor Info | 0,05 | no |
| OnePlus | 27 | ONEPLUS IMEI INFO | 0,04 | sí |
| Google Pixel | 72 | Google Pixel Info + Warranty (S2) | 0,10 | no |

### Alternativas descartadas (y por qué)

| ID | Servicio | Precio | Motivo |
|---|---|---|---|
| 8 | Samsung Info (S1) | 0,04 | No trae Knox Guard; el 37 trae ambos por solo US$0,04 más. |
| 36 | Samsung Info (S1) + Blacklist | 0,06 | No trae Knox Guard. El blacklist ya lo da el 5. |
| 21 | SAMSUNG INFO & KNOX GUARD (S2) | 0,14 | Lo mismo que el 37, más caro. Queda como **respaldo** si el 37 falla o trae menos datos. |
| 6 | Blacklist Pro (GSMA) con historial | 0,09 | El 5 basta para decidir; el historial no cambia el veredicto. |
| 11 | IMEI to Brand/Model/Name | 0,01 | La marca ya viene en el 5. Solo útil si algún día se quiere detectar la marca antes de cobrar más. |

### Formatos verificados (prueba real del 15-10-2026, Galaxy S26 Ultra)

Fixtures: `tests/fixtures/samsung-service5.json` y `tests/fixtures/service37.json` (IMEI y serie enmascarados).

- **Servicio 5 con Samsung:** `object` = `{ brand: "Samsung Korea", model: "Galaxy S26 Ultra", name: "SM-S948B/DS",
  gsmaBlacklisted: false, blacklistStatus: false }`. La marca no es solo "Samsung": comparar con *contiene*.
- **Servicio 37** (`object: false`, ~2,3 s), claves del `result`:
  `Model Info` (`MOBILE Galaxy S26 Ultra VIOLET LTL`), `Search Term`, `IMEI 1`, `Serial Number`, `Model Desc`
  (`SM-S948B/DS`), `Model Name`, `Model Number` (`SM-S948BZVJLTL`), `Warranty Status` (`Warranty Active`),
  `Estimated Warranty End Date` (`23-01-2028`, formato DD-MM-AAAA), `Production location` (vacío),
  `Production Date` (`23-01-2026`), `Knox Guard` (`OFF`), `Knox Message`.
- **No trae país ni compañía (CSC).** La única pista de origen son las 3 últimas letras de `Model Number` (aquí
  `LTL`), que es el código de región/venta del producto. Su significado está por confirmar (sección 10).

### No existen en el catálogo

- **Google FRP** (cuenta de Google): no hay servicio. Se verifica siempre en persona.
- **Samsung Reactivation Lock / Find My Mobile**: no hay servicio. Se verifica en persona junto con FRP.

---

## 4. Niveles de chequeo propuestos

Para Android los servicios son baratos, así que **no hace falta separar descarte y procedencia**: un solo
**"Chequeo completo"** por marca. iPhone queda exactamente como está.

| Marca | Botones | Servicios | Costo |
|---|---|---|---|
| iPhone | Descarte rápido / Procedencia completa | 1 → 5 → 4 / 47 | US$0,05 / US$0,75 (sin cambios) |
| Samsung | Chequeo completo | 5 → 37 | **US$0,10** |
| Xiaomi | Chequeo completo | 5 → 25 | **US$0,07** |
| Motorola | Chequeo completo | 5 → 63 | US$0,07 |
| Huawei | Chequeo completo | 5 → 17 | US$0,09 |
| Honor | Chequeo completo | 5 → 58 | US$0,07 |
| OnePlus | Chequeo completo | 5 → 27 | US$0,06 |
| Pixel | Chequeo completo | 5 → 72 | US$0,12 |
| Otro Android | Solo blacklist | 5 | US$0,02 |

- En la base de datos el chequeo completo de Android se guarda con `level = 'procedencia'` (es el nivel con datos de
  compra), así el historial agrupado, la caché y la imagen exportable funcionan sin cambios. "Otro Android" (solo blacklist)
  se guarda como `descarte`.
- Se mantiene la regla de **2,5 s de espera** entre servicios del mismo IMEI.
- Si el servicio de la marca falla, el chequeo queda `partial` con el blacklist (igual que el descarte hoy).
- Prioridad de implementación: **Samsung y Xiaomi** primero; las demás marcas se agregan después con el mismo patrón
  (solo cambia el ID del servicio y las claves del parser).

### Cómo se elige la marca

1. En la página **Chequear**, antes de los botones, un selector: **iPhone · Samsung · Xiaomi · Otra marca**
   (al elegir "Otra marca" se despliegan Motorola, Huawei, Honor, OnePlus, Pixel y "Otro Android"). Por defecto
   iPhone; se recuerda la última elección. Quien revisa el equipo lo tiene en la mano, así que elegirlo es gratis.
2. Validación cruzada: el servicio 5 corre primero y devuelve `Brand`. Si no calza con lo elegido (p. ej. elegiste
   Samsung y dice Apple), **se detiene antes de cobrar el servicio de la marca** y avisa:
   _"El IMEI es de un equipo X, no Samsung. Cambia la marca y vuelve a intentar."_ Solo se cobran los US$0,02 del 5.

---

## 5. Base de datos

Nueva migración `supabase/migrations/002_android.sql` (no se edita la 001):

```sql
alter table public.checks add column platform text not null default 'iphone'
  check (platform in ('iphone', 'samsung', 'xiaomi', 'motorola', 'huawei', 'honor', 'oneplus', 'pixel', 'android'));
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
| `lib/constants.ts` | `Platform` (`iphone`, `samsung`, `xiaomi`, `motorola`, `huawei`, `honor`, `oneplus`, `pixel`, `android`), `PLATFORM_LABEL`, y `LEVEL_SERVICES` pasa a `PLATFORM_LEVEL_SERVICES[platform][level]` (lista vacía = nivel no disponible). Precios por plataforma para los botones. |
| `lib/types.ts` | `DeviceReport` agrega: `brand`, `salesCode` (CSC), `knoxGuard`, `miLock`, `simLock`, `manufactureDate`. `Check` agrega `platform`. |
| `lib/parse-result.ts` | Nuevas claves en `FIELD_KEYS` según los formatos reales (etapa 0) y `BOOLEAN_LABELS` para los booleanos de `object`. |
| `lib/classify.ts` | Reglas por plataforma (sección 7). `CSC_CARRIER_CODES` editable, igual que `CARRIER_SELLERS`. |
| `lib/run-check.ts` | Recibe `platform` y toma los servicios de `PLATFORM_LEVEL_SERVICES`. Sin otros cambios. |
| `app/api/check/route.ts` | Body: `{ imei, level, platform, force? }`. Validar que el nivel exista para esa plataforma (400 si no). |
| `lib/import-order.ts` | `serviceFromName` reconoce los servicios Android de procedencia (servicios 37 y 25). |
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
- Siempre en Android: _"Verifica en persona que el vendedor elimine su cuenta de Google (y Samsung) y restablezca el equipo
  frente a ti (FRP)"_.
- `origin === "compañia"` (CSC de compañía en Samsung).
- País de venta distinto de Chile.
- Xiaomi Mi Account ON (el vendedor debe cerrar sesión en persona, como FMI en iPhone).
- `simLock` bloqueado a una compañía.
- La marca reportada no coincide con la elegida.
- Servicio fallido o falta procedencia (si la marca tiene procedencia).

### Verde
Ninguna roja, y las únicas amarillas son la de FRP; origen retail cuando la marca permite saberlo.
Como la de FRP siempre está, **en Android el mejor resultado es amarillo "Apto, verificar FRP en persona"**. Propuesta:
mostrarlo como **verde con aviso** (título "Apto para comprar · revisar cuenta Google") para no perder la diferencia con
un equipo realmente dudoso. _Decidir en la etapa 2._

### Origen Samsung (por confirmar)

El servicio 37 **no entrega el CSC** (ver sección 3). Lo único disponible es el código de 3 letras al final de
`Model Number` (p. ej. `SM-S948BZVJLTL` → `LTL`). Hay que confirmar qué códigos corresponden a Chile liberado y a
cada compañía, juntando ejemplos de equipos cuyo origen se conoce. Mientras tanto, el origen Samsung queda
**desconocido** (sin razón amarilla por compañía). Tabla de referencia de CSC de software, que **no** es lo mismo:

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
- **Tarjeta de resultado (Android):** Modelo, Marca, Código de venta / compañía, País, Knox Guard o
  Cuenta Mi, Blacklist, Garantía (si existe). Aviso fijo de FRP.
- **Historial:** marca visible en cada fila y filtro por marca.
- **Imagen exportable:** mismas secciones (Equipo, Compra, Bloqueos y estado) con los campos de Android.

---

## 9. Etapas de trabajo

Cada etapa queda funcionando antes de pasar a la siguiente.

0. **Formatos reales.** ~~Inventario de servicios~~ y ~~Samsung (5 + 37)~~ hechos el 15-10-2026 (sección 3).
   Falta el **25 con un Xiaomi** (US$0,05 + US$0,02 del 5).
   Guardar las respuestas como fixtures enmascarados en `tests/fixtures/`.
   _Listo cuando:_ hay un fixture real del 37 y del 25, y se sabe qué claves traen (CSC/compañía, país, KG, cuenta Mi).
1. **Datos y tipos:** migración 002, `Platform`, `PLATFORM_LEVEL_SERVICES`, campos nuevos de `DeviceReport`.
   _Listo cuando:_ los tests actuales siguen pasando y los chequeos viejos quedan como `iphone`.
2. **Parser y clasificación Android** con tests sobre los fixtures reales.
   _Listo cuando:_ cada fixture da el veredicto y origen esperados (incluido un caso con KG activo y uno de compañía).
3. **API:** `/api/check` con `platform`; importación de órdenes de Samsung Info.
4. **UI:** selector de marca, tarjeta, historial con marca, imagen exportable Android.
5. **Prueba real de punta a punta** con un Samsung y un Xiaomi (descarte + procedencia) en local y luego en Vercel.

---

## 10. Pendientes por verificar

- ~~Formato del servicio 37~~ (verificado). Falta el del **25 (Xiaomi)**.
- Qué significa el código de región al final de `Model Number` en Samsung (`LTL` en el equipo de prueba) y cuáles
  corresponden a Chile liberado y a cada compañía.
- Texto exacto del 37 cuando Knox Guard está **activo** (solo se vio `OFF`).
- Si el 25 trae país/región de venta además del estado de la cuenta Mi y el modo perdido.
- Qué significa la columna "Límite" del panel.
- Si la regla de "mismo IMEI en menos de 2 s" aplica igual a los servicios Android.
- Tiempos de respuesta de cada servicio (deben caber en 60 s).

---

## 11. Fuera de alcance (por ahora)

- Marcas sin servicio propio en el catálogo (Oppo, Vivo, Realme, ZTE, etc.): solo blacklist ("Otro Android").
- Detección automática de la marca con un servicio pagado (el 11 cuesta US$0,01 si algún día se quiere).
- Verificación de FRP y de Samsung Reactivation Lock por IMEI: no existen en el catálogo.
- Tablets, relojes y otros dispositivos.
