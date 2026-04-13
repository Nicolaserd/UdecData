import * as XLSX from "xlsx";
import { EstudiantesRow } from "../types";
import { normalizeProgram } from "../normalization/program-normalizer";
import { mapMunicipio } from "../normalization/municipio-mapper";
import { resolveNivel } from "../normalization/nivel-resolver";

interface EstudiantesRaw {
  "Categoría": string;
  "Unidad regional": string;
  "Nivel": string;
  "Nivel académico": string;
  "Programa académico": string;
  "Cantidad": number;
  "Año": number;
  "Periodo": string;
  [key: string]: unknown;
}

export function parseEstudiantesHistorico(
  buffer: ArrayBuffer
): { rows: EstudiantesRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<EstudiantesRaw>(sheet);

  const rows: EstudiantesRow[] = [];

  for (const row of rawData) {
    const categoria = String(row["Categoría"] || "").trim();
    const unidadRegionalRaw = String(row["Unidad regional"] || "").trim();
    const programaRaw = String(row["Programa académico"] || "").trim();
    const cantidad = Number(row["Cantidad"]) || 0;
    const año = Number(row["Año"]) || 0;
    const periodo = String(row["Periodo"] || "").trim();

    if (!categoria || !unidadRegionalRaw || !programaRaw || !año || !periodo)
      continue;

    // Normalize program name through fuzzy matcher
    const { name: programaAcademico, matched: progMatched } = normalizeProgram(programaRaw);
    if (!progMatched) {
      warnings.push(`Histórico: programa no reconocido "${programaRaw}"`);
    }

    // Normalize unidad regional through fuzzy matcher
    const { unidadRegional } = mapMunicipio(unidadRegionalRaw);

    // Resolve nivel from program name (consistent with other parsers)
    const { nivel, nivelAcademico } = resolveNivel(programaRaw);

    rows.push({
      categoria: categoria as EstudiantesRow["categoria"],
      unidadRegional,
      nivel,
      nivelAcademico,
      programaAcademico,
      cantidad,
      año,
      periodo,
    });
  }

  if (rows.length === 0) {
    warnings.push("ESTUDIANTES.xlsx: no se encontraron datos históricos");
  }

  return { rows, warnings };
}
