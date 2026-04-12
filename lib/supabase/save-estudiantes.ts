import { prisma } from "../prisma";
import { EstudiantesRow } from "../types";

/**
 * Save aggregated student data to Supabase.
 * @param data - Rows to save
 * @param allowedCategories - If provided, only save rows whose categoria is in this set.
 *                            Categories not in this set are skipped (not overwritten).
 */
export async function saveEstudiantes(
  data: EstudiantesRow[],
  allowedCategories?: Set<string>
): Promise<{ success: boolean; saved: number; skipped: number; error?: string }> {
  if (!process.env.DATABASE_URL) {
    return {
      success: false,
      saved: 0,
      skipped: data.length,
      error: "DATABASE_URL no configurada.",
    };
  }

  try {
    let saved = 0;
    let skipped = 0;

    for (const row of data) {
      if (allowedCategories && !allowedCategories.has(row.categoria)) {
        skipped++;
        continue;
      }

      await prisma.estudiante.upsert({
        where: {
          categoria_unidad_regional_nivel_nivel_academico_programa_academico_anio_periodo:
            {
              categoria: row.categoria,
              unidad_regional: row.unidadRegional,
              nivel: row.nivel,
              nivel_academico: row.nivelAcademico,
              programa_academico: row.programaAcademico,
              anio: row.año,
              periodo: row.periodo,
            },
        },
        update: { cantidad: row.cantidad },
        create: {
          categoria: row.categoria,
          unidad_regional: row.unidadRegional,
          nivel: row.nivel,
          nivel_academico: row.nivelAcademico,
          programa_academico: row.programaAcademico,
          cantidad: row.cantidad,
          anio: row.año,
          periodo: row.periodo,
        },
      });
      saved++;
    }

    return { success: true, saved, skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return { success: false, saved: 0, skipped: 0, error: message };
  }
}
