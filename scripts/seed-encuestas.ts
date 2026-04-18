/**
 * Seed script: carga encuestas_docentes.xlsx y encuestas_estudiantes.xlsx en la BD.
 * Ejecutar con: npx tsx scripts/seed-encuestas.ts
 */
import "dotenv/config";
import * as XLSX from "xlsx";
import path from "path";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no configurado");

const adapter = new PrismaPg({ connectionString });
const prisma  = new PrismaClient({ adapter });

const str       = (v: unknown): string => (v != null && String(v).trim() !== "" ? String(v).trim() : "");
const strOrNull = (v: unknown): string | null => (v != null && String(v).trim() !== "" ? String(v).trim() : null);
const numOrNull = (v: unknown): number | null => {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

// Normaliza una clave: minúsculas, sin tildes, NBSP → espacio
function normKey(s: string): string {
  return s
    .replace(/\u00A0/g, " ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase();
}

// Construye mapa con claves normalizadas
function normRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[normKey(k)] = v;
  return out;
}

// Busca la primera clave que empiece con el prefijo dado
function byPrefix(row: Record<string, unknown>, prefix: string): unknown {
  const p = normKey(prefix);
  for (const [k, v] of Object.entries(row)) if (k.startsWith(p)) return v;
  return undefined;
}

const FACULTAD_COLS = [
  "Facultad de Ciencias Administrativas, Economicas y Contables",
  "Facultad de Ciencias Agropecuarias",
  "Facultad de Ciencias del Deporte y la Educacion Fisica",
  "Facultad de Educacion",
  "Facultad de Ingenieria",
  "Facultad de Ciencias de la Salud",
  "Facultad de Ciencias Sociales, Humanidades y Ciencias Politicas",
  "Posgrados",
  "Instituto de Posgrados",
  "Doctorado", "Maestrias", "Especializaciones",
];

function extractPrograma(row: Record<string, unknown>): string | null {
  const facultad = str(row["facultad"]);
  // Intentar con la sub-columna que coincida con la facultad
  const byFacultad = row[normKey(facultad)];
  if (byFacultad != null && String(byFacultad).trim() !== "") return String(byFacultad).trim();
  // Fallback: primera sub-columna con valor
  for (const col of FACULTAD_COLS) {
    const val = row[normKey(col)];
    if (val != null && String(val).trim() !== "") return String(val).trim();
  }
  return null;
}

// ── DOCENTES ──────────────────────────────────────────────────────────────────
async function seedDocentes() {
  const wb   = XLSX.readFile(path.join(process.cwd(), "encuestas_docentes.xlsx"));
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets[wb.SheetNames[0]],
    { defval: null }
  );

  const deleted = await prisma.encuestaDocente.deleteMany();
  console.log(`  Eliminados ${deleted.count} registros previos de docentes`);

  const toInsert = rows.map((rawRow) => {
    const row = normRow(rawRow);
    return {
      unidad_regional:          str(row["unidad regional"]),
      facultad:                 str(row["facultad"]),
      programa:                 extractPrograma(row),
      encuentro:                str(row["encuentro"]) || "PRIMER ENCUENTRO",
      anio:                     2025,
      experiencia:              numOrNull(byPrefix(row, "en una escala del 1 al 5")),
      profundidad_temas:        strOrNull(byPrefix(row, "consideras que la profundidad")),
      oportunidad_opinion:      strOrNull(byPrefix(row, "consideras que la oportunidad")),
      claridad_respuestas:      strOrNull(row["claridad en las respuestas a la comunidad estudiantil"]),
      convocatoria:             strOrNull(row["convocatoria, publicidad y difusion del evento"]),
      organizacion:             strOrNull(row["organizacion del evento"]),
      mecanismos_participacion: strOrNull(row["mecanismos de participacion"]),
      participacion_comunidad:  strOrNull(row["participacion de la comunidad universitaria"]),
      uso_canales_digitales:    strOrNull(row["uso de canales digitales"]),
      aspectos_mejora:          strOrNull(byPrefix(row, "¿que aspectos del evento")),
    };
  });

  await prisma.encuestaDocente.createMany({ data: toInsert });
  console.log(`  Insertados ${toInsert.length} docentes`);
}

// ── ESTUDIANTES ───────────────────────────────────────────────────────────────
async function seedEstudiantes() {
  const wb   = XLSX.readFile(path.join(process.cwd(), "encuentros", "encuestas_estudiantes.xlsx"));
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets["Encuestas Estudiantes"],
    { defval: null }
  );

  const deleted = await prisma.encuestaEstudiante.deleteMany();
  console.log(`  Eliminados ${deleted.count} registros previos de estudiantes`);

  const toInsert = rows.map((row) => ({
    semestre:                strOrNull(row["Semestre que cursa"]),
    experiencia_general:     numOrNull(row["En una escala de 1 a 5 siendo 1 menos satisfecho, ¿ Cómo califica su experiencia general en el Encuentro Dialógico y Formativo?"]),
    profundidad_temas:       strOrNull(row["¿Cómo califica la profundidad con la que se abordaron los temas tratados durante el Encuentro?"]),
    retroalimentacion:       strOrNull(row["¿Ha recibido retroalimentación sobre los compromisos o acuerdos establecidos en el Encuentro?"]),
    seguimiento_compromisos: strOrNull(row["¿Cómo califica el seguimiento de los compromisos establecidos después del Encuentro?"]),
    aspectos_mejora:         strOrNull(row["¿Qué aspectos considera que podrían mejorarse para futuros Encuentros Dialógicos y Formativos?"]),
    programa:                str(row["Programa"]),
    anio:                    numOrNull(row["año"]) ?? 2025,
    numero_encuentro:        str(row["Nuero Encuentro"]),
    unidad_regional:         str(row["Unidad regional a la que pertenece"]),
  }));

  await prisma.encuestaEstudiante.createMany({ data: toInsert });
  console.log(`  Insertados ${toInsert.length} estudiantes`);
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
