/**
 * Generic fuzzy matcher using multiple similarity strategies.
 * Works for any input vs. a list of canonical values, without needing
 * to enumerate known variants. Handles: accents, case, typos, encoding issues,
 * missing/extra spaces, swapped letters, truncated names.
 */

function stripAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalize(str: string): string {
  return stripAccents(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract character bigrams from a string */
function bigrams(str: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < str.length - 1; i++) {
    result.push(str.slice(i, i + 2));
  }
  return result;
}

/** Dice coefficient using bigram multisets (handles repeated bigrams) */
function diceCoefficient(a: string, b: string): number {
  const normA = normalize(a);
  const normB = normalize(b);

  if (normA === normB) return 1;
  if (normA.length < 2 || normB.length < 2) return 0;

  const bigramsA = bigrams(normA);
  const bigramsB = bigrams(normB);

  const freqB = new Map<string, number>();
  for (const bg of bigramsB) {
    freqB.set(bg, (freqB.get(bg) || 0) + 1);
  }

  let intersection = 0;
  for (const bg of bigramsA) {
    const count = freqB.get(bg) || 0;
    if (count > 0) {
      intersection++;
      freqB.set(bg, count - 1);
    }
  }

  return (2 * intersection) / (bigramsA.length + bigramsB.length);
}

/** Levenshtein distance */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

/** Normalized Levenshtein similarity: 1 - (distance / max_length) */
function levenshteinSimilarity(a: string, b: string): number {
  const normA = normalize(a);
  const normB = normalize(b);
  if (normA === normB) return 1;
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(normA, normB) / maxLen;
}

export interface FuzzyMatch {
  canonical: string;
  score: number;
  matched: boolean;
}

/**
 * Find the best match for `input` in `canonicalList`.
 *
 * Strategy:
 * 1. Exact match after normalization (strip accents + lowercase + trim)
 * 2. Combined score: max(dice, levenshtein) — picks the highest above threshold
 *
 * This combined approach handles both:
 * - Long strings with typos (Dice is good here)
 * - Short strings with typos (Levenshtein is better here)
 *
 * @param input - The raw input string
 * @param canonicalList - Array of correct canonical values
 * @param threshold - Minimum combined similarity to accept (default 0.6)
 */
export function fuzzyMatch(
  input: string,
  canonicalList: string[],
  threshold = 0.6
): FuzzyMatch {
  const normalizedInput = normalize(input);

  // Phase 1: Exact match after normalization
  for (const canonical of canonicalList) {
    if (normalize(canonical) === normalizedInput) {
      return { canonical, score: 1, matched: true };
    }
  }

  // Phase 2: Combined similarity (best of Dice + Levenshtein)
  let bestMatch = "";
  let bestScore = 0;

  for (const canonical of canonicalList) {
    const dice = diceCoefficient(input, canonical);
    const lev = levenshteinSimilarity(input, canonical);
    // Take the max — Dice handles long strings well, Levenshtein handles short ones
    const combined = Math.max(dice, lev);

    if (combined > bestScore) {
      bestScore = combined;
      bestMatch = canonical;
    }
  }

  if (bestScore >= threshold) {
    return { canonical: bestMatch, score: bestScore, matched: true };
  }

  return { canonical: input.trim(), score: bestScore, matched: false };
}
