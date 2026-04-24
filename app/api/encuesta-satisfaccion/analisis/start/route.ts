import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanComentarios, chunkComentarios } from "@/lib/analisis/chunk-comentarios";

export const runtime     = "nodejs";
export const maxDuration = 60;

/**
 * Extrae comentarios del (anio, periodo), los agrupa por área, limpia y
 * materializa los chunks en `satisfaccion_analisis_chunk`.
 * Resetea análisis anterior para el mismo (anio, periodo).
 */
export async function POST(request: NextRequest) {
  try {
    const { anio: anioRaw, periodo: periodoRaw } = await request.json();
    const anio    = Number(anioRaw);
    const periodo = String(periodoRaw ?? "").trim().toUpperCase();

    if (!anio)
      return NextResponse.json({ error: "Falta año" }, { status: 400 });
    if (periodo !== "IPA" && periodo !== "IIPA")
      return NextResponse.json({ error: "Periodo debe ser IPA o IIPA" }, { status: 400 });

    // 1. Traer comentarios del periodo
    const rows = await prisma.encuestaSatisfaccion.findMany({
      where:  { anio, periodo_academico: periodo, comentarios: { not: null } },
      select: { area: true, comentarios: true },
    });

    if (rows.length === 0)
      return NextResponse.json({ error: `No hay comentarios para ${periodo} ${anio}` }, { status: 404 });

    // 2. Agrupar por área
    const byArea = new Map<string, string[]>();
    for (const r of rows) {
      if (!r.comentarios) continue;
      const bucket = byArea.get(r.area) ?? [];
      bucket.push(r.comentarios);
      byArea.set(r.area, bucket);
    }

    // 3. Reset previo
    const where = { anio, periodo_academico: periodo };
    await prisma.$transaction([
      prisma.satisfaccionAnalisisChunk.deleteMany({ where }),
      prisma.satisfaccionAnalisisConsolidado.deleteMany({ where }),
      prisma.satisfaccionAnalisisInforme.deleteMany({ where }),
    ]);

    // 4. Crear chunks por área
    type ChunkRow = {
      anio:              number;
      periodo_academico: string;
      area:              string;
      orden:             number;
      contenido:         string[];
      total_comentarios: number;
    };
    const chunkRows: ChunkRow[] = [];
    const areasInfo: { area: string; totalComentarios: number; totalChunks: number }[] = [];

    for (const [area, raw] of byArea.entries()) {
      const limpios = cleanComentarios(raw);
      const chunks  = chunkComentarios(limpios);
      areasInfo.push({ area, totalComentarios: limpios.length, totalChunks: chunks.length });

      chunks.forEach((contenido, idx) => {
        chunkRows.push({
          anio, periodo_academico: periodo, area,
          orden: idx + 1, contenido, total_comentarios: contenido.length,
        });
      });

      // Crea el stub de consolidado por área (estado pendiente hasta que todos los chunks terminen)
      if (chunks.length > 0) {
        await prisma.satisfaccionAnalisisConsolidado.create({
          data: { anio, periodo_academico: periodo, area, estado: "pendiente" },
        });
      }
    }

    if (chunkRows.length === 0)
      return NextResponse.json(
        { error: "No se encontraron comentarios significativos después de la limpieza" },
        { status: 404 },
      );

    // Inserción en tandas de 500
    const batchSize = 500;
    for (let i = 0; i < chunkRows.length; i += batchSize) {
      await prisma.satisfaccionAnalisisChunk.createMany({
        data: chunkRows.slice(i, i + batchSize),
      });
    }

    // 5. Crear registro de informe
    await prisma.satisfaccionAnalisisInforme.create({
      data: {
        anio, periodo_academico: periodo,
        estado: "pendiente",
        total_areas:  areasInfo.length,
        total_chunks: chunkRows.length,
      },
    });

    return NextResponse.json({
      message:      `Inicializados ${chunkRows.length} chunks en ${areasInfo.length} áreas.`,
      totalAreas:   areasInfo.length,
      totalChunks:  chunkRows.length,
      totalRespuestas: rows.length,
      areas:        areasInfo,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
