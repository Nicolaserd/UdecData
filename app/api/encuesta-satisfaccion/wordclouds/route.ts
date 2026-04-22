import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { extractWords, safeFilename } from "@/lib/parsers/wordcloud-text";
import { generateWordCloudPng } from "@/lib/wordcloud";

export const runtime     = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const anio    = Number(searchParams.get("anio"));
    const periodo = (searchParams.get("periodo") ?? "").toUpperCase();

    if (!anio)
      return NextResponse.json({ error: "El año es obligatorio" }, { status: 400 });
    if (periodo !== "IPA" && periodo !== "IIPA")
      return NextResponse.json({ error: "El periodo debe ser IPA o IIPA" }, { status: 400 });

    const rows = await prisma.encuestaSatisfaccion.findMany({
      where:   { anio, periodo_academico: periodo, comentarios: { not: null } },
      select:  { area: true, comentarios: true },
      orderBy: { area: "asc" },
    });

    if (rows.length === 0)
      return NextResponse.json(
        { error: `No hay comentarios para ${periodo} ${anio}` },
        { status: 404 },
      );

    // Group comments by area
    const byArea = new Map<string, string[]>();
    for (const r of rows) {
      if (!r.comentarios) continue;
      const bucket = byArea.get(r.area) ?? [];
      bucket.push(r.comentarios);
      byArea.set(r.area, bucket);
    }

    const zip      = new JSZip();
    const skipped: string[] = [];
    let generated  = 0;

    for (const [area, comments] of byArea.entries()) {
      const words = extractWords(comments);
      if (words.length < 3) {
        skipped.push(area);
        continue;
      }
      const png = await generateWordCloudPng(words);
      zip.file(safeFilename(area), png);
      generated += 1;
    }

    if (generated === 0)
      return NextResponse.json(
        { error: "No se encontraron comentarios significativos para generar nubes de palabras" },
        { status: 404 },
      );

    // Add a small README with run metadata
    const readme = [
      `Nubes de palabras — Encuesta de Satisfacción`,
      `Periodo: ${periodo} ${anio}`,
      `Áreas generadas: ${generated}`,
      skipped.length
        ? `Áreas sin datos suficientes: ${skipped.join(", ")}`
        : "Todas las áreas disponibles fueron procesadas.",
      ``,
      `Se filtraron: stopwords en español, ruido ("na", "ok", "ninguno", etc.), números y palabras de menos de 3 letras.`,
    ].join("\n");
    zip.file("README.txt", readme);

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type":        "application/zip",
        "Content-Disposition": `attachment; filename="nubes_de_palabras_${periodo}_${anio}.zip"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
