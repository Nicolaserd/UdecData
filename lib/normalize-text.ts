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
 * Elimina tildes/diacríticos: á→a, é→e, ñ→n, etc.
 * Usado para comparaciones insensibles a tildes en nombres de columna.
 */
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Normalización completa de clave: trim + minúscula + sin tildes */
function normKey(s: string): string {
  return stripAccents(s.trim().toLowerCase());
}

/**
 * Devuelve una copia del objeto con todas las claves normalizadas:
 * trim + minúscula + sin tildes. Permite acceso insensible a mayúsculas y tildes.
 */
export function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[normKey(k)] = v;
  }
  return out;
}

/**
 * Busca en el objeto (con claves normalizadas) la primera clave que comience
 * con el prefijo dado. Insensible a mayúsculas/minúsculas y tildes.
 */
export function getByPrefix(row: Record<string, unknown>, prefix: string): unknown {
  const p = normKey(prefix);
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith(p)) return v;
  }
  return undefined;
}

/**
 * Columnas de programa por facultad en los archivos de encuesta.
 * Pre-normalizadas (sin tildes, minúsculas) para coincidir con normalizeRowKeys.
 */
const FACULTAD_PROGRAM_COLS = [
  "facultad de ciencias administrativas, economicas y contables",
  "facultad de ciencias agropecuarias",
  "facultad de ciencias del deporte y la educacion fisica",
  "facultad de educacion",
  "facultad de ingenieria",
  "facultad de ciencias de la salud",
  "facultad de ciencias sociales, humanidades y ciencias politicas",
  "doctorado",
  "maestrias",
  "especializaciones",
  "posgrados",
  "instituto de posgrados",
];

/**
 * Extrae el nombre del programa de la fila de encuesta.
 * El programa está en la columna específica de facultad (la que tiene valor no nulo).
 * Recibe la fila ya normalizada con normalizeRowKeys.
 */
export function extractPrograma(row: Record<string, unknown>): string {
  for (const col of FACULTAD_PROGRAM_COLS) {
    const val = row[col];
    if (val != null && String(val).trim() !== "") {
      return toSentenceCase(String(val).trim());
    }
  }
  return "";
}

/**
 * Verifica que el objeto (primera fila del Excel) tenga todas las columnas requeridas.
 * Insensible a mayúsculas/minúsculas, espacios extremos y tildes.
 * Retorna los nombres de columnas faltantes.
 */
export function checkColumnas(
  row: Record<string, unknown>,
  required: readonly string[]
): string[] {
  const keys = Object.keys(row).map(normKey);
  return required.filter((col) => !keys.includes(normKey(col)));
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
