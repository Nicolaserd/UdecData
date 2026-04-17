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

const DATA_DIR = path.join(process.cwd(), "encuentros");

const str       = (v: unknown): string => (v != null && String(v).trim() !== "" ? String(v).trim() : "");
const strOrNull = (v: unknown): string | null => (v != null && String(v).trim() !== "" ? String(v).trim() : null);
const numOrNull = (v: unknown): number | null => {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

const FACULTAD_COLS = [
  "Facultad de Ciencias Administrativas, Económicas y Contables",
  "Facultad de Ciencias Agropecuarias",
  "Facultad de Ciencias del Deporte y la Educación Física",
  "Facultad de Educación",
  "Facultad de Ingeniería",
  "Facultad de Ciencias de la Salud",
  "Facultad de Ciencias Sociales, Humanidades y Ciencias Políticas",
  "Posgrados",
];

// Extrae el programa buscando en la sub-columna que coincida con la facultad del registro
function extractPrograma(row: Record<string, unknown>): string | null {
  const facultad = str(row["Facultad"]);
  // Intentar con la columna que coincide con la facultad
  if (facultad && row[facultad] != null && String(row[facultad]).trim() !== "") {
    return String(row[facultad]).trim();
  }
  // Fallback: buscar cualquier sub-columna de facultad con valor
  for (const col of FACULTAD_COLS) {
    if (row[col] != null && String(row[col]).trim() !== "") {
      return String(row[col]).trim();
    }
  }
  return null;
}

// Extrae el año desde el string de fecha: "miércoles, 3 de septiembre de 2025" → 2025
function extractAnio(fecha: unknown): number {
  if (fecha == null) return 2025;
  const match = String(fecha).match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1]) : 2025;
}

// ── DOCENTES ──────────────────────────────────────────────────────────────────
async function seedDocentes() {
  const wb   = XLSX.readFile(path.join(DATA_DIR, "encuestas_docentes.xlsx"));
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets["Encuestas Docentes"],
    { defval: null }
  );

  const deleted = await prisma.encuestaDocente.deleteMany();
  console.log(`  Eliminados ${deleted.count} registros previos de docentes`);

  const toInsert = rows.map((row) => ({
    unidad_regional:          str(row["Unidad Regional"]),
    facultad:                 str(row["Facultad"]),
    programa:                 extractPrograma(row),
    encuentro:                str(row["Encuentro"]) || "PRIMER ENCUENTRO",
    anio:                     2025,
    experiencia:              numOrNull(row["En una escala del 1 al 5, ¿Cómo calificarías tu experiencia en el Encuentro Dialógico y Formativo?"]),
    profundidad_temas:        strOrNull(row["Consideras que la profundidad con la cual se abarcaron los temas tratados en el ejercicio del Encuentro Dialógico y Formativo, fueron discutidos de manera:"]),
    oportunidad_opinion:      strOrNull(row["Consideras que la oportunidad dada a los asistentes inscritos para opinar durante el ejercicio del Encuentro Dialógico y Formativo fue"]),
    claridad_respuestas:      strOrNull(row["Claridad en las respuestas a la comunidad estudiantil"]),
    convocatoria:             strOrNull(row["Convocatoria, publicidad y difusión del evento"]),
    organizacion:             strOrNull(row["Organización del evento"]),
    mecanismos_participacion: strOrNull(row["Mecanismos de participación"]),
    participacion_comunidad:  strOrNull(row["Participación de la comunidad Universitaria"]),
    uso_canales_digitales:    strOrNull(row["Uso de canales digitales"]),
    aspectos_mejora:          strOrNull(row["¿Qué aspectos del evento crees que podrían mejorarse para futuros encuentros? Recuerda que tu opinión es parte de la mejora."]),
  }));

  await prisma.encuestaDocente.createMany({ data: toInsert });
  console.log(`  Insertados ${toInsert.length} docentes`);
}

// ── ESTUDIANTES ───────────────────────────────────────────────────────────────
async function seedEstudiantes() {
  const wb   = XLSX.readFile(path.join(DATA_DIR, "encuestas_estudiantes.xlsx"));
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
