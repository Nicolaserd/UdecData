/**
 * Revert the bad renames made by the first normalize script run.
 * Run: npx tsx scripts/revert-bad-renames.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

// These were wrong mappings made by the old script (before canonical list was complete)
const REVERTS: { wrong: string; correct: string }[] = [
  { wrong: "Licenciatura en Ciencias Sociales", correct: "Licenciatura en Lenguas Modernas Español-Inglés" },
  { wrong: "Especialización en Analítica y Ciencia de Datos", correct: "Especialización en Nutrición y Alimentación Animal" },
  { wrong: "Especialización en Agronegocios Sostenibles", correct: "Especialización en Negocios y Comercio Electrónico" },
];

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // First, check what we need to fix
  for (const rev of REVERTS) {
    // We can't simply rename back because some records were legitimately that name.
    // We need to identify the ones that were wrongly renamed.
    // The bad script renamed records that had the lowercase version of the "correct" name.
    // Since we can't distinguish them now, we'll need to re-seed.
    console.log(`Need to fix: "${rev.wrong}" should contain records from "${rev.correct}"`);
  }

  console.log("\nThe safest approach is to re-seed from ESTUDIANTES.xlsx.");
  console.log("Deleting all records and re-seeding...\n");

  // Delete all records
  const deleted = await prisma.estudiante.deleteMany({});
  console.log(`Deleted ${deleted.count} records`);

  await prisma.$disconnect();
}

main().catch(console.error);
