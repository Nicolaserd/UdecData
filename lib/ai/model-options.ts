export type AgentType = "analista" | "soporte";
export type AiProvider = "groq" | "cerebras";

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
    id: "cerebras:llama-3.3-70b",
    provider: "cerebras",
    model: "llama-3.3-70b",
    label: "Cerebras Llama 3.3 70B",
    desc: "Respaldo veloz para analisis",
  },
  {
    id: "cerebras:gpt-oss-120b",
    provider: "cerebras",
    model: "gpt-oss-120b",
    label: "Cerebras GPT OSS 120B",
    desc: "Mayor razonamiento para respuestas exigentes",
  },
  {
    id: "cerebras:llama-3.1-8b",
    provider: "cerebras",
    model: "llama-3.1-8b",
    label: "Cerebras Llama 3.1 8B",
    desc: "Rapido para soporte y resumen",
  },
];

export const FALLBACK_MODEL_IDS: Record<AgentType, string[]> = {
  analista: [
    "groq:llama-3.3-70b-versatile",
    "groq:llama-3.1-8b-instant",
    "groq:mixtral-8x7b-32768",
    "cerebras:llama-3.3-70b",
    "cerebras:gpt-oss-120b",
    "cerebras:llama-3.1-8b",
  ],
  soporte: [
    "groq:llama-3.1-8b-instant",
    "groq:llama-3.3-70b-versatile",
    "groq:mixtral-8x7b-32768",
    "cerebras:llama-3.1-8b",
    "cerebras:llama-3.3-70b",
    "cerebras:gpt-oss-120b",
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
