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

export const AI_MODELS: AiModelOption[] = [
  {
    id: "groq:llama-3.3-70b-versatile",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    label: "Groq Llama 3.3 70B",
    desc: "Primera opcion para analisis complejos",
  },
  {
    id: "groq:llama-3.1-8b-instant",
    provider: "groq",
    model: "llama-3.1-8b-instant",
    label: "Groq Llama 3.1 8B Instant",
    desc: "Rapido, ideal para soporte",
  },
  {
    id: "groq:mixtral-8x7b-32768",
    provider: "groq",
    model: "mixtral-8x7b-32768",
    label: "Groq Mixtral 8x7B",
    desc: "Respaldo historico si esta disponible",
  },
  {
    id: "groq:gemma2-9b-it",
    provider: "groq",
    model: "gemma2-9b-it",
    label: "Groq Gemma 2 9B",
    desc: "Modelo Google, bueno para instrucciones",
  },
  {
    id: "cerebras:qwen-3-235b",
    provider: "cerebras",
    model: "qwen-3-235b",
    label: "Cerebras Qwen 3 235B",
    desc: "Mayor razonamiento para respuestas exigentes",
  },
  {
    id: "cerebras:gpt-oss-120b",
    provider: "cerebras",
    model: "gpt-oss-120b",
    label: "Cerebras GPT OSS 120B",
    desc: "Respaldo de alto rendimiento",
  },
  {
    id: "cerebras:llama-3.1-8b",
    provider: "cerebras",
    model: "llama3.1-8b",
    label: "Cerebras Llama 3.1 8B",
    desc: "Rapido para soporte y resumen",
  },
  {
    id: "kimi:moonshot-v1-32k",
    provider: "kimi",
    model: "moonshot-v1-32k",
    label: "Kimi Moonshot 32K",
    desc: "Balanceado, gran contexto",
  },
  {
    id: "kimi:moonshot-v1-8k",
    provider: "kimi",
    model: "moonshot-v1-8k",
    label: "Kimi Moonshot 8K",
    desc: "Rapido para consultas simples",
  },
  {
    id: "kimi:moonshot-v1-128k",
    provider: "kimi",
    model: "moonshot-v1-128k",
    label: "Kimi Moonshot 128K",
    desc: "Mayor contexto para analisis extensos",
  },
  {
    id: "openrouter:nvidia/nemotron-3-super-120b-a12b:free",
    provider: "openrouter",
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    label: "OR NVIDIA Nemotron 120B",
    desc: "Gran modelo NVIDIA, gratuito",
  },
  {
    id: "openrouter:nvidia/nemotron-nano-9b-v2:free",
    provider: "openrouter",
    model: "nvidia/nemotron-nano-9b-v2:free",
    label: "OR NVIDIA Nemotron 9B",
    desc: "Rapido, razonamiento, gratuito",
  },
];

export const FALLBACK_MODEL_IDS: Record<AgentType, string[]> = {
  analista: [
    "groq:llama-3.3-70b-versatile",
    "groq:llama-3.1-8b-instant",
    "groq:mixtral-8x7b-32768",
    "groq:gemma2-9b-it",
    "kimi:moonshot-v1-32k",
    "cerebras:qwen-3-235b",
    "cerebras:gpt-oss-120b",
    "cerebras:llama-3.1-8b",
    "kimi:moonshot-v1-128k",
    "openrouter:nvidia/nemotron-3-super-120b-a12b:free",
    "openrouter:nvidia/nemotron-nano-9b-v2:free",
  ],
  soporte: [
    "groq:llama-3.1-8b-instant",
    "groq:llama-3.3-70b-versatile",
    "groq:gemma2-9b-it",
    "groq:mixtral-8x7b-32768",
    "kimi:moonshot-v1-8k",
    "cerebras:llama-3.1-8b",
    "cerebras:qwen-3-235b",
    "cerebras:gpt-oss-120b",
    "kimi:moonshot-v1-32k",
    "openrouter:nvidia/nemotron-nano-9b-v2:free",
    "openrouter:nvidia/nemotron-3-super-120b-a12b:free",
  ],
};

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
