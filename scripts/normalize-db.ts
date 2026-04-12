/**
 * One-time script to normalize existing DB data:
 * - nivel: "pregrado" → "Pregrado", "posgrado" → "Posgrado", etc.
 * - periodo: "1" → "IPA", "2" → "IIPA"
 *
 * Run: npx tsx scripts/normalize-db.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // Fix nivel capitalization
  const nivelFixes = [
    { from: "pregrado", to: "Pregrado" },
    { from: "posgrado", to: "Posgrado" },
    { from: "tecnología", to: "Tecnología" },
    { from: "tecnologia", to: "Tecnología" },
    { from: "PREGRADO", to: "Pregrado" },
    { from: "POSGRADO", to: "Posgrado" },
    { from: "TECNOLOGÍA", to: "Tecnología" },
    { from: "TECNOLOGIA", to: "Tecnología" },
  ];

  for (const fix of nivelFixes) {
    const result = await prisma.estudiante.updateMany({
      where: { nivel: fix.from },
      data: { nivel: fix.to },
    });
    if (result.count > 0) {
      console.log(`nivel: "${fix.from}" → "${fix.to}" (${result.count} registros)`);
    }
  }

  // Fix periodo: "1" → "IPA", "2" → "IIPA"
  const periodoFixes = [
    { from: "1", to: "IPA" },
    { from: "2", to: "IIPA" },
  ];

  for (const fix of periodoFixes) {
    const result = await prisma.estudiante.updateMany({
      where: { periodo: fix.from },
      data: { periodo: fix.to },
    });
    if (result.count > 0) {
      console.log(`periodo: "${fix.from}" → "${fix.to}" (${result.count} registros)`);
    }
  }

  // Fix nivel_academico capitalization
  const nivAcFixes = [
    { from: "profesional universitario", to: "Profesional universitario" },
    { from: "especialización", to: "Especialización" },
    { from: "especializacion", to: "Especialización" },
    { from: "maestría", to: "Maestría" },
    { from: "maestria", to: "Maestría" },
    { from: "doctorado", to: "Doctorado" },
    { from: "tecnología", to: "Tecnología" },
    { from: "tecnologia", to: "Tecnología" },
  ];

  for (const fix of nivAcFixes) {
    const result = await prisma.estudiante.updateMany({
      where: { nivel_academico: fix.from },
      data: { nivel_academico: fix.to },
    });
    if (result.count > 0) {
      console.log(`nivel_academico: "${fix.from}" → "${fix.to}" (${result.count} registros)`);
    }
  }

  // Show final distinct values
  const niveles = await prisma.estudiante.groupBy({ by: ["nivel"], _count: { id: true } });
  console.log("\nValores finales de nivel:", niveles.map(n => `${n.nivel} (${n._count.id})`).join(", "));

  const periodos = await prisma.estudiante.groupBy({ by: ["periodo"], _count: { id: true } });
  console.log("Valores finales de periodo:", periodos.map(p => `${p.periodo} (${p._count.id})`).join(", "));

  await prisma.$disconnect();
}

main().catch(console.error);
