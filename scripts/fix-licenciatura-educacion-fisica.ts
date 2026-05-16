/**
 * Unifica los dos nombres del programa de Licenciatura en Educación Física
 * bajo el canónico "Licenciatura en Educación Física" en la tabla `estudiantes`
 * (usada por el servicio "Automatizar Reportes para Boletín").
 *
 * Nombres antiguos:
 *   - "Licenciatura en Educación Física, Recreación y Deportes"
 *   - "Licenciatura en Educación Básica con Énfasis en Educación Física, Recreación y Deportes"
 *
 * Si al renombrar se colisiona con una fila existente en la unique key
 * (categoria, unidad_regional, nivel, nivel_academico, programa_academico, anio, periodo),
 * se suma `cantidad` y se elimina la fila duplicada.
 *
 * Run: npx tsx scripts/fix-licenciatura-educacion-fisica.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const CANONICAL = "Licenciatura en Educación Física";

const OLD_NAMES = [
  "Licenciatura en Educación Física, Recreación y Deportes",
  "Licenciatura en Educación Básica con Énfasis en Educación Física, Recreación y Deportes",
];

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  let totalRenamed = 0;
  let totalMerged = 0;

  for (const old of OLD_NAMES) {
    const rows = await prisma.estudiante.findMany({
      where: { programa_academico: old },
    });

    if (rows.length === 0) {
      console.log(`"${old}" — sin filas, se omite.`);
      continue;
    }

    let renamed = 0;
    let merged = 0;

    for (const row of rows) {
      const existing = await prisma.estudiante.findFirst({
        where: {
          categoria: row.categoria,
          unidad_regional: row.unidad_regional,
          nivel: row.nivel,
          nivel_academico: row.nivel_academico,
          programa_academico: CANONICAL,
          anio: row.anio,
          periodo: row.periodo,
        },
      });

      if (existing && existing.id !== row.id) {
        await prisma.estudiante.update({
          where: { id: existing.id },
          data: { cantidad: existing.cantidad + row.cantidad },
        });
        await prisma.estudiante.delete({ where: { id: row.id } });
        merged++;
      } else {
        await prisma.estudiante.update({
          where: { id: row.id },
          data: { programa_academico: CANONICAL },
        });
        renamed++;
      }
    }

    console.log(`"${old}" → "${CANONICAL}": ${renamed} renombradas, ${merged} fusionadas`);
    totalRenamed += renamed;
    totalMerged += merged;
  }

  console.log(`\nTotal: ${totalRenamed} renombradas, ${totalMerged} fusionadas.`);

  const efTotal = await prisma.estudiante.aggregate({
    where: { programa_academico: CANONICAL },
    _sum: { cantidad: true },
    _count: { id: true },
  });
  console.log(
    `Filas finales para "${CANONICAL}": ${efTotal._count.id} (cantidad total: ${efTotal._sum.cantidad ?? 0})`
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
