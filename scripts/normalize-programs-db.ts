/**
 * Normalize all programa_academico values in the DB using the fuzzy matcher.
 * Merges duplicates that differ only in capitalization/accents.
 *
 * Run: npx tsx scripts/normalize-programs-db.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { normalizeProgram } from "../lib/normalization/program-normalizer";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // Get all distinct program names
  const programs = await prisma.estudiante.groupBy({
    by: ["programa_academico"],
    _count: { id: true },
  });

  // Build map: current name → canonical name
  const fixes: { from: string; to: string }[] = [];
  for (const p of programs) {
    const { name: canonical } = normalizeProgram(p.programa_academico);
    if (canonical !== p.programa_academico) {
      fixes.push({ from: p.programa_academico, to: canonical });
    }
  }

  if (fixes.length === 0) {
    console.log("All programs already normalized!");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${fixes.length} programs to normalize:\n`);

  for (const fix of fixes) {
    // Find all records with the wrong name
    const wrongRows = await prisma.estudiante.findMany({
      where: { programa_academico: fix.from },
    });

    let renamed = 0;
    let merged = 0;

    for (const row of wrongRows) {
      // Check if canonical version already exists with same unique key
      const existing = await prisma.estudiante.findFirst({
        where: {
          categoria: row.categoria,
          unidad_regional: row.unidad_regional,
          nivel: row.nivel,
          nivel_academico: row.nivel_academico,
          programa_academico: fix.to,
          anio: row.anio,
          periodo: row.periodo,
        },
      });

      if (existing) {
        // Merge: sum cantidad, delete duplicate
        await prisma.estudiante.update({
          where: { id: existing.id },
          data: { cantidad: existing.cantidad + row.cantidad },
        });
        await prisma.estudiante.delete({ where: { id: row.id } });
        merged++;
      } else {
        // Just rename
        await prisma.estudiante.update({
          where: { id: row.id },
          data: { programa_academico: fix.to },
        });
        renamed++;
      }
    }

    console.log(`"${fix.from}" → "${fix.to}": ${renamed} renamed, ${merged} merged`);
  }

  // Final count
  const final = await prisma.estudiante.groupBy({
    by: ["programa_academico"],
    _sum: { cantidad: true },
    orderBy: { programa_academico: "asc" },
  });
  console.log(`\nTotal programas únicos: ${final.length}\n`);
  for (const p of final) {
    console.log(`  ${p._sum.cantidad}\t${p.programa_academico}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
