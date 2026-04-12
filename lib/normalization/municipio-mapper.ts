import { fuzzyMatch } from "./fuzzy-matcher";
import { CANONICAL_UNIDADES, UNIDAD_ALIASES } from "./canonical-data";

function stripAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function mapMunicipio(raw: string): {
  unidadRegional: string;
  matched: boolean;
  score: number;
} {
  // Check known aliases first (e.g., "Villa de San Diego de Ubaté" → "Ubaté")
  const normalized = stripAccents(raw).toUpperCase().trim().replace(/\s+/g, " ");
  for (const [alias, canonical] of Object.entries(UNIDAD_ALIASES)) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      return { unidadRegional: canonical, matched: true, score: 1 };
    }
  }

  // Generic fuzzy match
  const result = fuzzyMatch(raw, CANONICAL_UNIDADES, 0.5);
  return {
    unidadRegional: result.canonical,
    matched: result.matched,
    score: result.score,
  };
}
