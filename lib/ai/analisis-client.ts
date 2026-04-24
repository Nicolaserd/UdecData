/**
 * Cliente LLM con fallback Cerebras → Groq para análisis de comentarios.
 * Usa endpoints compatibles con OpenAI Chat Completions.
 */

export type Provider = "cerebras" | "groq";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ProviderSuccess = { ok: true;  provider: Provider; content: string };
export type ProviderFailure = { ok: false; provider: Provider; error:   string; status?: number; retryAfterMs?: number };
export type ProviderCallResult = ProviderSuccess | ProviderFailure;

const CEREBRAS_MODEL = process.env.CEREBRAS_ANALISIS_MODEL ?? "llama3.1-8b";
const GROQ_MODEL     = process.env.GROQ_ANALISIS_MODEL     ?? "llama-3.3-70b-versatile";

const ENDPOINTS: Record<Provider, string> = {
  cerebras: "https://api.cerebras.ai/v1/chat/completions",
  groq:     "https://api.groq.com/openai/v1/chat/completions",
};

function apiKey(provider: Provider): string | undefined {
  if (provider === "cerebras") return process.env.CEREBRAS_API_KEY;
  return process.env.GROQ_API_KEY;
}

function modelFor(provider: Provider): string {
  return provider === "cerebras" ? CEREBRAS_MODEL : GROQ_MODEL;
}

async function callOnce(
  provider: Provider,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<ProviderCallResult> {
  const key = apiKey(provider);
  if (!key) return { ok: false, provider, error: `API key ausente para ${provider}` };

  const body = {
    model: modelFor(provider),
    messages,
    temperature: opts.temperature ?? 0.3,
    ...(provider === "cerebras"
      ? { max_completion_tokens: opts.maxTokens ?? 1200 }
      : { max_tokens:            opts.maxTokens ?? 1200 }),
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
 * Intenta Cerebras primero; si falla, cae a Groq.
 * Devuelve el primer resultado exitoso o, si ambos fallan, ambos errores.
 */
export async function callWithFallback(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<{ success: ProviderSuccess | null; errors: ProviderFailure[] }> {
  const errors: ProviderFailure[] = [];

  const cerebrasResult = await callOnce("cerebras", messages, opts);
  if (cerebrasResult.ok) return { success: cerebrasResult, errors };
  errors.push(cerebrasResult);

  const groqResult = await callOnce("groq", messages, opts);
  if (groqResult.ok) return { success: groqResult, errors };
  errors.push(groqResult);

  return { success: null, errors };
}
