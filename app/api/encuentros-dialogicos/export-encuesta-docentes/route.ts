import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rows = await prisma.encuestaDocente.findMany({
      orderBy: [{ anio: "desc" }, { encuentro: "asc" }, { unidad_regional: "asc" }],
    });

    const data = rows.map((r) => ({
      "Unidad regional":           r.unidad_regional,
      "Facultad":                  r.facultad,
      "Programa":                  r.programa ?? "",
      "Encuentro":                 r.encuentro,
      "Año":                       r.anio,
      "Experiencia (1-5)":         r.experiencia ?? "",
      "Profundidad temas":         r.profundidad_temas ?? "",
      "Oportunidad de opinión":    r.oportunidad_opinion ?? "",
      "Claridad respuestas":       r.claridad_respuestas ?? "",
      "Convocatoria":              r.convocatoria ?? "",
      "Organización":              r.organizacion ?? "",
      "Mecanismos participación":  r.mecanismos_participacion ?? "",
      "Participación comunidad":   r.participacion_comunidad ?? "",
      "Canales digitales":         r.uso_canales_digitales ?? "",
      "Aspectos de mejora":        r.aspectos_mejora ?? "",
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Encuestas Docentes");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="encuestas_docentes.xlsx"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
