import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import {
  normalizePrograma,
  normalizeUnidadRegional,
  normalizeFacultad,
  normalizeEncuentro,
  computePlanMejoramiento,
  checkColumnas,
  normalizeRowKeys,
  REQUIRED_COLS_ESTUDIANTES,
  REQUIRED_COLS_DOCENTES,
} from "@/lib/normalize-text";

export type PreviewRow = {
  plan: string;
  actividad: string;
  programa: string;
  unidad_regional: string;
  encuentro: string;
  anio: number;
  status: "nuevo" | "actualizar";
};

export type PreviewResponse = {
  total: number;
  nuevos: number;
  actualizar: number;
  omitidos: number;
  rows: PreviewRow[];
};

/** Clave compuesta para lookup en memoria */
function makeKey(encuentro: string, anio: number, programa: string, unidad: string, facultad: string, actividad: string) {
  return `${encuentro}||${anio}||${programa}||${unidad}||${facultad}||${actividad}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const tipo = formData.get("tipo") as "estudiantes" | "docentes" | null;

    if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
    if (!tipo) return NextResponse.json({ error: "Falta tipo: estudiantes | docentes" }, { status: 400 });

    // ── Parsear Excel ────────────────────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });
    }

    // ── Validar columnas requeridas ──────────────────────────────────────────
    const required = tipo === "estudiantes" ? REQUIRED_COLS_ESTUDIANTES : REQUIRED_COLS_DOCENTES;
    const faltantes = checkColumnas(rawRows[0] as Record<string, unknown>, required);
    if (faltantes.length > 0) {
      return NextResponse.json(
        { error: `Columnas faltantes en el archivo: ${faltantes.join(", ")}` },
        { status: 400 }
      );
    }

    // ── Normalizar filas del archivo ─────────────────────────────────────────
    type ParsedRow = {
      programa: string; unidad_regional: string; facultad: string;
      encuentro: string; actividad: string; anio: number; plan: string;
    };

    const parsed: ParsedRow[] = [];
    let omitidos = 0;

    for (const rawRow of rawRows) {
      const row = normalizeRowKeys(rawRow);

      const rawPrograma  = String(row["programa"]       ?? "").trim();
      const rawUnidad    = String(row["unidad regional"] ?? "").trim();
      const rawFacultad  = String(row["facultad"]        ?? "").trim();
      const rawEncuentro = String(row["encuentro"]       ?? "").trim();
      const rawActividad = String(row["actividad"]       ?? "").trim();
      const anio         = Number(row["año"] ?? 0);

      if (!rawPrograma || !rawEncuentro || !anio || !rawActividad) {
        omitidos++;
        continue;
      }

      const programa       = normalizePrograma(rawPrograma);
      const unidad_regional = normalizeUnidadRegional(rawUnidad);
      const facultad       = normalizeFacultad(rawFacultad);
      const encuentro      = normalizeEncuentro(rawEncuentro);
      const plan           = computePlanMejoramiento(encuentro, anio, programa, unidad_regional, facultad);

      parsed.push({ programa, unidad_regional, facultad, encuentro, actividad: rawActividad, anio, plan });
    }

    if (parsed.length === 0) {
      return NextResponse.json({ total: 0, nuevos: 0, actualizar: 0, omitidos, rows: [] });
    }

    // ── Batch query: traer todos los registros que coincidan con los encuentros/años del archivo ──
    const aniosEnArchivo    = [...new Set(parsed.map((r) => r.anio))];
    const encuentrosEnArchivo = [...new Set(parsed.map((r) => r.encuentro))];

    const existingSet = new Set<string>();

    if (tipo === "estudiantes") {
      const existing = await prisma.planMejoramientoEstudiante.findMany({
        where: { anio: { in: aniosEnArchivo }, encuentro: { in: encuentrosEnArchivo } },
        select: { encuentro: true, anio: true, programa: true, unidad_regional: true, facultad: true, actividad: true },
      });
      for (const r of existing) {
        existingSet.add(makeKey(r.encuentro, r.anio, r.programa, r.unidad_regional, r.facultad, r.actividad));
      }
    } else {
      const existing = await prisma.planMejoramientoDocente.findMany({
        where: { anio: { in: aniosEnArchivo }, encuentro: { in: encuentrosEnArchivo } },
        select: { encuentro: true, anio: true, programa: true, unidad_regional: true, facultad: true, actividad: true },
      });
      for (const r of existing) {
        existingSet.add(makeKey(r.encuentro, r.anio, r.programa, r.unidad_regional, r.facultad, r.actividad));
      }
    }

    // ── Clasificar filas ─────────────────────────────────────────────────────
    const rows: PreviewRow[] = parsed.map((r) => ({
      plan: r.plan,
      actividad: r.actividad,
      programa: r.programa,
      unidad_regional: r.unidad_regional,
      encuentro: r.encuentro,
      anio: r.anio,
      status: existingSet.has(makeKey(r.encuentro, r.anio, r.programa, r.unidad_regional, r.facultad, r.actividad))
        ? "actualizar"
        : "nuevo",
    }));

    return NextResponse.json({
      total:     rows.length,
      nuevos:    rows.filter((r) => r.status === "nuevo").length,
      actualizar: rows.filter((r) => r.status === "actualizar").length,
      omitidos,
      rows,
    } satisfies PreviewResponse);

  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
