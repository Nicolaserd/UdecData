import * as XLSX from "xlsx";
import { NormalizedStudentRow } from "../types";
import { normalizeProgram } from "../normalization/program-normalizer";
import { mapMunicipio } from "../normalization/municipio-mapper";
import { resolveNivel } from "../normalization/nivel-resolver";
import { semestreToPeriodo } from "../normalization/canonical-data";

interface InscritosRaw {
  PROGRAMA: string;
  MUNICIPIO: string;
  "AÑO": number | string;
  SEMESTRE: number | string;
  [key: string]: unknown;
}

export function parseInscritos(
  buffer: ArrayBuffer
): { rows: NormalizedStudentRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<InscritosRaw>(sheet);

  const rows: NormalizedStudentRow[] = [];

  for (const row of rawData) {
    const programa = String(row["PROGRAMA"] || "").trim();
    const municipio = String(row["MUNICIPIO"] || "").trim();
    const año = parseInt(String(row["AÑO"] || ""), 10);
    const semestreRaw = parseInt(String(row["SEMESTRE"] || ""), 10);

    if (!programa || !municipio || isNaN(año) || isNaN(semestreRaw)) continue;

    const periodo = semestreToPeriodo(semestreRaw);

    const { name: programaAcademico, matched: progMatched } =
      normalizeProgram(programa);
    if (!progMatched) {
      warnings.push(`Inscritos: programa no reconocido "${programa}"`);
    }

    const { unidadRegional, matched: muniMatched } = mapMunicipio(municipio);
    if (!muniMatched) {
      warnings.push(`Inscritos: municipio no reconocido "${municipio}"`);
    }

    const { nivel, nivelAcademico } = resolveNivel(programa);

    rows.push({
      categoria: "Inscritos",
      unidadRegional,
      nivel,
      nivelAcademico,
      programaAcademico,
      año,
      periodo,
    });
  }

  return { rows, warnings: [...new Set(warnings)] };
}
