import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calcularPronosticos,
  calcularCobertura,
  buildChartData,
  getForecastPeriods,
  type StudentRecord,
} from "@/lib/pronostico";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoria = searchParams.get("categoria") ?? undefined;
    const unidadRegional = searchParams.get("unidad_regional") ?? undefined;
    const programaAcademico = searchParams.get("programa_academico") ?? undefined;

    const dbData = await prisma.estudiante.findMany({
      orderBy: [{ anio: "asc" }, { periodo: "asc" }],
      select: {
        categoria: true,
        unidad_regional: true,
        nivel: true,
        nivel_academico: true,
        programa_academico: true,
        cantidad: true,
        anio: true,
        periodo: true,
      },
    });

    const data = dbData as StudentRecord[];

    if (data.length === 0) {
      return NextResponse.json({
        chartData: [],
        forecastPeriods: [],
        summary: { lastYear: null, growthPct: null, totalForecast: null },
        categorias: [],
        unidadesRegionales: [],
        programasPorRegion: {},
      });
    }

    // Pronósticos calculados siempre sobre todos los datos (modelo global)
    const forecasts = calcularPronosticos(data);

    // Filtrar para el gráfico según los filtros seleccionados
    const applyFilters = <T extends { unidad_regional: string; programa_academico: string }>(arr: T[]) =>
      arr.filter(
        (r) =>
          (!unidadRegional || r.unidad_regional === unidadRegional) &&
          (!programaAcademico || r.programa_academico === programaAcademico)
      );

    const dataFiltrada = applyFilters(data);
    const forecastsFiltrados = applyFilters(forecasts);

    const chartData = buildChartData(dataFiltrada, forecastsFiltrados, categoria);
    const forecastPeriods = getForecastPeriods(data);

    // Estadísticas resumen (sobre la categoría seleccionada o Matriculados por defecto)
    const catForSummary = categoria ?? "Matriculados";
    const chartForSummary = buildChartData(dataFiltrada, forecastsFiltrados, catForSummary);

    // Metadatos para filtros dinámicos (siempre desde todos los datos)
    const unidadesRegionales = [...new Set(data.map((d) => d.unidad_regional))].sort();
    const programasPorRegion: Record<string, string[]> = {};
    for (const d of data) {
      if (!programasPorRegion[d.unidad_regional]) programasPorRegion[d.unidad_regional] = [];
      if (!programasPorRegion[d.unidad_regional].includes(d.programa_academico)) {
        programasPorRegion[d.unidad_regional].push(d.programa_academico);
      }
    }
    for (const k of Object.keys(programasPorRegion)) programasPorRegion[k].sort();

    const historicos = chartForSummary.filter((d) => d.tipo === "historico");
    const pronosticados = chartForSummary.filter((d) => d.tipo === "pronostico");

    const lastHistorico = historicos[historicos.length - 1];
    const firstPronostico = pronosticados[0];
    const lastPronostico = pronosticados[pronosticados.length - 1];

    let growthPct: number | null = null;
    if (lastHistorico && firstPronostico) {
      growthPct =
        lastHistorico.total > 0
          ? Math.round(
              ((firstPronostico.total - lastHistorico.total) /
                lastHistorico.total) *
                1000
            ) / 10
          : null;
    }

    const categorias = [...new Set(data.map((d) => d.categoria))].sort();
    const cobertura = calcularCobertura(forecasts, forecastPeriods);

    return NextResponse.json({
      chartData,
      forecastPeriods,
      summary: {
        lastYear: lastHistorico?.anio ?? null,
        lastPeriodTotal: lastHistorico?.total ?? null,
        firstForecastTotal: firstPronostico?.total ?? null,
        lastForecastTotal: lastPronostico?.total ?? null,
        growthPct,
      },
      cobertura,
      categorias,
      unidadesRegionales,
      programasPorRegion,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
