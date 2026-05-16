import { fuzzyMatch } from "./fuzzy-matcher";
import { CANONICAL_PROGRAMS, PROGRAM_ALIASES } from "./canonical-data";

function stripAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeForAlias(str: string): string {
  return stripAccents(str)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeProgram(raw: string): {
  name: string;
  matched: boolean;
  score: number;
} {
  const normalized = normalizeForAlias(raw);
  for (const [alias, canonical] of Object.entries(PROGRAM_ALIASES)) {
    if (normalized.includes(alias)) {
      return { name: canonical, matched: true, score: 1 };
    }
  }

  const result = fuzzyMatch(raw, CANONICAL_PROGRAMS, 0.55);
  return { name: result.canonical, matched: result.matched, score: result.score };
}
