import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter });

async function main() {
  const byArea = await prisma.encuestaSatisfaccion.groupBy({
    by: ["area"],
    where: { anio: 2026, periodo_academico: "IPA" },
    _count: { id: true },
  });
  const withComment = await prisma.encuestaSatisfaccion.groupBy({
    by: ["area"],
    where: { anio: 2026, periodo_academico: "IPA", comentarios: { not: null } },
    _count: { id: true },
  });

  console.log("Áreas totales con registros:", byArea.length);
  console.log("Áreas con al menos 1 comentario no-nulo:", withComment.length);

  const withSet = new Set(withComment.map((a) => a.area));
  const missing = byArea.filter((a) => !withSet.has(a.area));

  console.log("\nÁreas SIN comentarios no-nulos:");
  missing.forEach((a) => console.log(`  - ${a.area} (${a._count.id} registros)`));

  console.log("\nConteo por área (registros | con comentario):");
  byArea.sort((a, b) => a.area.localeCompare(b.area)).forEach((a) => {
    const wc = withComment.find((x) => x.area === a.area);
    console.log(`  ${a.area.padEnd(40)} ${String(a._count.id).padStart(4)} | ${String(wc?._count.id ?? 0).padStart(4)}`);
  });

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
