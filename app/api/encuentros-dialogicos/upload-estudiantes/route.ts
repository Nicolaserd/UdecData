import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import {
  normalizePrograma,
  normalizeUnidadRegional,
  normalizeFacultad,
  normalizeEncuentro,
  normalizeCategoria,
  normalizeSubcategoria,
  normalizeFormulado,
  computePlanMejoramiento,
} from "@/lib/normalize-text";

function parseFecha(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${String(date.d).padStart(2, "0")}/${String(date.m).padStart(2, "0")}/${date.y}`;
    }
  }
  return String(value).trim() || null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

    if (rows.length === 0) {
      return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });
    }

    let upserted = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const rawCategoria    = String(row["CATEGORIA"] ?? "").trim();
      const rawSubcategoria = String(row["SUBCATEGORIA"] ?? "").trim();
      const rawActividad    = String(row["ACTIVIDAD"] ?? "").trim();
      const rawPrograma     = String(row["PROGRAMA"] ?? "").trim();
      const rawUnidad       = String(row["UNIDAD REGIONAL"] ?? "").trim();
      const rawFacultad     = String(row["FACULTAD"] ?? "").trim();
      const anio            = Number(row["AÑO"] ?? 0);
      const rawEncuentro    = String(row["ENCUENTRO"] ?? "").trim();

      if (!rawCategoria || !rawActividad || !rawPrograma || !rawEncuentro || !anio) {
        errors.push(`Fila omitida por datos incompletos: ${rawActividad || "(sin actividad)"}`);
        continue;
      }

      // ── Normalización ──────────────────────────────────────────────────────
      const categoria      = normalizeCategoria(rawCategoria);
      const subcategoria   = normalizeSubcategoria(rawSubcategoria);
      const actividad      = rawActividad.trim();
      const programa       = normalizePrograma(rawPrograma);
      const unidadRegional = normalizeUnidadRegional(rawUnidad);
      const facultad       = normalizeFacultad(rawFacultad);
      const encuentro      = normalizeEncuentro(rawEncuentro);

      const planDeMejoramiento = computePlanMejoramiento(
        encuentro, anio, programa, unidadRegional, facultad
      );

      const calificacionRaw = row["CALIFICACION DE CUMPLIMIENTO"];
      const efectividadRaw  = row["EFECTIVIDAD"];
      const evidencias =
        row["EVIDENCIAS DE CUMPLIMIENTO "] != null
          ? String(row["EVIDENCIAS DE CUMPLIMIENTO "]).trim()
          : row["EVIDENCIAS DE CUMPLIMIENTO"] != null
          ? String(row["EVIDENCIAS DE CUMPLIMIENTO"]).trim()
          : null;

      await prisma.planMejoramientoEstudiante.upsert({
        where: {
          encuentro_anio_programa_unidad_regional_facultad_actividad: {
            encuentro,
            anio,
            programa,
            unidad_regional: unidadRegional,
            facultad,
            actividad,
          },
        },
        update: {
          categoria,
          subcategoria,
          plan_de_mejoramiento: planDeMejoramiento,
          fecha_cumplimiento: parseFecha(row["FECHA DE CUMPLIMIENTO"]),
          evidencias_cumplimiento: evidencias,
          calificacion_cumplimiento: calificacionRaw != null ? Number(calificacionRaw) : null,
          efectividad: efectividadRaw != null ? String(efectividadRaw).trim() : null,
          formulado: normalizeFormulado(row["formulado"] != null ? String(row["formulado"]) : null),
        },
        create: {
          categoria,
          subcategoria,
          plan_de_mejoramiento: planDeMejoramiento,
          actividad,
          fecha_cumplimiento: parseFecha(row["FECHA DE CUMPLIMIENTO"]),
          evidencias_cumplimiento: evidencias,
          calificacion_cumplimiento: calificacionRaw != null ? Number(calificacionRaw) : null,
          efectividad: efectividadRaw != null ? String(efectividadRaw).trim() : null,
          programa,
          unidad_regional: unidadRegional,
          facultad,
          anio,
          encuentro,
          formulado: normalizeFormulado(row["formulado"] != null ? String(row["formulado"]) : null),
        },
      });

      upserted++;
    }

    return NextResponse.json({
      message: `Se procesaron ${upserted} registros de planes de mejoramiento estudiantil.`,
      upserted,
      warnings: errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
