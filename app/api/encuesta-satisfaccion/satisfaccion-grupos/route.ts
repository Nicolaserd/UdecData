import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { prisma } from "@/lib/prisma";
import { normKey } from "@/lib/parsers/encuesta-satisfaccion";
import { injectCharts, type ChartOpts } from "@/lib/excel-chart";

export const runtime     = "nodejs";
export const maxDuration = 60;

const NIVELES = [
  "Muy insatisfecho",
  "Insatisfecho",
  "Ni satisfecho ni insatisfecho",
  "Satisfecho",
  "Muy satisfecho",
] as const;

type Grupo = "Administrativo" | "Docente" | "Estudiante" | "Graduado";
const GRUPOS: readonly Grupo[] = ["Administrativo", "Docente", "Estudiante", "Graduado"];

// Fuente: grupos_evalua_area_iipa_2025.md (claves normalizadas con normKey)
const AREA_GRUPOS: Record<string, readonly Grupo[]> = {
  "procesos financieros":              ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "talento humano":                    ["Administrativo", "Docente"],
  "direccion de talento humano":       ["Administrativo", "Docente"],
  "admisiones y registro":             ["Administrativo", "Docente", "Estudiante"],
  "direccion de investigacion":        ["Administrativo", "Docente", "Estudiante"],
  "interaccion social universitaria":  ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "bienestar universitario":           ["Administrativo", "Docente", "Estudiante"],
  "dialogando con el mundo":           ["Administrativo", "Docente", "Estudiante"],
  "oficina de graduados":              ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "educacion virtual":                 ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "educacion virtual y a distancia":   ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "atencion al ciudadano":             ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "planeacion institucional":          ["Administrativo", "Estudiante"],
  "bienes y servicios":                ["Administrativo", "Docente", "Estudiante"],
  "comunicaciones":                    ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "oficina asesora de comunicaciones": ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "autoevaluacion y acreditacion":     ["Administrativo", "Docente", "Estudiante"],
  "formacion y aprendizaje":           ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "planta fisica":                     ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "laboratorios":                      ["Docente", "Estudiante"],
  "espacios deportivos":               ["Administrativo", "Docente", "Estudiante"],
  "biblioclic":                        ["Administrativo", "Docente", "Estudiante"],
  "biblioteca biblioclic":             ["Administrativo", "Docente", "Estudiante"],
  "instituto de posgrados":            ["Administrativo", "Docente", "Estudiante"],
};

const AREA_ORDER = [
  "procesos financieros",
  "talento humano",
  "admisiones y registro",
  "direccion de investigacion",
  "interaccion social universitaria",
  "bienestar universitario",
  "dialogando con el mundo",
  "oficina de graduados",
  "educacion virtual y a distancia",
  "educacion virtual",
  "atencion al ciudadano",
  "planeacion institucional",
  "bienes y servicios",
  "comunicaciones",
  "autoevaluacion y acreditacion",
  "formacion y aprendizaje",
  "planta fisica",
  "laboratorios",
  "espacios deportivos",
  "biblioclic",
  "instituto de posgrados",
];

function gruposParaArea(area: string): readonly Grupo[] {
  const k = normKey(area);
  if (AREA_GRUPOS[k]) return AREA_GRUPOS[k];
  for (const [key, grupos] of Object.entries(AREA_GRUPOS)) {
    if (k.includes(key) || key.includes(k)) return grupos;
  }
  return GRUPOS;
}

function ordenAreaIdx(area: string): number {
  const k = normKey(area);
  const idx = AREA_ORDER.indexOf(k);
  if (idx >= 0) return idx;
  for (let i = 0; i < AREA_ORDER.length; i++) {
    const ref = AREA_ORDER[i];
    if (k.includes(ref) || ref.includes(k)) return i;
  }
  return AREA_ORDER.length + 1;
}

function normalizeRol(rol: string): Grupo | null {
  const k = normKey(rol);
  if (k.includes("administrativo")) return "Administrativo";
  if (k.includes("docente"))        return "Docente";
  if (k.includes("estudiante"))     return "Estudiante";
  if (k.includes("graduado") || k.includes("egresado")) return "Graduado";
  return null;
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const COL_HEADER = "A9D08E";
const COL_TOTAL  = "E2EFDA";
const BORDER      = { style: "thin" as const, color: { rgb: "808080" } };
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

type CellStyle = XLSX.CellStyle;

const styleAreaTitle: CellStyle = {
  font: { bold: true, sz: 13, color: { rgb: "1F4E2C" } },
  alignment: { horizontal: "left", vertical: "center" },
};

const styleHeader: CellStyle = {
  font: { bold: true, sz: 11, color: { rgb: "1F3826" } },
  fill: { patternType: "solid", fgColor: { rgb: COL_HEADER } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: ALL_BORDERS,
};

const styleGroupLabel: CellStyle = {
  font: { bold: true, sz: 11 },
  alignment: { horizontal: "left", vertical: "center" },
  border: ALL_BORDERS,
};

const styleData: CellStyle = {
  font: { sz: 11 },
  alignment: { horizontal: "center", vertical: "center" },
  border: ALL_BORDERS,
};

const styleDataHighlight: CellStyle = {
  font: { bold: true, sz: 11, color: { rgb: "1F3826" } },
  fill: { patternType: "solid", fgColor: { rgb: COL_HEADER } },
  alignment: { horizontal: "center", vertical: "center" },
  border: ALL_BORDERS,
};

const styleTotalLabel: CellStyle = {
  font: { bold: true, sz: 11 },
  fill: { patternType: "solid", fgColor: { rgb: COL_TOTAL } },
  alignment: { horizontal: "left", vertical: "center" },
  border: ALL_BORDERS,
};

const styleTotalData: CellStyle = {
  font: { bold: true, sz: 11 },
  fill: { patternType: "solid", fgColor: { rgb: COL_TOTAL } },
  alignment: { horizontal: "center", vertical: "center" },
  border: ALL_BORDERS,
};

const styleTotalHighlight: CellStyle = {
  font: { bold: true, sz: 11, color: { rgb: "1F3826" } },
  fill: { patternType: "solid", fgColor: { rgb: COL_HEADER } },
  alignment: { horizontal: "center", vertical: "center" },
  border: ALL_BORDERS,
};

// ─── Estilos hoja "Resumen general" ──────────────────────────────────────────

const styleChartTitle: CellStyle = {
  font: { bold: true, sz: 14, color: { rgb: "1F3826" } },
  alignment: { horizontal: "center", vertical: "center" },
};

const styleResumenAreaCell: CellStyle = {
  font: { sz: 11, color: { rgb: "191C1D" } },
  alignment: { horizontal: "left", vertical: "center" },
  border: ALL_BORDERS,
};

const styleResumenPctCell: CellStyle = {
  font: { bold: true, sz: 11, color: { rgb: "1F3826" } },
  fill: { patternType: "solid", fgColor: { rgb: COL_HEADER } },
  alignment: { horizontal: "center", vertical: "center" },
  border: ALL_BORDERS,
};

// ─── Helpers de celdas ───────────────────────────────────────────────────────

type RawCell =
  | { kind: "title";        text: string }
  | { kind: "subtitle";     text: string }
  | { kind: "areaTitle";    text: string }
  | { kind: "header";       text: string }
  | { kind: "groupLabel";   text: string }
  | { kind: "totalLabel";   text: string }
  | { kind: "data";         value: number; highlight?: boolean }
  | { kind: "totalData";    value: number; highlight?: boolean }
  | { kind: "chartTitle";   text: string }
  | { kind: "resumenArea"; text: string }
  | { kind: "resumenPct";  value: number }
  | { kind: "count";       value: number }
  | { kind: "totalCount";  value: number }
  | { kind: "na" }
  | null;

function cellFor(raw: RawCell): XLSX.CellObject | null {
  if (!raw) return null;
  switch (raw.kind) {
    case "title":      return { t: "s", v: raw.text, s: { font: { bold: true, sz: 14, color: { rgb: "00682F" } } } };
    case "subtitle":   return { t: "s", v: raw.text, s: { font: { italic: true, sz: 10, color: { rgb: "6E7A6E" } } } };
    case "areaTitle":  return { t: "s", v: raw.text, s: styleAreaTitle };
    case "header":     return { t: "s", v: raw.text, s: styleHeader };
    case "groupLabel": return { t: "s", v: raw.text, s: styleGroupLabel };
    case "totalLabel": return { t: "s", v: raw.text, s: styleTotalLabel };
    case "data":       return { t: "n", v: raw.value, z: "0.00%", s: raw.highlight ? styleDataHighlight : styleData };
    case "totalData":  return { t: "n", v: raw.value, z: "0.00%", s: raw.highlight ? styleTotalHighlight : styleTotalData };
    case "chartTitle": return { t: "s", v: raw.text, s: styleChartTitle };
    case "resumenArea": return { t: "s", v: raw.text, s: styleResumenAreaCell };
    case "resumenPct":  return { t: "n", v: raw.value, z: '0"%"', s: styleResumenPctCell };
    case "count":       return { t: "n", v: raw.value, z: "0", s: styleData };
    case "totalCount":  return { t: "n", v: raw.value, z: "0", s: styleTotalData };
    case "na":          return { t: "s", v: "—", s: styleData };
  }
}

function gridToSheet(grid: RawCell[][], merges: XLSX.Range[], cols: XLSX.ColInfo[], minCols: number, rows?: XLSX.RowInfo[]): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  let maxR = 0, maxC = 0;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      const cell = cellFor(row[c]);
      if (!cell) continue;
      const addr = XLSX.utils.encode_cell({ r, c });
      ws[addr] = cell;
      if (r > maxR) maxR = r;
      if (c > maxC) maxC = c;
    }
  }
  if (maxC < minCols - 1) maxC = minCols - 1;
  ws["!ref"]    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  ws["!cols"]   = cols;
  ws["!merges"] = merges;
  if (rows) ws["!rows"] = rows;
  return ws;
}

// ─── Hojas de detalle por tabla de BD (planta física, admisiones, …) ─────────
// Cada hoja apila 3 sub-tablas (por grupo, por unidad regional, por pregunta),
// con la distribución de los 5 niveles + columna de satisfacción (Satisfecho +
// Muy satisfecho). Solo se incluyen variables medidas en escala de satisfacción.

const NIVEL_INDEX: Record<string, number> = {
  "muy insatisfecho":              0,
  "insatisfecho":                  1,
  "ni satisfecho ni insatisfecho": 2,
  "satisfecho":                    3,
  "muy satisfecho":                4,
};

function nivelIdx(value: unknown): number | null {
  if (value == null) return null;
  const k = normKey(String(value));
  return k in NIVEL_INDEX ? NIVEL_INDEX[k] : null;
}

// Orden de unidades regionales (sede principal primero); el resto, alfabético.
const UNIDAD_ORDER = ["Fusagasugá", "Girardot", "Ubaté", "Soacha", "Chía", "Facatativá", "Zipaquirá"];
function ordUnidad(s: string): number {
  const k = normKey(s);
  const i = UNIDAD_ORDER.findIndex((u) => normKey(u) === k);
  return i >= 0 ? i : UNIDAD_ORDER.length;
}
function orderUnidades(list: string[]): string[] {
  return [...list].sort((a, b) => {
    const da = ordUnidad(a), db = ordUnidad(b);
    if (da !== db) return da - db;
    return a.localeCompare(b, "es");
  });
}

type VarDef = { key: string; label: string };
type Entry  = { label: string; counts: number[] };

/** Chart relativo a una hoja; el índice y nombre de la hoja se completan al armar el libro. */
type SheetChart = Omit<ChartOpts, "sheetIndex" | "sheetName">;

/** Filas (0-based) de un bloque: título, encabezado, primera fila de datos y fila "Total". */
type Bloque = { title: number; header: number; first: number; total: number };

type DetalleCtx = {
  grid:    RawCell[][];
  merges:  XLSX.Range[];
  charts:  SheetChart[];
  bloques: { grupo: Bloque; unidad: Bloque; variable: Bloque };
  periodo: string;
  anio:    number;
};

type DetalleTabla = {
  sheet:  string;   // nombre de la pestaña (≤31 chars, único)
  titulo: string;   // título dentro de la hoja
  fetch:  (anio: number, periodo: string) => Promise<Array<Record<string, unknown>>>;
  vars:   VarDef[]; // variables en escala de satisfacción
  /** Contenido adicional (tablas y gráficas) debajo de los bloques de satisfacción. */
  extra?: (rows: Array<Record<string, unknown>>, ctx: DetalleCtx) => void;
};

const VARS_ATENCION: VarDef[] = [
  { key: "respuesta_solicitud",  label: "Respuesta a la solicitud" },
  { key: "confianza_servidores", label: "Confianza en los servidores" },
  { key: "tiempo_respuesta",     label: "Tiempo de respuesta" },
  { key: "info_canales",         label: "Información en los canales" },
  { key: "facilidad_acceso",     label: "Facilidad de acceso" },
  { key: "amabilidad_respeto",   label: "Amabilidad y respeto" },
  { key: "nivel_edificios",      label: "Nivel de edificios e instalaciones" },
  { key: "nivel_plataformas",    label: "Nivel de plataformas" },
];

const DETALLE_TABLAS: DetalleTabla[] = [
  {
    sheet: "Planta Física", titulo: "Satisfacción · Planta Física",
    fetch: (anio, periodo) => prisma.satisfaccionPlantaFisica.findMany({ where: { anio, periodo_academico: periodo } }) as unknown as Promise<Record<string, unknown>[]>,
    vars: [
      { key: "estructura_administrativa",  label: "Estructura física área administrativa" },
      { key: "campus_verde",               label: "Transformación a campus verde" },
      { key: "senalizacion_emergencia",    label: "Señalización de emergencia" },
      { key: "estructura_areas_comunes",   label: "Estructura física áreas comunes" },
      { key: "protocolos_bioseguridad",    label: "Protocolos de bioseguridad" },
      { key: "servicio_energia",           label: "Servicio de energía eléctrica" },
      { key: "red_hidrosanitaria",         label: "Red hidrosanitaria" },
      { key: "estructura_academica",       label: "Estructura física área académica" },
      { key: "seguridad_fisica",           label: "Seguridad física" },
      { key: "pintura_espacios",           label: "Pintura de los espacios" },
      { key: "estructura_estacionamiento", label: "Estructura zonas de estacionamiento" },
      { key: "contenedores_residuos",      label: "Contenedores de residuos" },
      { key: "zonas_verdes",               label: "Zonas verdes" },
    ],
  },
  {
    sheet: "Admisiones y Registro", titulo: "Satisfacción · Admisiones y Registro",
    fetch: (anio, periodo) => prisma.satisfaccionAdmisionesRegistro.findMany({ where: { anio, periodo_academico: periodo } }) as unknown as Promise<Record<string, unknown>[]>,
    vars: [
      { key: "satisfaccion_general", label: "Satisfacción general con la oficina" },
      { key: "grados_titulos",       label: "Grados y títulos académicos" },
      { key: "proceso_inscripcion",  label: "Proceso de inscripción y admisión" },
      { key: "solicitud_documentos", label: "Solicitud de documentos" },
      ...VARS_ATENCION,
    ],
  },
  {
    sheet: "Bienestar", titulo: "Satisfacción · Bienestar Universitario",
    fetch: (anio, periodo) => prisma.satisfaccionBienestar.findMany({ where: { anio, periodo_academico: periodo } }) as unknown as Promise<Record<string, unknown>[]>,
    vars: [
      { key: "bienestar_universitario", label: "Satisfacción general con Bienestar" },
      ...VARS_ATENCION,
    ],
  },
  {
    sheet: "Comunicaciones", titulo: "Satisfacción · Comunicaciones",
    fetch: (anio, periodo) => prisma.satisfaccionComunicaciones.findMany({ where: { anio, periodo_academico: periodo } }) as unknown as Promise<Record<string, unknown>[]>,
    vars: [
      { key: "comunicaciones", label: "Satisfacción con las comunicaciones" },
    ],
    extra: buildComunicacionesExtra,
  },
  {
    sheet: "Biblioclic", titulo: "Satisfacción · Biblioclic",
    fetch: (anio, periodo) => prisma.satisfaccionBiblioclic.findMany({ where: { anio, periodo_academico: periodo } }) as unknown as Promise<Record<string, unknown>[]>,
    vars: [
      { key: "biblioclic", label: "Satisfacción con el servicio Biblioclic" },
    ],
  },
  {
    sheet: "Sede - Seccional", titulo: "Satisfacción · Sede / Seccional / Extensión",
    fetch: (anio, periodo) => prisma.satisfaccionSede.findMany({ where: { anio, periodo_academico: periodo } }) as unknown as Promise<Record<string, unknown>[]>,
    vars: [
      { key: "sede_satisfaccion", label: "Satisfacción general con la sede" },
      ...VARS_ATENCION,
    ],
  },
  {
    sheet: "Universidad", titulo: "Satisfacción · Universidad de Cundinamarca",
    fetch: (anio, periodo) => prisma.satisfaccionUniversidad.findMany({ where: { anio, periodo_academico: periodo } }) as unknown as Promise<Record<string, unknown>[]>,
    vars: [
      { key: "universidad", label: "Satisfacción general con la institución" },
      ...VARS_ATENCION,
    ],
  },
];

function tally(rows: Array<Record<string, unknown>>, vars: VarDef[]) {
  const zeros = () => [0, 0, 0, 0, 0];
  const byGrupo  = new Map<Grupo, number[]>();
  const byUnidad = new Map<string, number[]>();
  const byVar    = new Map<string, number[]>();
  const total    = zeros();

  for (const r of rows) {
    const grupo = normalizeRol(String(r.rol ?? ""));
    const sede  = (String(r.unidad_regional ?? "").trim() || "Sin sede");
    for (const v of vars) {
      const idx = nivelIdx(r[v.key]);
      if (idx == null) continue;
      total[idx]++;
      if (grupo) {
        let g = byGrupo.get(grupo); if (!g) { g = zeros(); byGrupo.set(grupo, g); } g[idx]++;
      }
      { let u = byUnidad.get(sede); if (!u) { u = zeros(); byUnidad.set(sede, u); } u[idx]++; }
      { let x = byVar.get(v.key);   if (!x) { x = zeros(); byVar.set(v.key, x); }   x[idx]++; }
    }
  }
  return { byGrupo, byUnidad, byVar, total };
}

function pushBlock(
  grid: RawCell[][], merges: XLSX.Range[], nCols: number,
  blockTitle: string, dimLabel: string, entries: Entry[],
): Bloque {
  const r0 = grid.length;
  grid.push([{ kind: "areaTitle", text: blockTitle }]);
  merges.push({ s: { r: r0, c: 0 }, e: { r: r0, c: nCols - 1 } });

  grid.push([
    { kind: "header", text: dimLabel },
    ...NIVELES.map((n) => ({ kind: "header" as const, text: n })),
    { kind: "header", text: "Nivel de satisfacción" },
  ]);

  const grand = [0, 0, 0, 0, 0];
  for (const e of entries) {
    const tot = e.counts.reduce((s, x) => s + x, 0);
    const row: RawCell[] = [{ kind: "groupLabel", text: e.label }];
    for (let i = 0; i < 5; i++) {
      row.push({ kind: "data", value: tot > 0 ? e.counts[i] / tot : 0 });
      grand[i] += e.counts[i];
    }
    const sat = e.counts[3] + e.counts[4];
    row.push({ kind: "data", value: tot > 0 ? sat / tot : 0, highlight: true });
    grid.push(row);
  }

  const gtot = grand.reduce((s, x) => s + x, 0);
  const totalRow: RawCell[] = [{ kind: "totalLabel", text: "Total" }];
  for (let i = 0; i < 5; i++) totalRow.push({ kind: "totalData", value: gtot > 0 ? grand[i] / gtot : 0 });
  const gsat = grand[3] + grand[4];
  totalRow.push({ kind: "totalData", value: gtot > 0 ? gsat / gtot : 0, highlight: true });
  const total = grid.length;
  grid.push(totalRow);
  grid.push([null]);
  return { title: r0, header: r0 + 1, first: r0 + 2, total };
}

const DETALLE_COLS: XLSX.ColInfo[] = [
  { wch: 46 }, { wch: 16 }, { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 20 },
];

function buildDetalleSheet(
  rows: Array<Record<string, unknown>>, tabla: DetalleTabla,
  periodo: string, anio: number,
): { ws: XLSX.WorkSheet; charts: SheetChart[] } | null {
  const { vars, titulo } = tabla;
  const nCols = 1 + NIVELES.length + 1;
  const { byGrupo, byUnidad, byVar, total } = tally(rows, vars);
  if (total.reduce((s, x) => s + x, 0) === 0) return null;

  const grid: RawCell[][] = [];
  const merges: XLSX.Range[] = [];

  grid.push([{ kind: "title", text: `${titulo} — ${periodo} ${anio}` }]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } });
  grid.push([{ kind: "subtitle", text: `Fuente: Encuesta de Satisfacción Voz de la Comunidad UCundinamarca · ${periodo} ${anio}. Distribución porcentual por nivel; "Nivel de satisfacción" = Satisfecho + Muy satisfecho.` }]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: nCols - 1 } });
  grid.push([null]);

  const grupoEntries:  Entry[] = GRUPOS.filter((g) => byGrupo.has(g)).map((g) => ({ label: g, counts: byGrupo.get(g)! }));
  const unidadEntries: Entry[] = orderUnidades([...byUnidad.keys()]).map((u) => ({ label: u, counts: byUnidad.get(u)! }));
  const varEntries:    Entry[] = vars.filter((v) => byVar.has(v.key)).map((v) => ({ label: v.label, counts: byVar.get(v.key)! }));

  const bloques = {
    grupo:    pushBlock(grid, merges, nCols, "Por grupo de interés", "Grupo de Interés", grupoEntries),
    unidad:   pushBlock(grid, merges, nCols, "Por unidad regional",  "Unidad Regional",  unidadEntries),
    variable: pushBlock(grid, merges, nCols, "Por pregunta evaluada", "Pregunta / Variable", varEntries),
  };

  const charts: SheetChart[] = [];
  tabla.extra?.(rows, { grid, merges, charts, bloques, periodo, anio });

  return { ws: gridToSheet(grid, merges, DETALLE_COLS, nCols), charts };
}

// ─── Comunicaciones: gráficas de satisfacción + preguntas de percepción ──────
// Las preguntas de tono, canales y emoción no usan la escala de satisfacción:
// se tabulan como % de personas por grupo de interés que eligió cada opción.
// Las opciones de tono y canales salen de los datos, así cualquier encuesta
// cargada (otro periodo/año, canales nuevos) se refleja sin tocar el código.

const OTRA_RESPUESTA = "Otra respuesta";
const CHART_COL_FROM = 8;   // columna I
const CHART_COL_TO   = 17;  // columna R
const CHART_ROWS     = 18;  // alto de cada gráfica en filas

type OpcionFija = { label: string; match: (k: string) => boolean };

type PreguntaCat = {
  key:    string;
  titulo: string;
  dim:    string;            // encabezado de la columna de opciones
  nota?:  string;
  multi?: boolean;           // selección múltiple separada por ";"
  opciones?: OpcionFija[];   // si no se define, las opciones salen de los datos (orden desc)
  chart:  "bar" | "col" | "pie";
};

const PREGUNTAS_COMUNICACIONES: PreguntaCat[] = [
  {
    key: "tono_comunicacion", dim: "Tono",
    titulo: "Tono de la comunicación de la Oficina Asesora de Comunicaciones en sus canales y productos",
    chart: "col",
  },
  {
    key: "canales_uso", dim: "Canal", multi: true,
    titulo: "Canales que usa para enterarse de las actividades y temas de la Universidad",
    nota: "Selección múltiple: % de personas que eligió cada canal (la suma puede superar el 100%).",
    chart: "bar",
  },
  {
    key: "tono_redes", dim: "Respuesta",
    titulo: "¿Los mensajes en redes sociales están redactados en un tono cercano y amigable?",
    opciones: [
      { label: "Sí", match: (k) => k === "si" },
      { label: "No", match: (k) => k === "no" },
    ],
    chart: "pie",
  },
  {
    key: "tono_emocion", dim: "Se siente como…",
    titulo: "El tono de los mensajes y contenidos de la oficina de comunicaciones le hace sentir",
    nota: "Las respuestas libres que no corresponden a una opción se agrupan en \"Otra respuesta\".",
    opciones: [
      { label: "Miembro cercano y familiar de la comunidad",     match: (k) => k.includes("miembro cercano") },
      { label: "Persona que necesita informarse de servicios",   match: (k) => k.includes("necesite informarse") || k.includes("necesita informarse") },
      { label: "Ciudadano que necesita estar actualizado",       match: (k) => k.includes("ciudadano") },
      { label: "Individuo que no hace parte de la Universidad",  match: (k) => k.includes("no hace parte") },
    ],
    chart: "bar",
  },
];

type ConteoPregunta = {
  orden:    string[];
  personas: Map<string, number>;               // columna (grupo | "Total") → personas
  cuenta:   Map<string, Map<string, number>>;  // opción → columna → personas
};

function contarPregunta(rows: Array<Record<string, unknown>>, p: PreguntaCat): ConteoPregunta {
  const personas = new Map<string, number>();
  const cuenta   = new Map<string, Map<string, number>>();
  const etiquetas = new Map<string, string>(); // clave normalizada → etiqueta (opciones dinámicas)
  const inc = <K>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);

  for (const r of rows) {
    const raw = String(r[p.key] ?? "").trim();
    if (!raw) continue;
    const partes = p.multi ? raw.split(";") : [raw];
    const elegidas = new Set<string>();
    for (const parte of partes) {
      const txt = parte.trim();
      const k = normKey(txt);
      if (!/[a-z0-9]/.test(k)) continue; // respuestas vacías como "." o "-"
      let label: string;
      if (p.opciones) {
        label = p.opciones.find((o) => o.match(k))?.label ?? OTRA_RESPUESTA;
      } else {
        if (!etiquetas.has(k)) etiquetas.set(k, txt.charAt(0).toUpperCase() + txt.slice(1));
        label = etiquetas.get(k)!;
      }
      elegidas.add(label);
    }
    if (elegidas.size === 0) continue;

    const grupo = normalizeRol(String(r.rol ?? ""));
    const cols  = grupo ? [grupo, "Total"] : ["Total"];
    for (const c of cols) {
      inc(personas, c);
      for (const e of elegidas) {
        let m = cuenta.get(e);
        if (!m) { m = new Map(); cuenta.set(e, m); }
        inc(m, c);
      }
    }
  }

  const totalDe = (label: string) => cuenta.get(label)?.get("Total") ?? 0;
  const orden = p.opciones
    ? [...p.opciones.map((o) => o.label), OTRA_RESPUESTA].filter((l) => totalDe(l) > 0)
    : [...cuenta.keys()].sort((a, b) => totalDe(b) - totalDe(a) || a.localeCompare(b, "es"));
  return { orden, personas, cuenta };
}

const colLetter = (c: number) => XLSX.utils.encode_col(c);

/** Valores numéricos de una columna del grid (para cachear en la gráfica). */
function numsAt(grid: RawCell[][], r1: number, r2: number, c: number): number[] {
  const out: number[] = [];
  for (let r = r1; r <= r2; r++) {
    const cell = grid[r]?.[c];
    out.push(cell && "value" in cell ? cell.value : 0);
  }
  return out;
}

function textsAt(grid: RawCell[][], r1: number, r2: number, c: number): string[] {
  const out: string[] = [];
  for (let r = r1; r <= r2; r++) {
    const cell = grid[r]?.[c];
    out.push(cell && "text" in cell ? cell.text : "");
  }
  return out;
}

function buildComunicacionesExtra(rows: Array<Record<string, unknown>>, ctx: DetalleCtx): void {
  const { grid, merges, charts, bloques, periodo, anio } = ctx;
  const sufijo = `${periodo} ${anio}`;

  // Gráfica 1: nivel de satisfacción con las comunicaciones por grupo de interés (incluye Total).
  const g = bloques.grupo;
  const COL_SAT = 1 + NIVELES.length; // columna G
  charts.push({
    kind: "col",
    title: `Satisfacción con las comunicaciones por grupo de interés — ${sufijo}`,
    catRange: `$A$${g.first + 1}:$A$${g.total + 1}`,
    valRange: `$${colLetter(COL_SAT)}$${g.first + 1}:$${colLetter(COL_SAT)}$${g.total + 1}`,
    serNameRef: `$${colLetter(COL_SAT)}$${g.header + 1}`,
    serName: "Nivel de satisfacción",
    numFmt: "0.0%", valMax: 1, valMajorUnit: 0.25,
    fromCol: CHART_COL_FROM, fromRow: g.title,
    toCol: CHART_COL_TO, toRow: g.title + CHART_ROWS,
    cache: { cats: textsAt(grid, g.first, g.total, 0), vals: numsAt(grid, g.first, g.total, COL_SAT) },
  });

  // Gráfica 2: distribución por nivel (fila "Total" del bloque por grupo), al lado de la anterior.
  const nivelesCats = `$B$${g.header + 1}:$${colLetter(NIVELES.length)}$${g.header + 1}`;
  charts.push({
    kind: "col",
    title: `Distribución por nivel de satisfacción — Comunicaciones ${sufijo}`,
    catRange: nivelesCats,
    valRange: `$B$${g.total + 1}:$${colLetter(NIVELES.length)}$${g.total + 1}`,
    serNameRef: `$A$${g.total + 1}`,
    serName: "Total",
    numFmt: "0.0%", valMax: 1, valMajorUnit: 0.25,
    fromCol: CHART_COL_TO + 1, fromRow: g.title,
    toCol: CHART_COL_TO + 10, toRow: g.title + CHART_ROWS,
    cache: {
      cats: [...NIVELES],
      vals: NIVELES.map((_, i) => numsAt(grid, g.total, g.total, 1 + i)[0]),
    },
  });

  // Secciones de percepción: cada tabla con su gráfica a la derecha.
  const NC = 1 + GRUPOS.length + 1; // opción + 4 grupos + Total
  let libre = Math.max(grid.length, g.title + CHART_ROWS + 2);
  const padTo = (n: number) => { while (grid.length < n) grid.push([null]); };

  const preguntas = PREGUNTAS_COMUNICACIONES
    .map((p) => ({ p, c: contarPregunta(rows, p) }))
    .filter(({ c }) => c.orden.length > 0);
  if (preguntas.length === 0) return;

  padTo(libre);
  const sr = grid.length;
  grid.push([{ kind: "title", text: `Percepción de las comunicaciones — ${sufijo}` }]);
  merges.push({ s: { r: sr, c: 0 }, e: { r: sr, c: NC - 1 } });
  grid.push([{ kind: "subtitle", text: "% de personas de cada grupo de interés que eligió cada opción, entre quienes respondieron la pregunta." }]);
  merges.push({ s: { r: sr + 1, c: 0 }, e: { r: sr + 1, c: NC - 1 } });
  grid.push([null]);

  for (const { p, c } of preguntas) {
    padTo(libre);
    const r0 = grid.length;
    grid.push([{ kind: "areaTitle", text: p.titulo }]);
    merges.push({ s: { r: r0, c: 0 }, e: { r: r0, c: NC - 1 } });
    if (p.nota) {
      grid.push([{ kind: "subtitle", text: p.nota }]);
      merges.push({ s: { r: r0 + 1, c: 0 }, e: { r: r0 + 1, c: NC - 1 } });
    }

    const header = grid.length;
    grid.push([
      { kind: "header", text: p.dim },
      ...GRUPOS.map((gr) => ({ kind: "header" as const, text: gr })),
      { kind: "header", text: "Total" },
    ]);

    const first = grid.length;
    for (const label of c.orden) {
      const m = c.cuenta.get(label)!;
      const row: RawCell[] = [{ kind: "groupLabel", text: label }];
      for (const gr of GRUPOS) {
        const n = c.personas.get(gr) ?? 0;
        row.push(n > 0 ? { kind: "data", value: (m.get(gr) ?? 0) / n } : { kind: "na" });
      }
      const nt = c.personas.get("Total") ?? 0;
      row.push({ kind: "data", value: nt > 0 ? (m.get("Total") ?? 0) / nt : 0, highlight: true });
      grid.push(row);
    }
    const last = grid.length - 1;

    grid.push([
      { kind: "totalLabel", text: "Personas que respondieron" },
      ...GRUPOS.map((gr) => ({ kind: "totalCount" as const, value: c.personas.get(gr) ?? 0 })),
      { kind: "totalCount", value: c.personas.get("Total") ?? 0 },
    ]);
    grid.push([null]);

    const colTot = colLetter(NC - 1); // columna F
    charts.push({
      kind: p.chart,
      title: `${p.titulo} — ${sufijo}`,
      catRange: `$A$${first + 1}:$A$${last + 1}`,
      valRange: `$${colTot}$${first + 1}:$${colTot}$${last + 1}`,
      serNameRef: `$${colTot}$${header + 1}`,
      serName: "Total",
      numFmt: "0.0%",
      ...(p.chart === "pie" ? {} : { valMax: 1, valMajorUnit: 0.25 }),
      fromCol: CHART_COL_FROM, fromRow: r0,
      toCol: CHART_COL_TO, toRow: r0 + CHART_ROWS,
      cache: { cats: textsAt(grid, first, last, 0), vals: numsAt(grid, first, last, NC - 1) },
    });

    libre = Math.max(grid.length, r0 + CHART_ROWS + 2);
  }
}

// ─── Hoja "Dimensiones de calidad" (SERVQUAL) ────────────────────────────────
// Clasificación de las preguntas de calidad de servicio en 5 dimensiones. Cada
// dimensión tiene ≥1 pregunta. Fuente: preguntas comunes presentes en las tablas
// de Admisiones, Bienestar, Sede y Universidad.

const DIM_FUENTE_SHEETS = new Set(["Admisiones y Registro", "Bienestar", "Sede - Seccional", "Universidad"]);

const DIMENSIONES: { nombre: string; vars: VarDef[] }[] = [
  {
    nombre: "Confiabilidad",
    vars: [{ key: "respuesta_solicitud", label: "Respuesta proporcionada a la solicitud" }],
  },
  {
    nombre: "Capacidad de respuesta",
    vars: [{ key: "tiempo_respuesta", label: "Tiempo de respuesta" }],
  },
  {
    nombre: "Accesibilidad a la información",
    vars: [
      { key: "info_canales",     label: "Información disponible en los canales" },
      { key: "facilidad_acceso", label: "Facilidad de acceso a los servicios" },
    ],
  },
  {
    nombre: "Amabilidad y empatía",
    vars: [
      { key: "amabilidad_respeto",   label: "Amabilidad y respeto en la atención" },
      { key: "confianza_servidores", label: "Confianza generada por los servidores" },
    ],
  },
  {
    nombre: "Elementos tangibles",
    vars: [
      { key: "nivel_edificios",   label: "Edificios e instalaciones" },
      { key: "nivel_plataformas", label: "Plataformas tecnológicas" },
    ],
  },
];

/** % de satisfacción (Satisfecho + Muy satisfecho) sobre las preguntas de la dimensión. */
function pctSat(rows: Array<Record<string, unknown>>, vars: VarDef[], grupo?: Grupo): { pct: number; total: number } {
  let sat = 0, total = 0;
  for (const r of rows) {
    if (grupo && normalizeRol(String(r.rol ?? "")) !== grupo) continue;
    for (const v of vars) {
      const i = nivelIdx(r[v.key]);
      if (i == null) continue;
      total++;
      if (i >= 3) sat++; // 3 = Satisfecho, 4 = Muy satisfecho
    }
  }
  return { pct: total > 0 ? sat / total : 0, total };
}

const DIM_COLS: XLSX.ColInfo[] = [{ wch: 34 }, { wch: 22 }];

function buildDimensionesSheet(
  rows: Array<Record<string, unknown>>, periodo: string, anio: number,
): XLSX.WorkSheet | null {
  const totalObs = DIMENSIONES.reduce((s, d) => s + pctSat(rows, d.vars).total, 0);
  if (totalObs === 0) return null;

  const NC = 2;
  const grid: RawCell[][] = [];
  const merges: XLSX.Range[] = [];

  grid.push([{ kind: "title", text: `Dimensiones de calidad — ${periodo} ${anio}` }]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: NC - 1 } });
  grid.push([{ kind: "subtitle", text: `Satisfacción por dimensión = Satisfecho + Muy satisfecho. Fuente: preguntas de calidad de servicio (Admisiones, Bienestar, Sede y Universidad).` }]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: NC - 1 } });
  grid.push([null]);

  // Tabla 1 — fuente del gráfico (fila 4 = header; filas 5-9 = dimensiones)
  grid.push([{ kind: "header", text: "Dimensión" }, { kind: "header", text: "Nivel de satisfacción" }]);
  for (const d of DIMENSIONES) {
    const { pct } = pctSat(rows, d.vars);
    grid.push([{ kind: "groupLabel", text: d.nombre }, { kind: "data", value: pct, highlight: true }]);
  }

  // Relleno hasta dejar espacio para el gráfico; la Tabla 2 va debajo.
  const TABLE2_START = 24;
  while (grid.length < TABLE2_START) grid.push([null]);

  // Tabla 2 — por dimensión y grupo de interés
  const t2r = grid.length;
  grid.push([{ kind: "areaTitle", text: `Satisfacción por dimensión y grupo de interés — ${periodo} ${anio}` }]);
  merges.push({ s: { r: t2r, c: 0 }, e: { r: t2r, c: NC - 1 } });
  grid.push([{ kind: "header", text: "Grupo de Interés" }, { kind: "header", text: periodo }]);

  for (const d of DIMENSIONES) {
    const hr = grid.length;
    grid.push([{ kind: "header", text: d.nombre }]);
    merges.push({ s: { r: hr, c: 0 }, e: { r: hr, c: NC - 1 } });
    for (const g of GRUPOS) {
      const { pct } = pctSat(rows, d.vars, g);
      grid.push([{ kind: "groupLabel", text: g }, { kind: "data", value: pct }]);
    }
    const { pct: tot } = pctSat(rows, d.vars);
    grid.push([{ kind: "totalLabel", text: "Total general" }, { kind: "totalData", value: tot, highlight: true }]);
  }

  // Tabla 3 — clasificación de preguntas por dimensión (transparencia del mapeo)
  grid.push([null]);
  const t3r = grid.length;
  grid.push([{ kind: "areaTitle", text: "Clasificación de preguntas por dimensión" }]);
  merges.push({ s: { r: t3r, c: 0 }, e: { r: t3r, c: NC - 1 } });
  grid.push([{ kind: "header", text: "Dimensión" }, { kind: "header", text: "Pregunta / Variable evaluada" }]);
  for (const d of DIMENSIONES) {
    d.vars.forEach((v, idx) => {
      grid.push([{ kind: "groupLabel", text: idx === 0 ? d.nombre : "" }, { kind: "resumenArea", text: v.label }]);
    });
  }

  return gridToSheet(grid, merges, DIM_COLS, NC);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const anio    = Number(searchParams.get("anio"));
    const periodo = (searchParams.get("periodo") ?? "").toUpperCase();

    if (!anio)
      return NextResponse.json({ error: "El año es obligatorio" }, { status: 400 });
    if (periodo !== "IPA" && periodo !== "IIPA")
      return NextResponse.json({ error: "El periodo debe ser IPA o IIPA" }, { status: 400 });

    const rows = await prisma.encuestaSatisfaccion.findMany({
      where:  { anio, periodo_academico: periodo, nivel_satisfaccion: { not: null } },
      select: { area: true, rol: true, nivel_satisfaccion: true },
    });

    if (rows.length === 0)
      return NextResponse.json(
        { error: `No hay registros con nivel de satisfacción para ${periodo} ${anio}` },
        { status: 404 },
      );

    // counts: area -> grupo -> nivel -> count
    const counts = new Map<string, Map<Grupo, Map<string, number>>>();
    for (const r of rows) {
      if (!r.nivel_satisfaccion) continue;
      const grupo = normalizeRol(r.rol);
      if (!grupo) continue;
      let byGrupo = counts.get(r.area);
      if (!byGrupo) { byGrupo = new Map(); counts.set(r.area, byGrupo); }
      let byNivel = byGrupo.get(grupo);
      if (!byNivel) { byNivel = new Map(); byGrupo.set(grupo, byNivel); }
      byNivel.set(r.nivel_satisfaccion, (byNivel.get(r.nivel_satisfaccion) ?? 0) + 1);
    }

    // ─── Hoja 1: Satisfacción por grupo ───────────────────────────────────────
    const grid: RawCell[][] = [];
    const merges: XLSX.Range[] = [];
    const N_COLS = 1 + NIVELES.length + 1;

    grid.push([{ kind: "title", text: `Tabla de satisfacción por grupo de interés — ${periodo} ${anio}` }]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: N_COLS - 1 } });

    grid.push([{ kind: "subtitle", text: `Fuente: Encuesta de Satisfacción Voz de la Comunidad UCundinamarca · Periodo ${periodo} ${anio}.` }]);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: N_COLS - 1 } });

    grid.push([null]);

    const areasOrdenadas = [...counts.keys()].sort((a, b) => {
      const da = ordenAreaIdx(a);
      const db = ordenAreaIdx(b);
      if (da !== db) return da - db;
      return a.localeCompare(b, "es");
    });

    const headers: RawCell[] = [
      { kind: "header", text: "Grupo de Interés" },
      ...NIVELES.map((n) => ({ kind: "header" as const, text: n })),
      { kind: "header", text: "Nivel de satisfacción" },
    ];

    // Acumula nivel de satisfacción "Total grupos" por área para hoja 2
    const totalSatPorArea: { area: string; pct: number }[] = [];

    for (const area of areasOrdenadas) {
      const areaRowIdx = grid.length;
      grid.push([{ kind: "areaTitle", text: area }]);
      merges.push({ s: { r: areaRowIdx, c: 0 }, e: { r: areaRowIdx, c: N_COLS - 1 } });

      grid.push([...headers]);

      const allowed = gruposParaArea(area);
      const byGrupo = counts.get(area)!;

      const totalNiveles = new Map<string, number>();
      let totalAll = 0;

      for (const grupo of allowed) {
        const niveles = byGrupo.get(grupo);
        const total   = niveles ? [...niveles.values()].reduce((s, x) => s + x, 0) : 0;
        const row: RawCell[] = [{ kind: "groupLabel", text: grupo }];
        let satisfechos = 0;

        for (const nivel of NIVELES) {
          const c = niveles?.get(nivel) ?? 0;
          const prop = total > 0 ? c / total : 0;
          row.push({ kind: "data", value: prop });
          totalNiveles.set(nivel, (totalNiveles.get(nivel) ?? 0) + c);
          if (nivel === "Satisfecho" || nivel === "Muy satisfecho") satisfechos += c;
        }
        const propSat = total > 0 ? satisfechos / total : 0;
        row.push({ kind: "data", value: propSat, highlight: true });
        totalAll += total;
        grid.push(row);
      }

      const totalRow: RawCell[] = [{ kind: "totalLabel", text: "Total grupos" }];
      let satTot = 0;
      for (const nivel of NIVELES) {
        const c = totalNiveles.get(nivel) ?? 0;
        totalRow.push({ kind: "totalData", value: totalAll > 0 ? c / totalAll : 0 });
        if (nivel === "Satisfecho" || nivel === "Muy satisfecho") satTot += c;
      }
      totalRow.push({ kind: "totalData", value: totalAll > 0 ? satTot / totalAll : 0, highlight: true });
      grid.push(totalRow);
      grid.push([null]);

      // Aproximación al entero superior si hay decimales
      const pctEntero = totalAll > 0 ? Math.ceil((satTot / totalAll) * 100) : 0;
      if (totalAll > 0) totalSatPorArea.push({ area, pct: pctEntero });
    }

    const ws1 = gridToSheet(grid, merges, [
      { wch: 22 },
      { wch: 18 }, { wch: 16 }, { wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 22 },
    ], N_COLS);

    // ─── Hoja 2: Resumen general (tabla + chart nativo) ──────────────────────
    // Layout:
    //   A1     → título (merged A1:B1)
    //   A3,B3  → headers "Área", "Nivel de satisfacción"
    //   A4..N  → datos (ordenados desc por pct)
    //   Chart anclado a la derecha referenciando esos rangos.
    const grid2:   RawCell[][]  = [];
    const merges2: XLSX.Range[] = [];

    grid2.push([{ kind: "chartTitle", text: `Resumen general nivel de satisfacción — ${periodo} ${anio}` }]);
    merges2.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } });

    grid2.push([null]);

    grid2.push([
      { kind: "header", text: "Área" },
      { kind: "header", text: "Nivel de satisfacción" },
    ]);

    const areasSorted = [...totalSatPorArea].sort((a, b) => b.pct - a.pct);
    for (const { area, pct } of areasSorted) {
      grid2.push([
        { kind: "resumenArea", text: area },
        { kind: "resumenPct",  value: pct },
      ]);
    }

    const ws2 = gridToSheet(
      grid2,
      merges2,
      [{ wch: 40 }, { wch: 22 }],
      2,
    );

    // ─── Workbook ─────────────────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Satisfacción por grupos");
    XLSX.utils.book_append_sheet(wb, ws2, "Resumen general");

    // Filas de detalle (se reutilizan para la hoja de dimensiones y las de detalle)
    const detalleRows = await Promise.all(
      DETALLE_TABLAS.map((t) => t.fetch(anio, periodo)),
    );

    // Hoja 3: Dimensiones de calidad — agrupa las preguntas de calidad de servicio
    // (presentes en Admisiones, Bienestar, Sede y Universidad) en las 5 dimensiones.
    const dimRows = DETALLE_TABLAS.flatMap((t, i) =>
      DIM_FUENTE_SHEETS.has(t.sheet) ? detalleRows[i] : [],
    );
    const wsDim = buildDimensionesSheet(dimRows, periodo, anio);
    if (wsDim) XLSX.utils.book_append_sheet(wb, wsDim, "Dimensiones de calidad");

    // ─── Charts nativos (se inyectan al final, sobre el .xlsx ya escrito) ────
    // SheetJS escribe sheetN.xml en el orden de SheetNames → índice = posición + 1.
    const sheetIdx = (name: string) => wb.SheetNames.indexOf(name) + 1;
    const charts: ChartOpts[] = [];

    // Hoja "Resumen general" — barras horizontales.
    if (areasSorted.length > 0) {
      const lastRow1Based = 3 + areasSorted.length; // header en fila 3 → datos hasta 3+N
      charts.push({
        sheetIndex: sheetIdx("Resumen general"),
        sheetName:  "Resumen general",
        catRange:   `$A$4:$A$${lastRow1Based}`,
        valRange:   `$B$4:$B$${lastRow1Based}`,
        serNameRef: "$B$3",
        serName:    "Nivel de satisfacción",
        title:      `Resumen general nivel de satisfacción — ${periodo} ${anio}`,
        fromCol: 3,  fromRow: 1,
        toCol:   18, toRow:   Math.max(28, 3 + areasSorted.length + 2),
        cache: { cats: areasSorted.map((a) => a.area), vals: areasSorted.map((a) => a.pct) },
      });
    }

    // Hoja "Dimensiones de calidad" — columnas verticales.
    if (wsDim) {
      charts.push({
        sheetIndex: sheetIdx("Dimensiones de calidad"),
        sheetName:  "Dimensiones de calidad",
        catRange:   "$A$5:$A$9",   // 5 dimensiones
        valRange:   "$B$5:$B$9",
        serNameRef: "$B$4",
        serName:    "Nivel de satisfacción",
        title:      `Resultados satisfacción dimensiones de calidad — ${periodo} ${anio}`,
        fromCol: 3,  fromRow: 2,
        toCol:   12, toRow:   22,
        kind:    "col",
        numFmt:  "0.00%",
        valMax:  1,
        valMajorUnit: 0.25,
        cache: {
          cats: DIMENSIONES.map((d) => d.nombre),
          vals: DIMENSIONES.map((d) => pctSat(dimRows, d.vars).pct),
        },
      });
    }

    // Hojas de detalle por tabla (se omiten las que no tengan datos en el periodo)
    DETALLE_TABLAS.forEach((t, i) => {
      const built = buildDetalleSheet(detalleRows[i], t, periodo, anio);
      if (!built) return;
      XLSX.utils.book_append_sheet(wb, built.ws, t.sheet);
      for (const c of built.charts) charts.push({ ...c, sheetIndex: sheetIdx(t.sheet), sheetName: t.sheet });
    });

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const body   = await injectCharts(new Uint8Array(buffer), charts);

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="satisfaccion_grupos_${periodo}_${anio}.xlsx"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
