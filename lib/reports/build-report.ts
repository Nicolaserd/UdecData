/**
 * Procesa los reportes de estudiantes EN EL NAVEGADOR (parseo + agregación).
 * Así el tamaño de los archivos no choca con el límite de 4,5 MB por petición
 * de Vercel: al servidor solo viaja el resultado agregado (pocos KB).
 *
 * Cada problema se informa con la categoría, el nombre del archivo y el tipo de
 * error (formato, separador, columnas o contenido).
 */
import * as XLSX from "xlsx";
import { parseMatriculados } from "@/lib/parsers/parse-matriculados";
import { parseAdmitidos } from "@/lib/parsers/parse-admitidos";
import { parsePrimiparos } from "@/lib/parsers/parse-primiparos";
import { parseInscritos } from "@/lib/parsers/parse-inscritos";
import { parseGraduados } from "@/lib/parsers/parse-graduados";
import { parseEstudiantesHistorico } from "@/lib/parsers/parse-estudiantes-historico";
import { aggregateStudents } from "@/lib/aggregation/aggregate-students";
import type { EstudiantesRow, NormalizedStudentRow } from "@/lib/types";

type Parser = (csv: string) => { rows: NormalizedStudentRow[]; warnings: string[] };

export interface ReportFileSpec {
  key: string;
  label: string;
  requiredColumns: readonly string[];
}

const PARSERS: Record<string, Parser> = {
  matriculados: parseMatriculados,
  admitidos: parseAdmitidos,
  primiparos: parsePrimiparos,
  inscritos: parseInscritos,
  graduados: parseGraduados,
};

const REPORT_EXTENSIONS = ["csv", "txt", "xlsx", "xls"];
const HISTORICO_EXTENSIONS = ["xlsx", "xls"];

export class ReportFileError extends Error {}

function sizeText(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
    : bytes === 0 ? "0 KB" : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function who(spec: ReportFileSpec, file: File): string {
  return `${spec.label} (${file.name}, ${sizeText(file.size)})`;
}

function extensionOf(file: File): string {
  return file.name.toLowerCase().split(".").pop() ?? "";
}

// ── Encabezados: flexibles en la forma, estrictos en el significado ─────────
// Se ignoran mayúsculas, tildes, "_" y espacios de más; solo se aceptan sinónimos
// que significan lo mismo. SEMESTRE no tiene sinónimos: el parser necesita 1 o 2.
const COLUMN_ALIASES: Record<string, string[]> = {
  "AÑO": ["ANIO"],
  "SEMESTRE": [],
  "PROGRAMA": ["NOMBRE PROGRAMA", "NOMBRE DEL PROGRAMA", "PROGRAMA ACADEMICO"],
  "NOMBRE PROGRAMA": ["PROGRAMA", "NOMBRE DEL PROGRAMA", "PROGRAMA ACADEMICO"],
  "MUNICIPIO": ["MUNICIPIO PROGRAMA", "MUNICIPIO DEL PROGRAMA"],
  "MUNICIPIO PROGRAMA": ["MUNICIPIO", "MUNICIPIO DEL PROGRAMA"],
};
const HEADER_SEARCH_ROWS = 20;

/** Forma comparable: sin BOM/comillas/tildes, mayúsculas, "_"→espacio ("Año" = "AÑO" = "ANO"). */
function headerKey(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .replace(/"/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[_\s]+/g, " ")
    .replace(/[:.]+$/, "")
    .trim();
}

function acceptedNames(col: string): string {
  if (col === "SEMESTRE") return "SEMESTRE (con el número 1 o 2; una columna PERIODO con IPA/IIPA no sirve)";
  const alts = COLUMN_ALIASES[col] ?? [];
  return alts.length ? `${col} (o ${alts.join(", ")})` : col;
}

/** Índice de cada columna requerida en la fila: primero nombre exacto, luego sinónimos. */
function matchColumns(cells: string[], required: readonly string[]) {
  const keys = cells.map(headerKey);
  const used = new Set<number>();
  const found = new Map<string, number>();
  for (const col of required) {
    const i = keys.findIndex((k, idx) => !used.has(idx) && k === headerKey(col));
    if (i >= 0) { found.set(col, i); used.add(i); }
  }
  for (const col of required) {
    if (found.has(col)) continue;
    const alts = (COLUMN_ALIASES[col] ?? []).map(headerKey);
    const i = keys.findIndex((k, idx) => !used.has(idx) && alts.includes(k));
    if (i >= 0) { found.set(col, i); used.add(i); }
  }
  return { found, missing: required.filter((c) => !found.has(c)) };
}

async function readAsCSV(spec: ReportFileSpec, file: File): Promise<string> {
  const ext = extensionOf(file);
  if (!REPORT_EXTENSIONS.includes(ext)) {
    throw new ReportFileError(
      `${who(spec, file)}: formato no admitido (.${ext || "sin extensión"}). Sube el reporte como .xlsx, .xls o .csv.`,
    );
  }
  if (file.size === 0) throw new ReportFileError(`${who(spec, file)}: el archivo está vacío.`);
  if (ext === "csv" || ext === "txt") return await file.text();

  // Un .xlsx real empieza por "PK" (zip) y un .xls por D0 CF (OLE). Si no, está
  // renombrado o dañado: decirlo en vez de fallar luego por "columnas faltantes".
  const buffer = await file.arrayBuffer();
  const head = new Uint8Array(buffer.slice(0, 4));
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  const isOle = head[0] === 0xd0 && head[1] === 0xcf;
  if ((ext === "xlsx" && !isZip) || (ext === "xls" && !isOle && !isZip)) {
    throw new ReportFileError(
      `${who(spec, file)}: la extensión es .${ext} pero el contenido no es un Excel real (archivo renombrado o dañado). Ábrelo en Excel y guárdalo de nuevo como .xlsx, o súbelo como .csv.`,
    );
  }
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error("sin hojas");
    return XLSX.utils.sheet_to_csv(sheet, { FS: ";" });
  } catch {
    throw new ReportFileError(
      `${who(spec, file)}: no se pudo leer. El archivo está dañado o no es un Excel/CSV real (por ejemplo, un .xlsx renombrado). Ábrelo en Excel y guárdalo de nuevo.`,
    );
  }
}

/**
 * Busca la fila de encabezados en las primeras filas (salta títulos como
 * "Fecha del reporte: …") y la reescribe con los nombres exactos que leen los
 * parsers. Devuelve el CSV listo para parsear.
 */
function locateHeader(spec: ReportFileSpec, file: File, csv: string): string {
  const lines = csv.split(/\r?\n/);
  let best: { row: number; cells: string[]; missing: string[] } | null = null;

  for (let i = 0; i < Math.min(HEADER_SEARCH_ROWS, lines.length); i++) {
    const line = lines[i];
    if (!line.replace(/[;,"\s]/g, "")) continue; // fila vacía

    // CSV separado por comas: detectarlo si con comas sí estarían los encabezados
    if (!line.includes(";") && line.includes(",")) {
      if (matchColumns(line.split(","), spec.requiredColumns).missing.length === 0) {
        throw new ReportFileError(
          `${who(spec, file)}: el CSV usa comas como separador y el sistema espera punto y coma (;). En Excel guárdalo como "CSV (delimitado por punto y coma)" o súbelo como .xlsx.`,
        );
      }
      continue;
    }

    const cells = line.split(";").map((c) => c.replace(/"/g, "").trim());
    const { found, missing } = matchColumns(cells, spec.requiredColumns);
    if (missing.length === 0) {
      const header = [...cells];
      for (const [col, idx] of found) header[idx] = col; // nombre exacto para el parser
      return [header.join(";"), ...lines.slice(i + 1)].join("\n");
    }
    if (!best || missing.length < best.missing.length) best = { row: i + 1, cells, missing };
  }

  const expected = spec.requiredColumns.map(acceptedNames).join("; ");
  if (!best || best.missing.length === spec.requiredColumns.length) {
    throw new ReportFileError(
      `${who(spec, file)}: no se encontró la fila de encabezados en las primeras ${HEADER_SEARCH_ROWS} filas. Se esperan las columnas: ${expected}. ¿Es el reporte de ${spec.label}?`,
    );
  }
  const shown = best.cells.filter(Boolean).slice(0, 8).join(", ") + (best.cells.length > 8 ? "…" : "");
  throw new ReportFileError(
    `${who(spec, file)}: en la fila ${best.row} (${shown}) faltan las columnas ${best.missing.map(acceptedNames).join("; ")}. ¿Es el reporte de ${spec.label}?`,
  );
}

export interface BuiltReport {
  aggregated: EstudiantesRow[];
  totalProcessed: number;
  warnings: string[];
  /** Año y periodo más frecuentes en los reportes cargados (sin el histórico). */
  mainPeriod: { anio: number; periodo: string } | null;
}

function mostFrequentPeriod(rows: NormalizedStudentRow[]): BuiltReport["mainPeriod"] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(`${r.año}|${r.periodo}`, (counts.get(`${r.año}|${r.periodo}`) ?? 0) + 1);
  let best: string | null = null;
  for (const [k, n] of counts) if (!best || n > (counts.get(best) ?? 0)) best = k;
  if (!best) return null;
  const [anio, periodo] = best.split("|");
  return { anio: Number(anio), periodo };
}

const periodLabel = (p: string) => p.replace("|", "-");

/** Huella de los datos de un archivo (independiente del orden de filas). */
function rowsSignature(rows: NormalizedStudentRow[]): string {
  return rows
    .map((r) => `${r.año}|${r.periodo}|${r.unidadRegional}|${r.nivel}|${r.nivelAcademico}|${r.programaAcademico}`)
    .sort()
    .join("\n");
}

/** Normaliza el estado del formulario: una casilla puede tener 0, 1 o varios archivos. */
function asList(v: File | File[] | null | undefined): File[] {
  return !v ? [] : Array.isArray(v) ? v : [v];
}

/**
 * @param files     archivos por clave (matriculados, admitidos, …, estudiantes); varios por casilla se suman
 * @param specs     etiqueta y columnas requeridas de cada clave
 * @param onStep    avance (0..1) para la barra de progreso
 */
export async function buildReport(
  files: Record<string, File | File[] | null>,
  specs: readonly ReportFileSpec[],
  onStep?: (fraction: number) => void,
): Promise<BuiltReport> {
  const allRows: NormalizedStudentRow[] = [];
  const warnings: string[] = [];
  const jobs = specs
    .filter((s) => PARSERS[s.key])
    .flatMap((spec) => asList(files[spec.key]).map((file) => ({ spec, file })));

  // Por archivo: periodo(s) que contiene y huella de sus datos, para las comprobaciones cruzadas
  const perFile: { spec: ReportFileSpec; file: File; periods: string[]; signature: string }[] = [];

  for (let i = 0; i < jobs.length; i++) {
    const { spec, file } = jobs[i];
    const csv = locateHeader(spec, file, await readAsCSV(spec, file));
    const result = PARSERS[spec.key](csv);
    if (result.rows.length === 0) {
      throw new ReportFileError(
        `${who(spec, file)}: tiene los encabezados correctos pero ninguna fila válida. Revisa que AÑO y SEMESTRE sean números y que PROGRAMA y MUNICIPIO no estén vacíos.`,
      );
    }
    const counts = new Map<string, number>();
    for (const r of result.rows) counts.set(`${r.año}|${r.periodo}`, (counts.get(`${r.año}|${r.periodo}`) ?? 0) + 1);
    if (counts.size > 1) {
      const detail = [...counts].map(([p, n]) => `${periodLabel(p)}: ${n} filas`).join(", ");
      throw new ReportFileError(
        `${who(spec, file)}: mezcla varios periodos (${detail}). Cada reporte debe ser de un solo año y semestre; separa el archivo por periodo.`,
      );
    }
    perFile.push({ spec, file, periods: [...counts.keys()], signature: rowsSignature(result.rows) });
    allRows.push(...result.rows);
    warnings.push(...result.warnings);
    onStep?.((i + 1) / (jobs.length + 1));
  }

  // Todos los reportes deben ser del mismo periodo
  const byPeriod = new Map<string, string[]>();
  for (const f of perFile) {
    for (const p of f.periods) byPeriod.set(p, [...(byPeriod.get(p) ?? []), who(f.spec, f.file)]);
  }
  if (byPeriod.size > 1) {
    const detail = [...byPeriod].map(([p, names]) => `${periodLabel(p)}: ${names.join(", ")}`).join(" | ");
    throw new ReportFileError(
      `Los archivos son de periodos distintos (${detail}). Carga en una misma vez solo reportes del mismo año y semestre.`,
    );
  }

  // El mismo contenido en dos archivos (misma o distinta casilla) duplica los datos
  for (let a = 0; a < perFile.length; a++) {
    for (let b = a + 1; b < perFile.length; b++) {
      if (perFile[a].signature !== perFile[b].signature) continue;
      const A = perFile[a], B = perFile[b];
      throw new ReportFileError(
        A.spec.key === B.spec.key
          ? `${who(A.spec, A.file)} y ${B.file.name} tienen exactamente los mismos datos: se contarían dos veces en ${A.spec.label}. Quita uno de los dos.`
          : `${who(A.spec, A.file)} y ${who(B.spec, B.file)} tienen exactamente los mismos datos. Probablemente el mismo reporte quedó en dos casillas; revisa que cada archivo esté en su categoría.`,
      );
    }
  }

  let historico: EstudiantesRow[] | undefined;
  const histFile = asList(files.estudiantes)[0];
  const histSpec = specs.find((s) => s.key === "estudiantes");
  if (histFile && histSpec) {
    const ext = extensionOf(histFile);
    if (!HISTORICO_EXTENSIONS.includes(ext)) {
      throw new ReportFileError(
        `${who(histSpec, histFile)}: formato no admitido (.${ext || "sin extensión"}). El consolidado histórico debe ser .xlsx o .xls.`,
      );
    }
    try {
      const parsed = parseEstudiantesHistorico(await histFile.arrayBuffer());
      historico = parsed.rows;
      warnings.push(...parsed.warnings);
    } catch {
      throw new ReportFileError(
        `${who(histSpec, histFile)}: no se pudo leer el consolidado histórico. Verifica que sea el archivo ESTUDIANTES.xlsx con las columnas ${histSpec.requiredColumns.join(", ")}.`,
      );
    }
  }

  const aggregated = aggregateStudents(allRows, historico);
  onStep?.(1);
  return {
    aggregated,
    totalProcessed: allRows.length,
    warnings: [...new Set(warnings)],
    mainPeriod: mostFrequentPeriod(allRows),
  };
}

/** Excel ESTUDIANTES.xlsx generado en el navegador (mismo formato que antes). */
export function estudiantesXlsxBlob(data: EstudiantesRow[]): Blob {
  const sheetData = data.map((row) => ({
    "Categoría": row.categoria,
    "Unidad regional": row.unidadRegional,
    "Nivel": row.nivel,
    "Nivel académico": row.nivelAcademico,
    "Programa académico": row.programaAcademico,
    "Cantidad": row.cantidad,
    "Año": row.año,
    "Periodo": row.periodo,
  }));
  const worksheet = XLSX.utils.json_to_sheet(sheetData);
  worksheet["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 26 }, { wch: 60 }, { wch: 10 }, { wch: 8 }, { wch: 8 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "ESTUDIANTES");
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
