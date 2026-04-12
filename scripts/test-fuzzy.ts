/**
 * Test script to validate fuzzy matching with real data + simulated typos.
 * Run with: npx tsx scripts/test-fuzzy.ts
 */

import { fuzzyMatch } from "../lib/normalization/fuzzy-matcher";
import { CANONICAL_PROGRAMS, CANONICAL_UNIDADES } from "../lib/normalization/canonical-data";
import { normalizeProgram } from "../lib/normalization/program-normalizer";
import { mapMunicipio } from "../lib/normalization/municipio-mapper";

// =============================================
// TEST 1: All real variants from the CSVs
// =============================================
const realProgramVariants = [
  "ADMINISTRACION DE EMPRESAS",
  "Administración de Empresas",
  "CONTADURIA PUBLICA",
  "CONTADURIA PÚBLICA",
  "Contaduría Pública",
  "DOCTORADO EN CIENCIAS DE LA EDUCACIÓN",
  "ENFERMERIA",
  "ESPECIALIZACION EN EDUCACION AMBIENTAL Y DESARROLLO DE LA COMUNIDAD",
  "ESPECIALIZACIÓN EN AGROECOLOGÍA Y DESARROLLO AGROECOTURÍSTICO",
  "ESPECIALIZACIÓN EN AGRONEGOCIOS SOSTENIBLES",
  "ESPECIALIZACIÓN EN ANALÍTICA APLICADA A NEGOCIOS",
  "ESPECIALIZACIÓN EN ANALÍTICA Y CIENCIA DE DATOS",
  "ESPECIALIZACIÓN EN GERENCIA PARA LA TRANSFORMACIÓN DIGITAL",
  "ESPECIALIZACIÓN EN GESTIÓN PÚBLICA",
  "ESPECIALIZACIÓN EN INTELIGENCIA ARTIFICIAL",
  "ESPECIALIZACIÓN EN MARKETING DIGITAL",
  "ESPECIALIZACIÓN EN METODOLOGÍAS DE CALIDAD PARA EL DESARROLLO DEL SOFTWARE",
  "Especialización en Deporte Escolar  ",
  "Especialización en Gerencia Financiera y Contable",
  "Especialización en Infraestructura y Seguridad de Redes",
  "INGENIERIA AGRONOMICA",
  "INGENIERIA DE SISTEMAS Y COMPUTACION",
  "INGENIERIA DE SISTEMAS Y COMPUTACIÓN",
  "INGENIERIA DE SISTEMAS",
  "INGENIERIA ELECTRONICA",
  "INGENIERIA INDUSTRIAL",
  "INGENIERÍA AMBIENTAL",
  "INGENIERÍA DE SISTEMAS Y COMPUTACIÓN",
  "INGENIERÍA DE SISTEMAS",
  "INGENIERÍA DE SOFTWARE",
  "Ingeniería Mecatrónica",
  "Ingeniería Topográfica y Geomática ",
  "Ingeniería de Software",
  "LICENCIATURA EN CIENCIAS SOCIALES",
  "LICENCIATURA EN EDUCACION BASICA CON ENFASIS EN CIENCIAS SOCIALES",
  "LICENCIATURA EN MATEMATICAS",
  "Licenciatura en Educación Física, Recreación y Deportes ",
  "MAESTRÍA EN CIENCIAS AGRARÍAS CON ÉNFASIS EN HORTIFRUTICULTURA",
  "MUSICA",
  "Medicina Veterinaria y Zootecnia ",
  "PROFESIONAL EN CIENCIAS DEL DEPORTE",
  "PSICOLOGÍA",
  "TECNOLOGÍA EN DESARROLLO DE SOFTWARE",
  "ZOOTECNIA",
  // Graduados variants
  "ESPECIALIZACION EN GERENCIA PARA EL DESARROLLO ORGANIZACIONAL",
  "ESPECIALIZACIÓN EN GESTIÓN DE SISTEMAS DE INFORMACIÓN GERENCIAL.",
  "LICENCIATURA EN EDUCACION BASICA CON ENFASIS EN EDUCACION FISICA,RECREACION Y DEPORTES",
  "MAESTRÍA EN CIENCIAS AMBIENTALES",
  "MAESTRÍA EN EDUCACIÓN",
  "TECNOLOGÍA EN GESTIÓN TURÍSTICA Y HOTELERA",
];

// =============================================
// TEST 2: Simulated typos/corruptions for future semesters
// =============================================
const simulatedTypos = [
  // Typos in program names
  { input: "INGENEIRIA DE SISTEMAS", expected: "Ingeniería de Sistemas" },
  { input: "INGENIERIA DE SITEMAS Y COMPUTACION", expected: "Ingeniería de Sistemas y Computación" },
  { input: "CONTADURIA PUBLCA", expected: "Contaduría Pública" },
  { input: "CONTADRIA PUBLICA", expected: "Contaduría Pública" },
  { input: "ADMINSITRACION DE EMPRESAS", expected: "Administración de Empresas" },
  { input: "ADMINISTRACION DE EMPRSAS", expected: "Administración de Empresas" },
  { input: "PSICOLOGIA", expected: "Psicología" },
  { input: "PSICOLGIA", expected: "Psicología" },
  { input: "ENFERMRIA", expected: "Enfermería" },
  { input: "ENFERMERAI", expected: "Enfermería" },
  { input: "ZOOTECNAI", expected: "Zootecnia" },
  { input: "MUSCA", expected: "Música" },
  { input: "MEDICINA VETRINARIA Y ZOOTECNIA", expected: "Medicina Veterinaria y Zootecnia" },
  { input: "INGENIERIA AMBIETAL", expected: "Ingeniería Ambiental" },
  { input: "INGENIERÍA ELECTRONICA", expected: "Ingeniería Electrónica" },
  { input: "LICENCIATURA EN MATMATICAS", expected: "Licenciatura en Matemáticas" },
  { input: "ESPECIALIZACION EN INTELIGENCIA ARTFICIAL", expected: "Especialización en Inteligencia Artificial" },
  { input: "MAESTRIA EN CIENCIAS AGRARIAS CON ENFASIS EN HORTIFRUTICULTURA", expected: "Maestría en Ciencias Agrarias con Énfasis en Hortifruticultura" },
  { input: "TECNOLOGIA EN DESAROLLO DE SOFTWARE", expected: "Tecnología en Desarrollo de Software" },
  { input: "ingenieria de software", expected: "Ingeniería de Software" },
  { input: "  INGENIERÍA   DE   SISTEMAS  ", expected: "Ingeniería de Sistemas" },
  // Encoding issues
  { input: "INGENIER\u00CDA DE SISTEMAS", expected: "Ingeniería de Sistemas" },
  { input: "CONTADUR\u00CDA P\u00DABLICA", expected: "Contaduría Pública" },
];

// =============================================
// TEST 3: Municipio matching
// =============================================
const municipioTests = [
  { input: "Chía", expected: "Chía" },
  { input: "CHIA", expected: "Chía" },
  { input: "chia", expected: "Chía" },
  { input: "Facatativá", expected: "Facatativá" },
  { input: "FACATATIVA", expected: "Facatativá" },
  { input: "Fusagasugá", expected: "Fusagasugá" },
  { input: "FUSAGASUGA", expected: "Fusagasugá" },
  { input: "Girardot", expected: "Girardot" },
  { input: "GIRARDOT", expected: "Girardot" },
  { input: "Soacha", expected: "Soacha" },
  { input: "SOACHA", expected: "Soacha" },
  { input: "Villa de San Diego de Ubaté", expected: "Ubaté" },
  { input: "VILLA DE SAN DIEGO DE UBATE", expected: "Ubaté" },
  { input: "Zipaquirá", expected: "Zipaquirá" },
  { input: "ZIPAQUIRA", expected: "Zipaquirá" },
  // Typos
  { input: "Facatatva", expected: "Facatativá" },
  { input: "Fusagasga", expected: "Fusagasugá" },
  { input: "Zipaquir", expected: "Zipaquirá" },
];

// =============================================
// RUN TESTS
// =============================================

console.log("=== TEST 1: Real CSV variants ===\n");
let realPass = 0;
let realFail = 0;
for (const variant of realProgramVariants) {
  const result = normalizeProgram(variant);
  if (result.matched) {
    realPass++;
  } else {
    realFail++;
    console.log(`  FAIL: "${variant}" → no match (score: ${result.score.toFixed(3)})`);
  }
}
console.log(`  Results: ${realPass}/${realProgramVariants.length} matched\n`);

console.log("=== TEST 2: Simulated typos ===\n");
let typoPass = 0;
let typoFail = 0;
for (const { input, expected } of simulatedTypos) {
  const result = normalizeProgram(input);
  const correct = result.name === expected;
  if (correct && result.matched) {
    typoPass++;
  } else {
    typoFail++;
    console.log(`  FAIL: "${input}"`);
    console.log(`    Expected: "${expected}"`);
    console.log(`    Got:      "${result.name}" (score: ${result.score.toFixed(3)}, matched: ${result.matched})`);
  }
}
console.log(`  Results: ${typoPass}/${simulatedTypos.length} correct\n`);

console.log("=== TEST 3: Municipio matching ===\n");
let muniPass = 0;
let muniFail = 0;
for (const { input, expected } of municipioTests) {
  const result = mapMunicipio(input);
  const correct = result.unidadRegional === expected;
  if (correct && result.matched) {
    muniPass++;
  } else {
    muniFail++;
    console.log(`  FAIL: "${input}"`);
    console.log(`    Expected: "${expected}"`);
    console.log(`    Got:      "${result.unidadRegional}" (score: ${result.score.toFixed(3)}, matched: ${result.matched})`);
  }
}
console.log(`  Results: ${muniPass}/${municipioTests.length} correct\n`);

// Summary
console.log("=== SUMMARY ===");
console.log(`  Real variants: ${realPass}/${realProgramVariants.length}`);
console.log(`  Simulated typos: ${typoPass}/${simulatedTypos.length}`);
console.log(`  Municipios: ${muniPass}/${municipioTests.length}`);
const totalTests = realProgramVariants.length + simulatedTypos.length + municipioTests.length;
const totalPass = realPass + typoPass + muniPass;
console.log(`  TOTAL: ${totalPass}/${totalTests} (${((totalPass / totalTests) * 100).toFixed(1)}%)`);

if (realFail + typoFail + muniFail > 0) {
  process.exit(1);
}
