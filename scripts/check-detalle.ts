import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter });

async function main() {
  // ¿Tienen comentarios en las tablas de detalle?
  const plantaConCom = await prisma.satisfaccionPlantaFisica.count({
    where: { anio: 2026, periodo_academico: "IPA", comentarios: { not: null } },
  });
  const plantaTotal  = await prisma.satisfaccionPlantaFisica.count({
    where: { anio: 2026, periodo_academico: "IPA" },
  });

  console.log(`Planta Física — detalle: ${plantaConCom}/${plantaTotal} tienen comentario`);

  const samplePlanta = await prisma.satisfaccionPlantaFisica.findMany({
    where: { anio: 2026, periodo_academico: "IPA" },
    take: 3,
  });
  console.log("\n3 ejemplos de registros detalle planta:");
  samplePlanta.forEach((r, i) => {
    console.log(`\n--- ejemplo ${i + 1} ---`);
    console.log("comentarios:", JSON.stringify(r.comentarios));
    console.log("promedio:", r.promedio);
    console.log("estructura_administrativa:", r.estructura_administrativa);
    console.log("zonas_verdes:", r.zonas_verdes);
  });

  // También el principal
  const principalSample = await prisma.encuestaSatisfaccion.findMany({
    where: { anio: 2026, periodo_academico: "IPA", area: "Planta Física" },
    take: 3,
  });
  console.log("\n3 ejemplos del principal (Planta Física):");
  principalSample.forEach((r) => console.log(" comentarios:", JSON.stringify(r.comentarios), "nivel:", r.nivel_satisfaccion));

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
