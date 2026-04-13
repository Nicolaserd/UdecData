/**
 * Script to load ESTUDIANTES.xlsx historical data into Supabase via Prisma.
 * Normalizes programa, unidad regional, and nivel using the fuzzy matcher.
 *
 * Run with: npx tsx scripts/seed-historico.ts
 * To force re-seed: npx tsx scripts/seed-historico.ts --force
 */

import "dotenv/config";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizeProgram } from "../lib/normalization/program-normalizer";
import { mapMunicipio } from "../lib/normalization/municipio-mapper";
import { resolveNivel } from "../lib/normalization/nivel-resolver";

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
  const force = process.argv.includes("--force");
  const filePath = path.join(__dirname, "..", "data", "ESTUDIANTES.xlsx");

  if (!fs.existsSync(filePath)) {
    console.error("No se encontró data/ESTUDIANTES.xlsx");
    process.exit(1);
  }

  const count = await prisma.estudiante.count();
  if (count > 0 && !force) {
    console.log(`La tabla ya tiene ${count} registros. Usa --force para re-seedear.`);
    return;
  }

  if (count > 0 && force) {
    console.log(`Eliminando ${count} registros existentes...`);
    await prisma.estudiante.deleteMany({});
  }

  console.log("Leyendo ESTUDIANTES.xlsx...");
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json<EstudiantesRaw>(sheet);

  console.log(`Encontradas ${rawData.length} filas. Normalizando y cargando...`);

  let inserted = 0;
  let skipped = 0;
  const unmatchedPrograms = new Set<string>();
  const batchSize = 500;

  for (let i = 0; i < rawData.length; i += batchSize) {
    const batch = rawData.slice(i, i + batchSize);

    for (const row of batch) {
      const categoria = String(row["Categoría"] || "").trim();
      const unidadRaw = String(row["Unidad regional"] || "").trim();
      const programaRaw = String(row["Programa académico"] || "").trim();
      const cantidad = Number(row["Cantidad"]) || 0;
      const anio = Number(row["Año"]);
      const periodo = String(row["Periodo"] || "").trim();

      if (!categoria || !programaRaw || !anio || !periodo) {
        skipped++;
        continue;
      }

      // Normalize program through fuzzy matcher
      const { name: programa, matched: progMatched } = normalizeProgram(programaRaw);
      if (!progMatched) unmatchedPrograms.add(programaRaw);

      // Normalize unidad regional
      const { unidadRegional } = mapMunicipio(unidadRaw);

      // Resolve nivel from program name
      const { nivel, nivelAcademico } = resolveNivel(programaRaw);

      try {
        await prisma.estudiante.upsert({
          where: {
            categoria_unidad_regional_nivel_nivel_academico_programa_academico_anio_periodo: {
              categoria,
              unidad_regional: unidadRegional,
              nivel,
              nivel_academico: nivelAcademico,
              programa_academico: programa,
              anio,
              periodo,
            },
          },
          update: { cantidad: { increment: cantidad } },
          create: {
            categoria,
            unidad_regional: unidadRegional,
            nivel,
            nivel_academico: nivelAcademico,
            programa_academico: programa,
            cantidad,
            anio,
            periodo,
          },
        });
        inserted++;
      } catch (e) {
        skipped++;
        if (skipped <= 5) {
          console.warn(`  Skip: ${programaRaw} - ${e}`);
        }
      }
    }

    console.log(`  Procesadas ${Math.min(i + batchSize, rawData.length)}/${rawData.length} filas`);
  }

  if (unmatchedPrograms.size > 0) {
    console.log(`\nProgramas no reconocidos (${unmatchedPrograms.size}):`);
    for (const p of unmatchedPrograms) console.log(`  - ${p}`);
  }

  console.log(`\nCompletado: ${inserted} insertados, ${skipped} omitidos`);

  const total = await prisma.estudiante.count();
  console.log(`Total registros en la tabla: ${total}`);

  // Show final programs
  const progs = await prisma.estudiante.groupBy({
    by: ["programa_academico"],
    _count: { id: true },
    orderBy: { programa_academico: "asc" },
  });
  console.log(`\nProgramas únicos: ${progs.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
