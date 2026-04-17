import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { normalizeRowKeys, extractPrograma, getByPrefix } from "@/lib/normalize-text";

export type PreviewEncuestaResponse = {
  existing: number;
  incoming: number;
  encuentro: string;
  anio: number;
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file     = formData.get("file")     as File | null;
    const tipo     = formData.get("tipo")     as "estudiantes" | "docentes" | null;
    const encuentro = String(formData.get("encuentro") ?? "").trim().toUpperCase();
    const anio      = Number(formData.get("anio") ?? 0);

    if (!file)      return NextResponse.json({ error: "No se recibió archivo" },  { status: 400 });
    if (!tipo)      return NextResponse.json({ error: "Falta tipo" },             { status: 400 });
    if (!encuentro) return NextResponse.json({ error: "Falta número de encuentro" }, { status: 400 });
    if (!anio)      return NextResponse.json({ error: "Falta año" },              { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb     = XLSX.read(buffer, { type: "buffer" });
    const ws     = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });
    }

    // Contar filas válidas del archivo
    let incoming = 0;
    for (const rawRow of rawRows) {
      const row = normalizeRowKeys(rawRow);
      if (tipo === "estudiantes") {
        const unidad = String(row["unidad regional a la que pertenece"] ?? "").trim();
        const prog   = extractPrograma(row);
        const exp    = getByPrefix(row, "en una escala de 1 a 5 siendo 1 menos satisfecho");
        if (unidad && prog && exp != null) incoming++;
      } else {
        const unidad  = String(row["unidad regional"] ?? "").trim();
        const facultad = String(row["facultad"] ?? "").trim();
        const exp     = getByPrefix(row, "en una escala del 1 al 5");
        if (unidad && facultad && exp != null) incoming++;
      }
    }

    // Contar registros existentes para este encuentro+año
    let existing = 0;
    if (tipo === "estudiantes") {
      existing = await prisma.encuestaEstudiante.count({
        where: { numero_encuentro: encuentro, anio },
      });
    } else {
      existing = await prisma.encuestaDocente.count({
        where: { encuentro, anio },
      });
    }

    return NextResponse.json({ existing, incoming, encuentro, anio } satisfies PreviewEncuestaResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
