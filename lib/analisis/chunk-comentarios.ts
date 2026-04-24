/**
 * Limpieza y chunking de comentarios para análisis LLM.
 * Garantiza que cada chunk esté delimitado por área.
 */

/** Respuestas basura que se descartan como comentario vacío */
const NOISE_REGEX = /^(n\/?a|na|ok|ninguno|ninguna|nada|no|n|ok\.*|-+|\.+|\s*)$/i;

/** Limpia comentarios: trim, quita duplicados, descarta nulos/vacíos/basura */
export function cleanComentarios(raw: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    if (!r) continue;
    const t = String(r).replace(/\s+/g, " ").trim();
    if (!t) continue;
    if (t.length < 3) continue;
    if (NOISE_REGEX.test(t)) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/**
 * Divide los comentarios de una misma área en chunks.
 * - Tamaño base: 15 comentarios
 * - Ajusta a 10 si el promedio de palabras supera 150
 * - Sube a 20 si el promedio no alcanza 40
 */
export function chunkComentarios(comentarios: string[]): string[][] {
  if (comentarios.length === 0) return [];

  const avgWords =
    comentarios.reduce((s, c) => s + c.split(/\s+/).length, 0) / comentarios.length;

  let size = 15;
  if (avgWords > 150) size = 10;
  else if (avgWords < 40) size = 20;

  const chunks: string[][] = [];
  for (let i = 0; i < comentarios.length; i += size) {
    chunks.push(comentarios.slice(i, i + size));
  }
  return chunks;
}
