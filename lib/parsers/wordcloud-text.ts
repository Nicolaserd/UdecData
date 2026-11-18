// Spanish stopwords + common survey noise ("na", "ok", "bien", "ninguno", etc.)
const STOPWORDS = new Set<string>([
  "a","al","algo","algun","alguna","algunas","alguno","algunos","ante","antes","aqui","aquel","aquella","aquellas","aquello","aquellos","asi","aun","aunque",
  "bajo","bastante","bien","cada","casi","cierta","ciertas","cierto","ciertos","como","con","contra","cual","cuales","cualquier","cualquiera","cuando",
  "cuanta","cuantas","cuanto","cuantos","de","del","demas","dentro","desde","donde","durante","el","ella","ellas","ello","ellos","en","encima","entre","era","erais","eramos","eran","eras","eres","es","esa","esas","ese","eso","esos","esta","estaba","estabais","estabamos","estaban","estabas","estad","estada","estadas","estado","estados","estais","estamos","estan","estando","estar","estara","estaran","estaras","estare","estareis","estaremos","estaria","estariais","estariamos","estarian","estarias","estas","este","esteis","estemos","esten","estes","esto","estos","estoy","estuve","estuviera","estuvierais","estuvieramos","estuvieran","estuvieras","estuvieron","estuviese","estuvieseis","estuviesemos","estuviesen","estuvieses","estuvimos","estuviste","estuvisteis","estuvo","etc","fin","fue","fuera","fuerais","fueramos","fueran","fueras","fueron","fuese","fueseis","fuesemos","fuesen","fueses","fui","fuimos","fuiste","fuisteis","gran","grande","grandes","ha","habeis","haber","habia","habiais","habiamos","habian","habias","habida","habidas","habido","habidos","habiendo","habra","habran","habras","habre","habreis","habremos","habria","habriais","habriamos","habrian","habrias","han","has","hasta","hay","haya","hayais","hayamos","hayan","hayas","he","hemos","hizo","hube","hubiera","hubierais","hubieramos","hubieran","hubieras","hubieron","hubiese","hubieseis","hubiesemos","hubiesen","hubieses","hubimos","hubiste","hubisteis","hubo","igual","incluso","ir","jamas","junto","la","las","le","les","lo","los","luego","mal","mas","mayor","me","medio","menor","menos","mi","mia","mias","mientras","mio","mios","mis","misma","mismas","mismo","mismos","mucha","muchas","mucho","muchos","muy","nada","nadie","ni","ningun","ninguna","ningunas","ninguno","ningunos","no","nos","nosotras","nosotros","nuestra","nuestras","nuestro","nuestros","nunca","o","os","otra","otras","otro","otros","para","parece","parte","pero","poca","pocas","poco","pocos","por","porque","primero","propio","pudiera","pudieron","pueda","pueden","puedo","pues","que","quedo","quien","quienes","quiere","quien","se","sea","seais","seamos","sean","seas","segun","seguro","ser","sera","seran","seras","sere","sereis","seremos","seria","seriais","seriamos","serian","serias","si","sido","siempre","siendo","siete","sin","sino","sobre","sois","solo","somos","son","soy","su","sus","suya","suyas","suyo","suyos","tal","tambien","tampoco","tan","tanta","tantas","tanto","tantos","te","teneis","tenemos","tener","tenga","tengais","tengamos","tengan","tengas","tengo","tenia","teniais","teniamos","tenian","tenias","tenida","tenidas","tenido","tenidos","teniendo","ti","tiene","tienen","tienes","toda","todas","todavia","todo","todos","trata","tras","tu","tus","tuve","tuviera","tuvierais","tuvieramos","tuvieran","tuvieras","tuvieron","tuviese","tuvieseis","tuviesemos","tuviesen","tuvieses","tuvimos","tuviste","tuvisteis","tuvo","tuya","tuyas","tuyo","tuyos","un","una","unas","uno","unos","usted","ustedes","va","vais","valor","vamos","van","varias","varios","vas","vaya","vayan","ve","veces","vez","vosotras","vosotros","vuestra","vuestras","vuestro","vuestros","y","ya","yo",
  // Non-informative survey responses
  "nn","nada","ninguno","ninguna","ningun","ok","oka","okay","nope","nose","nsnr","ns","nr","sn","sa","aa","aaa","nan","xd","xxx",
  // Filler words very common in "how was the service" comments
  "buen","buena","buenas","bueno","buenos","mejor","peor","gran","grande","grandes","regular","perfecto","excelente","pesimo",
  // Survey-specific fillers (branding words that repeat everywhere and dilute signal)
  "universidad","siglo","xxi","ucundinamarca","cundinamarca","udec","ude","generacion","periodo","academico","encuesta","encuestas",
]);

// Groserías e insultos (español, incluido el uso colombiano). Se comparan sin tildes.
const PROFANITY_EXACT = new Set<string>([
  "puta","putas","puto","putos","putada","putadas","pene","penes","culo","culos","culero","culera",
  "polla","perra","perras","zorra","zorras","carajo","joder","jodido","jodida","jodidos","jodidas",
  "jodan","cagada","cagadas","cagar","mamon","mamona","hpta","hdp","weon","webon","chimba","nojoda",
]);
const PROFANITY_PREFIX = [
  "hijueput","hijodeput","jueput","gonorre","malparid","maric","mierd","pendej","estupid",
  "imbecil","idiot","huevon","guevon","verga","pirob",
];

// Siglas y palabras legítimas que no pasarían las reglas de "sin sentido".
const ALLOWLIST = new Set<string>([
  "pqr","pqrs","pqrsd","pqrsf","sgc","tic","tics","gpt","sst","crm","pdf","sms","tv","mvz",
]);

// Secuencias de teclado típicas de texto escrito al azar.
const KEYBOARD_RE = /(asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|rtyu|tyui|yuio|uiop|zxcv|xcvb|cvbn|vbnm)/;

const MIN_LEN     = 3;
const MAX_LEN     = 24;
const STRIP_RE    = /[̀-ͯ]/g;        // combining diacritics (removed by NFD normalization)
const TOKENIZE_RE = /[^a-záéíóúüñ]+/;          // split on anything that isn't a Spanish letter

// Pure noise patterns (whole-string matches)
const NOISE_FULL = /^(x+|z+|[aeiou]{1,3}|lol+|jeje+|jaja+|jiji+|jsjs+)$/;

/** Con diccionario: una palabra fuera del diccionario entra solo si la usan ≥ 3
 *  comentarios distintos (términos propios: "biblioclic", "moodle", "fusagasugá"). */
const DOMAIN_MIN_COMMENTS = 3;
/** Sin diccionario: una palabra entra si aparece en ≥ 2 comentarios distintos… */
const MIN_COMMENTS = 2;
/** …salvo que así queden menos de estas palabras (áreas con pocos comentarios). */
const MIN_WORDS_STRICT = 15;

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(STRIP_RE, "");
}

function normalize(s: string): string {
  return stripAccents(s.toLowerCase());
}

export function isProfanity(key: string): boolean {
  return PROFANITY_EXACT.has(key) || PROFANITY_PREFIX.some((p) => key.startsWith(p));
}

/** Texto sin sentido: sin vocales, letras repetidas, consonantes imposibles, teclado. */
export function isGibberish(key: string): boolean {
  if (ALLOWLIST.has(key)) return false;
  if (key.length > MAX_LEN)               return true;
  if (!/[aeiouy]/.test(key))              return true; // "vdd", "ssr", "jkl" ("gym" sí pasa)
  if (/(.)\1\1/.test(key))                return true; // "gggg", "todooo", "arrrglar"
  if (/[^aeiou]{5,}/.test(key))           return true; // "ifkddndrfjg", "insgrhmentalizan"
  if (KEYBOARD_RE.test(key))              return true; // "asdf", "qwerty"
  if (/q(?!u)/.test(key))                 return true; // "qblas", "qie"
  if (/^(.{1,3})\1{2,}$/.test(key))       return true; // "jkjkjk", "asasas"
  const vowels = key.replace(/[^aeiou]/g, "").length;
  if (key.length >= 6 && vowels / key.length < 0.2) return true;
  return false;
}

/** Distancia de edición (Levenshtein) con corte temprano: devuelve > max si se pasa. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const STOPWORDS_LONG = [...STOPWORDS].filter((s) => s.length >= 4);

/** Palabra mal escrita de una palabra vacía: "nunguno", "niguna", "nads", "exelente". */
function nearStopword(key: string): boolean {
  if (key.length < 4) return false;
  const max = key.length >= 7 ? 2 : 1;
  return STOPWORDS_LONG.some((s) => editDistance(key, s, max) <= max);
}

/** `w` es la clave sin tildes. */
function isNoise(w: string): boolean {
  if (w.length < MIN_LEN)   return true;
  if (NOISE_FULL.test(w))   return true;
  if (STOPWORDS.has(w))     return true;
  if (isProfanity(w))       return true;
  if (isGibberish(w))       return true;
  return false;
}

// Drop full-comment noise: "na", "n/a", "ninguno", ".", " ", etc.
// These show up even when the individual tokens pass filtering (e.g. "nada que comentar").
export function isMeaningfulComment(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (trimmed.length < 4) return false;
  const norm = normalize(trimmed).replace(/[^a-z\s]/g, "").trim();
  if (!norm) return false;
  if (/^(na|nn|ninguno|ninguna|ningun|nada|ok|okay|nope|nose|no se|ns|nr|sn|no|si|xd|test|prueba|asdf|qwer)$/.test(norm))
    return false;
  // At least one meaningful word (≥4 chars, non-stopword) must survive
  const tokens = norm.split(/\s+/).filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  return tokens.length > 0;
}

export type Word = { text: string; value: number };

type Stat = { count: number; comments: number; forms: Map<string, number> };

/**
 * @param isSpanish verificador de diccionario (`lib/spanish-dictionary.ts`). Si no
 *   se pasa, se usa la regla de frecuencia (≥ 2 comentarios) para descartar tipeos.
 */
export function extractWords(
  comments: Array<string | null>,
  topN = 80,
  isSpanish?: (key: string, forms: Iterable<string>) => boolean,
): Word[] {
  // Clave = palabra sin tildes (agrupa "atencion" y "atención"); se guarda cada
  // forma escrita para mostrar la correcta.
  const stats = new Map<string, Stat>();
  // Un mismo texto pegado varias veces (p. ej. en cada pregunta) cuenta como un
  // solo comentario al medir cuántas personas usan una palabra.
  const textosVistos = new Set<string>();

  for (const raw of comments) {
    if (!isMeaningfulComment(raw)) continue;
    const tokens = raw!.normalize("NFC").toLowerCase().split(TOKENIZE_RE).filter(Boolean);
    const firma = tokens.join(" ");
    const repetido = textosVistos.has(firma);
    textosVistos.add(firma);
    const seen = new Set<string>();
    for (const form of tokens) {
      const key = stripAccents(form);
      if (isNoise(key)) continue;
      let s = stats.get(key);
      if (!s) { s = { count: 0, comments: 0, forms: new Map() }; stats.set(key, s); }
      s.count++;
      s.forms.set(form, (s.forms.get(form) ?? 0) + 1);
      if (!seen.has(key) && !repetido) { s.comments++; seen.add(key); }
    }
  }

  const all = [...stats.entries()];
  let chosen: typeof all;
  if (isSpanish) {
    // Palabra del diccionario, sigla conocida o término que usan varias personas
    // (siempre que no sea una palabra vacía mal escrita).
    chosen = all.filter(([key, s]) => {
      if (ALLOWLIST.has(key)) return true;
      if (isSpanish(key, s.forms.keys())) return true;
      return s.comments >= DOMAIN_MIN_COMMENTS && !nearStopword(key);
    });
  } else {
    // Sin diccionario: se descartan palabras que usó una sola persona (tipeos,
    // texto inventado), salvo que el área tenga tan pocos comentarios que la nube quede vacía.
    const strict = all.filter(([, s]) => s.comments >= MIN_COMMENTS);
    chosen = strict.length >= MIN_WORDS_STRICT ? strict : all;
  }

  return chosen
    .map(([key, s]) => ({ text: displayForm(key, s.forms), value: s.count }))
    .sort((a, b) => b.value - a.value || a.text.localeCompare(b.text, "es"))
    .slice(0, topN);
}

/** Forma a mostrar: la más escrita (la mayoría pone bien las tildes: "comunicación",
 *  "acompañamiento", y no "sedé"); en empate, la que lleva tilde o ñ. */
function displayForm(key: string, forms: Map<string, number>): string {
  const byUse = [...forms.entries()].sort(
    (a, b) => b[1] - a[1] || Number(b[0] !== key) - Number(a[0] !== key),
  );
  return byUse[0][0];
}

export function safeFilename(s: string): string {
  const clean = stripAccents(s)
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `${clean || "area"}.png`;
}
