import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import cloud from "d3-cloud";
import path from "node:path";
import fs from "node:fs";
import type { Word } from "@/lib/parsers/wordcloud-text";

// UCundinamarca brand palette
const PALETTE = ["#007B3E", "#79C000", "#00A99D"];

// Color aleatorio (pero estable por palabra) dentro de la paleta UDEC: cada
// palabra recibe siempre el mismo color vía un hash FNV-1a de su texto, lo que
// da una distribución variada/aleatoria a la vista y reproducible en producción.
function colorForWord(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return PALETTE[(h >>> 0) % PALETTE.length];
}

// ─── Font registration ───────────────────────────────────────────────────────
// On Vercel/Linux serverless there are no system fonts, so @napi-rs/canvas
// cannot measure/render text → blank PNGs. We ship the TTFs in `public/fonts/`
// and register one once before the first canvas operation. Poppins (SemiBold)
// es la principal por su mejor diseño para nubes; Geist queda como respaldo.
const FONTS = [
  { family: "Poppins", file: "Poppins-SemiBold.ttf" },
  { family: "Geist",   file: "Geist-Regular.ttf" },
];
let registeredFamily: string | null = null;

function ensureFont(): string {
  if (registeredFamily) return registeredFamily;
  for (const f of FONTS) {
    const candidates = [
      path.join(process.cwd(), "public", "fonts", f.file),
      path.join(process.cwd(), ".next", "server", "public", "fonts", f.file),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          GlobalFonts.registerFromPath(p, f.family);
          registeredFamily = f.family;
          return f.family;
        } catch {
          // ignore and try next
        }
      }
    }
  }
  // Fallback (will likely render blank on Vercel but won't crash)
  return "sans-serif";
}

// Minimum and maximum font sizes — scaled linearly against the top word count.
// Con todas las palabras en horizontal, un tope algo menor mejora el empaquetado
// (caben más palabras y queda menos espacio vacío).
const MIN_FONT = 18;
const MAX_FONT = 82;

// Deterministic PRNG (mulberry32) so the same input produces the same output.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

type PlacedWord = Required<Pick<cloud.Word, "text" | "size" | "x" | "y" | "rotate">>;

export async function generateWordCloudPng(
  words: Word[],
  opts: { width?: number; height?: number } = {},
): Promise<Buffer> {
  const width  = opts.width  ?? 1200;
  const height = opts.height ?? 800;

  const maxValue = Math.max(...words.map((w) => w.value));
  const minValue = Math.min(...words.map((w) => w.value));
  const fontSize = (value: number): number => {
    if (maxValue === minValue) return (MIN_FONT + MAX_FONT) / 2;
    const t = (value - minValue) / (maxValue - minValue);
    return MIN_FONT + t * (MAX_FONT - MIN_FONT);
  };

  const seededRandom = mulberry32(42);
  const font         = ensureFont();

  const placed: PlacedWord[] = await new Promise((resolve) => {
    cloud<cloud.Word>()
      .size([width, height])
      .canvas(() => createCanvas(1, 1) as unknown as HTMLCanvasElement)
      .words(words.map((w) => ({ text: w.text, size: fontSize(w.value) })))
      .padding(6)
      .rotate(() => 0)            // todas las palabras en horizontal
      .font(font)
      .fontWeight("normal")      // mismo peso que el render → sin solapamientos
      .fontSize((d) => d.size ?? MIN_FONT)
      .random(seededRandom)
      .on("end", (tags) => resolve(tags as PlacedWord[]))
      .start();
  });

  const canvas = createCanvas(width, height);
  const ctx    = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";

  const cx = width / 2;
  const cy = height / 2;

  placed.forEach((w) => {
    ctx.save();
    ctx.translate(cx + w.x, cy + w.y);
    ctx.fillStyle = colorForWord(w.text);
    // Sin "bold": la cara registrada (Poppins SemiBold) ya tiene peso, y el peso
    // del render coincide con el que mide d3-cloud → no hay solapamientos.
    ctx.font = `${w.size}px ${font}`;
    ctx.fillText(w.text, 0, 0);
    ctx.restore();
  });

  return canvas.toBuffer("image/png");
}
