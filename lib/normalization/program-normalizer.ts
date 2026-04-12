import { fuzzyMatch } from "./fuzzy-matcher";
import { CANONICAL_PROGRAMS } from "./canonical-data";

export function normalizeProgram(raw: string): {
  name: string;
  matched: boolean;
  score: number;
} {
  const result = fuzzyMatch(raw, CANONICAL_PROGRAMS, 0.55);
  return { name: result.canonical, matched: result.matched, score: result.score };
}
