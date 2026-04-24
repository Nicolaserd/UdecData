import type { ChatMessage } from "@/lib/ai/analisis-client";

export function buildChunkPrompt(area: string, comentarios: string[]): ChatMessage[] {
  const list = comentarios.map((c, i) => `${i + 1}. ${c}`).join("\n");
  return [
    {
      role: "system",
      content:
        "Eres un analista cualitativo institucional de la Universidad de Cundinamarca. " +
        "Analizas comentarios de encuestas de satisfacción y produces resúmenes objetivos, " +
        "claros y sintéticos, con redacción institucional en español. No inventes datos.",
    },
    {
      role: "user",
      content:
        `Área evaluada: ${area}\n\n` +
        `Se presentan ${comentarios.length} comentarios de encuestados sobre esta área. ` +
        `Elabora un análisis parcial (4 a 8 oraciones) que resuma los temas principales presentes en este bloque. ` +
        `Identifica las problemáticas más frecuentes, los aspectos positivos y las oportunidades de mejora mencionadas. ` +
        `No uses listas ni viñetas; entrega un único párrafo en prosa. ` +
        `No repitas los comentarios textualmente; sintetiza.\n\n` +
        `Comentarios:\n${list}`,
    },
  ];
}

export function buildConsolidatePrompt(area: string, analisis: string[]): ChatMessage[] {
  const joined = analisis.map((a, i) => `Análisis parcial ${i + 1}:\n${a}`).join("\n\n");
  return [
    {
      role: "system",
      content:
        "Eres un analista cualitativo institucional de la Universidad de Cundinamarca. " +
        "Consolidas análisis parciales en un único párrafo integrador con redacción institucional en español.",
    },
    {
      role: "user",
      content:
        `Área: ${area}\n\n` +
        `A partir de los siguientes análisis parciales (cada uno proviene de un subconjunto de comentarios de la misma área), ` +
        `elabora un único párrafo consolidado, claro, coherente y sintético. El párrafo debe integrar las tendencias principales, ` +
        `los temas recurrentes, las problemáticas más frecuentes, los aspectos positivos identificados y las oportunidades de mejora. ` +
        `No uses listas ni viñetas. No repitas frases entre análisis. Mantén un tono institucional objetivo. ` +
        `Extensión recomendada: 8 a 14 oraciones.\n\n` +
        `${joined}`,
    },
  ];
}
