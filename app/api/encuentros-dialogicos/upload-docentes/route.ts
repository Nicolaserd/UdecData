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
  normalizeCalificacion,
  computePlanMejoramiento,
  checkColumnas,
  normalizeRowKeys,
  REQUIRED_COLS_DOCENTES,
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

    // ── Validar columnas requeridas ────────────────────────────────────────
    const faltantes = checkColumnas(rows[0] as Record<string, unknown>, REQUIRED_COLS_DOCENTES);
    if (faltantes.length > 0) {
      return NextResponse.json(
        { error: `Columnas faltantes en el archivo: ${faltantes.join(", ")}` },
        { status: 400 }
      );
    }

    let upserted = 0;
    const errors: string[] = [];

    for (const rawRow of rows) {
      const row = normalizeRowKeys(rawRow);

      const rawCategoria    = String(row["categoria"] ?? "").trim();
      const rawSubcategoria = String(row["subcategoria"] ?? "").trim();
      const rawActividad    = String(row["actividad"] ?? "").trim();
      const rawPrograma     = String(row["programa"] ?? "").trim();
      const rawUnidad       = String(row["unidad regional"] ?? "").trim();
      const rawFacultad     = String(row["facultad"] ?? "").trim();
      const anio            = Number(row["año"] ?? 0);
      const rawEncuentro    = String(row["encuentro"] ?? "").trim();

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

      const calificacionRaw = row["calificacion de cumplimiento"];
      const evidencias      = row["evidencias de cumplimiento"] != null
        ? String(row["evidencias de cumplimiento"]).trim()
        : null;

      await prisma.planMejoramientoDocente.upsert({
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
          fecha_cumplimiento: parseFecha(row["fecha de cumplimiento"]),
          evidencias_cumplimiento: evidencias,
          calificacion_cumplimiento: calificacionRaw != null && calificacionRaw !== "" ? Number(calificacionRaw) || null : null,
          formulado: normalizeFormulado(row["formulado"] != null ? String(row["formulado"]) : null),
          calificacion: normalizeCalificacion(row["calificación"] != null ? String(row["calificación"]) : null),
        },
        create: {
          categoria,
          subcategoria,
          plan_de_mejoramiento: planDeMejoramiento,
          actividad,
          fecha_cumplimiento: parseFecha(row["fecha de cumplimiento"]),
          evidencias_cumplimiento: evidencias,
          calificacion_cumplimiento: calificacionRaw != null && calificacionRaw !== "" ? Number(calificacionRaw) || null : null,
          programa,
          unidad_regional: unidadRegional,
          facultad,
          anio,
          encuentro,
          formulado: normalizeFormulado(row["formulado"] != null ? String(row["formulado"]) : null),
          calificacion: normalizeCalificacion(row["calificación"] != null ? String(row["calificación"]) : null),
        },
      });

      upserted++;
    }

    return NextResponse.json({
      message: `Se procesaron ${upserted} registros de planes de mejoramiento docente.`,
      upserted,
      warnings: errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
