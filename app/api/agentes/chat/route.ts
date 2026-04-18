import { NextRequest, NextResponse } from "next/server";
import { Pool, PoolClient } from "pg";

// ── Tipos ──────────────────────────────────────────────────────────────────────
type AgentType = "analista" | "soporte";

interface ChatMessage {
  role: "user" | "assistant";
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
}

// ── Modelos y cadenas de fallback ─────────────────────────────────────────────
const ALLOWED_MODELS = [
  "llama-3.3-70b-versatile",
  "mixtral-8x7b-32768",
  "llama-3.1-8b-instant",
];

const FALLBACK_CHAINS: Record<string, string[]> = {
  analista: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "llama-3.1-8b-instant"],
  soporte:  ["llama-3.1-8b-instant", "mixtral-8x7b-32768", "llama-3.3-70b-versatile"],
};

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

// ── Llamada simple a Groq ──────────────────────────────────────────────────────
async function callGroq(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  maxTokens = 512
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.2 }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
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
- SOLO consultas SELECT. NUNCA INSERT, UPDATE, DELETE, DROP, ALTER.
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
- No reveles información sensible: contraseñas, IDs, URLs de BD, claves API.
- No proporciones datos específicos de la BD (eso es tarea del Analista).
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
  return "Ocurrió un problema al procesar tu consulta. Intenta reformular la pregunta o cambia el modelo en **Configuración**.";
}

// ── Llamada a Groq con fallback por 429 ───────────────────────────────────────
async function callGroqWithFallback(
  apiKey: string,
  modelQueue: string[],
  messages: { role: string; content: string }[],
  maxTokens = 1024
): Promise<{ reply: string; usage: Record<string, number>; model: string }> {
  let lastError = "";
  for (const currentModel of modelQueue) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: currentModel, messages, max_tokens: maxTokens, temperature: 0.7 }),
    });

    // 429 = rate limit, 413 = request too large, 400 model deprecado → siguiente modelo
    if (res.status === 429 || res.status === 413) {
      lastError = `${currentModel} (${res.status})`;
      continue;
    }
    if (res.status === 400) {
      const errText = await res.text();
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.code === "model_decommissioned") {
          lastError = `${currentModel} (deprecado)`;
          continue;
        }
      } catch { /* ignorar */ }
      throw new Error(`Groq 400 (${currentModel}): ${errText}`);
    }
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq ${res.status} (${currentModel}): ${err}`);
    }

    const data = await res.json();
    return {
      reply: data.choices?.[0]?.message?.content ?? "",
      usage: data.usage ?? {},
      model: currentModel,
    };
  }
  throw new Error(`Todos los modelos alcanzaron el límite (último: ${lastError}). Cambia la API Key en Configuración.`);
}

// ── POST Handler ───────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, agent, history = [], summary, model, apiKey, summarize } = body;

    if (!summarize && (!message || typeof message !== "string")) {
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

    const groqApiKey = process.env.GROQ_API_KEY || apiKey;
    if (!groqApiKey) {
      return NextResponse.json({ error: "API Key de Groq no configurada" }, { status: 500 });
    }

    // ── Modo resumen — respuesta JSON normal (no streaming) ───────────────────
    if (summarize) {
      const lines = history
        .map((m) => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.content}`)
        .join("\n");
      const summaryText = await callGroq(groqApiKey, "llama-3.1-8b-instant", [
        { role: "system", content: "Resume conversaciones de forma concisa en 3-5 oraciones en español." },
        { role: "user", content: `Resume esta conversación:\n\n${lines}` },
      ]);
      return NextResponse.json({ summary: summaryText });
    }

    // ── Cola de modelos ───────────────────────────────────────────────────────
    const chain = FALLBACK_CHAINS[agent];
    const preferredModel = ALLOWED_MODELS.includes(model ?? "") ? model! : chain[0];
    const modelQueue = [preferredModel, ...chain.filter((m) => m !== preferredModel)];

    // ── Contexto de historial — máximo 3 mensajes para reducir tokens ─────────
    const recentHistory = history.slice(-3);
    const contextMessages: ChatMessage[] = summary
      ? [{ role: "assistant", content: `[Resumen anterior]: ${summary}` }, ...recentHistory]
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
            const { reply, usage, model: usedModel } = await callGroqWithFallback(
              groqApiKey,
              modelQueue,
              [
                { role: "system", content: getSoporteSystemPrompt() },
                ...contextMessages,
                { role: "user", content: message },
              ]
            );
            send({ done: true, reply, usage, model: usedModel });
            return;
          }

          // ── Analista: flujo de 4 pasos con progreso ─────────────────────────

          // Paso 1 — IA genera SQL o responde directamente
          send({ step: "generating_sql" });
          const step1 = await callGroqWithFallback(
            groqApiKey,
            modelQueue,
            [
              { role: "system", content: getAnalistaSystemPrompt() },
              ...contextMessages,
              { role: "user", content: message },
            ],
            600
          );

          const sqlCandidate = extractSQL(step1.reply);

          // Sin SQL → la IA ya respondió sin necesitar la BD
          if (!sqlCandidate) {
            send({ done: true, reply: step1.reply, usage: step1.usage, model: step1.model });
            return;
          }

          // Paso 2 — Validación de seguridad (servidor)
          send({ step: "validating" });
          const validation = validateSQL(sqlCandidate);

          if (!validation.ok) {
            send({ step: "responding" });
            const fallbackMsg = `[SISTEMA: La consulta SQL fue bloqueada por seguridad (${validation.reason}). Responde con los datos que conozcas del esquema o indica que no tienes esa información.]`;
            const { reply, usage, model: usedModel } = await callGroqWithFallback(
              groqApiKey,
              modelQueue,
              [
                { role: "system", content: getAnalistaSystemPrompt() },
                ...contextMessages,
                { role: "user", content: message },
                { role: "assistant", content: fallbackMsg },
              ]
            );
            send({ done: true, reply, usage, model: usedModel, sqlBlocked: true });
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
          const { reply, usage, model: usedModel } = await callGroqWithFallback(
            groqApiKey,
            modelQueue,
            [
              { role: "system", content: getAnalistaSystemPrompt() },
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

          send({ done: true, reply, usage, model: usedModel, executedSQL: sqlCandidate, queryError });

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
