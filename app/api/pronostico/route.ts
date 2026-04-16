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
      });
    }

    const forecasts = calcularPronosticos(data);
    const chartData = buildChartData(data, forecasts, categoria);
    const forecastPeriods = getForecastPeriods(data);

    // Estadísticas resumen (sobre la categoría seleccionada o Matriculados por defecto)
    const catForSummary = categoria ?? "Matriculados";
    const chartForSummary = buildChartData(data, forecasts, catForSummary);

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
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
