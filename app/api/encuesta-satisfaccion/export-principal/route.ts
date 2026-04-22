import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rows = await prisma.encuestaSatisfaccion.findMany({
      orderBy: [{ anio: "desc" }, { periodo_academico: "asc" }, { sede: "asc" }, { area: "asc" }],
    });

    const data = rows.map((r) => ({
      "ID único":              `${r.respuesta_id}-${r.anio}-${r.periodo_academico}`,
      "ID respuesta":          r.respuesta_id,
      "Año":                   r.anio,
      "Periodo académico":     r.periodo_academico,
      "Rol":                   r.rol,
      "Sede":                  r.sede,
      "Área":                  r.area,
      "Nivel de satisfacción": r.nivel_satisfaccion ?? "",
      "Nivel numérico (1-5)":  r.nivel_numerico ?? "",
      "Comentarios":           r.comentarios ?? "",
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Encuesta Satisfaccion");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="encuesta_satisfaccion_principal.xlsx"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
