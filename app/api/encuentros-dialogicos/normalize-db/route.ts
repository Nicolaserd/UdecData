import { NextResponse } from "next/server";
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
} from "@/lib/normalize-text";

export async function POST() {
  try {
    let updatedEst = 0;
    let updatedDo = 0;

    // ── Normalizar Estudiantes ─────────────────────────────────────────────
    const estudiantes = await prisma.planMejoramientoEstudiante.findMany();

    for (const r of estudiantes) {
      const categoria      = normalizeCategoria(r.categoria);
      const subcategoria   = normalizeSubcategoria(r.subcategoria);
      const programa       = normalizePrograma(r.programa);
      const unidadRegional = normalizeUnidadRegional(r.unidad_regional);
      const facultad       = normalizeFacultad(r.facultad);
      const encuentro      = normalizeEncuentro(r.encuentro);
      const formulado      = normalizeFormulado(r.formulado);
      const planDeMejoramiento = computePlanMejoramiento(
        encuentro, r.anio, programa, unidadRegional, facultad
      );

      // Solo actualiza si hay algún cambio
      if (
        r.categoria !== categoria ||
        r.subcategoria !== subcategoria ||
        r.programa !== programa ||
        r.unidad_regional !== unidadRegional ||
        r.facultad !== facultad ||
        r.encuentro !== encuentro ||
        r.formulado !== formulado ||
        r.plan_de_mejoramiento !== planDeMejoramiento
      ) {
        await prisma.planMejoramientoEstudiante.update({
          where: { id: r.id },
          data: {
            categoria,
            subcategoria,
            programa,
            unidad_regional: unidadRegional,
            facultad,
            encuentro,
            formulado,
            plan_de_mejoramiento: planDeMejoramiento,
          },
        });
        updatedEst++;
      }
    }

    // ── Normalizar Docentes ────────────────────────────────────────────────
    const docentes = await prisma.planMejoramientoDocente.findMany();

    for (const r of docentes) {
      const categoria      = normalizeCategoria(r.categoria);
      const subcategoria   = normalizeSubcategoria(r.subcategoria);
      const programa       = normalizePrograma(r.programa);
      const unidadRegional = normalizeUnidadRegional(r.unidad_regional);
      const facultad       = normalizeFacultad(r.facultad);
      const encuentro      = normalizeEncuentro(r.encuentro);
      const formulado      = normalizeFormulado(r.formulado);
      const calificacion   = normalizeCalificacion(r.calificacion);
      const planDeMejoramiento = computePlanMejoramiento(
        encuentro, r.anio, programa, unidadRegional, facultad
      );

      if (
        r.categoria !== categoria ||
        r.subcategoria !== subcategoria ||
        r.programa !== programa ||
        r.unidad_regional !== unidadRegional ||
        r.facultad !== facultad ||
        r.encuentro !== encuentro ||
        r.formulado !== formulado ||
        r.calificacion !== calificacion ||
        r.plan_de_mejoramiento !== planDeMejoramiento
      ) {
        await prisma.planMejoramientoDocente.update({
          where: { id: r.id },
          data: {
            categoria,
            subcategoria,
            programa,
            unidad_regional: unidadRegional,
            facultad,
            encuentro,
            formulado,
            calificacion,
            plan_de_mejoramiento: planDeMejoramiento,
          },
        });
        updatedDo++;
      }
    }

    return NextResponse.json({
      message: `Normalización completada. Estudiantes: ${updatedEst} registros actualizados. Docentes: ${updatedDo} registros actualizados.`,
      updatedEst,
      updatedDo,
      totalEst: estudiantes.length,
      totalDo: docentes.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
