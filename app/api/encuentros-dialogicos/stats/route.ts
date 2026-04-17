import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toBarData(
  rows: {
    unidad_regional: string;
    _avg: { calificacion_cumplimiento: number | null };
    _count: { id: number };
  }[]
) {
  return rows.map((r) => {
    const avg = r._avg.calificacion_cumplimiento ?? 0;
    const pct = avg <= 1 ? Math.round(avg * 100) : Math.round(avg);
    return { label: r.unidad_regional, pct, count: r._count.id };
  });
}

function toGlobalPct(avg: number | null): number | null {
  if (avg == null) return null;
  return avg <= 1 ? Math.round(avg * 100) : Math.round(avg);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const anio      = searchParams.get("anio");      // "" = todos
    const programa  = searchParams.get("programa");  // "" | "todos" = todos
    const encuentro = searchParams.get("encuentro"); // "" | "todos" = todos

    const anioNum     = anio ? Number(anio) : null;
    const progFilter  = programa  && programa  !== "todos" ? programa  : null;
    const encFilter   = encuentro && encuentro !== "todos" ? encuentro : null;

    // ── Where para gráficas (aplica los 3 filtros) ────────────────────────
    const baseWhereEst = {
      ...(anioNum    ? { anio: anioNum }                            : {}),
      ...(progFilter ? { programa: { equals: progFilter, mode: "insensitive" as const } } : {}),
      ...(encFilter  ? { encuentro: { equals: encFilter, mode: "insensitive" as const } } : {}),
      calificacion_cumplimiento: { not: null },
    };
    const baseWhereDo = { ...baseWhereEst };

    // ── Gráficas ──────────────────────────────────────────────────────────
    const [estRows, doRows, estGlobal, doGlobal] = await Promise.all([
      prisma.planMejoramientoEstudiante.groupBy({
        by: ["unidad_regional"],
        where: baseWhereEst,
        _avg: { calificacion_cumplimiento: true },
        _count: { id: true },
        orderBy: { unidad_regional: "asc" },
      }),
      prisma.planMejoramientoDocente.groupBy({
        by: ["unidad_regional"],
        where: baseWhereDo,
        _avg: { calificacion_cumplimiento: true },
        _count: { id: true },
        orderBy: { unidad_regional: "asc" },
      }),
      prisma.planMejoramientoEstudiante.aggregate({
        where: baseWhereEst,
        _avg: { calificacion_cumplimiento: true },
        _count: { id: true },
      }),
      prisma.planMejoramientoDocente.aggregate({
        where: baseWhereDo,
        _avg: { calificacion_cumplimiento: true },
        _count: { id: true },
      }),
    ]);

    // ── Cascadeo de filtros ───────────────────────────────────────────────
    // AÑOS: siempre todos (sin filtro)
    const [aniosEst, aniosDo] = await Promise.all([
      prisma.planMejoramientoEstudiante.findMany({
        select: { anio: true }, distinct: ["anio"], orderBy: { anio: "desc" },
      }),
      prisma.planMejoramientoDocente.findMany({
        select: { anio: true }, distinct: ["anio"], orderBy: { anio: "desc" },
      }),
    ]);
    const allAnios = [...new Set([
      ...aniosEst.map((r) => r.anio),
      ...aniosDo.map((r) => r.anio),
    ])].sort((a, b) => b - a);

    // PROGRAMAS: filtrado por año seleccionado
    const progWhereEst = anioNum ? { anio: anioNum } : {};
    const progWhereDo  = anioNum ? { anio: anioNum } : {};
    const [programasEst, programasDo] = await Promise.all([
      prisma.planMejoramientoEstudiante.findMany({
        select: { programa: true }, distinct: ["programa"],
        where: progWhereEst, orderBy: { programa: "asc" },
      }),
      prisma.planMejoramientoDocente.findMany({
        select: { programa: true }, distinct: ["programa"],
        where: progWhereDo, orderBy: { programa: "asc" },
      }),
    ]);
    const allProgramas = [...new Set([
      ...programasEst.map((r) => r.programa),
      ...programasDo.map((r) => r.programa),
    ])].sort();

    // ENCUENTROS: filtrado por año + programa seleccionados
    const encWhereEst = {
      ...(anioNum    ? { anio: anioNum } : {}),
      ...(progFilter ? { programa: { equals: progFilter, mode: "insensitive" as const } } : {}),
    };
    const encWhereDo = { ...encWhereEst };
    const [encuentrosEst, encuentrosDo] = await Promise.all([
      prisma.planMejoramientoEstudiante.findMany({
        select: { encuentro: true }, distinct: ["encuentro"],
        where: encWhereEst, orderBy: { encuentro: "asc" },
      }),
      prisma.planMejoramientoDocente.findMany({
        select: { encuentro: true }, distinct: ["encuentro"],
        where: encWhereDo, orderBy: { encuentro: "asc" },
      }),
    ]);
    const allEncuentros = [...new Set([
      ...encuentrosEst.map((r) => r.encuentro),
      ...encuentrosDo.map((r) => r.encuentro),
    ])].sort();

    return NextResponse.json({
      estudiantes: {
        bars: toBarData(estRows),
        globalPct: toGlobalPct(estGlobal._avg.calificacion_cumplimiento),
        total: estGlobal._count.id,
      },
      docentes: {
        bars: toBarData(doRows),
        globalPct: toGlobalPct(doGlobal._avg.calificacion_cumplimiento),
        total: doGlobal._count.id,
      },
      filters: {
        anios: allAnios,
        programas: allProgramas,
        encuentros: allEncuentros,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
