import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Protección del chat de IA contra abuso y consumo excesivo:
 *  - Límite de mensajes por IP (por minuto y por hora) y de llamadas auxiliares (resumen/título).
 *  - Un solo mensaje en curso por IP (sin ráfagas en paralelo).
 *  - Tope global por instancia (circuit breaker) para proteger las cuotas de los proveedores.
 *  - Presupuesto de llamadas al LLM por mensaje y corte si el cliente se desconecta.
 *
 * Estado en memoria por instancia serverless: frena abusos y bucles; para límites
 * globales entre instancias complementar con Vercel Firewall.
 */

export type ChatKind = "message" | "aux";

const LIMITS = {
  messagePerMinute: 5,
  messagePerHour:   40,
  auxPerMinute:     12,
  globalPerMinute:  40,   // mensajes de todos los usuarios en esta instancia
  maxConcurrentPerIp: 1,
};

export const LLM_BUDGET = {
  message: 30, // llamadas máximas al LLM por mensaje (incluye reintentos y fallbacks)
  aux:     4,
};

export const INPUT_LIMITS = {
  message:        2000,
  historyItems:   20,
  historyContent: 4000,
  summary:        3000,
  model:          120,
  apiKey:         300,
};

type Window = { count: number; resetAt: number };
const windows = new Map<string, Window>();
const active = new Map<string, number>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
}

function peek(key: string, now: number): Window {
  const w = windows.get(key);
  return w && w.resetAt > now ? w : { count: 0, resetAt: now };
}

function bump(key: string, windowMs: number, now: number) {
  const w = windows.get(key);
  if (!w || w.resetAt <= now) windows.set(key, { count: 1, resetAt: now + windowMs });
  else w.count++;
}

export type RateResult =
  | { ok: true; release: () => void }
  | { ok: false; status: 429 | 503; error: string; retryAfter: number };

/** Verifica límites y, si pasa, reserva el cupo. Llamar a release() al terminar. */
export function acquireChatSlot(ip: string, kind: ChatKind): RateResult {
  const now = Date.now();
  sweep(now);

  const deny = (status: 429 | 503, error: string, resetAt: number): RateResult => ({
    ok: false, status, error, retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  });

  if (kind === "aux") {
    const k = `aux:m:${ip}`;
    const w = peek(k, now);
    if (w.count >= LIMITS.auxPerMinute) return deny(429, "Demasiadas solicitudes. Espera un momento.", w.resetAt);
    bump(k, 60_000, now);
    return { ok: true, release: () => {} };
  }

  if ((active.get(ip) ?? 0) >= LIMITS.maxConcurrentPerIp) {
    return deny(429, "Espera a que termine la respuesta anterior antes de enviar otro mensaje.", now + 5_000);
  }

  const g = peek("msg:global", now);
  if (g.count >= LIMITS.globalPerMinute) {
    return deny(503, "El asistente está recibiendo muchas consultas. Intenta de nuevo en un minuto.", g.resetAt);
  }
  const m = peek(`msg:m:${ip}`, now);
  if (m.count >= LIMITS.messagePerMinute) {
    const secs = Math.max(1, Math.ceil((m.resetAt - now) / 1000));
    return deny(429, `Has enviado muchos mensajes seguidos. Espera ${secs} s antes de continuar.`, m.resetAt);
  }
  const h = peek(`msg:h:${ip}`, now);
  if (h.count >= LIMITS.messagePerHour) {
    const mins = Math.max(1, Math.ceil((h.resetAt - now) / 60_000));
    return deny(429, `Alcanzaste el límite de ${LIMITS.messagePerHour} mensajes por hora. Intenta en ${mins} min.`, h.resetAt);
  }

  bump("msg:global", 60_000, now);
  bump(`msg:m:${ip}`, 60_000, now);
  bump(`msg:h:${ip}`, 3_600_000, now);
  active.set(ip, (active.get(ip) ?? 0) + 1);

  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      const n = (active.get(ip) ?? 1) - 1;
      if (n <= 0) active.delete(ip); else active.set(ip, n);
    },
  };
}

// ── Presupuesto de llamadas al LLM por solicitud ──────────────────────────────
type Budget = { used: number; max: number; signal?: AbortSignal };
const budgetStore = new AsyncLocalStorage<Budget>();

export function runWithLlmBudget<T>(max: number, signal: AbortSignal | undefined, fn: () => Promise<T>): Promise<T> {
  return budgetStore.run({ used: 0, max, signal }, fn);
}

export class LlmBudgetError extends Error {}

/** Llamar antes de cada petición al proveedor. Lanza si se agotó el presupuesto o el cliente se fue. */
export function consumeLlmCall(): AbortSignal | undefined {
  const b = budgetStore.getStore();
  if (!b) return undefined;
  if (b.signal?.aborted) throw new LlmBudgetError("Solicitud cancelada por el cliente");
  if (b.used >= b.max) {
    throw new LlmBudgetError("Esta consulta requirió demasiados pasos. Intenta con una pregunta más específica.");
  }
  b.used++;
  return b.signal;
}

// ── Validación y saneo de entrada ─────────────────────────────────────────────
/**
 * Valida tipos y acota el contexto del chat (historial + resumen) SIN romper la
 * conversación: en vez de rechazar, conserva los últimos mensajes y recorta textos
 * largos. Muta `body`. Devuelve un mensaje de error solo si la entrada es inválida.
 */
export function sanitizeChatInput(body: Record<string, unknown>): string | null {
  const { message, history, summary, model, apiKey } = body;
  if (message != null && (typeof message !== "string" || message.length > INPUT_LIMITS.message)) {
    return `Mensaje demasiado largo (máx ${INPUT_LIMITS.message} caracteres)`;
  }
  if (history != null) {
    if (!Array.isArray(history)) return "Historial inválido";
    body.history = history
      .filter((h): h is { role: unknown; content: string } =>
        !!h && typeof h === "object" && typeof (h as { content?: unknown }).content === "string")
      .slice(-INPUT_LIMITS.historyItems)
      .map((h) => ({ ...h, content: h.content.slice(0, INPUT_LIMITS.historyContent) }));
  }
  if (summary != null) {
    if (typeof summary !== "string") return "Resumen inválido";
    body.summary = summary.slice(0, INPUT_LIMITS.summary);
  }
  if (model != null && (typeof model !== "string" || model.length > INPUT_LIMITS.model)) return "Modelo inválido";
  if (apiKey != null && (typeof apiKey !== "string" || apiKey.length > INPUT_LIMITS.apiKey)) return "API Key inválida";
  return null;
}
