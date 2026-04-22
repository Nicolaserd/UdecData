# Sección "Descargar Resultados para Análisis"

Sección dentro de `/encuesta-satisfaccion` que expone **reportes procesados** (cuantitativos / cualitativos) generados en el backend y descargables por el usuario.

Cada análisis es una **card independiente** en un grid responsive. Esta guía documenta:
1. Qué hace la primera card (nubes de palabras) y cómo está construida.
2. La **plantilla genérica de la card** para agregar nuevos análisis de forma consistente.

---

## 1. Card implementada: Nubes de palabras por área

### Qué hace
- Toma los comentarios almacenados en `EncuestaSatisfaccion` para un `(anio, periodo_academico)`.
- Los agrupa por `area`.
- Limpia el ruido (ver filtros más abajo).
- Genera **un PNG por área** con `d3-cloud` + `@napi-rs/canvas`.
- Los empaqueta en un **ZIP** con `jszip` y lo devuelve como descarga.

### Archivos

| Archivo | Propósito |
| --- | --- |
| [`lib/parsers/wordcloud-text.ts`](lib/parsers/wordcloud-text.ts) | Stopwords español + filtros de ruido + tokenización + conteo de frecuencias. |
| [`lib/wordcloud.ts`](lib/wordcloud.ts) | Render PNG: layout con `d3-cloud`, dibujo con `@napi-rs/canvas`. Paleta UCundinamarca, PRNG con semilla (output determinista). |
| [`app/api/encuesta-satisfaccion/wordclouds/route.ts`](app/api/encuesta-satisfaccion/wordclouds/route.ts) | `GET ?anio&periodo` — query DB → extract words → render PNGs → zip → stream. |
| [`app/encuesta-satisfaccion/page.tsx`](app/encuesta-satisfaccion/page.tsx) | Card UI + handler `downloadWordClouds()`. |
| [`next.config.ts`](next.config.ts) | `@napi-rs/canvas` añadido a `serverExternalPackages` (binario nativo). |

### Dependencias agregadas
```bash
npm install @napi-rs/canvas d3-cloud jszip
npm install -D @types/d3-cloud
```
- `@napi-rs/canvas` — Canvas server-side con prebuilt binaries multi-plataforma.
- `d3-cloud` — Algoritmo de layout (espiral arquimediana).
- `jszip` — Construcción de ZIP en memoria.

### Filtros de ruido aplicados
- **Stopwords español completas** (≈350 palabras: pronombres, conjugaciones, etc.).
- **Respuestas sin sentido** descartadas al nivel de comentario completo: `"na"`, `"nn"`, `"ok"`, `"nada"`, `"ninguno"`, `"xd"`, `"test"`, `"prueba"`, etc.
- **A nivel de token**: longitud < 3, sólo dígitos, repeticiones (`"xxxx"`, `"jajaja"`, vocales 1-3 chars).
- **Branding repetitivo** filtrado para no dominar la nube: `universidad`, `cundinamarca`, `ucundinamarca`, `udec`, `siglo`, `xxi`, `generacion`, `periodo`, `academico`, etc.
- Acentos normalizados (NFD) antes de contar.

### Parámetros de render (configurables en `lib/wordcloud.ts`)
- Canvas: 1200 × 800 px
- Fuentes: `MIN_FONT = 16`, `MAX_FONT = 96` (escala lineal por frecuencia).
- Paleta **institucional** rotativa: `#007B3E`, `#79C000`, `#00A99D`.
- Rotación: 0° o 90° (30 % vertical) con PRNG sembrado → mismo input ⇒ mismo PNG.
- **Sin título** dibujado en el PNG (el usuario lo pidió así).

### Contrato HTTP
```
GET /api/encuesta-satisfaccion/wordclouds?anio=2026&periodo=IPA

200 → application/zip (attachment; filename="nubes_de_palabras_IPA_2026.zip")
        contiene: <area_slug>.png × N + README.txt
400 → { error: "El año es obligatorio" | "El periodo debe ser IPA o IIPA" }
404 → { error: "No hay comentarios para IPA 2026" }
500 → { error: "<mensaje>" }
```

Nombre de archivo del PNG: `safeFilename(area)` normaliza el texto del área (sin acentos, solo `[a-zA-Z0-9_]`, max 80 chars).

---

## 2. Plantilla genérica de la card

Toda card en esta sección sigue el mismo layout, colores y flujo. Usar esto al agregar nuevos análisis para mantener consistencia visual.

### Grid contenedor

En `app/encuesta-satisfaccion/page.tsx`, dentro de la sección `"Descargar Resultados para Análisis"`:

```tsx
<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
  {/* Cada card va aquí */}
</div>
```

### Estructura de una card

```tsx
<article className="relative flex flex-col rounded-2xl border border-[#bdcabb]/20 bg-white p-6 shadow-[0_20px_40px_rgba(0,104,47,0.06)] transition-all hover:shadow-[0_20px_40px_rgba(0,104,47,0.12)]">
  {/* 1. Header: icon + badge */}
  <div className="mb-5 flex items-start justify-between">
    <div className="flex size-12 items-center justify-center rounded-xl bg-[#00682f]/10">
      <IconoRelevante className="size-6 text-[#00682f]" />
    </div>
    <span className="rounded-full bg-[#7c4dff]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#7c4dff]">
      Categoría
    </span>
  </div>

  {/* 2. Título + descripción */}
  <h3 className="mb-2 font-[Manrope] text-xl font-extrabold leading-tight text-[#191c1d]">
    Nombre del análisis
  </h3>
  <p className="mb-5 text-sm leading-relaxed text-[#3e4a3e]">
    Qué hace, qué limpia, qué devuelve (zip / xlsx / pdf).
  </p>

  {/* 3. Inputs (filtros obligatorios) */}
  <div className="mb-4 grid grid-cols-2 gap-3">
    <Selector label="Año *"     ... />
    <Selector label="Periodo *" ... />
  </div>

  {/* 4. Error (condicional) */}
  {error && (
    <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{error}</span>
    </div>
  )}

  {/* 5. Botón (mt-auto lo pega al fondo) */}
  <button
    onClick={handleDownload}
    disabled={!canSubmit || loading}
    className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)] px-5 py-3 text-sm font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50">
    {loading
      ? <><Loader2 className="size-4 animate-spin" /> Generando…</>
      : <><Download className="size-4" /> Descargar <formato></>}
  </button>
</article>
```

### Reglas de diseño

| Elemento | Valor |
| --- | --- |
| Card | `rounded-2xl` · `border-[#bdcabb]/20` · `bg-white` · `p-6` · sombra suave verde |
| Hover | sombra más intensa (`rgba(0,104,47,0.12)`) |
| Icon box | `size-12` · `rounded-xl` · fondo tinted `bg-[#00682f]/10` · icono `text-[#00682f]` |
| Badge categoría | `rounded-full` · color distinto por tipo (cualitativo = morado, cuantitativo = azul, predictivo = naranja, etc.) |
| Título | `font-[Manrope]` · `text-xl font-extrabold` |
| Descripción | `text-sm` · `text-[#3e4a3e]` · max 3-4 líneas |
| Inputs | `border-[#bdcabb]` · focus `ring-[#00682f]` · labels en tracking-wider uppercase 10px |
| Botón primario | gradient `#00682f → #00843d` · `mt-auto` · full width · `rounded-lg` |
| Estados | `Loader2 animate-spin` mientras carga, `AlertCircle` rojo para errores |

### Flujo de interacción estándar

1. Usuario selecciona los filtros obligatorios (año, periodo, u otros).
2. Botón se habilita (`disabled={!canSubmit || loading}`).
3. Click → `setLoading(true)` → `fetch(/api/.../<analisis>?params)`.
4. Si `!res.ok` → parse `{ error }` → mostrar en bloque rojo.
5. Si OK → `res.blob()` → crear `<a>` con `URL.createObjectURL` → click programático → limpiar URL → `setLoading(false)`.

Ver `downloadWordClouds()` en [`app/encuesta-satisfaccion/page.tsx`](app/encuesta-satisfaccion/page.tsx) como referencia.

### Selectores de año / periodo

Se alimentan de `stats?.filters.anios` y `stats?.filters.periodos` (ya disponibles en la página):

```tsx
<select value={wcAnio} onChange={(e) => setWcAnio(e.target.value)} ...>
  <option value="">Seleccione…</option>
  {stats?.filters.anios.map((a) => <option key={a} value={String(a)}>{a}</option>)}
</select>
```

Si el nuevo análisis no aplica por periodo, usar sólo año, o agregar selects adicionales (sede, rol) reutilizando `stats?.filters.sedes` / `stats?.filters.roles`.

---

## 3. Receta para agregar una nueva card

Al recibir un pedido tipo "agregar una card de X que descargue Y", seguir estos pasos:

### Paso 1 — Route API
Crear `app/api/encuesta-satisfaccion/<nombre>/route.ts`:
- `GET` con `NextRequest`, leer `searchParams`.
- Validar filtros obligatorios → 400 con `{ error }` si faltan.
- Query a Prisma con `where: { anio, periodo_academico: periodo, ... }`.
- Procesar los datos (según el análisis).
- Si es **archivo único**: retornar con `Content-Type` + `Content-Disposition` apropiados.
  - XLSX: usar `xlsx` (ya instalado) — ver `app/api/encuesta-satisfaccion/export-principal/route.ts`.
  - ZIP: usar `jszip` — ver `app/api/encuesta-satisfaccion/wordclouds/route.ts`.
  - PDF: requiere instalar lib (ej. `pdfkit` / `@react-pdf/renderer`).
- Si procesamiento > 10 s: añadir `export const maxDuration = 300;`.
- Si usa binarios nativos: agregar al `serverExternalPackages` en `next.config.ts`.

### Paso 2 — Lógica reutilizable
Si hay transformación compleja (cleanup, cálculos, render), crear módulos en `lib/`:
- Puro → `lib/<nombre>.ts`
- Parser de datos → `lib/parsers/<nombre>.ts`
- Mantener las rutas delgadas (solo validación + orquestación).

### Paso 3 — Card en la página
En `app/encuesta-satisfaccion/page.tsx`:
1. Importar el icono de `lucide-react` que mejor represente el análisis.
2. Agregar state local: `<nombre>Anio`, `<nombre>Periodo`, `<nombre>Loading`, `<nombre>Error` (y los filtros adicionales si aplica).
3. Implementar el handler `download<Nombre>()` siguiendo el mismo patrón que `downloadWordClouds` (blob → anchor → click).
4. Pegar el **template de card** dentro del grid `"Descargar Resultados para Análisis"`, ajustando icon, badge y textos.

### Paso 4 — Verificación
- `npx tsc --noEmit` debe pasar sin errores.
- Si el análisis renderiza imágenes / PDFs, abrir el archivo descargado y verificar visualmente.
- Probar el estado de error con filtros inválidos.

---

## 4. Anexo — Paleta institucional UCundinamarca

```
#007B3E   verde oscuro institucional
#79C000   verde lima
#00A99D   turquesa / aqua
```

Adicionalmente, el proyecto usa estos tokens (ya presentes en Tailwind classes):

```
#00682f   verde primario UI (oscuro)
#00843d   verde secundario UI (botones gradient)
#0058be   azul institucional
#191c1d   texto principal
#3e4a3e   texto secundario
#6e7a6e   texto muted / labels
#bdcabb   borders
#f8f9fa   fondo sutil
#f3f4f5   fondo alternativo
```

**Regla**: para PNGs / reportes visuales usar **institucional** (`#007B3E`, `#79C000`, `#00A99D`).
Para UI web (botones, texto, borders) usar los tokens de la paleta UI listados arriba.
