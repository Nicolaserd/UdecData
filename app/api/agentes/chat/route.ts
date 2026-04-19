import { NextRequest, NextResponse } from "next/server";
import { Pool, PoolClient } from "pg";
import {
  type AgentType,
  type AiModelOption,
  type AiProvider,
  buildFallbackQueue,
  findAiModel,
  prioritizeModel,
  PROVIDER_LABELS,
} from "@/lib/ai/model-options";
import { DB_CONTEXT } from "@/lib/ai/db-context";

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  agent: AgentType;
  history: ChatMessage[];
  summary?: string;
  model?: string;
  apiKey?: string;
  summarize?: boolean;
  generateTitle?: boolean;
  autoSwitch?: boolean;
  marioMode?: boolean;
}

const MAX_CONTEXT_MESSAGES = 10;

// ── Esquema de la BD (DB_CONTEXT en inglés + ejemplos SQL en español) ──────────
const DB_SCHEMA = `${DB_CONTEXT}

---

SQL EXAMPLES (use these patterns to generate queries):

-- Total enrolled students 2026 (no double-count):
SELECT SUM(cantidad) FROM estudiantes
WHERE categoria = 'Matriculados' AND "año" = 2026 AND periodo = 'IPA'

-- Enrolled by campus 2026:
SELECT unidad_regional, SUM(cantidad) AS total
FROM estudiantes
WHERE categoria = 'Matriculados' AND "año" = 2026 AND periodo = 'IPA'
GROUP BY unidad_regional ORDER BY total DESC

-- Primíparos (first-time students) 2025:
SELECT SUM(cantidad) FROM estudiantes
WHERE categoria = 'Primiparos' AND "año" = 2025 AND periodo = 'IPA'

-- Graduates 2025:
SELECT SUM(cantidad) FROM estudiantes
WHERE categoria = 'Graduados' AND "año" = 2025

-- Average student survey score by year:
SELECT "año", ROUND(AVG(experiencia_general)::numeric,2) AS promedio
FROM encuestas_estudiantes GROUP BY "año" ORDER BY "año"

-- Average faculty survey score by campus:
SELECT unidad_regional, ROUND(AVG(experiencia)::numeric,2) AS promedio
FROM encuestas_docentes GROUP BY unidad_regional ORDER BY promedio DESC

-- Improvement plan fulfillment by category (students):
SELECT categoria, ROUND(AVG(calificacion_cumplimiento)::numeric,2) AS promedio
FROM planes_mejoramiento_estudiantes GROUP BY categoria ORDER BY promedio DESC
`.trim();

// ── Validación estricta de SQL — solo lectura ──────────────────────────────────
function validateSQL(sql: string): { ok: boolean; reason?: string } {
  const clean = sql.trim();

  if (!/^select\s/i.test(clean)) {
    return { ok: false, reason: "La consulta debe comenzar con SELECT" };
  }

  const writeOps = /\b(insert|update|delete|drop|create|alter|truncate|grant|revoke|merge|call|exec|execute|copy|vacuum|analyze|explain\s+analyze)\b/i;
  if (writeOps.test(clean)) {
    return { ok: false, reason: "Operación de escritura detectada y bloqueada" };
  }

  if (/--/.test(clean) || /\/\*/.test(clean)) {
    return { ok: false, reason: "Comentarios SQL no permitidos" };
  }

  if (/;/.test(clean)) {
    return { ok: false, reason: "Solo se permite una sentencia SQL" };
  }

  const allowedTables = [
    "estudiantes",
    "encuestas_estudiantes",
    "encuestas_docentes",
    "planes_mejoramiento_estudiantes",
    "planes_mejoramiento_docentes",
  ];
  const fromMatches = clean.match(/\bfrom\s+(\w+)/gi) ?? [];
  const joinMatches = clean.match(/\bjoin\s+(\w+)/gi) ?? [];
  for (const m of [...fromMatches, ...joinMatches]) {
    const table = m.trim().split(/\s+/)[1].toLowerCase();
    if (!allowedTables.includes(table)) {
      return { ok: false, reason: `Tabla no permitida: ${table}` };
    }
  }

  return { ok: true };
}

// ── Ejecuta SELECT en una conexión read-only a nivel de sesión ─────────────────
async function executeReadOnlyQuery(sql: string): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no configurado");

  const pool = new Pool({ connectionString: url, max: 2 });
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    // BEGIN READ ONLY en lugar de SET SESSION — al hacer COMMIT la conexión
    // vuelve al estado normal en el pool de PgBouncer (no contamina otras rutas)
    await client.query("BEGIN READ ONLY");

    let safeSql = sql.trim();
    if (!/\blimit\s+\d+/i.test(safeSql)) {
      safeSql += " LIMIT 200";
    } else {
      safeSql = safeSql.replace(/\blimit\s+(\d+)/i, (_, n) =>
        `LIMIT ${Math.min(parseInt(n), 300)}`
      );
    }

    const result = await client.query(safeSql);
    await client.query("COMMIT");
    return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
  } catch (err) {
    await client?.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client?.release();
    await pool.end();
  }
}

// ── Comprime resultados SQL para evitar 413 (request too large) ───────────────
function compressQueryResult(rows: Record<string, unknown>[], rowCount: number): string {
  // Normalizar nulls a 0 en columnas numéricas para que el modelo no los malinterprete
  const normalizedRows = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, v === null ? 0 : v])
    )
  );

  if (rowCount === 0 || normalizedRows.every((r) => Object.values(r).every((v) => v === 0))) {
    return "La consulta retornó 0 resultados — no hay datos para ese filtro en la base de datos.";
  }

  const SAMPLE = 15;
  const sample = normalizedRows.slice(0, SAMPLE);

  // Estadísticas de columnas numéricas
  const firstRow = normalizedRows[0];
  const numericCols = Object.keys(firstRow).filter((k) => {
    const v = firstRow[k];
    return v !== null && !isNaN(Number(v as number)) && typeof v !== "boolean";
  });

  const stats: Record<string, string> = {};
  for (const col of numericCols) {
    const vals = normalizedRows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
    if (vals.length > 0) {
      const sum = vals.reduce((a, b) => a + b, 0);
      stats[col] = `min:${Math.min(...vals)} max:${Math.max(...vals)} avg:${(sum / vals.length).toFixed(2)} sum:${sum}`;
    }
  }

  let out = `Total filas: ${rowCount}\n`;
  if (Object.keys(stats).length > 0) {
    out += `Stats numéricas: ${JSON.stringify(stats)}\n`;
  }
  out += rowCount > SAMPLE
    ? `Muestra (${SAMPLE} de ${rowCount}):\n${JSON.stringify(sample)}`
    : `Datos:\n${JSON.stringify(sample)}`;

  return out;
}

// ── Limpia bloques SQL del texto antes de usarlo como contexto ────────────────
function stripSQLBlocks(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\bSELECT\b[\s\S]*?\bFROM\b[^\n]*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Extrae SQL del texto de la IA — elimina punto y coma final ─────────────────
function extractSQL(text: string): string | null {
  // 1. Bloque fenced ```sql ... ``` o ``` ... ```
  const fenced = text.match(/```sql\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim().replace(/;\s*$/, "");

  // 2. Bloque SELECT multi-línea sin fenced (el modelo no usó backticks)
  const blockMatch = text.match(/\bSELECT\b([\s\S]*?)(?:;[\s]*$|;[\s]*\n|$)/im);
  if (blockMatch) {
    const candidate = ("SELECT" + blockMatch[1]).trim().replace(/;\s*$/, "");
    if (/\bFROM\b/i.test(candidate)) return candidate;
  }

  // 3. Fallback: primera línea SELECT
  const line = text.split("\n").find((l) => /^\s*select\s/i.test(l));
  return line?.trim().replace(/;\s*$/, "") ?? null;
}

// ── Llamada a proveedores IA ───────────────────────────────────────────────────
interface ModelCallResult {
  reply: string;
  usage: Record<string, number>;
  model: string;
  modelId: string;
  provider: AiProvider;
  providerLabel: string;
  modelTrace: ModelTraceItem[];
  finishReason?: string;
}

interface ModelTraceItem {
  provider: AiProvider;
  providerLabel: string;
  model: string;
  modelId: string;
  label: string;
  status: "used" | "failed" | "skipped";
}

function getSystemPrompt(agent: AgentType, marioMode = false): string {
  return agent === "analista" ? getAnalistaSystemPrompt() : getSoporteSystemPrompt();
}

function resolveProviderApiKey(provider: AiProvider, customApiKey?: string): string | undefined {
  const trimmed = customApiKey?.trim();
  if (provider === "groq") {
    if (trimmed?.startsWith("gsk_")) return trimmed;
    return process.env.GROQ_API_KEY;
  }
  if (provider === "cerebras") {
    if (trimmed?.startsWith("csk-")) return trimmed;
    return process.env.CEREBRAS_API_KEY;
  }
  if (provider === "kimi") {
    if (trimmed?.startsWith("sk-")) return trimmed;
    return process.env.KIMI_API_KEY;
  }
  if (provider === "openrouter") {
    if (trimmed?.startsWith("sk-or-")) return trimmed;
    return process.env.OPENROUTER_API_KEY;
  }
  return undefined;
}

function getProviderEndpoint(provider: AiProvider): string {
  if (provider === "groq") return "https://api.groq.com/openai/v1/chat/completions";
  if (provider === "kimi") return "https://api.moonshot.cn/v1/chat/completions";
  if (provider === "openrouter") return "https://openrouter.ai/api/v1/chat/completions";
  return "https://api.cerebras.ai/v1/chat/completions";
}

function buildProviderBody(
  provider: AiProvider,
  model: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
  temperature: number
) {
  const tokenParam = provider === "cerebras"
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };

  return { model, messages, temperature, ...tokenParam };
}

function compactProviderError(provider: AiProvider, model: string, status: number, raw: string): string {
  let detail = raw;
  try {
    const parsed = JSON.parse(raw);
    detail = parsed.error?.code || parsed.error?.message || raw;
  } catch {
    detail = raw.slice(0, 180);
  }
  return `${PROVIDER_LABELS[provider]} ${status} (${model}): ${detail}`;
}

// Descarta líneas de meta-razonamiento en inglés de modelos reasoning (ej: NVIDIA Nemotron)
// y conserva solo el contenido útil en español o con datos.
function extractSpanishFromReasoning(reasoning: string): string {
  const lines = reasoning.split("\n");
  const isMetaLine = (line: string): boolean => {
    const t = line.trim();
    if (!t) return false;
    return (
      /^(We |The |Thus |So |I |Let |Now |This |That |Since |Actually |Note |To |For |With |In |As |Check |Must |Should |Can |Do |Also |And |But |Or |If |Then )/i.test(t) &&
      !/[áéíóúñÁÉÍÓÚÑ]/.test(t) &&
      !/^[-•*]\s/.test(t)
    );
  };
  const useful = lines.filter((l) => !isMetaLine(l));
  const result = useful.join("\n").trim();
  if (result.length > 30) return result;
  const lastBulletIdx = [...lines].reverse().findIndex(
    (l) => /^[-•*]\s/.test(l.trim()) || /[áéíóúñÁÉÍÓÚÑ]/.test(l)
  );
  if (lastBulletIdx !== -1) {
    const fromIdx = lines.length - 1 - lastBulletIdx;
    return lines.slice(Math.max(0, fromIdx - 2)).join("\n").trim();
  }
  return reasoning.trim();
}

async function callModelOnce(
  apiKey: string,
  candidate: AiModelOption,
  messages: { role: string; content: string }[],
  maxTokens = 1024,
  temperature = 0.7
): Promise<ModelCallResult> {
  const extraHeaders: Record<string, string> = candidate.provider === "openrouter"
    ? { "HTTP-Referer": "https://udec-portal.vercel.app", "X-Title": "Portal IA UdeC" }
    : {};
  const res = await fetch(getProviderEndpoint(candidate.provider), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...extraHeaders },
    body: JSON.stringify(buildProviderBody(candidate.provider, candidate.model, messages, maxTokens, temperature)),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(compactProviderError(candidate.provider, candidate.model, res.status, err));
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  const finishReason: string = data.choices?.[0]?.finish_reason ?? "stop";

  // Modelos de razonamiento (NVIDIA Nemotron via OpenRouter): content=null, output en reasoning
  let reply: string = (msg?.content ?? "").trim();
  if (!reply && msg?.reasoning) {
    reply = extractSpanishFromReasoning(msg.reasoning);
  }
  if (!reply) {
    throw new Error(`${PROVIDER_LABELS[candidate.provider]} devolvio una respuesta vacia (${candidate.model})`);
  }
  return {
    reply,
    usage: data.usage ?? {},
    model: candidate.model,
    modelId: candidate.id,
    provider: candidate.provider,
    providerLabel: PROVIDER_LABELS[candidate.provider],
    modelTrace: [toModelTraceItem(candidate, "used")],
    finishReason,
  };
}

function toModelTraceItem(candidate: AiModelOption, status: ModelTraceItem["status"]): ModelTraceItem {
  return {
    provider: candidate.provider,
    providerLabel: PROVIDER_LABELS[candidate.provider],
    model: candidate.model,
    modelId: candidate.id,
    label: candidate.label,
    status,
  };
}

function compactModelTrace(...traces: ModelTraceItem[][]): ModelTraceItem[] {
  const seen = new Set<string>();
  const compacted: ModelTraceItem[] = [];

  for (const item of traces.flat()) {
    if (item.status === "skipped") continue;
    const key = `${item.provider}:${item.model}:${item.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    compacted.push(item);
  }

  return compacted;
}

// ── System prompts ─────────────────────────────────────────────────────────────

const MARIO_ADDON = `

MODO ESPECIAL — PERSONALIDAD MARIO BROS (activo hasta que el usuario lo desactive):
Mantén TODAS tus capacidades, reglas y restricciones anteriores sin excepción. Solo cambia el ESTILO de comunicación:
- Habla como Mario Bros: usa expresiones como "¡Mama mia!", "¡Wahoo!", "¡Let's-a go!", "It's-a me!", "¡Mamma mia!", "Okey-dokey!"
- Llama a los datos como "monedas", a los reportes como "estrellas", a los errores como "Bowser bloqueando el camino"
- Celebra resultados positivos con entusiasmo: "¡YAHOO! ¡Encontré las monedas!"
- Mantén el contenido 100% correcto y preciso — nunca sacrifiques exactitud por el personaje
- No rompas el personaje bajo ninguna circunstancia`;

// FASE 1 — Plan: decide qué consultar, SIN SQL
function getAnalistaPlanPrompt(): string {
  return `Eres el planificador de consultas del Portal de Inteligencia Académica de la Universidad de Cundinamarca.

IMPORTANTE: Tienes conexión ACTIVA y en TIEMPO REAL a una base de datos PostgreSQL institucional.
Cuando el usuario pregunta por cifras, datos, estadísticas o información académica, DEBES consultarla.
NUNCA digas que no tienes acceso a datos — la BD contiene información real actualizada.

${DB_SCHEMA}

REGLA PRIMÍPAROS: Los primíparos son los estudiantes que ingresan por PRIMERA VEZ a la universidad.
En la tabla 'estudiantes', los primíparos se identifican con categoria = 'Primiparos'.

TAREA: Decide si la pregunta necesita consultar la base de datos.

USA SIN_SQL solo para: saludos, preguntas sobre cómo usar el portal, preguntas filosóficas o sin relación con datos académicos.
Para CUALQUIER pregunta sobre cifras, años, sedes, programas, estudiantes, encuestas o planes → genera el PLAN.

Si NO necesitas datos → responde: SIN_SQL: [respuesta directa en español, máximo 2 líneas]

Si SÍ necesitas datos → responde SOLO con lista numerada, SIN SQL:
REGLAS DEL PLAN:
- Para preguntas simples de un solo dato → genera SOLO 1 ítem.
- Cada ítem debe consultar una DIMENSIÓN DIFERENTE: total general, desglose por sede, por programa, por nivel, por período, etc.
- NUNCA repitas la misma métrica con diferente redacción — si ya pediste "total de X", no lo pidas de nuevo.
- Máximo 4 ítems. Si la pregunta no lo justifica, usa menos.

PLAN:
1. [qué consultar — específico y distinto]
2. [segunda dimensión solo si la pregunta la justifica]`;
}

// FASE 2.N — Genera UN solo bloque SQL para un ítem del plan
function getAnalistaQueryPrompt(): string {
  return `Eres un generador de consultas SQL para el Portal de Inteligencia Académica de la Universidad de Cundinamarca.

${DB_SCHEMA}

REGLA PRIMÍPAROS: primíparos = categoria = 'Primiparos' en tabla estudiantes.
REGLA MATRÍCULA ANUAL: para evitar doble conteo usar WHERE periodo = 'IPA'.
REGLA AÑO: la columna "año" siempre con comillas dobles en PostgreSQL.
REGLA NULL: SIEMPRE usa COALESCE(SUM(cantidad), 0) para evitar resultados nulos.
REGLA AÑO SIN DATOS: si el año pedido puede no tener datos, incluir también una consulta de los años disponibles:
  SELECT DISTINCT "año" FROM estudiantes ORDER BY "año" DESC

Responde ÚNICAMENTE con un bloque SQL:
\`\`\`sql
SELECT ...
\`\`\`
Solo SELECT con agregaciones (SUM, AVG, COUNT, GROUP BY). NUNCA SELECT * ni filas individuales. Sin texto adicional.`;
}

// FASE 2 — Resumen derivado del plan
function getAnalistaResumenPrompt(): string {
  return `Eres un asistente de análisis de datos. Tu única tarea: resumir en UNA sola oración en español qué información se va a consultar según el plan recibido.

REGLAS:
- Máximo 20 palabras. Solo la esencia del plan.
- En español. Sin SQL. Sin explicaciones.
- Ejemplo: "Total de estudiantes matriculados por sede en 2025"`;
}

// FASE 3 — Valida si plan y resumen responden la pregunta
function getAnalistaValidarPrompt(): string {
  return `Eres un validador de coherencia. Verifica si el plan de consultas y el resumen responden correctamente la pregunta del usuario.
Responde ÚNICAMENTE con una sola palabra: SI o NO.
Sin explicaciones, sin puntuación, sin nada más.`;
}

// FASE 3b — ¿Puede la BD responder esto?
function getAnalistaPuedeBDPrompt(): string {
  return `Eres un validador. Tienes acceso a esta base de datos institucional:

${DB_SCHEMA}

Determina si la pregunta del usuario puede responderse con los datos de esta BD.
Responde ÚNICAMENTE con una sola palabra: SI o NO.
Sin explicaciones, sin puntuación, sin nada más.`;
}

// FASE 3c — Mejora el plan usando el plan y resumen anteriores
function getAnalistaMejorarPlanPrompt(): string {
  return `Eres un planificador de análisis de datos para el Portal de Inteligencia Académica de la Universidad de Cundinamarca.

${DB_SCHEMA}

REGLA PRIMÍPAROS: primíparos = categoria = 'Primiparos' en tabla estudiantes.

Recibirás: la pregunta original, el plan anterior que NO fue suficiente, el resumen anterior y el motivo del rechazo.
Tu tarea: generar un plan MEJORADO que sí responda la pregunta correctamente.

REGLAS DEL PLAN:
- Cada ítem debe consultar una DIMENSIÓN DIFERENTE (total, por sede, por programa, por nivel, por período).
- NUNCA repitas la misma métrica con diferente redacción.
- Solo los ítems que la pregunta realmente justifica. Máximo 4.

Responde SOLO con lista numerada, SIN SQL:
PLAN:
1. [descripción mejorada — específica y distinta]
2. [segunda dimensión solo si aplica]`;
}

// PRE-CHECK — ¿Puedo responder sin consultar la BD?
function getAnalistaPreCheckPrompt(): string {
  return `Eres un asistente de análisis de datos del Portal de Inteligencia Académica de la Universidad de Cundinamarca.

Recibirás una pregunta del usuario junto con el historial y resumen de conversación disponibles.
Tu tarea: determinar si con ESA información de contexto puedes responder la pregunta SIN necesitar consultar la base de datos.

Responde ÚNICAMENTE con una sola palabra: SI o NO.
- SI: si el historial/resumen ya contiene la respuesta o la pregunta no requiere datos de la BD.
- NO: si necesitas consultar la BD para dar una respuesta con datos reales.
Sin explicaciones, sin puntuación adicional.`;
}

// FASE 4 — Interpreta UN resultado de consulta usando el resumen como contexto
function getAnalistaInterpretOnePrompt(marioMode = false): string {
  const base = `Eres el Analista de Datos Académicos del Portal de Inteligencia Académica de la Universidad de Cundinamarca (UdeC).

Interpreta el resultado de la consulta en UNA sola oración o dos líneas máximo en español formal.

REGLAS:
- Menciona los números exactos del resultado.
- Sin mencionar nombres técnicos de tablas o columnas.
- Sin SQL. Sin meta-comentarios.
- Si el resultado está vacío o tiene error: "No se encontraron datos para esta consulta."`;
  return marioMode ? base + MARIO_ADDON : base;
}

// FASE 5 — Párrafo introductorio que termina en "se presentan los resultados:"
function getAnalistaIntroPrompt(marioMode = false): string {
  const base = `Eres el Analista de Datos Académicos del Portal de Inteligencia Académica de la Universidad de Cundinamarca (UdeC).

Genera UN párrafo introductorio formal en español para presentar los resultados del análisis solicitado.

REGLAS:
- Máximo 3 oraciones.
- Presenta el contexto del análisis basado en el resumen recibido.
- La última oración DEBE terminar exactamente con: "se presentan los resultados:"
- Sin SQL. Sin bullets. Solo prosa formal.`;
  return marioMode ? base + MARIO_ADDON : base;
}

// Respuestas generales sin SQL
function getAnalistaGeneralPrompt(marioMode = false): string {
  if (marioMode) {
    return `Eres el Analista de Datos Académicos del Portal UdeC en MODO MARIO BROS.
Para preguntas que no necesitan datos de la BD:
- Responde MUY CORTO (1-2 líneas máximo).
- Usa frases de Mario: "¡Mama mia!", "¡Wahoo!", "¡Let's-a go!", "¡Okey-dokey!"
- Da UN consejo gracioso relacionado con los datos académicos en tono Mario.
- NUNCA inventes cifras. Sin SQL.`;
  }
  return `Eres el Analista de Datos Académicos del Portal de Inteligencia Académica de la Universidad de Cundinamarca (UdeC).

CONTEXTO INSTITUCIONAL — úsalo cuando te pregunten por definiciones:
- Primíparos: estudiantes que ingresan por PRIMERA VEZ a la Universidad de Cundinamarca. En la base de datos se identifican como categoria = 'Primiparos' en la tabla de estudiantes.
- Matriculados: estudiantes activos en un semestre determinado.
- Graduados: estudiantes que obtuvieron su título.
- Inscritos: aspirantes registrados (aún no admitidos ni matriculados).
- Admitidos: aspirantes aceptados (aún no matriculados).
- Encuentros Dialógicos: espacios institucionales de diálogo entre directivos, docentes y estudiantes.
- Planes de mejoramiento: compromisos de mejora derivados de los encuentros dialógicos.

Para preguntas que no requieren datos de la BD, responde MUY CORTO:
- Definiciones: 1-2 líneas usando el contexto institucional de arriba.
- Saludos: 1 línea + ofrece ayuda con datos.
- Preguntas sobre el portal: 1-2 líneas sobre la funcionalidad relevante.
- Preguntas ambiguas: 1 línea pidiendo qué datos necesita.
NUNCA uses tu conocimiento general si contradice el contexto institucional. Sin SQL. Máximo 3 líneas.`;
}

// Compatibilidad con getSystemPrompt (soporte)
function getAnalistaSystemPrompt(): string { return getAnalistaGeneralPrompt(); }

// Parsea ítems numerados del plan
function parsePlanItems(planText: string): string[] {
  const items: string[] = [];
  for (const line of planText.split("\n")) {
    const match = line.match(/^\s*\d+\.\s+(.+)/);
    if (match) items.push(match[1].trim());
    if (items.length >= 4) break;
  }
  return items;
}

// Detecta si un texto está en español
function isSpanish(text: string): boolean {
  const spanishChars = (text.match(/[áéíóúñÁÉÍÓÚÑ¿¡]/g) ?? []).length;
  const spanishWords = (text.match(/\b(el|la|los|las|de|del|en|con|por|que|una|año|datos|sede|según|están|más|también|es|son|fue|hay|pero|para|como|total|entre|programa)\b/gi) ?? []).length;
  const englishWords = (text.match(/\b(the|and|we|is|are|was|were|this|that|with|from|have|has|they|their|been|would|should|could|also|about|which|when|where|what|how)\b/gi) ?? []).length;
  return spanishChars > 2 || spanishWords > englishWords;
}

// FASE 5 — Traduce y redacta formal si la respuesta no está en español
async function ensureSpanish(
  result: ModelCallResult,
  modelQueue: AiModelOption[],
  customApiKey?: string
): Promise<ModelCallResult> {
  if (isSpanish(result.reply)) return result;
  try {
    const translated = await callModelWithFallback(
      customApiKey,
      modelQueue,
      [
        {
          role: "system",
          content: `Eres un redactor académico. Toma el texto recibido y redáctalo en español formal universitario.
REGLAS: Conserva todos los números exactamente. Usa bullets (- ) para listas. Máximo 5 líneas.
No agregues información nueva. No menciones que estás traduciendo. Devuelve SOLO la respuesta redactada.`,
        },
        { role: "user", content: result.reply },
      ],
      600,
      0.2
    );
    return { ...translated, modelTrace: compactModelTrace(result.modelTrace, translated.modelTrace) };
  } catch {
    return result;
  }
}

// FASE 4 — Valida si la respuesta responde la pregunta
async function validateFinalAnswer(
  question: string,
  interpretation: ModelCallResult,
  modelQueue: AiModelOption[],
  customApiKey?: string
): Promise<ModelCallResult> {
  try {
    const validated = await callModelWithFallback(
      customApiKey,
      modelQueue,
      [
        {
          role: "system",
          content: `Eres un validador de respuestas. Verifica si la respuesta responde la pregunta.
- Si ES relevante: devuelve la respuesta exactamente como está.
- Si NO es relevante: devuelve "IRRELEVANTE: [explicación breve en español]"
Solo una de las dos opciones. Sin texto adicional.`,
        },
        {
          role: "user",
          content: `Pregunta: ${question}\n\nRespuesta:\n${stripSQLBlocks(interpretation.reply) || interpretation.reply}`,
        },
      ],
      350,
      0.1
    );
    const reply = validated.reply.trim();
    if (/^IRRELEVANTE:/i.test(reply)) {
      const explanation = reply.replace(/^IRRELEVANTE:\s*/i, "").trim();
      return {
        ...validated,
        reply: `No pude responder con los datos disponibles. ${explanation}`,
        modelTrace: compactModelTrace(interpretation.modelTrace, validated.modelTrace),
      };
    }
    return { ...validated, modelTrace: compactModelTrace(interpretation.modelTrace, validated.modelTrace) };
  } catch {
    return interpretation;
  }
}

function getSoporteSystemPrompt(): string {
  return `Eres el Agente de Soporte del Portal de Inteligencia Académica de la Universidad de Cundinamarca (UdeC).

SERVICIOS DEL PORTAL:
1. Dashboard de Estudiantes: visualización de matrículas, tendencias por programa, sede y período.
2. Automatización de Reportes: carga y procesamiento de archivos Excel.
3. Pronóstico Estudiantil: modelo predictivo de matrícula.
4. Encuentros Dialógicos: gestión de encuestas de percepción de estudiantes y docentes.
5. Planes de Mejoramiento: seguimiento a planes derivados de los encuentros.
6. Agentes IA: asistentes inteligentes para análisis y soporte.

REGLAS:
- Usa el resumen y el historial de esta conversacion para responder datos que el usuario ya dio.
- Si el usuario dice su nombre, programa, sede u otra preferencia y luego pregunta por eso, respondelo desde el contexto.
- No reveles información sensible: contraseñas, IDs, URLs de BD, claves API.
- No proporciones datos específicos de la BD (eso es tarea del Analista).
- NUNCA consultes Internet ni fuentes externas. Responde solo con lo que sabes del portal y el contexto de la conversación.
- Orienta al usuario sobre cómo usar las funcionalidades.
- Responde siempre en español, de forma clara y amable.`;
}

// ── Convierte errores técnicos en mensajes amigables en español ───────────────
function friendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("model_decommissioned") || lower.includes("decommissioned")) {
    return "El modelo seleccionado fue dado de baja por Groq y ya no está disponible. Ve a **Configuración** y elige otro modelo.";
  }
  if (lower.includes("rate_limit_exceeded") || lower.includes("429") || lower.includes("tpm")) {
    return "Se alcanzó el límite de solicitudes por minuto en todos los modelos disponibles. Espera unos segundos e intenta de nuevo, o agrega una API Key propia en **Configuración**.";
  }
  if (lower.includes("413") || lower.includes("too large") || lower.includes("request too large")) {
    return "La consulta generó demasiados datos para procesar de una vez. Intenta ser más específico en tu pregunta (por ejemplo, filtra por año o sede).";
  }
  if (lower.includes("401") || lower.includes("invalid_api_key") || lower.includes("authentication")) {
    return "La API Key no es válida o ha expirado. Verifica tu clave en **Configuración**.";
  }
  if (lower.includes("database") || lower.includes("postgresql") || lower.includes("connection")) {
    return "No fue posible conectar con la base de datos en este momento. Intenta de nuevo en unos segundos.";
  }
  if (lower.includes("no hay api key") || lower.includes("api key configurada")) {
    return "No hay una API Key configurada para Groq o Cerebras. Configura GROQ_API_KEY o CEREBRAS_API_KEY en el servidor.";
  }
  return "Ocurrió un problema al procesar tu consulta. Intenta reformular la pregunta o cambia el modelo en **Configuración**.";
}

async function callModelWithFallback(
  customApiKey: string | undefined,
  modelQueue: AiModelOption[],
  messages: { role: string; content: string }[],
  maxTokens = 1024,
  temperature = 0.7
): Promise<ModelCallResult> {
  const errors: string[] = [];
  const trace: ModelTraceItem[] = [];

  for (const candidate of modelQueue) {
    const apiKey = resolveProviderApiKey(candidate.provider, customApiKey);
    if (!apiKey) {
      trace.push(toModelTraceItem(candidate, "skipped"));
      errors.push(`No hay API Key configurada para ${PROVIDER_LABELS[candidate.provider]}`);
      continue;
    }

    try {
      const result = await callModelOnce(apiKey, candidate, messages, maxTokens, temperature);
      return {
        ...result,
        modelTrace: compactModelTrace(trace, result.modelTrace),
      };
    } catch (error) {
      trace.push(toModelTraceItem(candidate, "failed"));
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(errors.join(" | ") || "No hay modelos disponibles para responder");
}

async function refineAnswer(
  agent: AgentType,
  question: string,
  draft: ModelCallResult,
  baseQueue: AiModelOption[],
  customApiKey?: string,
  contextMessages: ChatMessage[] = [],
  marioMode = false
): Promise<ModelCallResult> {
  const refineQueue = prioritizeModel(baseQueue, draft.modelId);
  try {
    const refined = await callModelWithFallback(
      customApiKey,
      refineQueue,
      [
        {
          role: "system",
          content: `${getSystemPrompt(agent, marioMode)}

VALIDACION FINAL:
- Revisa si el borrador responde la pregunta del usuario.
- Usa el resumen y el historial de conversacion proporcionados antes de decidir que falta informacion.
- Si el usuario pregunta por un dato que dio antes en esta misma conversacion, usalo.
- Si responde, mejora claridad y conserva el estilo del agente.
- Si no responde, dilo de forma honesta y explica que dato falta o como reformular.
- No inventes datos. No incluyas SQL. No menciones nombres tecnicos de tablas o columnas.`,
        },
        ...contextMessages,
        {
          role: "user",
          content: `Pregunta original:\n${question}\n\nBorrador de respuesta:\n${draft.reply}\n\nDevuelve solo la respuesta final en espanol.`,
        },
      ],
      900,
      0.2
    );
    return {
      ...refined,
      modelTrace: compactModelTrace(draft.modelTrace, refined.modelTrace),
    };
  } catch {
    return draft;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, agent, history = [], summary, model, apiKey, summarize, generateTitle, autoSwitch = true, marioMode = false } = body;

    if (!summarize && !generateTitle && (!message || typeof message !== "string")) {
      return NextResponse.json({ error: "Mensaje inválido" }, { status: 400 });
    }
    if (message && message.length > 2000) {
      return NextResponse.json({ error: "Mensaje demasiado largo (máx 2000 caracteres)" }, { status: 400 });
    }
    if (!["analista", "soporte"].includes(agent)) {
      return NextResponse.json({ error: "Agente inválido" }, { status: 400 });
    }
    const writeOps = /\b(insert|update|delete|drop|create|alter|truncate|grant|revoke)\b/i;
    if (message && writeOps.test(message)) {
      return NextResponse.json({ error: "Mensaje contiene operaciones no permitidas" }, { status: 400 });
    }

    const selectedModelOption = findAiModel(model);
    const modelQueue = autoSwitch
      ? buildFallbackQueue(agent, model)
      : selectedModelOption
        ? [selectedModelOption]
        : buildFallbackQueue(agent, model);

    // ── Modo título — genera un título corto a partir del resumen ────────────
    if (generateTitle && summary) {
      const result = await callModelWithFallback(
        apiKey,
        buildFallbackQueue(agent, "groq:llama-3.1-8b-instant"),
        [
          {
            role: "system",
            content: "Eres un generador de títulos. Dado un resumen de conversación, devuelve ÚNICAMENTE un título de máximo 6 palabras en español. Sin comillas, sin puntuación al final, sin explicaciones.",
          },
          { role: "user", content: `Resume en máximo 6 palabras este contenido:\n\n${summary}` },
        ],
        60,
        0.3
      );
      return NextResponse.json({ title: result.reply.trim().replace(/^["']|["']$/g, "") });
    }

    // ── Modo resumen — respuesta JSON normal (no streaming) ───────────────────
    if (summarize) {
      const lines = history
        .map((m) => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.content}`)
        .join("\n");
      const summary = await callModelWithFallback(
        apiKey,
        buildFallbackQueue(agent, "groq:llama-3.1-8b-instant"),
        [
          {
            role: "system",
            content: [
              "Resume la ventana de contexto reciente de una conversacion en espanol.",
              "La ventana contiene como maximo los 10 mensajes mas nuevos.",
              "Prioriza con mas fuerza los mensajes mas recientes sobre los antiguos.",
              "Conserva datos, decisiones, preferencias, objetivos y restricciones utiles para continuar.",
              "Devuelve 3-6 oraciones concisas.",
            ].join(" "),
          },
          { role: "user", content: `Resume estos mensajes recientes, dando prioridad a los ultimos:\n\n${lines}` },
        ],
        512,
        0.2
      );
      return NextResponse.json({ summary: summary.reply, model: summary.model, provider: summary.provider });
    }

    // ── Cola de modelos ───────────────────────────────────────────────────────

    // Contexto de historial: maximo 10 mensajes previos desde BD.
    const recentHistory = history
      .filter((m) => ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .slice(-MAX_CONTEXT_MESSAGES);
    const contextMessages: ChatMessage[] = summary
      ? [{ role: "system", content: `Resumen de contexto reciente de esta conversacion: ${summary}` }, ...recentHistory]
      : recentHistory;

    // ── Streaming NDJSON — emite eventos de progreso ──────────────────────────
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        };

        try {
          // ── Soporte: respuesta directa ──────────────────────────────────────
          if (agent === "soporte") {
            const draft = await callModelWithFallback(
              apiKey,
              modelQueue,
              [
                { role: "system", content: getSystemPrompt(agent, marioMode) },
                ...contextMessages,
                { role: "user", content: message },
              ]
            );
            send({ step: "validating_answer" });
            const finalAnswer = await refineAnswer(agent, message, draft, modelQueue, apiKey, contextMessages, marioMode);
            send({
              done: true,
              reply: finalAnswer.reply,
              usage: finalAnswer.usage,
              model: finalAnswer.model,
              modelId: finalAnswer.modelId,
              provider: finalAnswer.provider,
              providerLabel: finalAnswer.providerLabel,
              modelTrace: finalAnswer.modelTrace,
            });
            return;
          }

          // ── Analista: Plan → (SQL → Ejecutar) × N → Extraer → Redactar → Validar → Traducir

          // ╔═ PRE-CHECK — ¿Puedo responder sin consultar la BD? (max 3 intentos)╗
          const MAX_PRECHECK = 3;
          let respondidoDesdeContexto = false;
          const allTraces: ModelTraceItem[][] = [];

          for (let pc = 0; pc < MAX_PRECHECK; pc++) {
            send({ step: "validating_answer" });

            // Modelo sube → pregunta si puede responder sin BD
            const preCheckResult = await callModelWithFallback(
              apiKey, modelQueue,
              [
                { role: "system", content: getAnalistaPreCheckPrompt() },
                ...(summary ? [{ role: "system" as const, content: `Resumen de conversación: ${summary}` }] : []),
                ...recentHistory.slice(-4),
                { role: "user", content: message },
              ],
              10, 0.1
            );
            allTraces.push(preCheckResult.modelTrace);
            const puedeDesdeContexto = preCheckResult.reply.trim().toUpperCase().startsWith("S") ? "SI" : "NO";
            // Modelo baja

            if (puedeDesdeContexto === "SI") {
              // Modelo sube → responde directamente desde contexto
              send({ step: "interpreting" });
              const ctxResult = await callModelWithFallback(
                apiKey, modelQueue,
                [
                  { role: "system", content: getAnalistaGeneralPrompt(marioMode) },
                  ...contextMessages,
                  { role: "user", content: message },
                ],
                200, 0.4
              );
              // Modelo baja
              allTraces.push(ctxResult.modelTrace);
              const ctxFinal = await ensureSpanish(ctxResult, modelQueue, apiKey);
              send({ done: true, reply: ctxFinal.reply, usage: ctxFinal.usage, model: ctxFinal.model, modelId: ctxFinal.modelId, provider: ctxFinal.provider, providerLabel: ctxFinal.providerLabel, modelTrace: compactModelTrace(...allTraces, ctxFinal.modelTrace) });
              respondidoDesdeContexto = true;
              break;
            }
            // NO → siguiente intento
          }

          if (respondidoDesdeContexto) return;
          // ╚═ PRE-CHECK cerrado — se necesita consultar BD ══════════════════════╝

          // ╔═ FASE 1 — PLAN (sin SQL, solo descripciones) ══════════════════════╗
          send({ step: "planning" });
          const planResult = await callModelWithFallback(
            apiKey,
            modelQueue,
            [
              { role: "system", content: getAnalistaPlanPrompt() },
              ...(summary ? [{ role: "system" as const, content: `Contexto previo: ${summary}` }] : []),
              ...recentHistory.slice(-4),
              { role: "user", content: message },
            ],
            400,
            0.1
          );
          // ╚═ FASE 1 cerrada ═══════════════════════════════════════════════════╝

          // Sin BD → respuesta directa corta
          const needsGeneral = /^SIN_SQL:/i.test(planResult.reply.trim()) || parsePlanItems(planResult.reply).length === 0;
          if (needsGeneral) {
            send({ step: "interpreting" });
            const generalResult = await callModelWithFallback(
              apiKey,
              modelQueue,
              [
                { role: "system", content: getAnalistaGeneralPrompt(marioMode) },
                ...contextMessages,
                { role: "user", content: message },
              ],
              150,
              0.5
            );
            send({ step: "translating" });
            const generalFinal = await ensureSpanish(generalResult, modelQueue, apiKey);
            send({
              done: true,
              reply: generalFinal.reply,
              usage: generalFinal.usage,
              model: generalFinal.model,
              modelId: generalFinal.modelId,
              provider: generalFinal.provider,
              providerLabel: generalFinal.providerLabel,
              modelTrace: compactModelTrace(planResult.modelTrace, generalFinal.modelTrace),
            });
            return;
          }

          // ── variables en memoria temporal ────────────────────────────────────
          let planItems = parsePlanItems(planResult.reply);
          allTraces.push(planResult.modelTrace);
          let resumen = "";

          // ╔═ FASE 2 + 3 — RESUMEN + VALIDACIÓN (hasta 4 intentos) ════════════╗
          const MAX_INTENTOS = 4;
          let validado = false;

          for (let intento = 0; intento < MAX_INTENTOS; intento++) {
            // Enviar plan al UI
            send({ step: "planning", plan: planItems });

            // FASE 2 — Resumen derivado del plan → modelo baja
            const resumenResult = await callModelWithFallback(
              apiKey, modelQueue,
              [
                { role: "system", content: getAnalistaResumenPrompt() },
                { role: "user", content: `Plan de consultas:\n${planItems.map((p, i) => `${i + 1}. ${p}`).join("\n")}` },
              ],
              80, 0.1
            );
            resumen = resumenResult.reply.trim();
            allTraces.push(resumenResult.modelTrace);
            // Modelo baja

            // FASE 3 — Validar coherencia plan+resumen con la pregunta → modelo baja
            send({ step: "validating_answer" });
            const validarResult = await callModelWithFallback(
              apiKey, modelQueue,
              [
                { role: "system", content: getAnalistaValidarPrompt() },
                {
                  role: "user",
                  content: `Pregunta del usuario: "${message}"\n\nPlan:\n${planItems.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\nResumen: "${resumen}"\n\n¿El plan y el resumen responden correctamente la pregunta?`,
                },
              ],
              10, 0.1
            );
            allTraces.push(validarResult.modelTrace);
            const validacion = validarResult.reply.trim().toUpperCase().startsWith("S") ? "SI" : "NO";
            // Modelo baja

            if (validacion === "SI") {
              validado = true;
              break;
            }

            // Validación negativa — ¿puede la BD responder esto?
            const puedeBDResult = await callModelWithFallback(
              apiKey, modelQueue,
              [
                { role: "system", content: getAnalistaPuedeBDPrompt() },
                { role: "user", content: `Pregunta: "${message}"` },
              ],
              10, 0.1
            );
            allTraces.push(puedeBDResult.modelTrace);
            const puedeBD = puedeBDResult.reply.trim().toUpperCase().startsWith("S") ? "SI" : "NO";
            // Modelo baja

            if (puedeBD === "NO") {
              // La BD no tiene lo que se pide → respuesta general
              send({ step: "interpreting" });
              const generalResult = await callModelWithFallback(
                apiKey, modelQueue,
                [
                  { role: "system", content: getAnalistaGeneralPrompt(marioMode) },
                  ...contextMessages,
                  { role: "user", content: message },
                ],
                150, 0.5
              );
              const generalFinal = await ensureSpanish(generalResult, modelQueue, apiKey);
              send({ done: true, reply: generalFinal.reply, usage: generalFinal.usage, model: generalFinal.model, modelId: generalFinal.modelId, provider: generalFinal.provider, providerLabel: generalFinal.providerLabel, modelTrace: compactModelTrace(...allTraces, generalFinal.modelTrace) });
              return;
            }

            // La BD sí puede → mejorar el plan con contexto del intento anterior
            if (intento < MAX_INTENTOS - 1) {
              send({ step: "planning" });
              const mejorarResult = await callModelWithFallback(
                apiKey, modelQueue,
                [
                  { role: "system", content: getAnalistaMejorarPlanPrompt() },
                  {
                    role: "user",
                    content: `Pregunta: "${message}"\n\nPlan anterior:\n${planItems.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\nResumen anterior: "${resumen}"\n\nEl plan no fue suficiente. Genera un plan mejorado.`,
                  },
                ],
                400, 0.1
              );
              allTraces.push(mejorarResult.modelTrace);
              const newItems = parsePlanItems(mejorarResult.reply);
              if (newItems.length > 0) planItems = newItems;
              // Modelo baja → siguiente intento
            }
          }

          // Si tras 4 intentos no hay validación positiva → respuesta definitiva
          if (!validado) {
            send({ step: "interpreting" });
            const definitivaResult = await callModelWithFallback(
              apiKey, modelQueue,
              [
                { role: "system", content: getAnalistaGeneralPrompt(marioMode) },
                ...contextMessages,
                { role: "user", content: message },
              ],
              200, 0.5
            );
            const definitivaFinal = await ensureSpanish(definitivaResult, modelQueue, apiKey);
            send({ done: true, reply: definitivaFinal.reply, usage: definitivaFinal.usage, model: definitivaFinal.model, modelId: definitivaFinal.modelId, provider: definitivaFinal.provider, providerLabel: definitivaFinal.providerLabel, modelTrace: compactModelTrace(...allTraces, definitivaFinal.modelTrace) });
            return;
          }
          // ╚═ FASE 2+3 cerrada ══════════════════════════════════════════════════╝

          // ╔═ FASE 4.N — GENERAR SQL + EJECUTAR por ítem ═══════════════════════╗
          const queryResults: Array<{ description: string; data: string; sql: string }> = [];
          const executedSQLs: string[] = [];
          let anyQueryError = false;

          for (let i = 0; i < planItems.length; i++) {
            const description = planItems[i];
            send({ step: "executing", current: i + 1, total: planItems.length });

            // Modelo sube: genera SQL para este ítem
            let queryGenResult: ModelCallResult;
            try {
              queryGenResult = await callModelWithFallback(
                apiKey, modelQueue,
                [
                  { role: "system", content: getAnalistaQueryPrompt() },
                  { role: "user", content: `Resumen del análisis: "${resumen}"\n\nConsulta ${i + 1}: "${description}"` },
                ],
                350, 0.1
              );
              allTraces.push(queryGenResult.modelTrace);
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err);
              const modelName = modelQueue[0]?.label ?? "el modelo seleccionado";
              const friendlyMsg = autoSwitch
                ? `No se pudo generar SQL para "${description}": ${errMsg}`
                : `No se pudo realizar esta consulta porque ${modelName} no está disponible en este momento. Activa el cambio automático de modelo en Configuración para continuar.`;
              queryResults.push({ description, data: friendlyMsg, sql: "" });
              anyQueryError = true;
              continue;
            }
            // Modelo baja

            const sql = extractSQL(queryGenResult.reply);
            if (!sql) {
              queryResults.push({ description, data: "No se pudo extraer una consulta SQL válida.", sql: "" });
              anyQueryError = true;
              continue;
            }

            const validation = validateSQL(sql);
            if (!validation.ok) {
              queryResults.push({ description, data: `Consulta bloqueada por seguridad: ${validation.reason}`, sql });
              anyQueryError = true;
              continue;
            }

            // Enviar SQL generado al UI
            send({ step: "executing", current: i + 1, total: planItems.length, description, sql });

            // Servidor ejecuta (sin modelo)
            executedSQLs.push(sql);
            try {
              const { rows, rowCount } = await executeReadOnlyQuery(sql);
              queryResults.push({ description, data: compressQueryResult(rows, rowCount), sql });
            } catch (err) {
              queryResults.push({ description, data: `Error al ejecutar: ${err instanceof Error ? err.message : String(err)}`, sql });
              anyQueryError = true;
            }
          }

          // Liberar plan de memoria
          planItems = [];
          // ╚═ FASE 3 cerrada ═══════════════════════════════════════════════════╝

          // ╔═ FASE 4.N — INTERPRETAR cada resultado usando el resumen ══════════╗
          send({ step: "interpreting" });
          const interpretaciones: string[] = [];

          for (let i = 0; i < queryResults.length; i++) {
            const { description, data } = queryResults[i];
            let interpResult: ModelCallResult;
            try {
              interpResult = await callModelWithFallback(
                apiKey, modelQueue,
                [
                  { role: "system", content: getAnalistaInterpretOnePrompt(marioMode) },
                  { role: "user", content: `Análisis solicitado: "${resumen}"\nConsulta: "${description}"\nDatos:\n${data}` },
                ],
                200, 0.3
              );
              allTraces.push(interpResult.modelTrace);
              const interp = stripSQLBlocks(interpResult.reply) || interpResult.reply;
              interpretaciones.push(interp);
              // Enviar interpretación al UI
              send({ step: "interpreting", current: i + 1, total: queryResults.length, description, text: interp });
            } catch {
              const fallback = `No se encontraron datos para "${description}".`;
              interpretaciones.push(fallback);
              send({ step: "interpreting", current: i + 1, total: queryResults.length, description, text: fallback });
            }
            // Modelo baja
          }
          // ╚═ FASE 4 cerrada ═══════════════════════════════════════════════════╝

          // ╔═ FASE 5 — PÁRRAFO INTRODUCTORIO ═══════════════════════════════════╗
          send({ step: "validating_answer" });
          let introText = "";
          try {
            const introResult = await callModelWithFallback(
              apiKey, modelQueue,
              [
                { role: "system", content: getAnalistaIntroPrompt(marioMode) },
                { role: "user", content: `Análisis solicitado: "${resumen}"` },
              ],
              150, 0.3
            );
            allTraces.push(introResult.modelTrace);
            introText = introResult.reply.trim();
          } catch {
            introText = `A continuación se presentan los resultados del análisis sobre ${resumen}, se presentan los resultados:`;
          }
          // Modelo baja
          // ╚═ FASE 5 cerrada ═══════════════════════════════════════════════════╝

          // ╔═ COMPOSICIÓN FINAL ═════════════════════════════════════════════════╗
          const bulletLines = interpretaciones.map((interp) => `- ${interp}`).join("\n");
          const finalReply = `${introText}\n\n${bulletLines}`;

          // Liberar memoria temporal
          interpretaciones.length = 0;
          // ╚═ COMPOSICIÓN FINAL cerrada ═════════════════════════════════════════╝

          send({
            done: true,
            reply: finalReply,
            usage: {},
            model: allTraces.at(-1)?.[0]?.model ?? "",
            modelId: allTraces.at(-1)?.[0]?.modelId ?? "",
            provider: allTraces.at(-1)?.[0]?.provider ?? "groq",
            providerLabel: allTraces.at(-1)?.[0]?.providerLabel ?? "",
            modelTrace: compactModelTrace(...allTraces),
            executedSQL: executedSQLs.join(";\n\n"),
            queryError: anyQueryError,
          });

        } catch (err) {
          const msg = err instanceof Error ? err.message : "Error desconocido";
          send({ done: true, reply: friendlyError(msg) });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    const status = msg.includes("límite") || msg.includes("Cambia la API Key") ? 429 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
