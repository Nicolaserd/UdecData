import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import {
  AREAS, COL_ID, COL_ROL, COL_SEDE,
  normalizeRowKeys, isYes, getNivel, getComentarios, getByPrefix,
} from "@/lib/parsers/encuesta-satisfaccion";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file    = formData.get("file") as File | null;
    const anio    = Number(formData.get("anio") ?? 0);
    const periodo = String(formData.get("periodo_academico") ?? "").trim().toUpperCase();

    if (!file)   return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
    if (!anio)   return NextResponse.json({ error: "Falta año" }, { status: 400 });
    if (periodo !== "IPA" && periodo !== "IIPA")
      return NextResponse.json({ error: "Periodo académico debe ser IPA o IIPA" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb     = XLSX.read(buffer, { type: "buffer" });
    const ws     = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

    if (rawRows.length === 0)
      return NextResponse.json({ error: "El archivo está vacío o no tiene datos" }, { status: 400 });

    let respuestas    = 0;
    let registrosArea = 0;
    const areasCount: Record<string, number> = {};

    for (const rawRow of rawRows) {
      const row = normalizeRowKeys(rawRow);
      const id  = getByPrefix(row, COL_ID);
      if (id == null) continue;
      respuestas++;

      for (const a of AREAS) {
        if (a.triggerCol && !isYes(getByPrefix(row, a.triggerCol))) continue;
        const { text } = getNivel(row, a);
        const comentarios = getComentarios(row, a);
        if (text == null && comentarios == null) continue;
        registrosArea++;
        areasCount[a.area] = (areasCount[a.area] ?? 0) + 1;
      }
    }

    const existing = await prisma.encuestaSatisfaccion.count({
      where: { anio, periodo_academico: periodo },
    });

    return NextResponse.json({ respuestas, registrosArea, areasCount, existing, anio, periodo_academico: periodo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
