/**
 * Cliente LLM con fallback Cerebras → Groq para análisis de comentarios.
 * Usa endpoints compatibles con OpenAI Chat Completions.
 */

export type Provider = "cerebras" | "groq";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ProviderSuccess = { ok: true;  provider: Provider; content: string };
export type ProviderFailure = { ok: false; provider: Provider; error:   string; status?: number; retryAfterMs?: number };
export type ProviderCallResult = ProviderSuccess | ProviderFailure;

// Modelos verificados el 2026-09-30 (los Llama de Groq fueron retirados).
const CEREBRAS_MODEL = process.env.CEREBRAS_ANALISIS_MODEL ?? "gpt-oss-120b";
const GROQ_MODEL     = process.env.GROQ_ANALISIS_MODEL     ?? "openai/gpt-oss-120b";
// Modelo Groq de respaldo en un bucket de rate-limit distinto al principal,
// para que un 429 en el 120B no tumbe todo el lote.
const GROQ_MODEL_FALLBACK = process.env.GROQ_ANALISIS_MODEL_FALLBACK ?? "qwen/qwen3.8-27b";

// Cadena de intentos: cada uno con su (proveedor, modelo). Se prueban en orden.
// Groq primero: Cerebras exige plan de pago (queda como último respaldo).
type Attempt = { provider: Provider; model: string };
const FALLBACK_CHAIN: Attempt[] = [
  { provider: "groq",     model: GROQ_MODEL },
  { provider: "groq",     model: GROQ_MODEL_FALLBACK },
  { provider: "cerebras", model: CEREBRAS_MODEL },
];

const ENDPOINTS: Record<Provider, string> = {
  cerebras: "https://api.cerebras.ai/v1/chat/completions",
  groq:     "https://api.groq.com/openai/v1/chat/completions",
};

function apiKey(provider: Provider): string | undefined {
  if (provider === "cerebras") return process.env.CEREBRAS_API_KEY;
  return process.env.GROQ_API_KEY;
}

async function callOnce(
  provider: Provider,
  model: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<ProviderCallResult> {
  const key = apiKey(provider);
  if (!key) return { ok: false, provider, error: `API key ausente para ${provider}` };

  const body = {
    model,
    messages,
    temperature: opts.temperature ?? 0.3,
    ...(provider === "cerebras"
      ? { max_completion_tokens: opts.maxTokens ?? 1200 }
      : { max_tokens:            opts.maxTokens ?? 1200 }),
    // gpt-oss razona antes de responder; con esfuerzo bajo no agota max_tokens
    ...(/gpt-oss/.test(model) ? { reasoning_effort: "low" } : {}),
  };

  const ctl = new AbortController();
  const t   = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 25_000);

  try {
    const res = await fetch(ENDPOINTS[provider], {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body:    JSON.stringify(body),
      signal:  ctl.signal,
    });
    clearTimeout(t);

    if (!res.ok) {
      const raw = await res.text();
      let detail = raw.slice(0, 300);
      try {
        const parsed = JSON.parse(raw);
        detail = parsed?.error?.message ?? parsed?.error?.code ?? detail;
      } catch { /* keep raw */ }

      // Parse Retry-After header for 429 responses
      let retryAfterMs: number | undefined;
      if (res.status === 429) {
        const ra = res.headers.get("retry-after");
        if (ra) {
          const n = Number(ra);
          if (!isNaN(n)) retryAfterMs = Math.ceil(n * 1000);
        }
      }
      return { ok: false, provider, error: `${provider} HTTP ${res.status}: ${detail}`, status: res.status, retryAfterMs };
    }

    const json    = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return { ok: false, provider, error: `${provider}: respuesta vacía` };
    }
    return { ok: true, provider, content: content.trim() };
  } catch (err) {
    clearTimeout(t);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, provider, error: `${provider}: ${msg}` };
  }
}

/**
 * Recorre la cadena de fallback (Cerebras → Groq 70B → Groq 8B) y devuelve el
 * primer resultado exitoso o, si todos fallan, todos los errores acumulados.
 */
export async function callWithFallback(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<{ success: ProviderSuccess | null; errors: ProviderFailure[] }> {
  const errors: ProviderFailure[] = [];

  for (const { provider, model } of FALLBACK_CHAIN) {
    const result = await callOnce(provider, model, messages, opts);
    if (result.ok) return { success: result, errors };
    errors.push(result);
  }

  return { success: null, errors };
}
