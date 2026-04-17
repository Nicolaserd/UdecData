/**
 * Normalización de texto para Encuentros Dialógicos.
 * Sentence case: primera letra mayúscula, resto minúscula.
 * Solo aplica a campos de texto, nunca a números.
 */

/** Primera letra mayúscula, resto minúscula, sin espacios extra */
export function toSentenceCase(str: string): string {
  if (!str) return str;
  const clean = str.trim().replace(/\s+/g, " ").toLowerCase();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function normalizePrograma(value: string): string {
  return toSentenceCase(value);
}

export function normalizeUnidadRegional(value: string): string {
  return toSentenceCase(value);
}

export function normalizeFacultad(value: string): string {
  return toSentenceCase(value);
}

export function normalizeEncuentro(value: string): string {
  return toSentenceCase(value);
}

export function normalizeCategoria(value: string): string {
  return toSentenceCase(value);
}

export function normalizeSubcategoria(value: string): string {
  return toSentenceCase(value);
}

/** formulado → "SI" / "NO" en mayúscula */
export function normalizeFormulado(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toUpperCase();
  if (v === "SI" || v === "SÍ" || v === "S" || v === "YES") return "SI";
  if (v === "NO" || v === "N") return "NO";
  return toSentenceCase(value.trim());
}

/** calificación de docentes — "EN PROCESO" → "En proceso" */
export function normalizeCalificacion(value: string | null | undefined): string | null {
  if (!value) return null;
  return toSentenceCase(value.trim());
}

// ─── Columnas requeridas ──────────────────────────────────────────────────────

export const REQUIRED_COLS_ESTUDIANTES = [
  "CATEGORIA", "SUBCATEGORIA", "ACTIVIDAD",
  "FECHA DE CUMPLIMIENTO", "CALIFICACION DE CUMPLIMIENTO",
  "EFECTIVIDAD", "PROGRAMA", "UNIDAD REGIONAL", "FACULTAD",
  "AÑO", "ENCUENTRO", "formulado",
] as const;

export const REQUIRED_COLS_DOCENTES = [
  "CATEGORIA", "SUBCATEGORIA", "ACTIVIDAD",
  "FECHA DE CUMPLIMIENTO", "CALIFICACION DE CUMPLIMIENTO",
  "PROGRAMA", "UNIDAD REGIONAL", "FACULTAD",
  "AÑO", "ENCUENTRO", "formulado", "CALIFICACIÓN",
] as const;

/**
 * Devuelve una copia del objeto con todas las claves en minúscula y sin espacios
 * al inicio/fin, para acceso insensible a mayúsculas.
 */
export function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.trim().toLowerCase()] = v;
  }
  return out;
}

/**
 * Verifica que el objeto (primera fila del Excel) tenga todas las columnas requeridas.
 * Comparación insensible a mayúsculas/minúsculas y espacios al inicio/fin.
 * Retorna los nombres de columnas faltantes.
 */
export function checkColumnas(
  row: Record<string, unknown>,
  required: readonly string[]
): string[] {
  const normalize = (s: string) => s.trim().toLowerCase();
  const keys = Object.keys(row).map(normalize);
  return required.filter((col) => !keys.includes(normalize(col)));
}

/**
 * Recalcula PLAN DE MEJORAMIENTO en mayúscula total
 * (fórmula Excel: MAYUSC("plan de mejoramiento " & ...))
 */
export function computePlanMejoramiento(
  encuentro: string,
  anio: number | string,
  programa: string,
  unidadRegional: string,
  facultad: string
): string {
  return `PLAN DE MEJORAMIENTO ${encuentro} ${anio} : ${programa} ${unidadRegional} ${facultad}`.toUpperCase();
}
