// Only the CORRECT canonical names. The fuzzy matcher handles all variants.
export const CANONICAL_PROGRAMS: string[] = [
  "Administración de Empresas",
  "Contaduría Pública",
  "Doctorado en Ciencias de la Educación",
  "Enfermería",
  "Especialización en Educación Ambiental y Desarrollo de la Comunidad",
  "Especialización en Agroecología y Desarrollo Agroecoturístico",
  "Especialización en Agronegocios Sostenibles",
  "Especialización en Analítica Aplicada a Negocios",
  "Especialización en Analítica y Ciencia de Datos",
  "Especialización en Gerencia para la Transformación Digital",
  "Especialización en Gestión Pública",
  "Especialización en Inteligencia Artificial",
  "Especialización en Marketing Digital",
  "Especialización en Metodologías de Calidad para el Desarrollo del Software",
  "Especialización en Deporte Escolar",
  "Especialización en Gerencia Financiera y Contable",
  "Especialización en Infraestructura y Seguridad de Redes",
  "Ingeniería Agronómica",
  "Ingeniería de Sistemas y Computación",
  "Ingeniería de Sistemas",
  "Ingeniería Electrónica",
  "Ingeniería Industrial",
  "Ingeniería Ambiental",
  "Ingeniería de Software",
  "Ingeniería Mecatrónica",
  "Ingeniería Topográfica y Geomática",
  "Licenciatura en Ciencias Sociales",
  "Licenciatura en Educación Básica con Énfasis en Ciencias Sociales",
  "Licenciatura en Matemáticas",
  "Licenciatura en Educación Física, Recreación y Deportes",
  "Maestría en Ciencias Agrarias con Énfasis en Hortifruticultura",
  "Música",
  "Medicina Veterinaria y Zootecnia",
  "Profesional en Ciencias del Deporte",
  "Psicología",
  "Tecnología en Desarrollo de Software",
  "Tecnología en Gestión Turística y Hotelera",
  "Zootecnia",
  "Especialización en Gerencia para el Desarrollo Organizacional",
  "Especialización en Gestión de Sistemas de Información Gerencial",
  "Licenciatura en Educación Básica con Énfasis en Educación Física, Recreación y Deportes",
  "Maestría en Ciencias Ambientales",
  "Maestría en Educación",
];

// Only the CORRECT canonical unidad regional names
export const CANONICAL_UNIDADES: string[] = [
  "Chía",
  "Facatativá",
  "Fusagasugá",
  "Girardot",
  "Soacha",
  "Ubaté",
  "Zipaquirá",
];

// Known long-form aliases that should map to a shorter canonical name
// This handles "Villa de San Diego de Ubaté" → "Ubaté" which fuzzy alone can't resolve
export const UNIDAD_ALIASES: Record<string, string> = {
  "VILLA DE SAN DIEGO DE UBATE": "Ubaté",
};

// Rules to resolve Nivel and Nivel Académico from program name
export const NIVEL_ACADEMICO_RULES: Array<{
  pattern: RegExp;
  nivel: string;
  nivelAcademico: string;
}> = [
  { pattern: /^DOCTORADO/i, nivel: "Posgrado", nivelAcademico: "Doctorado" },
  { pattern: /^MAESTR[IÍ]A/i, nivel: "Posgrado", nivelAcademico: "Maestría" },
  { pattern: /^ESPECIALIZACI[OÓ]N/i, nivel: "Posgrado", nivelAcademico: "Especialización" },
  { pattern: /^TECNOLOG[IÍ]A/i, nivel: "Tecnología", nivelAcademico: "Tecnología" },
];

export const DEFAULT_NIVEL = "Pregrado";
export const DEFAULT_NIVEL_ACADEMICO = "Profesional universitario";

// Semestre → Periodo mapping
export function semestreToPeriodo(semestre: number | string): string {
  const num = typeof semestre === "string" ? parseInt(semestre, 10) : semestre;
  if (num === 1) return "IPA";
  if (num === 2) return "IIPA";
  return String(semestre);
}
