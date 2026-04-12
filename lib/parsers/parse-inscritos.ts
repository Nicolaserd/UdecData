import Papa from "papaparse";
import { NormalizedStudentRow } from "../types";
import { normalizeProgram } from "../normalization/program-normalizer";
import { mapMunicipio } from "../normalization/municipio-mapper";
import { resolveNivel } from "../normalization/nivel-resolver";
import { semestreToPeriodo } from "../normalization/canonical-data";

interface InscritosRow {
  PROGRAMA: string;
  MUNICIPIO: string;
  "AÑO": string;
  SEMESTRE: string;
  [key: string]: string;
}

export function parseInscritos(
  csvText: string
): { rows: NormalizedStudentRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const clean = csvText.replace(/^\uFEFF/, "");

  const parsed = Papa.parse<InscritosRow>(clean, {
    delimiter: ";",
    header: true,
    skipEmptyLines: true,
    quoteChar: '"',
  });

  if (parsed.errors.length > 0) {
    warnings.push(`Inscritos: ${parsed.errors.length} errores de parseo`);
  }

  const rows: NormalizedStudentRow[] = [];

  for (const row of parsed.data) {
    const programa = String(row["PROGRAMA"] || "").trim();
    const municipio = String(row["MUNICIPIO"] || "").trim();
    const año = parseInt(row["AÑO"] || row["\u00C1\u00D1O"] || "", 10);
    const semestreRaw = parseInt(row["SEMESTRE"] || "", 10);

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
