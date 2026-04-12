/**
 * Test script for fuzzy matching.
 * Run with: npx tsx test-fuzzy.ts
 *
 * Tests:
 * 1. All real variants from the actual data files
 * 2. Simulated typos (missing letters, swapped letters, encoding garbage)
 * 3. Edge cases (extra spaces, mixed case, partial names)
 * 4. Municipio matching including "Villa de San Diego de Ubaté"
 */

import { normalizeProgram } from "./lib/normalization/program-normalizer";
import { mapMunicipio } from "./lib/normalization/municipio-mapper";

let passed = 0;
let failed = 0;

function test(
  description: string,
  input: string,
  expected: string,
  matchFn: (s: string) => { name?: string; unidadRegional?: string; matched: boolean; score: number }
) {
  const result = matchFn(input);
  const actual = result.name || result.unidadRegional || "";
  const ok = actual === expected && result.matched;

  if (ok) {
    passed++;
  } else {
    failed++;
    console.log(`FAIL: ${description}`);
    console.log(`  Input:    "${input}"`);
    console.log(`  Expected: "${expected}"`);
    console.log(`  Got:      "${actual}" (matched=${result.matched}, score=${result.score.toFixed(3)})`);
  }
}

function testProg(desc: string, input: string, expected: string) {
  test(desc, input, expected, (s) => {
    const r = normalizeProgram(s);
    return { name: r.name, matched: r.matched, score: r.score };
  });
}

function testMuni(desc: string, input: string, expected: string) {
  test(desc, input, expected, (s) => {
    const r = mapMunicipio(s);
    return { unidadRegional: r.unidadRegional, matched: r.matched, score: r.score };
  });
}

console.log("=== PROGRAM NORMALIZATION TESTS ===\n");

// --- GROUP 1: REAL VARIANTS FROM THE DATA FILES ---
console.log("--- Real variants from data files ---");

testProg("Exact uppercase no accents", "ADMINISTRACION DE EMPRESAS", "Administración de Empresas");
testProg("Title case with accents", "Administración de Empresas", "Administración de Empresas");
testProg("Upper no accent", "CONTADURIA PUBLICA", "Contaduría Pública");
testProg("Upper partial accent", "CONTADURIA PÚBLICA", "Contaduría Pública");
testProg("Title case accented", "Contaduría Pública", "Contaduría Pública");
testProg("Upper with accents", "DOCTORADO EN CIENCIAS DE LA EDUCACIÓN", "Doctorado en Ciencias de la Educación");
testProg("Upper no accent", "ENFERMERIA", "Enfermería");
testProg("Upper long name no accent", "ESPECIALIZACION EN EDUCACION AMBIENTAL Y DESARROLLO DE LA COMUNIDAD", "Especialización en Educación Ambiental y Desarrollo de la Comunidad");
testProg("Upper with accents", "ESPECIALIZACIÓN EN AGROECOLOGÍA Y DESARROLLO AGROECOTURÍSTICO", "Especialización en Agroecología y Desarrollo Agroecoturístico");
testProg("Upper with accents", "ESPECIALIZACIÓN EN ANALÍTICA APLICADA A NEGOCIOS", "Especialización en Analítica Aplicada a Negocios");
testProg("Upper with accents", "ESPECIALIZACIÓN EN GERENCIA PARA LA TRANSFORMACIÓN DIGITAL", "Especialización en Gerencia para la Transformación Digital");
testProg("Upper with accents", "ESPECIALIZACIÓN EN GESTIÓN PÚBLICA", "Especialización en Gestión Pública");
testProg("Upper with accents", "ESPECIALIZACIÓN EN INTELIGENCIA ARTIFICIAL", "Especialización en Inteligencia Artificial");
testProg("Upper with accents", "ESPECIALIZACIÓN EN MARKETING DIGITAL", "Especialización en Marketing Digital");
testProg("Title case with trailing spaces", "Especialización en Deporte Escolar  ", "Especialización en Deporte Escolar");
testProg("Title case", "Especialización en Gerencia Financiera y Contable", "Especialización en Gerencia Financiera y Contable");
testProg("Title case", "Especialización en Infraestructura y Seguridad de Redes", "Especialización en Infraestructura y Seguridad de Redes");
testProg("Upper no accent", "INGENIERIA AGRONOMICA", "Ingeniería Agronómica");
testProg("Upper partial accent", "INGENIERIA DE SISTEMAS Y COMPUTACION", "Ingeniería de Sistemas y Computación");
testProg("Upper with accent", "INGENIERIA DE SISTEMAS Y COMPUTACIÓN", "Ingeniería de Sistemas y Computación");
testProg("Upper full accents", "INGENIERÍA DE SISTEMAS Y COMPUTACIÓN", "Ingeniería de Sistemas y Computación");
testProg("Upper no accent short", "INGENIERIA DE SISTEMAS", "Ingeniería de Sistemas");
testProg("Upper with accent short", "INGENIERÍA DE SISTEMAS", "Ingeniería de Sistemas");
testProg("Upper no accent", "INGENIERIA ELECTRONICA", "Ingeniería Electrónica");
testProg("Upper no accent", "INGENIERIA INDUSTRIAL", "Ingeniería Industrial");
testProg("Upper with accent", "INGENIERÍA AMBIENTAL", "Ingeniería Ambiental");
testProg("Upper with accent", "INGENIERÍA DE SOFTWARE", "Ingeniería de Software");
testProg("Title case with accent", "Ingeniería de Software", "Ingeniería de Software");
testProg("Title case", "Ingeniería Mecatrónica", "Ingeniería Mecatrónica");
testProg("Title case trailing space", "Ingeniería Topográfica y Geomática ", "Ingeniería Topográfica y Geomática");
testProg("Upper", "LICENCIATURA EN CIENCIAS SOCIALES", "Licenciatura en Ciencias Sociales");
testProg("Upper no accent", "LICENCIATURA EN EDUCACION BASICA CON ENFASIS EN CIENCIAS SOCIALES", "Licenciatura en Educación Básica con Énfasis en Ciencias Sociales");
testProg("Upper no accent", "LICENCIATURA EN MATEMATICAS", "Licenciatura en Matemáticas");
testProg("Title case trailing space", "Licenciatura en Educación Física, Recreación y Deportes ", "Licenciatura en Educación Física, Recreación y Deportes");
testProg("Upper with accents", "MAESTRÍA EN CIENCIAS AGRARÍAS CON ÉNFASIS EN HORTIFRUTICULTURA", "Maestría en Ciencias Agrarias con Énfasis en Hortifruticultura");
testProg("Upper no accent", "MUSICA", "Música");
testProg("Title case trailing space", "Medicina Veterinaria y Zootecnia ", "Medicina Veterinaria y Zootecnia");
testProg("Upper", "PROFESIONAL EN CIENCIAS DEL DEPORTE", "Profesional en Ciencias del Deporte");
testProg("Upper with accent", "PSICOLOGÍA", "Psicología");
testProg("Upper with accent", "TECNOLOGÍA EN DESARROLLO DE SOFTWARE", "Tecnología en Desarrollo de Software");
testProg("Upper", "ZOOTECNIA", "Zootecnia");

// --- GROUP 2: SIMULATED TYPOS (future semesters) ---
console.log("\n--- Simulated typos / future semester variants ---");

testProg("Missing letter", "INGENERIA DE SISTEMAS", "Ingeniería de Sistemas");
testProg("Missing letter #2", "INGENIRIA DE SISTEMAS", "Ingeniería de Sistemas");
testProg("Swapped letters", "INGENIERIA DE SITEMAS", "Ingeniería de Sistemas");
testProg("Double letter", "INGENIERIIA DE SISTEMAS", "Ingeniería de Sistemas");
testProg("Typo in contaduria", "CONTADURIA PUBLCA", "Contaduría Pública");
testProg("Typo in administracion", "ADMINSTRACION DE EMPRESAS", "Administración de Empresas");
testProg("Garbled accent", "ADMINISTRACI\u00d3N DE EMPRESAS", "Administración de Empresas");
testProg("Missing space", "INGENIERIAINDUSTRIAL", "Ingeniería Industrial");
testProg("Extra space", "INGENIERIA  DE  SISTEMAS", "Ingeniería de Sistemas");
testProg("Typo enfermeria", "ENFREMERIA", "Enfermería");
testProg("Truncated", "ESPECIALIZACION EN INTELIGENCIA ARTIF", "Especialización en Inteligencia Artificial");
testProg("Typo psicologia", "PSICLOGIA", "Psicología");
testProg("Typo zootecnia", "ZOTECNIA", "Zootecnia");
testProg("Typo musica", "MUISCA", "Música");
testProg("Lowercase everything", "ingenieria ambiental", "Ingeniería Ambiental");
testProg("Mixed weird case", "iNgEnIeRiA dE sOfTwArE", "Ingeniería de Software");
testProg("Typo licenciatura", "LICENCITURA EN MATEMATICAS", "Licenciatura en Matemáticas");
testProg("Typo maestria", "MAESTRIA EN CIENCIAS AGRARIAS CON ENFASIS EN HORTIFRUTICULTURA", "Maestría en Ciencias Agrarias con Énfasis en Hortifruticultura");
testProg("Encoding issue simulation", "INGENIER\u00cdA ELECTR\u00d3NICA", "Ingeniería Electrónica");

// --- GROUP 3: MUNICIPIO TESTS ---
console.log("\n=== MUNICIPIO MATCHING TESTS ===\n");

console.log("--- Real variants ---");
testMuni("Normal Chía", "Chía", "Chía");
testMuni("Normal Facatativá", "Facatativá", "Facatativá");
testMuni("Normal Fusagasugá", "Fusagasugá", "Fusagasugá");
testMuni("Normal Girardot", "Girardot", "Girardot");
testMuni("Normal Soacha", "Soacha", "Soacha");
testMuni("Long form Ubaté", "Villa de San Diego de Ubaté", "Ubaté");
testMuni("Normal Zipaquirá", "Zipaquirá", "Zipaquirá");

console.log("\n--- Simulated typos ---");
testMuni("No accent Chia", "Chia", "Chía");
testMuni("Upper CHIA", "CHIA", "Chía");
testMuni("No accent Facatativa", "Facatativa", "Facatativá");
testMuni("Upper FUSAGASUGA", "FUSAGASUGA", "Fusagasugá");
testMuni("Typo Girrdot", "Girrdot", "Girardot");
testMuni("Typo Socha", "Socha", "Soacha");
testMuni("No accent Zipaquira", "Zipaquira", "Zipaquirá");
testMuni("Upper ZIPAQUIRA", "ZIPAQUIRA", "Zipaquirá");
testMuni("Long form no accent", "Villa de San Diego de Ubate", "Ubaté");
testMuni("Upper long form", "VILLA DE SAN DIEGO DE UBATE", "Ubaté");
testMuni("Typo Fcatativa", "Fcatativa", "Facatativá");
testMuni("Lower fusagasuga", "fusagasuga", "Fusagasugá");

// --- GROUP 4: EXTREME STRESS TESTS ---
console.log("\n=== EXTREME STRESS TESTS ===\n");

console.log("--- Heavy typos in programs ---");
testProg("Two letters swapped + no accent", "INGENIREIA DE SITEMAS Y COMPUTACION", "Ingeniería de Sistemas y Computación");
testProg("Missing multiple letters", "INGENERIA AMBIETAL", "Ingeniería Ambiental");
testProg("Totally uppercase garbled", "CONTDURIA PUBLCA", "Contaduría Pública");
testProg("Wrong vowels", "ADMINISTRACION DE IMPRESAS", "Administración de Empresas");
testProg("Extra chars encoding garbage", "PSICOLOG\u00cdA ", "Psicología");
testProg("All lowercase no accents", "especializacion en marketing digital", "Especialización en Marketing Digital");
testProg("Random caps no accents", "EsPeCiAlIzAcIoN eN gEsTiOn PuBlIcA", "Especialización en Gestión Pública");
testProg("Trailing dots/garbage", "INGENIERIA ELECTRONICA...", "Ingeniería Electrónica");
testProg("Leading spaces", "   ZOOTECNIA   ", "Zootecnia");
testProg("Double word", "INGENIERIA  INDUSTRIAL", "Ingeniería Industrial");
testProg("Truncated long name", "ESPECIALIZACION EN METODOLOGIAS DE CALIDAD PARA EL DESARROLLO", "Especialización en Metodologías de Calidad para el Desarrollo del Software");
testProg("One extra letter", "ENFERMERIAA", "Enfermería");
testProg("Missing accent + typo medicina", "MEDIICINA VETERINARIA Y ZOOTECNIA", "Medicina Veterinaria y Zootecnia");
testProg("Mixed case software", "ingeniería de Software", "Ingeniería de Software");
testProg("Typo in maestria", "MAETSRIA EN CIENCIAS AGRARIAS CON ENFASIS EN HORTIFRUTICULTURA", "Maestría en Ciencias Agrarias con Énfasis en Hortifruticultura");
testProg("Abbreviated", "LIC. EN MATEMATICAS", "Licenciatura en Matemáticas");

console.log("\n--- Heavy typos in municipios ---");
testMuni("Missing a letter", "Facatativ", "Facatativá");
testMuni("Extra letter", "Fusagasugaa", "Fusagasugá");
testMuni("Two swapped", "Girarodt", "Girardot");
testMuni("Lower + typo", "soacah", "Soacha");
testMuni("Lower + typo zipaquira", "zipaqira", "Zipaquirá");

// --- SUMMARY ---
console.log(`\n${"=".repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed === 0) {
  console.log("ALL TESTS PASSED!");
} else {
  console.log(`${failed} TESTS FAILED - review output above`);
  process.exit(1);
}
