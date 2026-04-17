/**
 * Seed script: carga Encuesta_docentes.xlsx y Encuesta_estudiante.xlsx en la BD.
 * Ejecutar con: npx tsx scripts/seed-encuestas.ts
 */
import "dotenv/config";
import * as XLSX from "xlsx";
import path from "path";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  normalizeRowKeys,
  extractPrograma,
  getByPrefix,
  toSentenceCase,
} from "../lib/normalize-text";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no configurado");

const adapter = new PrismaPg({ connectionString });
const prisma  = new PrismaClient({ adapter });

const DATA_DIR = path.join(process.cwd(), "Encuentrosdialogicos", "datos");

// ── DOCENTES ──────────────────────────────────────────────────────────────────
async function seedDocentes() {
  const wb   = XLSX.readFile(path.join(DATA_DIR, "Encuesta_docentes.xlsx"));
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: null });

  // Limpiar tabla antes de insertar
  const deleted = await prisma.encuestaDocente.deleteMany();
  console.log(`  Eliminados ${deleted.count} registros previos de docentes`);

  const toInsert = [];
  let omitidos = 0;

  for (const rawRow of rows) {
    const row = normalizeRowKeys(rawRow);

    const unidad_regional = String(row["unidad regional"] ?? "").trim();
    const facultad        = String(row["facultad"]        ?? "").trim();
    // Encuentro ya viene en mayúsculas en el archivo
    const encuentro = String(row["encuentro"] ?? "").trim().toUpperCase() || "PRIMER ENCUENTRO";
    // Año: todos son 2025 (PRIMER ENCUENTRO septiembre 2025)
    const anio = 2025;
    const programa = extractPrograma(row) || null;

    if (!unidad_regional || !facultad) { omitidos++; continue; }

    const norm = (v: unknown) =>
      v != null && String(v).trim() !== "" ? toSentenceCase(String(v).trim()) : null;

    const expRaw     = getByPrefix(row, "en una escala del 1 al 5");
    const profRaw    = getByPrefix(row, "consideras que la profundidad");
    const opinionRaw = getByPrefix(row, "consideras que la oportunidad");
    const claridadRaw = row["claridad en las respuestas a la comunidad estudiantil"];
    const convRaw    = row["convocatoria, publicidad y difusión del evento"];
    const orgRaw     = row["organización del evento"];
    const mecRaw     = row["mecanismos de participación"];
    const partRaw    = row["participación de la comunidad universitaria"];
    const canalesRaw = row["uso de canales digitales"];
    const mejoraRaw  = getByPrefix(row, "¿qué aspectos del evento");

    toInsert.push({
      unidad_regional:          toSentenceCase(unidad_regional),
      facultad:                 toSentenceCase(facultad),
      programa,
      encuentro,
      anio,
      experiencia:              expRaw != null ? Number(expRaw) || null : null,
      profundidad_temas:        norm(profRaw),
      oportunidad_opinion:      norm(opinionRaw),
      claridad_respuestas:      norm(claridadRaw),
      convocatoria:             norm(convRaw),
      organizacion:             norm(orgRaw),
      mecanismos_participacion: norm(mecRaw),
      participacion_comunidad:  norm(partRaw),
      uso_canales_digitales:    norm(canalesRaw),
      aspectos_mejora:          mejoraRaw != null && String(mejoraRaw).trim() !== "" ? String(mejoraRaw).trim() : null,
    });
  }

  await prisma.encuestaDocente.createMany({ data: toInsert });
  console.log(`  Insertados ${toInsert.length} docentes (omitidos: ${omitidos})`);
}

// ── ESTUDIANTES ───────────────────────────────────────────────────────────────
async function seedEstudiantes() {
  const wb   = XLSX.readFile(path.join(DATA_DIR, "Encuesta_estudiante.xlsx"));
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: null });

  const deleted = await prisma.encuestaEstudiante.deleteMany();
  console.log(`  Eliminados ${deleted.count} registros previos de estudiantes`);

  const toInsert = [];
  let omitidos = 0;

  for (const rawRow of rows) {
    const row = normalizeRowKeys(rawRow);

    const unidad_regional = String(row["unidad regional a la que pertenece"] ?? "").trim();
    // Programa ya viene directo en esta plantilla
    const programaRaw  = String(row["programa"] ?? "").trim();
    const programa     = programaRaw ? toSentenceCase(programaRaw) : "";
    const anio         = Number(row["año"] ?? 0);
    const numero_encuentro = String(row["nuero encuentro"] ?? "").trim().toUpperCase();

    if (!unidad_regional || !programa || !anio || !numero_encuentro) { omitidos++; continue; }

    const expRaw    = getByPrefix(row, "en una escala de 1 a 5 siendo 1 menos satisfecho");
    const profRaw   = getByPrefix(row, "¿cómo califica la profundidad");
    const retroRaw  = getByPrefix(row, "¿ha recibido retroalimentación");
    const seguimRaw = getByPrefix(row, "¿cómo califica el seguimiento");
    const mejoraRaw = getByPrefix(row, "¿qué aspectos considera que podrían mejorarse");
    const semestre  = row["semestre que cursa"] != null ? String(row["semestre que cursa"]).trim() : null;

    const norm = (v: unknown) =>
      v != null && String(v).trim() !== "" ? toSentenceCase(String(v).trim()) : null;

    toInsert.push({
      semestre:                semestre   ? toSentenceCase(semestre) : null,
      experiencia_general:     expRaw != null ? Number(expRaw) || null : null,
      profundidad_temas:       norm(profRaw),
      retroalimentacion:       norm(retroRaw),
      seguimiento_compromisos: norm(seguimRaw),
      aspectos_mejora:         mejoraRaw != null && String(mejoraRaw).trim() !== "" ? String(mejoraRaw).trim() : null,
      programa,
      anio,
      numero_encuentro,
      unidad_regional:         toSentenceCase(unidad_regional),
    });
  }

  await prisma.encuestaEstudiante.createMany({ data: toInsert });
  console.log(`  Insertados ${toInsert.length} estudiantes (omitidos: ${omitidos})`);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding encuestas docentes...");
  await seedDocentes();

  console.log("Seeding encuestas estudiantes...");
  await seedEstudiantes();

  console.log("Seed completado.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
