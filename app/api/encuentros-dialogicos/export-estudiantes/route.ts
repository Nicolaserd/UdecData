import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const data = await prisma.planMejoramientoEstudiante.findMany({
      orderBy: [
        { anio: "asc" },
        { encuentro: "asc" },
        { unidad_regional: "asc" },
        { facultad: "asc" },
        { programa: "asc" },
      ],
    });

    const rows = data.map((r) => ({
      "CATEGORIA": r.categoria,
      "SUBCATEGORIA": r.subcategoria,
      "PLAN DE MEJORAMIENTO": r.plan_de_mejoramiento,
      "ACTIVIDAD": r.actividad,
      "FECHA DE CUMPLIMIENTO": r.fecha_cumplimiento ?? "",
      "EVIDENCIAS DE CUMPLIMIENTO": r.evidencias_cumplimiento ?? "",
      "CALIFICACION DE CUMPLIMIENTO": r.calificacion_cumplimiento ?? "",
      "EFECTIVIDAD": r.efectividad ?? "",
      "PROGRAMA": r.programa,
      "UNIDAD REGIONAL": r.unidad_regional,
      "FACULTAD": r.facultad,
      "AÑO": r.anio,
      "ENCUENTRO": r.encuentro,
      "formulado": r.formulado ?? "",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 20 }, { wch: 25 }, { wch: 80 }, { wch: 60 },
      { wch: 25 }, { wch: 60 }, { wch: 10 }, { wch: 40 },
      { wch: 35 }, { wch: 20 }, { wch: 35 }, { wch: 8 },
      { wch: 20 }, { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "PM Estudiantes");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="PM_ESTUDIANTES_ENCUENTROS_DIALOGICOS.xlsx"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
