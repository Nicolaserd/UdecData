import { NextRequest, NextResponse } from "next/server";
import { requirePin } from "@/lib/security";
import { describeServerError } from "@/lib/server-errors";
import { saveEstudiantes } from "@/lib/supabase/save-estudiantes";
import type { Categoria, EstudiantesRow } from "@/lib/types";

/**
 * Guarda en la BD las filas de estudiantes YA agregadas en el navegador
 * (lib/reports/build-report.ts). Los archivos no viajan al servidor, así que su
 * tamaño no choca con el límite de 4,5 MB por petición de Vercel. El cliente
 * envía las filas en lotes de hasta MAX_ROWS.
 */
const MAX_ROWS = 3000;
const CATEGORIAS = new Set<Categoria>(["Matriculados", "Admitidos", "Primiparos", "Inscritos", "Graduados"]);

function isText(v: unknown, max = 200): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

function validateRow(r: unknown, i: number): string | null {
  const row = r as Partial<EstudiantesRow> | null;
  if (!row || typeof row !== "object") return `fila ${i + 1}: formato inválido`;
  if (!CATEGORIAS.has(row.categoria as Categoria)) return `fila ${i + 1}: categoría "${String(row.categoria)}" no reconocida`;
  if (!isText(row.unidadRegional) || !isText(row.nivel) || !isText(row.nivelAcademico) || !isText(row.programaAcademico, 300)) {
    return `fila ${i + 1}: faltan unidad regional, nivel o programa`;
  }
  if (!Number.isInteger(row.cantidad) || (row.cantidad as number) < 0) return `fila ${i + 1}: cantidad inválida`;
  if (!Number.isInteger(row.año) || (row.año as number) < 2000 || (row.año as number) > 2100) return `fila ${i + 1}: año inválido`;
  if (!isText(row.periodo, 10)) return `fila ${i + 1}: periodo inválido`;
  return null;
}

export async function POST(request: NextRequest) {
  // Escribe en la BD: exige el PIN de registro también en el servidor
  const denied = requirePin(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as { rows?: unknown; allowedCategories?: unknown };
    const rows = body.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "no llegaron filas para guardar." }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `se enviaron ${rows.length} filas en un solo lote (máximo ${MAX_ROWS}).` }, { status: 400 });
    }
    for (let i = 0; i < rows.length; i++) {
      const problem = validateRow(rows[i], i);
      if (problem) return NextResponse.json({ error: `datos inválidos en ${problem}.` }, { status: 400 });
    }
    const allowed = Array.isArray(body.allowedCategories)
      ? new Set<string>(body.allowedCategories.filter((c): c is string => typeof c === "string"))
      : undefined;

    const result = await saveEstudiantes(rows as EstudiantesRow[], allowed);
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "no se pudieron guardar los datos." }, { status: 500 });
    }
    return NextResponse.json({ saved: result.saved, skipped: result.skipped });
  } catch (error) {
    console.error("guardar los datos de estudiantes:", error);
    return NextResponse.json(
      { error: describeServerError(error, "guardar los datos de estudiantes") },
      { status: 500 },
    );
  }
}
