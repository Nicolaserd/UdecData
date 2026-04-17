import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  normalizeRowKeys,
  extractPrograma,
  getByPrefix,
  toSentenceCase,
} from "@/lib/normalize-text";

export async function POST(request: NextRequest) {
  try {
    const formData  = await request.formData();
    const file      = formData.get("file")      as File | null;
    const encuentro = String(formData.get("encuentro") ?? "").trim().toUpperCase();
    const anio      = Number(formData.get("anio") ?? 0);

    if (!file)      return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
    if (!encuentro) return NextResponse.json({ error: "Falta número de encuentro" }, { status: 400 });
    if (!anio)      return NextResponse.json({ error: "Falta año" }, { status: 400 });

    const buffer  = Buffer.from(await file.arrayBuffer());
    const wb      = XLSX.read(buffer, { type: "buffer" });
    const ws      = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });
    }

    // ── Eliminar registros existentes del mismo encuentro+año ──────────────────
    const deleted = await prisma.encuestaEstudiante.deleteMany({
      where: { numero_encuentro: encuentro, anio },
    });

    // ── Construir filas a insertar ─────────────────────────────────────────────
    const toInsert: Prisma.EncuestaEstudianteCreateManyInput[] = [];
    const warnings: string[] = [];

    for (const rawRow of rawRows) {
      const row = normalizeRowKeys(rawRow);

      const unidad_regional = String(row["unidad regional a la que pertenece"] ?? "").trim();
      const programa        = extractPrograma(row);
      const expRaw          = getByPrefix(row, "en una escala de 1 a 5 siendo 1 menos satisfecho");
      const semestre        = row["semestre que cursa"] != null ? String(row["semestre que cursa"]).trim() : null;
      const profRaw         = getByPrefix(row, "¿cómo califica la profundidad");
      const retroRaw        = getByPrefix(row, "¿ha recibido retroalimentación");
      const seguimRaw       = getByPrefix(row, "¿cómo califica el seguimiento");
      const mejoraRaw       = getByPrefix(row, "¿qué aspectos considera que podrían mejorarse");

      toInsert.push({
        semestre:                semestre   ? toSentenceCase(semestre) : null,
        experiencia_general:     Number(expRaw) || null,
        profundidad_temas:       profRaw  != null ? toSentenceCase(String(profRaw).trim())  : null,
        retroalimentacion:       retroRaw != null ? toSentenceCase(String(retroRaw).trim()) : null,
        seguimiento_compromisos: seguimRaw != null ? toSentenceCase(String(seguimRaw).trim()) : null,
        aspectos_mejora:         mejoraRaw != null ? String(mejoraRaw).trim() : null,
        programa,
        anio,
        numero_encuentro:        encuentro,
        unidad_regional:         toSentenceCase(unidad_regional),
      });
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ error: "No se encontraron filas válidas en el archivo" }, { status: 400 });
    }

    await prisma.encuestaEstudiante.createMany({ data: toInsert });

    return NextResponse.json({
      message:  `Se insertaron ${toInsert.length} respuestas de estudiantes (se eliminaron ${deleted.count} anteriores).`,
      inserted: toInsert.length,
      deleted:  deleted.count,
      warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
