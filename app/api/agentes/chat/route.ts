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

// ── Esquema de la BD (lo ve la IA para generar SQL correcto) ───────────────────
const DB_SCHEMA = `
TABLAS DISPONIBLES (PostgreSQL, solo lectura):

1. estudiantes
   Columnas: id, categoria, unidad_regional, nivel, nivel_academico,
             programa_academico, cantidad INT, año INT, periodo

   ESTRUCTURA CLAVE:
   - Cada fila = un grupo de estudiantes con las mismas características
     (misma categoría + sede + nivel + programa + año + semestre).
   - 'cantidad' es el conteo de ese grupo, NO un estudiante individual.

   COLUMNA 'categoria' — CRÍTICA:
   Esta columna distingue el TIPO de estudiante. Ejemplos típicos:
     • "Matriculados"        → estudiantes activos ese semestre (la cifra más usada)
     • "Nuevos Matriculados" → estudiantes que se matriculan por primera vez
     • "Graduados"          → estudiantes que obtuvieron título ese período
     • "Inscritos"          → aspirantes que se inscribieron al programa
     • "Admitidos"          → aspirantes aceptados (aún no matriculados)
     • "Desertores"         → estudiantes que abandonaron
   ⚠️ REGLA: NUNCA hagas SUM(cantidad) sin filtrar por una sola categoria.
   Si no sabes qué categorías existen, ejecuta primero:
     SELECT DISTINCT categoria FROM estudiantes ORDER BY categoria

   COLUMNA 'periodo' — DOBLE CONTEO ANUAL:
     • 'IPA'  = primer semestre del año
     • 'IIPA' = segundo semestre del año
   ⚠️ Para totales anuales sin duplicar: filtra WHERE periodo = 'IPA'
   Para comparar semestres: agrupa por periodo.

   COLUMNAS DE CLASIFICACIÓN:
   - 'nivel'          → clasificación amplia (ej: Pregrado, Posgrado, Tecnología)
   - 'nivel_academico'→ clasificación específica (ej: Especialización, Maestría, Técnico)
   - 'programa_academico' → nombre exacto del programa
   - 'unidad_regional'    → sede (ej: Fusagasugá, Girardot, Chía, Ubaté, etc.)

   EJEMPLOS DE QUERIES CORRECTAS:
   -- Total matriculados 2026 (sin duplicar):
   SELECT SUM(cantidad) FROM estudiantes
   WHERE categoria = 'Matriculados' AND "año" = 2026 AND periodo = 'IPA'

   -- Matriculados por sede en 2026:
   SELECT unidad_regional, SUM(cantidad) AS total
   FROM estudiantes
   WHERE categoria = 'Matriculados' AND "año" = 2026 AND periodo = 'IPA'
   GROUP BY unidad_regional ORDER BY total DESC

   -- Graduados 2025:
   SELECT SUM(cantidad) FROM estudiantes
   WHERE categoria = 'Graduados' AND "año" = 2025

2. encuestas_estudiantes
   - id, semestre, experiencia_general INT (1-5)
   - profundidad_temas (Excelente|Buena|Regular|Mala|Muy mala)
   - retroalimentacion, seguimiento_compromisos, aspectos_mejora
   - programa, año INT, numero_encuentro, unidad_regional

3. encuestas_docentes
   - id, unidad_regional, facultad, programa
   - encuentro, año INT, experiencia INT (1-5)
   - profundidad_temas, oportunidad_opinion, claridad_respuestas
   - convocatoria, organizacion, mecanismos_participacion
   - participacion_comunidad, uso_canales_digitales, aspectos_mejora

4. planes_mejoramiento_estudiantes
   - id, categoria, subcategoria, plan_de_mejoramiento, actividad
   - fecha_cumplimiento, evidencias_cumplimiento
   - calificacion_cumplimiento FLOAT, efectividad
   - programa, unidad_regional, facultad, año INT, encuentro, formulado

5. planes_mejoramiento_docentes
   - id, categoria, subcategoria, plan_de_mejoramiento, actividad
   - fecha_cumplimiento, evidencias_cumplimiento
   - calificacion_cumplimiento FLOAT
   - programa, unidad_regional, facultad, año INT, encuentro, formulado, calificacion

NOTAS SQL:
- La columna "año" se escribe con comillas dobles: "año"
- Para matrícula anual sin doble conteo: WHERE periodo = 'IPA'
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
  if (rowCount === 0) return "La consulta no retornó resultados.";

  const SAMPLE = 15;
  const sample = rows.slice(0, SAMPLE);

  // Estadísticas de columnas numéricas
  const firstRow = rows[0];
  const numericCols = Object.keys(firstRow).filter((k) => {
    const v = firstRow[k];
    return v !== null && !isNaN(Number(v)) && typeof v !== "boolean";
  });

  const stats: Record<string, string> = {};
  for (const col of numericCols) {
    const vals = rows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
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

// ── Extrae SQL del texto de la IA — elimina punto y coma final ─────────────────
function extractSQL(text: string): string | null {
  const fenced = text.match(/```sql\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim().replace(/;\s*$/, "");
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
}

interface ModelTraceItem {
  provider: AiProvider;
  providerLabel: string;
  model: string;
  modelId: string;
  label: string;
  status: "used" | "failed" | "skipped";
}

const MARIO_ADDON = `

MODO ESPECIAL — PERSONALIDAD MARIO BROS (activo hasta que el usuario lo desactive):
Mantén TODAS tus capacidades, reglas y restricciones anteriores sin excepción. Solo cambia el ESTILO de comunicación:
- Habla como Mario Bros: usa expresiones como "¡Mama mia!", "¡Wahoo!", "¡Let's-a go!", "It's-a me!", "¡Mamma mia!", "Okey-dokey!"
- Llama a los datos como "monedas", a los reportes como "estrellas", a los errores como "Bowser bloqueando el camino"
- Celebra resultados positivos con entusiasmo: "¡YAHOO! ¡Encontré las monedas!"
- Mantén el contenido 100% correcto y preciso — nunca sacrifiques exactitud por el personaje
- No rompas el personaje bajo ninguna circunstancia`;

function getSystemPrompt(agent: AgentType, marioMode = false): string {
  const base = agent === "analista" ? getAnalistaSystemPrompt() : getSoporteSystemPrompt();
  return marioMode ? base + MARIO_ADDON : base;
}

function resolveProviderApiKey(provider: AiProvider, customApiKey?: string): string | undefined {
  const trimmed = customApiKey?.trim();
  if (provider === "groq") {
    if (trimmed && !trimmed.startsWith("csk-")) return trimmed;
    return process.env.GROQ_API_KEY;
  }
  if (trimmed?.startsWith("csk-")) return trimmed;
  return process.env.CEREBRAS_API_KEY;
}

function getProviderEndpoint(provider: AiProvider): string {
  return provider === "groq"
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.cerebras.ai/v1/chat/completions";
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

  return {
    model,
    messages,
    temperature,
    ...tokenParam,
  };
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

async function callModelOnce(
  apiKey: string,
  candidate: AiModelOption,
  messages: { role: string; content: string }[],
  maxTokens = 1024,
  temperature = 0.7
): Promise<ModelCallResult> {
  const res = await fetch(getProviderEndpoint(candidate.provider), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(buildProviderBody(candidate.provider, candidate.model, messages, maxTokens, temperature)),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(compactProviderError(candidate.provider, candidate.model, res.status, err));
  }
  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content ?? "";
  if (!reply.trim()) {
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
function getAnalistaSystemPrompt(): string {
  return `Eres el Analista de Datos Académicos del Portal de Inteligencia Académica de la Universidad de Cundinamarca (UdeC).

INFORMACIÓN DISPONIBLE EN LA BASE DE DATOS:
Tienes acceso a cuatro grandes áreas de datos institucionales:

1. Población estudiantil — cifras de estudiantes organizadas por tipo (matriculados activos, nuevos matriculados, graduados, inscritos, admitidos, desertores), sede, nivel académico, programa y período semestral. Permite responder preguntas como: cuántos estudiantes hay activos, cuántos se graduaron, cuántos ingresaron por primera vez, comparar sedes o programas, ver evolución histórica. Para totales anuales se usa el primer semestre (IPA). Siempre se trabaja con una sola categoría a la vez para evitar duplicados.

2. Encuestas de Encuentros Dialógicos — opiniones y calificaciones de estudiantes y docentes sobre los encuentros institucionales. Incluye: experiencia general (escala 1-5), profundidad de los temas tratados, retroalimentación recibida, seguimiento a compromisos, claridad en respuestas, organización del evento, participación de la comunidad y aspectos de mejora. Datos por año, semestre/encuentro, sede y programa.

3. Planes de mejoramiento de programas académicos — compromisos de mejora derivados de los encuentros con estudiantes, organizados por categoría, subcategoría, actividad, fecha de cumplimiento y una calificación de cumplimiento (0-100). Incluye evidencias y efectividad reportada.

4. Planes de mejoramiento docentes — similar al anterior pero orientado al cuerpo docente, con categoría, actividad, calificación de cumplimiento y observaciones.

REGLAS DE COMUNICACIÓN (MUY IMPORTANTE):
- NUNCA menciones nombres técnicos de tablas (como "encuestas_docentes", "estudiantes", etc.).
- NUNCA menciones nombres de columnas técnicas (como "unidad_regional", "programa_academico").
- Habla siempre en lenguaje natural: "según los datos de matrícula", "en las encuestas de docentes", "los planes de mejoramiento indican", etc.
- Redondea números decimales a 2 cifras. Usa formato legible (ej: "3.247 estudiantes").
- Si hay pocos datos o ninguno, dilo claramente y sugiere cómo reformular la pregunta.

REGLAS DE SEGURIDAD:
- SOLO consultas SELECT. NUNCA INSERT, UPDATE, DELETE, DROP, ALTER ni ninguna operación de escritura.
- NUNCA consultes Internet ni uses conocimiento externo para fabricar cifras. Toda respuesta con datos debe provenir exclusivamente de la base de datos institucional.
- Si un dato no está en la base de datos, dilo claramente. No inventes ni estimes cifras.
- No reveles contraseñas, URLs de conexión ni claves API.
- Responde siempre en español.

${DB_SCHEMA}

INSTRUCCIÓN TÉCNICA PARA GENERAR SQL:
Cuando necesites consultar datos, responde SOLO con el bloque SQL:
\`\`\`sql
SELECT ...
\`\`\`
Sin punto y coma al final. Sin texto antes del SQL. Después de recibir los resultados, analiza y responde en lenguaje natural.`;
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

          // ── Analista: flujo de 4 pasos con progreso ─────────────────────────

          // Paso 1 — IA genera SQL o responde directamente
          send({ step: "generating_sql" });
          const step1 = await callModelWithFallback(
            apiKey,
            modelQueue,
            [
              { role: "system", content: getSystemPrompt(agent, marioMode) },
              ...contextMessages,
              { role: "user", content: message },
            ],
            600
          );

          const sqlCandidate = extractSQL(step1.reply);

          // Sin SQL → la IA ya respondió sin necesitar la BD
          if (!sqlCandidate) {
            send({ step: "validating_answer" });
            const finalAnswer = await refineAnswer(agent, message, step1, modelQueue, apiKey, contextMessages, marioMode);
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

          // Paso 2 — Validación de seguridad (servidor)
          send({ step: "validating" });
          const validation = validateSQL(sqlCandidate);

          if (!validation.ok) {
            send({ step: "responding" });
            const fallbackMsg = `[SISTEMA: La consulta SQL fue bloqueada por seguridad (${validation.reason}). Responde con los datos que conozcas del esquema o indica que no tienes esa información.]`;
            const draft = await callModelWithFallback(
              apiKey,
              modelQueue,
              [
                { role: "system", content: getSystemPrompt(agent, marioMode) },
                ...contextMessages,
                { role: "user", content: message },
                { role: "assistant", content: fallbackMsg },
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
              modelTrace: compactModelTrace(step1.modelTrace, finalAnswer.modelTrace),
              sqlBlocked: true,
            });
            return;
          }

          // Paso 3 — Ejecución en BD (read-only a nivel de sesión PostgreSQL)
          send({ step: "executing" });
          let queryResult: string;
          let queryError = false;
          try {
            const { rows, rowCount } = await executeReadOnlyQuery(sqlCandidate);
            // Comprimir resultados para evitar 413 por request demasiado grande
            queryResult = compressQueryResult(rows, rowCount);
          } catch (err) {
            queryResult = `Error al ejecutar: ${err instanceof Error ? err.message : String(err)}`;
            queryError = true;
          }

          // Paso 4 — IA analiza resultados y genera respuesta final
          // Sin historial de conversación aquí: solo pregunta + SQL + resultados
          send({ step: "analyzing" });
          const draft = await callModelWithFallback(
            apiKey,
            modelQueue,
            [
              { role: "system", content: getSystemPrompt(agent, marioMode) },
              { role: "user", content: message },
              { role: "assistant", content: `SQL ejecutado:\n\`\`\`sql\n${sqlCandidate}\n\`\`\`` },
              {
                role: "user",
                content: queryError
                  ? `Error al ejecutar la consulta: ${queryResult}. Explica en lenguaje natural qué pudo salir mal y cómo podría reformularse la pregunta. NO generes SQL nuevo.`
                  : `${queryResult}\n\nAnaliza estos datos y responde la pregunta en español de forma clara. NO incluyas bloques de código SQL en tu respuesta.`,
              },
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
            modelTrace: compactModelTrace(step1.modelTrace, finalAnswer.modelTrace),
            executedSQL: sqlCandidate,
            queryError,
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
