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

// Los parsers leen los encabezados exactos (en mayúsculas); solo se toleran BOM,
// comillas, espacios y la variante "ÁÑO" que también aceptan los parsers.
function normalizeHeader(h: string): string {
  return h.replace(/^﻿/, "").replace(/"/g, "").trim().replace("ÁÑO", "AÑO");
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

function checkHeaders(spec: ReportFileSpec, file: File, csv: string): void {
  const headerLine = csv.split(/\r?\n/, 1)[0] ?? "";
  if (!headerLine.includes(";") && headerLine.includes(",")) {
    throw new ReportFileError(
      `${who(spec, file)}: el CSV usa comas como separador y el sistema espera punto y coma (;). En Excel guárdalo como "CSV (delimitado por punto y coma)" o súbelo como .xlsx.`,
    );
  }
  const found = headerLine.split(";").map(normalizeHeader).filter(Boolean);
  const missing = spec.requiredColumns.filter((col) => !found.includes(normalizeHeader(col)));
  if (missing.length > 0) {
    const shown = found.slice(0, 8).join(", ") + (found.length > 8 ? "…" : "");
    throw new ReportFileError(
      `${who(spec, file)}: faltan las columnas ${missing.join(", ")} (escritas exactamente así, en mayúsculas). La primera fila debe tener los encabezados; se encontraron: ${shown || "ninguno"}. ¿Es el reporte de ${spec.label}?`,
    );
  }
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

/**
 * @param files     archivos por clave (matriculados, admitidos, …, estudiantes)
 * @param specs     etiqueta y columnas requeridas de cada clave
 * @param onStep    avance (0..1) para la barra de progreso
 */
export async function buildReport(
  files: Record<string, File | null>,
  specs: readonly ReportFileSpec[],
  onStep?: (fraction: number) => void,
): Promise<BuiltReport> {
  const allRows: NormalizedStudentRow[] = [];
  const warnings: string[] = [];
  const reportSpecs = specs.filter((s) => PARSERS[s.key] && files[s.key]);

  for (let i = 0; i < reportSpecs.length; i++) {
    const spec = reportSpecs[i];
    const file = files[spec.key]!;
    const csv = await readAsCSV(spec, file);
    checkHeaders(spec, file, csv);
    const result = PARSERS[spec.key](csv);
    if (result.rows.length === 0) {
      throw new ReportFileError(
        `${who(spec, file)}: tiene los encabezados correctos pero ninguna fila válida. Revisa que AÑO y SEMESTRE sean números y que PROGRAMA y MUNICIPIO no estén vacíos.`,
      );
    }
    allRows.push(...result.rows);
    warnings.push(...result.warnings);
    onStep?.((i + 1) / (reportSpecs.length + 1));
  }

  let historico: EstudiantesRow[] | undefined;
  const histFile = files.estudiantes;
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
