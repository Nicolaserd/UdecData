import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildInformeDocx } from "@/lib/analisis/build-docx";

export const runtime     = "nodejs";
export const maxDuration = 60;

/**
 * Construye el .docx a partir de los consolidados por área y lo devuelve
 * directamente como binario (sin almacenamiento externo). Luego limpia las
 * 3 tablas de análisis para ese (año, periodo). NO invoca IA.
 */
export async function POST(request: NextRequest) {
  try {
    const { anio: anioRaw, periodo: periodoRaw } = await request.json();
    const anio    = Number(anioRaw);
    const periodo = String(periodoRaw ?? "").trim().toUpperCase();

    if (!anio || (periodo !== "IPA" && periodo !== "IIPA"))
      return NextResponse.json({ error: "Año/periodo inválidos" }, { status: 400 });

    const where = { anio, periodo_academico: periodo };

    const consolidados = await prisma.satisfaccionAnalisisConsolidado.findMany({
      where:   { ...where, estado: "completado", parrafo: { not: null } },
      orderBy: { area: "asc" },
    });

    if (consolidados.length === 0)
      return NextResponse.json(
        { error: "No hay consolidados completados para generar el informe" },
        { status: 400 },
      );

    const [totalRespuestas, totalComentarios] = await Promise.all([
      prisma.encuestaSatisfaccion.findMany({
        where:    { anio, periodo_academico: periodo },
        select:   { respuesta_id: true },
        distinct: ["respuesta_id"],
      }).then((r) => r.length),
      prisma.encuestaSatisfaccion.count({
        where: { anio, periodo_academico: periodo, comentarios: { not: null } },
      }),
    ]);

    const buffer = await buildInformeDocx({
      anio, periodo, totalRespuestas, totalComentarios,
      consolidados: consolidados.map((c) => ({ area: c.area, parrafo: c.parrafo ?? "" })),
    });

    const filename   = `informe_satisfaccion_${periodo}_${anio}.docx`;
    const totalAreas = consolidados.length;

    // Limpiamos las 3 tablas ANTES de enviar el binario (ya tenemos el docx
    // en memoria, no dependemos de la BD para responder).
    await prisma.$transaction([
      prisma.satisfaccionAnalisisChunk.deleteMany({ where }),
      prisma.satisfaccionAnalisisConsolidado.deleteMany({ where }),
      prisma.satisfaccionAnalisisInforme.deleteMany({ where }),
    ]);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length":      String(buffer.length),
        "X-Informe-Areas":     String(totalAreas),
        "X-Informe-Filename":  filename,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
