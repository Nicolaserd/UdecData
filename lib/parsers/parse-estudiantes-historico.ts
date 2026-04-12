import * as XLSX from "xlsx";
import { EstudiantesRow } from "../types";

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
    const unidadRegional = String(row["Unidad regional"] || "").trim();
    const nivelRaw = String(row["Nivel"] || "").trim();
    const nivelAcademicoRaw = String(row["Nivel académico"] || "").trim();
    // Normalize capitalization: "pregrado" → "Pregrado", "posgrado" → "Posgrado"
    const nivel = nivelRaw.charAt(0).toUpperCase() + nivelRaw.slice(1).toLowerCase();
    const nivelAcademico = nivelAcademicoRaw.charAt(0).toUpperCase() + nivelAcademicoRaw.slice(1).toLowerCase();
    const programaAcademico = String(row["Programa académico"] || "").trim();
    const cantidad = Number(row["Cantidad"]) || 0;
    const año = Number(row["Año"]) || 0;
    const periodo = String(row["Periodo"] || "").trim();

    if (!categoria || !unidadRegional || !programaAcademico || !año || !periodo)
      continue;

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
