import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import {
  normalizePrograma,
  normalizeUnidadRegional,
  normalizeFacultad,
  normalizeEncuentro,
  normalizeCategoria,
  normalizeSubcategoria,
  computePlanMejoramiento,
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const tipo = formData.get("tipo") as "estudiantes" | "docentes" | null;

    if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
    if (!tipo) return NextResponse.json({ error: "Se requiere tipo: estudiantes | docentes" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

    const preview: PreviewRow[] = [];
    let omitidos = 0;

    for (const row of rows) {
      const rawPrograma  = String(row["PROGRAMA"] ?? "").trim();
      const rawUnidad    = String(row["UNIDAD REGIONAL"] ?? "").trim();
      const rawFacultad  = String(row["FACULTAD"] ?? "").trim();
      const rawEncuentro = String(row["ENCUENTRO"] ?? "").trim();
      const rawActividad = String(row["ACTIVIDAD"] ?? "").trim();
      const anio         = Number(row["AÑO"] ?? 0);

      if (!rawPrograma || !rawEncuentro || !anio || !rawActividad) {
        omitidos++;
        continue;
      }

      const programa       = normalizePrograma(rawPrograma);
      const unidadRegional = normalizeUnidadRegional(rawUnidad);
      const facultad       = normalizeFacultad(rawFacultad);
      const encuentro      = normalizeEncuentro(rawEncuentro);
      const categoria      = normalizeCategoria(String(row["CATEGORIA"] ?? "").trim());
      const subcategoria   = normalizeSubcategoria(String(row["SUBCATEGORIA"] ?? "").trim());
      const plan           = computePlanMejoramiento(encuentro, anio, programa, unidadRegional, facultad);

      // Buscar si ya existe en BD
      let exists = false;
      if (tipo === "estudiantes") {
        const found = await prisma.planMejoramientoEstudiante.findUnique({
          where: {
            encuentro_anio_programa_unidad_regional_facultad_actividad: {
              encuentro, anio, programa, unidad_regional: unidadRegional, facultad, actividad: rawActividad,
            },
          },
          select: { id: true },
        });
        exists = found !== null;
      } else {
        const found = await prisma.planMejoramientoDocente.findUnique({
          where: {
            encuentro_anio_programa_unidad_regional_facultad_actividad: {
              encuentro, anio, programa, unidad_regional: unidadRegional, facultad, actividad: rawActividad,
            },
          },
          select: { id: true },
        });
        exists = found !== null;
      }

      preview.push({
        plan,
        actividad: rawActividad,
        programa,
        unidad_regional: unidadRegional,
        encuentro,
        anio,
        status: exists ? "actualizar" : "nuevo",
        // suppress unused
        ...({ categoria, subcategoria } as object),
      } as PreviewRow);
    }

    const nuevos    = preview.filter((r) => r.status === "nuevo").length;
    const actualizar = preview.filter((r) => r.status === "actualizar").length;

    return NextResponse.json({
      total: preview.length,
      nuevos,
      actualizar,
      omitidos,
      rows: preview,
    } satisfies PreviewResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
