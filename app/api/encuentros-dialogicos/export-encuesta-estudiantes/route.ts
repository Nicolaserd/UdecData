import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rows = await prisma.encuestaEstudiante.findMany({
      orderBy: [{ anio: "desc" }, { numero_encuentro: "asc" }, { unidad_regional: "asc" }],
    });

    const data = rows.map((r) => ({
      "Semestre":                r.semestre ?? "",
      "Experiencia general (1-5)": r.experiencia_general ?? "",
      "Profundidad temas":       r.profundidad_temas ?? "",
      "Retroalimentación":       r.retroalimentacion ?? "",
      "Seguimiento compromisos": r.seguimiento_compromisos ?? "",
      "Aspectos de mejora":      r.aspectos_mejora ?? "",
      "Programa":                r.programa,
      "Año":                     r.anio,
      "Número encuentro":        r.numero_encuentro,
      "Unidad regional":         r.unidad_regional,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Encuestas Estudiantes");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="encuestas_estudiantes.xlsx"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
