/**
 * Fix duplicate programs with spelling/accent differences in the DB.
 * Groups duplicates under the canonical (correctly spelled) name.
 *
 * For records that share the same unique key after renaming,
 * we sum their cantidad and delete the duplicate.
 *
 * Run: npx tsx scripts/fix-programs.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

// Map of wrong name → correct canonical name
const FIXES: Record<string, string> = {
  "Contaduría publica": "Contaduría pública",
  "Especialización en agroecología y desarrollo agro ecoturístico": "Especialización en agroecología y desarrollo agroecoturístico",
  "Especialización en gestión de sistemas de información gerencial.": "Especialización en gestión de sistemas de información gerencial",
  "Maestría en Ciencias ambientales": "Maestría en ciencias ambientales",
};

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  for (const [wrong, correct] of Object.entries(FIXES)) {
    // Find all records with the wrong name
    const wrongRows = await prisma.estudiante.findMany({
      where: { programa_academico: wrong },
    });

    if (wrongRows.length === 0) {
      console.log(`"${wrong}" — no records found, skipping`);
      continue;
    }

    let updated = 0;
    let merged = 0;

    for (const row of wrongRows) {
      // Check if the canonical version already exists with same unique key
      const existing = await prisma.estudiante.findFirst({
        where: {
          categoria: row.categoria,
          unidad_regional: row.unidad_regional,
          nivel: row.nivel,
          nivel_academico: row.nivel_academico,
          programa_academico: correct,
          anio: row.anio,
          periodo: row.periodo,
        },
      });

      if (existing) {
        // Merge: add cantidad to existing, delete duplicate
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
          data: { programa_academico: correct },
        });
        updated++;
      }
    }

    console.log(`"${wrong}" → "${correct}": ${updated} renamed, ${merged} merged`);
  }

  // Show final program list
  const progs = await prisma.estudiante.groupBy({
    by: ["programa_academico"],
    _sum: { cantidad: true },
    orderBy: { programa_academico: "asc" },
  });
  console.log(`\nTotal programas únicos: ${progs.length}`);
  for (const p of progs) {
    console.log(`  ${p._sum.cantidad}\t${p.programa_academico}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
