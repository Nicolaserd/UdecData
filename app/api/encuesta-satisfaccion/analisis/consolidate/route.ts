import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callWithFallback } from "@/lib/ai/analisis-client";
import { buildConsolidatePrompt } from "@/lib/analisis/prompts";

export const runtime     = "nodejs";
export const maxDuration = 60;

const BATCH_MAX        = 3;     // áreas a consolidar por invocación
const STUCK_TIMEOUT_MS = 90_000;

/**
 * Para cada área cuyos chunks estén todos completados, llama a la IA con los
 * análisis parciales para producir un único párrafo consolidado.
 */
export async function POST(request: NextRequest) {
  try {
    const { anio: anioRaw, periodo: periodoRaw } = await request.json();
    const anio    = Number(anioRaw);
    const periodo = String(periodoRaw ?? "").trim().toUpperCase();

    if (!anio || (periodo !== "IPA" && periodo !== "IIPA"))
      return NextResponse.json({ error: "Año/periodo inválidos" }, { status: 400 });

    const stuckCutoff = new Date(Date.now() - STUCK_TIMEOUT_MS);
    const pendientes = await prisma.satisfaccionAnalisisConsolidado.findMany({
      where: {
        anio, periodo_academico: periodo,
        OR: [
          { estado: { in: ["pendiente", "error"] } },
          { estado: "procesando", updated_at: { lt: stuckCutoff } },
        ],
      },
      orderBy: { area: "asc" },
      take:    BATCH_MAX,
    });

    let consolidados = 0;
    let errores      = 0;
    let ultimoError  = "";
    const ignoradas: string[] = [];

    for (const c of pendientes) {
      const chunks = await prisma.satisfaccionAnalisisChunk.findMany({
        where:   { anio, periodo_academico: periodo, area: c.area },
        orderBy: { orden: "asc" },
      });

      const totales    = chunks.length;
      const terminados = chunks.filter((k) => k.estado === "completado" || k.estado === "error_final").length;
      if (totales === 0 || terminados < totales) {
        ignoradas.push(c.area);
        continue;
      }

      const analisis = chunks
        .filter((k) => k.estado === "completado" && k.resultado)
        .map((k) => k.resultado as string);

      if (analisis.length === 0) {
        await prisma.satisfaccionAnalisisConsolidado.update({
          where: { id: c.id },
          data:  { estado: "error", error: "Todos los chunks de esta área fallaron" },
        });
        errores++;
        continue;
      }

      await prisma.satisfaccionAnalisisConsolidado.update({
        where: { id: c.id },
        data:  { estado: "procesando" },
      });

      const { success, errors } = await callWithFallback(buildConsolidatePrompt(c.area, analisis), { maxTokens: 1200, temperature: 0.2 });

      if (success) {
        await prisma.satisfaccionAnalisisConsolidado.update({
          where: { id: c.id },
          data:  {
            estado:          "completado",
            parrafo:         success.content,
            proveedor_usado: success.provider,
            error:           null,
          },
        });
        consolidados++;
      } else {
        const lastError = errors.map((e) => e.error).join(" | ");
        await prisma.satisfaccionAnalisisConsolidado.update({
          where: { id: c.id },
          data:  { estado: "error", error: lastError.slice(0, 800) },
        });
        errores++;
        ultimoError = lastError;

        // Backoff si ambos proveedores rate-limited
        const bothRateLimited = errors.length === 2 && errors.every((e) => e.status === 429);
        if (bothRateLimited) {
          const retryAfter = Math.max(
            errors.find((e) => e.provider === "cerebras")?.retryAfterMs ?? 0,
            errors.find((e) => e.provider === "groq")?.retryAfterMs     ?? 0,
          );
          const wait = Math.min(Math.max(retryAfter, 2000), 10_000);
          await new Promise((r) => setTimeout(r, wait));
        }
      }
    }

    const [pendientesRest, completados, errorRest, total] = await Promise.all([
      prisma.satisfaccionAnalisisConsolidado.count({ where: { anio, periodo_academico: periodo, estado: "pendiente"  } }),
      prisma.satisfaccionAnalisisConsolidado.count({ where: { anio, periodo_academico: periodo, estado: "completado" } }),
      prisma.satisfaccionAnalisisConsolidado.count({ where: { anio, periodo_academico: periodo, estado: "error"      } }),
      prisma.satisfaccionAnalisisConsolidado.count({ where: { anio, periodo_academico: periodo } }),
    ]);

    return NextResponse.json({
      consolidados, errores, ignoradas,
      ultimoError: ultimoError.slice(0, 300),
      counts:      { pendiente: pendientesRest, completado: completados, error: errorRest, total },
      // "done" cuando todo está completado o en error (sin pendientes ni reintentables)
      done:        (pendientesRest + errorRest) === 0 && total > 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
