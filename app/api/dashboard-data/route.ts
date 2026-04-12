import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Capitalize first letter: "pregrado" → "Pregrado" */
function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Normalize periodo: "1" → "IPA", "2" → "IIPA", keep "IPA"/"IIPA" as-is */
function normalizePeriodo(p: string): string {
  const trimmed = p.trim();
  if (trimmed === "1") return "IPA";
  if (trimmed === "2") return "IIPA";
  return trimmed;
}

export async function GET() {
  try {
    const allRows = await prisma.estudiante.findMany({
      select: {
        categoria: true,
        unidad_regional: true,
        nivel: true,
        programa_academico: true,
        cantidad: true,
        anio: true,
        periodo: true,
      },
    });

    // Normalize and send individual rows — filtering happens client-side
    const rows = allRows.map((r) => ({
      categoria: r.categoria,
      unidadRegional: r.unidad_regional,
      nivel: capitalize(r.nivel),
      programa: r.programa_academico,
      cantidad: r.cantidad,
      anio: r.anio,
      periodo: normalizePeriodo(r.periodo),
    }));

    // Extract unique filter options
    const regiones = [...new Set(rows.map((r) => r.unidadRegional))].sort();
    const programas = [...new Set(rows.map((r) => r.programa))].sort();
    const anios = [...new Set(rows.map((r) => r.anio))].sort((a, b) => a - b);

    return NextResponse.json({ rows, regiones, programas, anios });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
