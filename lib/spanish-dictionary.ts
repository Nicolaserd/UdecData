/**
 * Diccionario de español (Hunspell, LibreOffice) para validar palabras de las
 * nubes de palabras. Se carga una sola vez por instancia (~1 s) y luego cada
 * consulta toma microsegundos.
 *
 * Licencia de `dictionary-es`: (GPL-3.0 OR LGPL-3.0 OR MPL-1.1) — se usa bajo
 * MPL-1.1 sin modificar los archivos. Excepción aprobada en `.claude/rules/paquetes.md`.
 */
import nspell from "nspell";

/** Recibe la clave sin tildes y las formas escritas; true si alguna es palabra del español. */
export type SpanishChecker = (key: string, forms: Iterable<string>) => boolean;

const ACCENTED: Record<string, string[]> = {
  a: ["á"], e: ["é"], i: ["í"], o: ["ó"], u: ["ú", "ü"], n: ["ñ"],
};

/** La palabra tal cual, con mayúscula inicial (nombres propios) y con una tilde/ñ en cada posición. */
function variants(word: string): string[] {
  const out = [word, word.charAt(0).toUpperCase() + word.slice(1)];
  for (let i = 0; i < word.length; i++) {
    for (const rep of ACCENTED[word[i]] ?? []) out.push(word.slice(0, i) + rep + word.slice(i + 1));
  }
  return out;
}

let loading: Promise<SpanishChecker | null> | null = null;

/** Devuelve el verificador, o null si el diccionario no se pudo cargar (se usan otras reglas). */
export function getSpanishChecker(): Promise<SpanishChecker | null> {
  loading ??= (async () => {
    try {
      const { default: dict } = await import("dictionary-es");
      const spell = nspell({ aff: Buffer.from(dict.aff), dic: Buffer.from(dict.dic) });
      const cache = new Map<string, boolean>();
      const isWord = (w: string) => {
        let ok = cache.get(w);
        if (ok === undefined) { ok = spell.correct(w); cache.set(w, ok); }
        return ok;
      };
      return (key, forms) => {
        for (const f of forms) if (isWord(f) || isWord(f.charAt(0).toUpperCase() + f.slice(1))) return true;
        // Quien escribe sin tildes ("comunicacion", "tramites"): probar con tilde o ñ.
        return variants(key).some(isWord);
      };
    } catch (error) {
      console.error("[diccionario-es] no se pudo cargar; las nubes usan solo las reglas sin diccionario", error);
      loading = null; // reintentar en la próxima petición
      return null;
    }
  })();
  return loading;
}
