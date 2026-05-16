/**
 * Simula el endpoint POST /api/process-reports contra los 5 archivos de muestra
 * (admitidos, primíparos, graduados, inscritos, matriculados) y reporta:
 *  - filas crudas parseadas por cada archivo
 *  - warnings (programas/municipios no reconocidos, errores de parseo)
 *  - filas agregadas finales por categoría
 *  - chequeo de unique-key duplicada post-agregación
 *  - excepción capturada (si alguna)
 *
 * NO escribe en la BD ni genera el XLSX. Solo diagnóstico.
 *
 * Run: npx tsx scripts/test-upload-pipeline.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseMatriculados } from "../lib/parsers/parse-matriculados";
import { parseAdmitidos } from "../lib/parsers/parse-admitidos";
import { parsePrimiparos } from "../lib/parsers/parse-primiparos";
import { parseInscritos } from "../lib/parsers/parse-inscritos";
import { parseGraduados } from "../lib/parsers/parse-graduados";
import { aggregateStudents } from "../lib/aggregation/aggregate-students";
import { fileToCSV } from "../lib/parsers/read-file";
import { saveEstudiantes } from "../lib/supabase/save-estudiantes";
import { generateEstudiantesXlsx } from "../lib/export/generate-xlsx";
import { NormalizedStudentRow } from "../lib/types";

type ParseFn = (csv: string) => { rows: NormalizedStudentRow[]; warnings: string[] };

const FILES: Array<{ label: string; path: string; parser: ParseFn }> = [
  {
    label: "Admitidos",
    path: "Reporte_general__Admitidos_.csv",
    parser: parseAdmitidos,
  },
  {
    label: "Primíparos",
    path: "Reporte_general__Estudiantes_Primer_Curso_.csv",
    parser: parsePrimiparos,
  },
  {
    label: "Graduados",
    path: "Reporte_general__Graduados_.csv",
    parser: parseGraduados,
  },
  {
    label: "Inscritos",
    path: "Reporte_general__Inscrito_programa_.xlsx",
    parser: parseInscritos,
  },
  {
    label: "Matriculados",
    path: "Reporte_general__Matriculados_.csv",
    parser: parseMatriculados,
  },
];

function loadCSV(filePath: string): string {
  const abs = resolve(process.cwd(), filePath);
  const ext = filePath.toLowerCase().split(".").pop() ?? "";
  if (ext === "csv" || ext === "txt") {
    return readFileSync(abs, "utf-8");
  }
  const buffer = readFileSync(abs);
  // Pass an ArrayBuffer (node Buffer is also accepted by XLSX.read with type: "array")
  return fileToCSV(
    filePath,
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );
}

async function main() {
  const allRows: NormalizedStudentRow[] = [];

  console.log("=".repeat(72));
  console.log("TEST PIPELINE — sin escribir en BD");
  console.log("=".repeat(72));

  for (const f of FILES) {
    console.log(`\n→ ${f.label}  (${f.path})`);
    try {
      const csv = loadCSV(f.path);
      const result = f.parser(csv);
      allRows.push(...result.rows);
      console.log(`   ✅ filas parseadas: ${result.rows.length}`);
      if (result.warnings.length === 0) {
        console.log(`   sin warnings`);
      } else {
        console.log(`   ⚠️  warnings (${result.warnings.length}):`);
        for (const w of result.warnings.slice(0, 20)) {
          console.log(`      - ${w}`);
        }
        if (result.warnings.length > 20) {
          console.log(`      … (+${result.warnings.length - 20} más)`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
      console.log(`   ❌ EXCEPCIÓN: ${msg}`);
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log("AGREGACIÓN");
  console.log("=".repeat(72));

  let aggregated;
  try {
    aggregated = aggregateStudents(allRows);
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.log(`❌ EXCEPCIÓN en aggregateStudents: ${msg}`);
    return;
  }

  console.log(`Total filas crudas: ${allRows.length}`);
  console.log(`Total filas agregadas: ${aggregated.length}`);

  // Group counts per categoria
  const perCat = new Map<string, { rows: number; cantidad: number }>();
  for (const r of aggregated) {
    const v = perCat.get(r.categoria) ?? { rows: 0, cantidad: 0 };
    v.rows++;
    v.cantidad += r.cantidad;
    perCat.set(r.categoria, v);
  }
  console.log("\nPor categoría (post-agregación):");
  for (const [cat, v] of perCat) {
    console.log(`   ${cat.padEnd(15)} filas=${String(v.rows).padStart(5)}   cantidad=${v.cantidad}`);
  }

  // Sanity-check: any duplicate unique-key after aggregation? (should be 0)
  const seen = new Set<string>();
  let dups = 0;
  for (const r of aggregated) {
    const k = [r.categoria, r.unidadRegional, r.nivel, r.nivelAcademico, r.programaAcademico, r.año, r.periodo].join("|");
    if (seen.has(k)) {
      dups++;
      if (dups <= 5) console.log(`   ⚠️  duplicado unique-key: ${k}`);
    } else {
      seen.add(k);
    }
  }
  console.log(`\nDuplicados de unique-key tras agregación: ${dups}`);

  // Surface any rows with empty/null required fields that would break the upsert
  const broken = aggregated.filter((r) =>
    !r.categoria || !r.unidadRegional || !r.nivel || !r.nivelAcademico ||
    !r.programaAcademico || !r.año || !r.periodo || r.cantidad == null
  );
  console.log(`Filas con campos requeridos vacíos: ${broken.length}`);
  for (const b of broken.slice(0, 10)) {
    console.log(`   ${JSON.stringify(b)}`);
  }

  console.log("\n" + "=".repeat(72));
  console.log("XLSX GENERATION");
  console.log("=".repeat(72));
  try {
    const xlsx = generateEstudiantesXlsx(aggregated);
    console.log(`✅ XLSX generado: ${xlsx.length} bytes`);
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.log(`❌ EXCEPCIÓN en generateEstudiantesXlsx: ${msg}`);
  }

  if (process.argv.includes("--save")) {
    console.log("\n" + "=".repeat(72));
    console.log("SAVE TO DB (--save activado)");
    console.log("=".repeat(72));
    const t0 = Date.now();
    const allCats = new Set(aggregated.map((r) => r.categoria));
    const res = await saveEstudiantes(aggregated, allCats);
    const ms = Date.now() - t0;
    console.log(`Resultado: ${JSON.stringify(res)}   (${ms} ms)`);
  } else {
    console.log("\n(Para probar también el guardado: npx tsx scripts/test-upload-pipeline.ts --save)");
  }

  console.log("\n✅ Pipeline corrió sin lanzar excepciones.");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
