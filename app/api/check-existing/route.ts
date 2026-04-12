import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { anio, periodo } = await request.json();

    if (!anio || !periodo) {
      return NextResponse.json(
        { error: "Se requiere año y periodo" },
        { status: 400 }
      );
    }

    // Check which categories already have data for this año+periodo
    const existing = await prisma.estudiante.groupBy({
      by: ["categoria"],
      where: {
        anio: Number(anio),
        periodo: String(periodo),
      },
      _count: { id: true },
    });

    const categories = existing.map((e) => ({
      categoria: e.categoria,
      registros: e._count.id,
    }));

    return NextResponse.json({ categories });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
