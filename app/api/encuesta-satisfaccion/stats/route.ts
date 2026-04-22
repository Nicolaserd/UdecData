import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type BarItem = { label: string; pct: number; satisfechos: number; total: number };

function toBarItems(
  totals:    { label: string; total: number }[],
  satisfMap: Map<string, number>,
): BarItem[] {
  return totals
    .map(({ label, total }) => {
      const sat = satisfMap.get(label) ?? 0;
      return { label, pct: total > 0 ? Math.round((sat / total) * 100) : 0, satisfechos: sat, total };
    })
    .sort((a, b) => b.pct - a.pct);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const anio    = searchParams.get("anio")    ? Number(searchParams.get("anio")) : undefined;
    const periodo = searchParams.get("periodo") || undefined;
    const sede    = searchParams.get("sede") && searchParams.get("sede") !== "todas" ? searchParams.get("sede")! : undefined;
    const rol     = searchParams.get("rol") && searchParams.get("rol") !== "todos" ? searchParams.get("rol")! : undefined;

    const where = {
      ...(anio    ? { anio }                       : {}),
      ...(periodo ? { periodo_academico: periodo } : {}),
      ...(sede    ? { sede }                       : {}),
      ...(rol     ? { rol }                        : {}),
    };

    // ── Barras por área ───────────────────────────────────────────────────────
    const [areaTotals, areaSat] = await Promise.all([
      prisma.encuestaSatisfaccion.groupBy({ by: ["area"], where: { ...where, nivel_satisfaccion: { not: null } }, _count: { id: true } }),
      prisma.encuestaSatisfaccion.groupBy({ by: ["area"], where: { ...where, nivel_satisfaccion: { in: ["Satisfecho", "Muy satisfecho"] } }, _count: { id: true } }),
    ]);
    const areaBars = toBarItems(areaTotals.map((g) => ({ label: g.area, total: g._count.id })), new Map(areaSat.map((g) => [g.area, g._count.id])));

    // ── Barras por sede ───────────────────────────────────────────────────────
    const [sedeTotals, sedeSat] = await Promise.all([
      prisma.encuestaSatisfaccion.groupBy({ by: ["sede"], where: { ...where, nivel_satisfaccion: { not: null } }, _count: { id: true } }),
      prisma.encuestaSatisfaccion.groupBy({ by: ["sede"], where: { ...where, nivel_satisfaccion: { in: ["Satisfecho", "Muy satisfecho"] } }, _count: { id: true } }),
    ]);
    const sedeBars = toBarItems(sedeTotals.map((g) => ({ label: g.sede, total: g._count.id })), new Map(sedeSat.map((g) => [g.sede, g._count.id])));

    // ── Barras por rol ────────────────────────────────────────────────────────
    const [rolTotals, rolSat] = await Promise.all([
      prisma.encuestaSatisfaccion.groupBy({ by: ["rol"], where: { ...where, nivel_satisfaccion: { not: null } }, _count: { id: true } }),
      prisma.encuestaSatisfaccion.groupBy({ by: ["rol"], where: { ...where, nivel_satisfaccion: { in: ["Satisfecho", "Muy satisfecho"] } }, _count: { id: true } }),
    ]);
    const rolBars = toBarItems(rolTotals.map((g) => ({ label: g.rol, total: g._count.id })), new Map(rolSat.map((g) => [g.rol, g._count.id])));

    // ── Distribución por nivel ────────────────────────────────────────────────
    const nivelGroups = await prisma.encuestaSatisfaccion.groupBy({
      by:     ["nivel_satisfaccion"],
      where:  { ...where, nivel_satisfaccion: { not: null } },
      _count: { id: true },
    });

    const distribucion = nivelGroups
      .map((g) => ({ label: g.nivel_satisfaccion ?? "Sin dato", count: g._count.id }))
      .sort((a, b) => b.count - a.count);

    // ── KPIs globales ─────────────────────────────────────────────────────────
    const totalAgg = await prisma.encuestaSatisfaccion.aggregate({
      where,
      _count: { id: true },
      _avg:   { nivel_numerico: true },
    });

    const [satisfechosTotal, totalConNivel, respuestasUnicas] = await Promise.all([
      prisma.encuestaSatisfaccion.count({
        where: { ...where, nivel_satisfaccion: { in: ["Satisfecho", "Muy satisfecho"] } },
      }),
      prisma.encuestaSatisfaccion.count({
        where: { ...where, nivel_satisfaccion: { not: null } },
      }),
      prisma.encuestaSatisfaccion.findMany({
        where,
        select:   { respuesta_id: true },
        distinct: ["respuesta_id"],
      }),
    ]);

    const satisfaccionPct = totalConNivel > 0
      ? Math.round((satisfechosTotal / totalConNivel) * 100)
      : null;

    // ── Filtros disponibles ───────────────────────────────────────────────────
    const [anios, periodos, sedesList, rolesList] = await Promise.all([
      prisma.encuestaSatisfaccion.findMany({ select: { anio: true },              distinct: ["anio"],              orderBy: { anio: "desc" } }),
      prisma.encuestaSatisfaccion.findMany({ select: { periodo_academico: true }, distinct: ["periodo_academico"] }),
      prisma.encuestaSatisfaccion.findMany({ select: { sede: true },              distinct: ["sede"],              orderBy: { sede: "asc" } }),
      prisma.encuestaSatisfaccion.findMany({ select: { rol: true },               distinct: ["rol"],               orderBy: { rol: "asc" } }),
    ]);

    return NextResponse.json({
      kpis: {
        registros:        totalAgg._count.id,
        respuestasUnicas: respuestasUnicas.length,
        promedioGlobal:   totalAgg._avg.nivel_numerico != null ? Math.round(totalAgg._avg.nivel_numerico * 100) / 100 : null,
        satisfaccionPct,
      },
      areaBars,
      sedeBars,
      rolBars,
      distribucion,
      filters: {
        anios:    anios.map((a) => a.anio),
        periodos: periodos.map((p) => p.periodo_academico),
        sedes:    sedesList.map((s) => s.sede),
        roles:    rolesList.map((r) => r.rol),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
