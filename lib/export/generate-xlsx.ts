import * as XLSX from "xlsx";
import { EstudiantesRow } from "../types";

export function generateEstudiantesXlsx(data: EstudiantesRow[]): Buffer {
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

  worksheet["!cols"] = [
    { wch: 14 }, // Categoría
    { wch: 16 }, // Unidad regional
    { wch: 12 }, // Nivel
    { wch: 26 }, // Nivel académico
    { wch: 60 }, // Programa académico
    { wch: 10 }, // Cantidad
    { wch: 8 },  // Año
    { wch: 8 },  // Periodo
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "ESTUDIANTES");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });

  return buffer;
}
