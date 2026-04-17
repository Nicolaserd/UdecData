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
    const deleted = await prisma.encuestaDocente.deleteMany({
      where: { encuentro, anio },
    });

    // ── Construir filas a insertar ─────────────────────────────────────────────
    const toInsert: Prisma.EncuestaDocenteCreateManyInput[] = [];
    const warnings: string[] = [];

    for (const rawRow of rawRows) {
      const row = normalizeRowKeys(rawRow);

      const unidad_regional = String(row["unidad regional"] ?? "").trim();
      const facultad        = String(row["facultad"] ?? "").trim();
      const programa        = extractPrograma(row) || null;
      const expRaw          = getByPrefix(row, "en una escala del 1 al 5");
      const profRaw         = getByPrefix(row, "consideras que la profundidad");
      const opinionRaw      = getByPrefix(row, "consideras que la oportunidad");
      const claridadRaw     = getByPrefix(row, "claridad en las respuestas");
      const convocatoriaRaw = getByPrefix(row, "convocatoria");
      const orgRaw          = getByPrefix(row, "organización del evento");
      const mecRaw          = getByPrefix(row, "mecanismos de participación");
      const partRaw         = getByPrefix(row, "participación de la comunidad");
      const canalesRaw      = getByPrefix(row, "uso de canales digitales");
      const mejoraRaw       = getByPrefix(row, "¿qué aspectos del evento");

      const norm = (v: unknown) => v != null && String(v).trim() !== "" ? toSentenceCase(String(v).trim()) : null;

      toInsert.push({
        unidad_regional:          toSentenceCase(unidad_regional),
        facultad:                 toSentenceCase(facultad),
        programa,
        encuentro,
        anio,
        experiencia:              expRaw != null ? Number(expRaw) || null : null,
        profundidad_temas:        norm(profRaw),
        oportunidad_opinion:      norm(opinionRaw),
        claridad_respuestas:      norm(claridadRaw),
        convocatoria:             norm(convocatoriaRaw),
        organizacion:             norm(orgRaw),
        mecanismos_participacion: norm(mecRaw),
        participacion_comunidad:  norm(partRaw),
        uso_canales_digitales:    norm(canalesRaw),
        aspectos_mejora:          mejoraRaw != null && String(mejoraRaw).trim() !== "" ? String(mejoraRaw).trim() : null,
      });
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ error: "No se encontraron filas válidas en el archivo" }, { status: 400 });
    }

    await prisma.encuestaDocente.createMany({ data: toInsert });

    return NextResponse.json({
      message:  `Se insertaron ${toInsert.length} respuestas de docentes (se eliminaron ${deleted.count} anteriores).`,
      inserted: toInsert.length,
      deleted:  deleted.count,
      warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
