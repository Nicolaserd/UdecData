/**
 * Mapeo de columnas del Excel "Encuesta de satisfacción - UCundinamarca".
 * Usa nombres de columna (insensibles a mayúsculas/tildes) en vez de índices.
 */

// ─── Utilidades de normalización ─────────────────────────────────────────────

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normKey(s: string): string {
  return stripAccents(s.trim().toLowerCase());
}

/** Normaliza todas las claves de una fila */
export function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[normKey(k)] = v;
  return out;
}

/** Primer valor cuya clave empiece con el prefijo dado */
export function getByPrefix(row: Record<string, unknown>, prefix: string): unknown {
  const p = normKey(prefix);
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith(p)) return v;
  }
  return undefined;
}

/** Obtiene valor por nombre exacto normalizado */
export function getByKey(row: Record<string, unknown>, key: string): string | null {
  const v = row[normKey(key)];
  if (v == null || v === "") return null;
  return String(v).trim();
}

export function isYes(value: unknown): boolean {
  if (value == null) return false;
  const v = String(value).trim().toLowerCase();
  return v === "sí" || v === "si" || v === "s" || v === "yes" || v === "y";
}

// ─── Mapeo nivel ↔ número ─────────────────────────────────────────────────────

const NIVEL_TO_NUM: Record<string, number> = {
  "muy insatisfecho":              1,
  "insatisfecho":                  2,
  "ni satisfecho ni insatisfecho": 3,
  "satisfecho":                    4,
  "muy satisfecho":                5,
};

const NUM_TO_NIVEL: Record<number, string> = {
  1: "Muy insatisfecho",
  2: "Insatisfecho",
  3: "Ni satisfecho ni insatisfecho",
  4: "Satisfecho",
  5: "Muy satisfecho",
};

export function nivelToNumber(value: unknown): number | null {
  if (value == null) return null;
  const k = normKey(String(value));
  if (!k) return null;
  return NIVEL_TO_NUM[k] ?? null;
}

export function numberToNivel(n: number | null): string | null {
  if (n == null) return null;
  const rounded = Math.max(1, Math.min(5, Math.round(n)));
  return NUM_TO_NIVEL[rounded] ?? null;
}

// ─── Nombres de columnas clave ────────────────────────────────────────────────

export const COL_ID   = "ID";
export const COL_SEDE = "¿A cuál sede pertenece o perteneció?";
export const COL_ROL  = "¿Cuál es su relación con la Universidad de Cundinamarca?";

// Columnas de planta física para el promedio
export const COLS_PLANTA_FISICA = [
  "Estructura física del área administrativa",
  "Proceso gradual de transformación a campus verde (dispositivos de ahorro y uso eficiente de agua, energía y papel)",
  "Señalización de emergencia en la Universidad",
  "Estructura física en las áreas comunes",
  "Implementación de los protocolos de bioseguridad",
  "Servicio de energía eléctrica",
  "Red hidrosanitaria (agua potable, grifería, baño)",
  "Estructura física del área académica",
  "Seguridad física",
  "Pintura de los espacios físicos",
  "Estructura física en las zonas de estacionamiento",
  "Disponibilidad de contenedores o dispositivos para almacenamiento temporal de residuos",
  "Zonas verdes",
];

// ─── Definición de áreas ──────────────────────────────────────────────────────

export type AreaMapping = {
  key:           string;
  area:          string;
  triggerCol:    string | null;   // null = siempre se incluye
  nivelCol:      string | string[]; // string[] = promedio de varias columnas
  comentariosCol: string | null;
  exception?:    "admisiones" | "bienestar" | "comunicaciones" | "planta_fisica" | "biblioclic" | "sede" | "universidad";
};

export const AREAS: AreaMapping[] = [
  {
    key: "investigacion", area: "Dirección de Investigación",
    triggerCol: "¿Desea evaluar los trámites o servicios prestados por la Dirección de Investigación?",
    nivelCol: "Dirección de Investigación",
    comentariosCol: "¿Qué aspectos considera que debe mejorar esta dependencia?",
  },
  {
    key: "financieros", area: "Procesos Financieros",
    triggerCol: "¿Desea evaluar los trámites o servicios prestados por los procesos financieros?",
    nivelCol: "Procesos financieros",
    comentariosCol: "¿Por favor indique qué aspectos específicos considera que deben mejorarse en esta dependencia?",
  },
  {
    key: "talento_humano", area: "Talento Humano",
    triggerCol: "¿Desea evaluar los trámites o servicios prestados por el proceso de Talento Humano?",
    nivelCol: "Talento humano",
    comentariosCol: "¿Qué aspectos considera que debe mejorar esta dependencia?2",
  },
  {
    key: "admisiones", area: "Admisiones y Registro",
    triggerCol: "¿Desea evaluar los trámites o servicios prestados por el proceso de Admisiones y Registro?",
    nivelCol: "Satisfacción general con la oficina",
    comentariosCol: "¿Qué aspectos considera que debe mejorar esta dependencia?3",
    exception: "admisiones",
  },
  {
    key: "interaccion_social", area: "Interacción Social Universitaria",
    triggerCol: "¿Desea evaluar los trámites o servicios prestados por el proceso de Interacción Social Universitaria?",
    nivelCol: "Interacción Social Universitaria",
    comentariosCol: "¿Qué aspectos considera que debe mejorar esta dependencia?4",
  },
  {
    key: "bienestar", area: "Bienestar Universitario",
    triggerCol: "¿Desea evaluar los trámites o servicios prestados por la Dirección de Bienestar Universitario?",
    nivelCol: "Bienestar Universitario",
    comentariosCol: "¿Qué aspectos considera que debe mejorar esta dependencia?5",
    exception: "bienestar",
  },
  {
    key: "dialogando_mundo", area: "Dialogando con el Mundo",
    triggerCol: "¿Desea evaluar los trámites o servicios prestados por el proceso Dialogando con el Mundo?",
    nivelCol: "Dialogando con el mundo",
    comentariosCol: "¿Qué aspectos considera que debe mejorar esta dependencia?6",
  },
  {
    key: "graduados", area: "Oficina de Graduados",
    triggerCol: "¿Desea evaluar los trámites o servicios prestados por la Oficina de Graduados?",
    nivelCol: "Oficina de graduados",
    comentariosCol: "¿Qué aspectos considera que debe mejorar esta dependencia?7",
  },
  {
    key: "educacion_virtual", area: "Educación Virtual y a Distancia",
    triggerCol: "¿Desea evaluar los trámites o servicios prestados por el proceso de Educación Virtual y a Distancia?",
    nivelCol: "Educación Virtual y a Distancia",
    comentariosCol: "¿Qué aspectos considera que debe mejorar esta dependencia?8",
  },
  {
    key: "atencion_ciudadano", area: "Atención al Ciudadano",
    triggerCol: "¿Desea evaluar los trámites o servicios prestados por el proceso de Atención al Ciudadano?",
    nivelCol: "Atención al Ciudadano",
    comentariosCol: "¿Qué aspectos considera que debe mejorar esta dependencia?9",
  },
  {
    key: "planeacion", area: "Planeación Institucional",
    triggerCol: "¿Desea evaluar los trámites o servicios prestados por el proceso de Planeación Institucional?",
    nivelCol: "Planeación Institucional",
    comentariosCol: "¿Qué aspectos considera que debe mejorar esta dependencia?10",
  },
  {
    key: "bienes_servicios", area: "Bienes y Servicios",
    triggerCol: "¿Desea evaluar los trámites o servicios prestados por la Oficina de Bienes y Servicios?",
    nivelCol: "Bienes y Servicios",
    comentariosCol: "¿Qué aspectos considera que debe mejorar esta dependencia?11",
  },
  {
    key: "comunicaciones", area: "Comunicaciones",
    triggerCol: "¿Desea evaluar las comunicaciones de la institución?",
    nivelCol: "Comunicaciones",
    comentariosCol: "¿Qué aspectos considera que debe mejorar la universidad en cuanto a sus comunicaciones?",
    exception: "comunicaciones",
  },
  {
    key: "autoevaluacion", area: "Autoevaluación y Acreditación",
    triggerCol: "¿Desea evaluar los trámites o servicios prestados por la Dirección de Autoevaluación y Acreditación?",
    nivelCol: "Autoevaluación y Acreditación",
    comentariosCol: "¿Qué aspectos considera que debe mejorar este proceso?",
  },
  {
    key: "formacion_aprendizaje", area: "Formación y Aprendizaje",
    triggerCol: "¿Desea evaluar los servicios prestados por los procesos de formación y aprendizaje?",
    nivelCol: "Formación y aprendizaje",
    comentariosCol: "¿Qué aspectos considera que debe mejorar este proceso?2",
  },
  {
    key: "planta_fisica", area: "Planta Física",
    triggerCol: "¿Desea evaluar la planta física de la universidad?",
    nivelCol: COLS_PLANTA_FISICA,
    comentariosCol: "¿Qué mejoras cree que se deben hacer a la planta física de la Universidad?",
    exception: "planta_fisica",
  },
  {
    key: "cad", area: "CAD",
    triggerCol: "¿Desea evaluar el CAD de la universidad?",
    nivelCol: "CAD",
    comentariosCol: "¿Qué mejoras cree que se deben hacer el  CAD?",
  },
  {
    key: "laboratorios", area: "Laboratorios",
    triggerCol: "¿Desea evaluar los Laboratorios?",
    nivelCol: "Laboratorios",
    comentariosCol: "¿Qué aspectos considera que se deben mejorar en los laboratorios?",
  },
  {
    key: "espacios_deportivos", area: "Espacios Deportivos",
    triggerCol: "¿Desea evaluar los Espacios Deportivos?",
    nivelCol: "Espacios Deportivos",
    comentariosCol: "¿Qué aspectos considera que se deben mejorar en los espacios deportivos?",
  },
  {
    key: "biblioclic", area: "Biblioclic",
    triggerCol: "¿Desea evaluar el servicio Biblioclic?",
    nivelCol: "Biblioclic",
    comentariosCol: "¿Qué aspectos considera que se deben mejorar el servicio Biblioclic?",
    exception: "biblioclic",
  },
  {
    key: "instituto_posgrados", area: "Instituto de Posgrados",
    triggerCol: "¿Desea evaluar los servicios del Instituto de Posgrados?",
    nivelCol: "Biblioclic2",
    comentariosCol: "¿Qué aspectos considera se deben mejorar en los servicios del Instituto de Posgrados?",
  },
  {
    key: "sede_seccional", area: "Sede / Seccional / Extensión",
    triggerCol: null,
    nivelCol: "Sede/seccional/extensión",
    comentariosCol: "¿Qué aspectos considera que debe mejorar en general la sede/seccional/extensión de la cual usted forma parte?",
    exception: "sede",
  },
  {
    key: "universidad", area: "Universidad de Cundinamarca",
    triggerCol: null,
    nivelCol: "Universidad de Cundinamarca",
    comentariosCol: "¿Qué aspectos considera que debe mejorar en general la UCundinamarca?",
    exception: "universidad",
  },
];

// ─── Helpers de lectura ───────────────────────────────────────────────────────

/** Promedio de planta física a partir de los nombres de columna */
export function avgPlantaFisica(row: Record<string, unknown>): number | null {
  let sum = 0;
  let count = 0;
  for (const col of COLS_PLANTA_FISICA) {
    const n = nivelToNumber(row[normKey(col)]);
    if (n != null) { sum += n; count++; }
  }
  return count > 0 ? sum / count : null;
}

/** Lee el nivel de un área (simple o promedio de planta física) */
export function getNivel(row: Record<string, unknown>, a: AreaMapping): { text: string | null; num: number | null } {
  if (Array.isArray(a.nivelCol)) {
    const avg = avgPlantaFisica(row);
    return { text: numberToNivel(avg), num: avg };
  }
  const text = getByPrefix(row, a.nivelCol);
  const str  = text != null && text !== "" ? String(text).trim() : null;
  return { text: str, num: nivelToNumber(str) };
}

/** Lee comentarios de un área */
export function getComentarios(row: Record<string, unknown>, a: AreaMapping): string | null {
  if (!a.comentariosCol) return null;
  const v = getByPrefix(row, a.comentariosCol);
  return v != null && v !== "" ? String(v).trim() : null;
}
