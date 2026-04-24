import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { anio: anioRaw, periodo: periodoRaw } = await request.json();
    const anio    = Number(anioRaw);
    const periodo = String(periodoRaw ?? "").trim().toUpperCase();

    if (!anio || (periodo !== "IPA" && periodo !== "IIPA"))
      return NextResponse.json({ error: "Año/periodo inválidos" }, { status: 400 });

    const where = { anio, periodo_academico: periodo };
    const [c1, c2, c3] = await prisma.$transaction([
      prisma.satisfaccionAnalisisChunk.deleteMany({ where }),
      prisma.satisfaccionAnalisisConsolidado.deleteMany({ where }),
      prisma.satisfaccionAnalisisInforme.deleteMany({ where }),
    ]);

    return NextResponse.json({ chunks: c1.count, consolidados: c2.count, informes: c3.count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
