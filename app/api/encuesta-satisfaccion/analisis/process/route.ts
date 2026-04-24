import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callWithFallback } from "@/lib/ai/analisis-client";
import { buildChunkPrompt } from "@/lib/analisis/prompts";

export const runtime     = "nodejs";
export const maxDuration = 60;

const BATCH_MAX       = 3;    // chunks por invocación (evita timeout de 60s)
const MAX_ATTEMPTS    = 3;
const STUCK_TIMEOUT_MS = 90_000; // después de 90s en "procesando" se considera abandonado

type Intentos = { cerebras?: number; groq?: number };

/**
 * Procesa un lote de chunks (pendiente o error_temporal) para (anio, periodo).
 * Cada chunk se intenta con Cerebras → Groq y se marca como completado o error.
 */
export async function POST(request: NextRequest) {
  try {
    const { anio: anioRaw, periodo: periodoRaw } = await request.json();
    const anio    = Number(anioRaw);
    const periodo = String(periodoRaw ?? "").trim().toUpperCase();

    if (!anio || (periodo !== "IPA" && periodo !== "IIPA"))
      return NextResponse.json({ error: "Año/periodo inválidos" }, { status: 400 });

    // Reclama chunks en estados reintentables + los que quedaron colgados en "procesando"
    const stuckCutoff = new Date(Date.now() - STUCK_TIMEOUT_MS);
    const pendientes = await prisma.satisfaccionAnalisisChunk.findMany({
      where: {
        anio, periodo_academico: periodo,
        OR: [
          { estado: { in: ["pendiente", "error_temporal"] } },
          { estado: "procesando", updated_at: { lt: stuckCutoff } },
        ],
      },
      orderBy: [{ area: "asc" }, { orden: "asc" }],
      take:    BATCH_MAX,
    });

    let procesados  = 0;
    let errores     = 0;
    let ultimoError = "";

    for (const chunk of pendientes) {
      const comentarios = Array.isArray(chunk.contenido) ? (chunk.contenido as unknown as string[]) : [];
      if (comentarios.length === 0) {
        await prisma.satisfaccionAnalisisChunk.update({
          where: { id: chunk.id },
          data:  { estado: "error_final", error: "Chunk sin comentarios" },
        });
        continue;
      }

      const prevIntentos = (chunk.intentos ?? {}) as Intentos;
      const messages     = buildChunkPrompt(chunk.area, comentarios);

      // Marca "procesando" para visibilidad (idempotente si el cliente ya lo hizo)
      await prisma.satisfaccionAnalisisChunk.update({
        where: { id: chunk.id },
        data:  { estado: "procesando" },
      });

      const { success, errors } = await callWithFallback(messages, { maxTokens: 900, temperature: 0.3 });

      // Rate-limit en AMBOS proveedores: no consume intento; hacemos pausa y marcamos error_temporal.
      const bothRateLimited = !success && errors.length === 2 && errors.every((e) => e.status === 429);

      const nuevosIntentos: Intentos = {
        cerebras: (prevIntentos.cerebras ?? 0) + (bothRateLimited ? 0 : 1),
        groq:     (prevIntentos.groq     ?? 0) + (success?.provider === "groq" || errors.some((e) => e.provider === "groq") ? 1 : 0),
      };

      if (success) {
        await prisma.satisfaccionAnalisisChunk.update({
          where: { id: chunk.id },
          data:  {
            estado:          "completado",
            proveedor_usado: success.provider,
            resultado:       success.content,
            error:           null,
            intentos:        nuevosIntentos as never,
          },
        });
        procesados++;
      } else {
        const lastError = errors.map((e) => e.error).join(" | ");
        const agotado   = !bothRateLimited && (nuevosIntentos.cerebras ?? 0) >= MAX_ATTEMPTS;
        await prisma.satisfaccionAnalisisChunk.update({
          where: { id: chunk.id },
          data:  {
            estado:   agotado ? "error_final" : "error_temporal",
            error:    lastError.slice(0, 800),
            intentos: nuevosIntentos as never,
          },
        });
        errores++;
        ultimoError = lastError;

        // Si ambos están rate-limited, hacer una pausa corta para no quemar la cuota
        if (bothRateLimited) {
          const retryAfter = Math.max(
            errors.find((e) => e.provider === "cerebras")?.retryAfterMs ?? 0,
            errors.find((e) => e.provider === "groq")?.retryAfterMs     ?? 0,
          );
          const wait = Math.min(Math.max(retryAfter, 1500), 8000);
          await new Promise((r) => setTimeout(r, wait));
        }
      }
    }

    const [pendientesRest, procesadosTotal, errorTemporal, errorFinal, completados, total] = await Promise.all([
      prisma.satisfaccionAnalisisChunk.count({ where: { anio, periodo_academico: periodo, estado: "pendiente"       } }),
      prisma.satisfaccionAnalisisChunk.count({ where: { anio, periodo_academico: periodo, estado: "procesando"      } }),
      prisma.satisfaccionAnalisisChunk.count({ where: { anio, periodo_academico: periodo, estado: "error_temporal"  } }),
      prisma.satisfaccionAnalisisChunk.count({ where: { anio, periodo_academico: periodo, estado: "error_final"     } }),
      prisma.satisfaccionAnalisisChunk.count({ where: { anio, periodo_academico: periodo, estado: "completado"      } }),
      prisma.satisfaccionAnalisisChunk.count({ where: { anio, periodo_academico: periodo } }),
    ]);

    return NextResponse.json({
      procesados,
      errores,
      ultimoError: ultimoError.slice(0, 300),
      restantes:   pendientesRest + errorTemporal + procesadosTotal,
      counts:      { pendiente: pendientesRest, procesando: procesadosTotal, error_temporal: errorTemporal, error_final: errorFinal, completado: completados, total },
      done:        (pendientesRest + errorTemporal + procesadosTotal) === 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
