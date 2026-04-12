/**
 * Script to load ESTUDIANTES.xlsx historical data into Supabase via Prisma.
 * Run with: npx tsx scripts/seed-historico.ts
 */

import "dotenv/config";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface EstudiantesRaw {
  "Categoría": string;
  "Unidad regional": string;
  "Nivel": string;
  "Nivel académico": string;
  "Programa académico": string;
  "Cantidad": number;
  "Año": number;
  "Periodo": string;
}

async function main() {
  const filePath = path.join(__dirname, "..", "data", "ESTUDIANTES.xlsx");

  if (!fs.existsSync(filePath)) {
    console.error("No se encontró data/ESTUDIANTES.xlsx");
    process.exit(1);
  }

  // Solo ejecutar si la tabla está vacía
  const count = await prisma.estudiante.count();
  if (count > 0) {
    console.log(`La tabla ya tiene ${count} registros. No se ejecuta el seed.`);
    return;
  }

  console.log("Tabla vacía. Leyendo ESTUDIANTES.xlsx...");
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json<EstudiantesRaw>(sheet);

  console.log(`Encontradas ${rawData.length} filas. Cargando...`);

  let inserted = 0;
  let skipped = 0;
  const batchSize = 500;

  for (let i = 0; i < rawData.length; i += batchSize) {
    const batch = rawData.slice(i, i + batchSize);

    const records = batch
      .filter((row) => {
        const cat = String(row["Categoría"] || "").trim();
        const prog = String(row["Programa académico"] || "").trim();
        const anio = Number(row["Año"]);
        const periodo = String(row["Periodo"] || "").trim();
        return cat && prog && anio && periodo;
      })
      .map((row) => ({
        categoria: String(row["Categoría"]).trim(),
        unidad_regional: String(row["Unidad regional"] || "").trim(),
        nivel: String(row["Nivel"] || "").trim(),
        nivel_academico: String(row["Nivel académico"] || "").trim(),
        programa_academico: String(row["Programa académico"]).trim(),
        cantidad: Number(row["Cantidad"]) || 0,
        anio: Number(row["Año"]),
        periodo: String(row["Periodo"]).trim(),
      }));

    for (const record of records) {
      try {
        await prisma.estudiante.upsert({
          where: {
            categoria_unidad_regional_nivel_nivel_academico_programa_academico_anio_periodo: {
              categoria: record.categoria,
              unidad_regional: record.unidad_regional,
              nivel: record.nivel,
              nivel_academico: record.nivel_academico,
              programa_academico: record.programa_academico,
              anio: record.anio,
              periodo: record.periodo,
            },
          },
          update: { cantidad: record.cantidad },
          create: record,
        });
        inserted++;
      } catch (e) {
        skipped++;
        if (skipped <= 5) {
          console.warn(`  Skip: ${JSON.stringify(record).slice(0, 100)}... Error: ${e}`);
        }
      }
    }

    console.log(`  Procesadas ${Math.min(i + batchSize, rawData.length)}/${rawData.length} filas`);
  }

  console.log(`\nCompletado: ${inserted} insertados, ${skipped} omitidos`);

  const total = await prisma.estudiante.count();
  console.log(`Total registros en la tabla: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
