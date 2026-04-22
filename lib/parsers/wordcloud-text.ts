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

const MIN_LEN     = 3;
const STRIP_RE    = /[̀-ͯ]/g;            // combining diacritics (removed by NFD normalization)
const LETTERS_RE  = /[a-z]/;
const TOKENIZE_RE = /[^a-zñ]+/i;              // split on anything that isn't a letter or ñ

// Pure noise patterns (whole-string matches)
const NOISE_FULL = /^(x+|z+|[aeiou]{1,3}|lol+|jeje+|jaja+|jiji+)$/;

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(STRIP_RE, "");
}

function normalize(s: string): string {
  return stripAccents(s.toLowerCase());
}

function isNoise(w: string): boolean {
  if (w.length < MIN_LEN)   return true;
  if (!LETTERS_RE.test(w))  return true;
  if (/^\d+$/.test(w))      return true;
  if (NOISE_FULL.test(w))   return true;
  if (STOPWORDS.has(w))     return true;
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

export function extractWords(comments: Array<string | null>, topN = 80): Word[] {
  const counts = new Map<string, number>();

  for (const raw of comments) {
    if (!isMeaningfulComment(raw)) continue;
    const tokens = normalize(raw!).split(TOKENIZE_RE).filter(Boolean);
    for (const t of tokens) {
      if (isNoise(t)) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }

  return Array.from(counts, ([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);
}

export function safeFilename(s: string): string {
  const clean = stripAccents(s)
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `${clean || "area"}.png`;
}
