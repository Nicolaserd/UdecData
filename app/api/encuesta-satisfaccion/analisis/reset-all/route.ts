import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Borra TODOS los registros de las 3 tablas de análisis LLM.
 * Requiere PIN (PIN_REGISTRO_BD) validado server-side.
 */
export async function POST(request: NextRequest) {
  try {
    const { pin } = (await request.json()) as { pin?: string };
    const expected = process.env.PIN_REGISTRO_BD;

    if (!expected) return NextResponse.json({ error: "PIN no configurado en el servidor" }, { status: 500 });
    if (!pin || pin !== expected) return NextResponse.json({ error: "PIN inválido" }, { status: 401 });

    const [chunks, consolidados, informes] = await prisma.$transaction([
      prisma.satisfaccionAnalisisChunk.deleteMany({}),
      prisma.satisfaccionAnalisisConsolidado.deleteMany({}),
      prisma.satisfaccionAnalisisInforme.deleteMany({}),
    ]);

    return NextResponse.json({
      ok: true,
      deleted: {
        chunks:       chunks.count,
        consolidados: consolidados.count,
        informes:     informes.count,
        total:        chunks.count + consolidados.count + informes.count,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
