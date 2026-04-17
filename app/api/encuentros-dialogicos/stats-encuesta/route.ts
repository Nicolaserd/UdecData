import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type BarData = { label: string; pct: number; count: number };

function toBarData(
  groups: { unidad_regional: string; _avg: { experiencia_general?: number | null; experiencia?: number | null }; _count: { id: number } }[]
): BarData[] {
  return groups
    .map((g) => {
      const avg = g._avg.experiencia_general ?? g._avg.experiencia ?? null;
      return {
        label: g.unidad_regional,
        // Escala 1-5 → porcentaje: (avg - 1) / 4 * 100 para mostrar el rango completo
        // O simplemente avg * 20 para mapear 5 = 100%
        pct:   avg != null ? Math.round(avg * 20) : 0,
        count: g._count.id,
      };
    })
    .sort((a, b) => b.pct - a.pct);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const anio     = searchParams.get("anio")     ? Number(searchParams.get("anio"))  : undefined;
    const encuentro = searchParams.get("encuentro") ?? undefined;

    // ── Estudiantes ──────────────────────────────────────────────────────────
    const whereEst = {
      ...(anio      ? { anio }                             : {}),
      ...(encuentro ? { numero_encuentro: encuentro }      : {}),
    };

    const estGroups = await prisma.encuestaEstudiante.groupBy({
      by:      ["unidad_regional"],
      where:   whereEst,
      _avg:    { experiencia_general: true },
      _count:  { id: true },
    });

    const estTotal = estGroups.reduce((s, g) => s + g._count.id, 0);
    const estGlobalAvg = estTotal > 0
      ? estGroups.reduce((s, g) => s + (g._avg.experiencia_general ?? 0) * g._count.id, 0) / estTotal
      : null;

    // ── Docentes ─────────────────────────────────────────────────────────────
    const whereDoc = {
      ...(anio      ? { anio }      : {}),
      ...(encuentro ? { encuentro } : {}),
    };

    const docGroups = await prisma.encuestaDocente.groupBy({
      by:     ["unidad_regional"],
      where:  whereDoc,
      _avg:   { experiencia: true },
      _count: { id: true },
    });

    const docTotal = docGroups.reduce((s, g) => s + g._count.id, 0);
    const docGlobalAvg = docTotal > 0
      ? docGroups.reduce((s, g) => s + (g._avg.experiencia ?? 0) * g._count.id, 0) / docTotal
      : null;

    // ── Filtros disponibles ───────────────────────────────────────────────────
    const [estAnios, docAnios] = await Promise.all([
      prisma.encuestaEstudiante.findMany({ select: { anio: true }, distinct: ["anio"], orderBy: { anio: "desc" } }),
      prisma.encuestaDocente.findMany(   { select: { anio: true }, distinct: ["anio"], orderBy: { anio: "desc" } }),
    ]);
    const [estEnc, docEnc] = await Promise.all([
      prisma.encuestaEstudiante.findMany({ select: { numero_encuentro: true }, distinct: ["numero_encuentro"] }),
      prisma.encuestaDocente.findMany(   { select: { encuentro: true },        distinct: ["encuentro"] }),
    ]);

    const aniosSet     = [...new Set([...estAnios.map((r) => r.anio), ...docAnios.map((r) => r.anio)])].sort((a, b) => b - a);
    const encuentrosSet = [...new Set([...estEnc.map((r) => r.numero_encuentro), ...docEnc.map((r) => r.encuentro)])].sort();

    return NextResponse.json({
      estudiantes: {
        bars:     toBarData(estGroups as Parameters<typeof toBarData>[0]),
        avgScore: estGlobalAvg != null ? Math.round(estGlobalAvg * 10) / 10 : null,
        total:    estTotal,
      },
      docentes: {
        bars:     toBarData(docGroups as Parameters<typeof toBarData>[0]),
        avgScore: docGlobalAvg != null ? Math.round(docGlobalAvg * 10) / 10 : null,
        total:    docTotal,
      },
      filters: {
        anios:      aniosSet,
        encuentros: encuentrosSet,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
