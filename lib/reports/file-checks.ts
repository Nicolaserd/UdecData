/**
 * Comprobaciones al elegir un archivo en "Automatizar reportes" (navegador).
 * Evitan errores como subir el mismo reporte en dos casillas.
 */

/** Huella SHA-256 del contenido: dos archivos con la misma huella son idénticos aunque cambie el nombre. */
export async function fileHash(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Palabras del nombre del archivo que delatan la categoría del reporte
const NAME_HINTS: Record<string, RegExp> = {
  matriculados: /matricul/,
  admitidos: /admitid/,
  primiparos: /primipar|primer[\s_-]*curso|primer[\s_-]*semestre/,
  inscritos: /inscrit/,
  graduados: /graduad|egresad/,
};

/**
 * Categoría que sugiere el nombre del archivo, solo si apunta a UNA categoría
 * distinta de la casilla elegida (null si no hay pista clara).
 */
export function categoryHintFromName(fileName: string, slotKey: string): string | null {
  const name = fileName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (NAME_HINTS[slotKey]?.test(name)) return null; // el nombre coincide con la casilla
  const matches = Object.keys(NAME_HINTS).filter((k) => NAME_HINTS[k].test(name));
  return matches.length === 1 ? matches[0] : null;
}
