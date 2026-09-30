export type AgentType = "analista" | "soporte";
export type AiProvider = "groq" | "cerebras" | "kimi" | "openrouter";

export interface AiModelOption {
  id: string;
  provider: AiProvider;
  model: string;
  label: string;
  desc: string;
}

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  groq: "Groq",
  cerebras: "Cerebras",
  kimi: "Kimi",
  openrouter: "OpenRouter",
};

// Verificados contra las APIs de cada proveedor el 2026-09-30. Groq es la base
// (Cerebras pide pago y Kimi tiene la cuenta suspendida por saldo; quedan como
// respaldo por si se reactivan). Revisar con `/v1/models` si el chat deja de responder.
export const AI_MODELS: AiModelOption[] = [
  {
    id: "groq:openai/gpt-oss-120b",
    provider: "groq",
    model: "openai/gpt-oss-120b",
    label: "Groq GPT-OSS 120B",
    desc: "Primera opcion para analisis complejos",
  },
  {
    id: "groq:openai/gpt-oss-20b",
    provider: "groq",
    model: "openai/gpt-oss-20b",
    label: "Groq GPT-OSS 20B",
    desc: "Rapido, ideal para soporte",
  },
  {
    id: "groq:qwen/qwen3.8-27b",
    provider: "groq",
    model: "qwen/qwen3.8-27b",
    label: "Groq Qwen 3.8 27B",
    desc: "Buen seguimiento de instrucciones",
  },
  {
    id: "openrouter:google/gemma-4-31b-it:free",
    provider: "openrouter",
    model: "google/gemma-4-31b-it:free",
    label: "OR Gemma 4 31B",
    desc: "Modelo Google, gratuito",
  },
  {
    id: "openrouter:nvidia/nemotron-3-super-120b-a12b:free",
    provider: "openrouter",
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    label: "OR NVIDIA Nemotron 120B",
    desc: "Gran modelo NVIDIA, gratuito",
  },
  {
    id: "cerebras:gpt-oss-120b",
    provider: "cerebras",
    model: "gpt-oss-120b",
    label: "Cerebras GPT-OSS 120B",
    desc: "Requiere plan de pago en Cerebras",
  },
  {
    id: "kimi:kimi-k2.6",
    provider: "kimi",
    model: "kimi-k2.6",
    label: "Kimi K2.6",
    desc: "Requiere saldo en Moonshot",
  },
];

export const FALLBACK_MODEL_IDS: Record<AgentType, string[]> = {
  analista: [
    "groq:openai/gpt-oss-120b",
    "groq:qwen/qwen3.8-27b",
    "groq:openai/gpt-oss-20b",
    "openrouter:nvidia/nemotron-3-super-120b-a12b:free",
    "openrouter:google/gemma-4-31b-it:free",
    "cerebras:gpt-oss-120b",
    "kimi:kimi-k2.6",
  ],
  soporte: [
    "groq:openai/gpt-oss-20b",
    "groq:qwen/qwen3.8-27b",
    "groq:openai/gpt-oss-120b",
    "openrouter:google/gemma-4-31b-it:free",
    "openrouter:nvidia/nemotron-3-super-120b-a12b:free",
    "cerebras:gpt-oss-120b",
    "kimi:kimi-k2.6",
  ],
};

/** Modelo rápido para tareas auxiliares (título y resumen del chat). */
export const AUX_MODEL_ID = "groq:openai/gpt-oss-20b";

export function findAiModel(modelId?: string): AiModelOption | undefined {
  if (!modelId) return undefined;
  return AI_MODELS.find((model) => model.id === modelId || model.model === modelId);
}

export function buildFallbackQueue(agent: AgentType, preferredModelId?: string): AiModelOption[] {
  const chain = FALLBACK_MODEL_IDS[agent]
    .map((modelId) => findAiModel(modelId))
    .filter((model): model is AiModelOption => Boolean(model));
  const preferred = findAiModel(preferredModelId) ?? chain[0];
  return [preferred, ...chain.filter((model) => model.id !== preferred.id)];
}

export function prioritizeModel(queue: AiModelOption[], preferredModelId?: string): AiModelOption[] {
  const preferred = findAiModel(preferredModelId);
  if (!preferred) return queue;
  return [preferred, ...queue.filter((model) => model.id !== preferred.id)];
}
