import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import {
  calcularPronosticos,
  buildSheetData,
  getForecastPeriods,
  type StudentRecord,
} from "@/lib/pronostico";

const CATEGORIAS = ["Inscritos", "Admitidos", "Matriculados", "Primiparos"];

// Colores para resaltar columnas de pronóstico (light blue)
const FORECAST_FILL = { fgColor: { rgb: "BDD7EE" } };
const TOTAL_FILL = { fgColor: { rgb: "E2EFDA" } };
const HEADER_FILL = { fgColor: { rgb: "375623" } };
const HEADER_FONT = { color: { rgb: "FFFFFF" }, bold: true };
const TOTAL_FONT = { bold: true };

function applyStyles(
  ws: XLSX.WorkSheet,
  headers: string[],
  rowCount: number,
  forecastColumns: string[]
) {
  const forecastSet = new Set(forecastColumns);
  const colCount = headers.length;

  // Estilos de cabecera (fila 1)
  for (let c = 0; c < colCount; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = { fill: HEADER_FILL, font: HEADER_FONT, alignment: { horizontal: "center" } };
  }

  // Estilos por columna (pronóstico) y fila de totales
  for (let r = 1; r <= rowCount; r++) {
    const isTotalRow = r === rowCount;
    for (let c = 0; c < colCount; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) continue;
      const colHeader = headers[c];
      const isForecast = forecastSet.has(colHeader);

      if (isTotalRow) {
        ws[cellRef].s = {
          fill: TOTAL_FILL,
          font: TOTAL_FONT,
          alignment: c >= 2 ? { horizontal: "right" } : undefined,
        };
      } else if (isForecast) {
        ws[cellRef].s = {
          fill: FORECAST_FILL,
          alignment: c >= 2 ? { horizontal: "right" } : undefined,
        };
      }
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const nivelParam = (searchParams.get("nivel") ?? "pregrado").toLowerCase();
    const nivel = nivelParam === "posgrado" ? "posgrado" : "pregrado";

    const dbData = await prisma.estudiante.findMany({
      orderBy: [{ anio: "asc" }, { periodo: "asc" }],
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

    const data = dbData as StudentRecord[];

    if (data.length === 0) {
      return NextResponse.json({ error: "No hay datos en la base de datos" }, { status: 404 });
    }

    const forecasts = calcularPronosticos(data);
    const forecastPeriods = getForecastPeriods(data);

    // Determinar el rango de años para el nombre del archivo
    const forecastYears = [...new Set(forecastPeriods.map(([y]) => y))].sort();
    const yearRange =
      forecastYears.length > 0
        ? `${forecastYears[0]}_${forecastYears[forecastYears.length - 1]}`
        : "Pronostico";

    const wb = XLSX.utils.book_new();

    for (const categoria of CATEGORIAS) {
      const { headers, rows, forecastColumns } = buildSheetData(
        data,
        forecasts,
        nivel,
        categoria
      );

      if (rows.length <= 1) continue; // Solo fila de totales → sin datos para este nivel/cat

      const wsData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Anchos de columna
      ws["!cols"] = headers.map((h, i) => ({
        wch: i === 0 ? 22 : i === 1 ? 50 : 14,
      }));

      // Congelar primeras 2 columnas + cabecera
      ws["!freeze"] = { xSplit: 2, ySplit: 1 };

      applyStyles(ws, headers, rows.length, forecastColumns);

      XLSX.utils.book_append_sheet(wb, ws, categoria);
    }

    const nivelLabel = nivel === "pregrado" ? "Pregrado" : "Posgrado";
    const fileName = `Pronostico_${nivelLabel}_${yearRange}.xlsx`;

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
