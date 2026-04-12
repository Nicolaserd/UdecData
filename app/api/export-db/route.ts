import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const data = await prisma.estudiante.findMany({
      orderBy: [
        { anio: "asc" },
        { periodo: "asc" },
        { categoria: "asc" },
        { unidad_regional: "asc" },
        { programa_academico: "asc" },
      ],
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

    const rows = data.map((r) => ({
      "Categoría": r.categoria,
      "Unidad regional": r.unidad_regional,
      "Nivel": r.nivel,
      "Nivel académico": r.nivel_academico,
      "Programa académico": r.programa_academico,
      "Cantidad": r.cantidad,
      "Año": r.anio,
      "Periodo": r.periodo,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 25 },
      { wch: 50 }, { wch: 10 }, { wch: 8 }, { wch: 8 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Estudiantes");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="BASE_DATOS_ESTUDIANTES.xlsx"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
