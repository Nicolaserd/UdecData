import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const anio    = Number(searchParams.get("anio"));
    const periodo = (searchParams.get("periodo") ?? "").toUpperCase();

    if (!anio || (periodo !== "IPA" && periodo !== "IIPA"))
      return NextResponse.json({ error: "Año/periodo inválidos" }, { status: 400 });

    const where = { anio, periodo_academico: periodo };

    const [chunksByEstado, consolByEstado, informe] = await Promise.all([
      prisma.satisfaccionAnalisisChunk.groupBy({
        by: ["estado"], where, _count: { id: true },
      }),
      prisma.satisfaccionAnalisisConsolidado.groupBy({
        by: ["estado"], where, _count: { id: true },
      }),
      prisma.satisfaccionAnalisisInforme.findUnique({
        where: { anio_periodo_academico: { anio, periodo_academico: periodo } },
      }),
    ]);

    const chunks: Record<string, number> = {};
    let chunksTotal = 0;
    for (const g of chunksByEstado) {
      chunks[g.estado] = g._count.id;
      chunksTotal += g._count.id;
    }

    const consolidados: Record<string, number> = {};
    let consolTotal = 0;
    for (const g of consolByEstado) {
      consolidados[g.estado] = g._count.id;
      consolTotal += g._count.id;
    }

    const chunksCompletados    = chunks["completado"]    ?? 0;
    const consolCompletados    = consolidados["completado"] ?? 0;
    const chunksPendientes     = (chunks["pendiente"] ?? 0) + (chunks["error_temporal"] ?? 0) + (chunks["procesando"] ?? 0);
    const consolPendientes     = (consolidados["pendiente"] ?? 0) + (consolidados["procesando"] ?? 0);

    return NextResponse.json({
      chunks: {
        total:       chunksTotal,
        porEstado:   chunks,
        pendientes:  chunksPendientes,
        completados: chunksCompletados,
        progreso:    chunksTotal > 0 ? Math.round((chunksCompletados / chunksTotal) * 100) : 0,
      },
      consolidados: {
        total:       consolTotal,
        porEstado:   consolidados,
        pendientes:  consolPendientes,
        completados: consolCompletados,
        progreso:    consolTotal > 0 ? Math.round((consolCompletados / consolTotal) * 100) : 0,
      },
      informe: informe ? {
        estado:   informe.estado,
        url:      informe.url,
        filename: informe.filename,
        totalAreas:  informe.total_areas,
        totalChunks: informe.total_chunks,
        error:       informe.error,
        updatedAt:   informe.updated_at,
      } : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
