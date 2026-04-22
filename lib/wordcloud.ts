import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import cloud from "d3-cloud";
import type { Word } from "@/lib/parsers/wordcloud-text";

// UCundinamarca brand palette
const PALETTE = ["#007B3E", "#79C000", "#00A99D"];

// Minimum and maximum font sizes — scaled linearly against the top word count.
const MIN_FONT = 16;
const MAX_FONT = 96;

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

  const placed: PlacedWord[] = await new Promise((resolve) => {
    cloud<cloud.Word>()
      .size([width, height])
      .canvas(() => createCanvas(1, 1) as unknown as HTMLCanvasElement)
      .words(words.map((w) => ({ text: w.text, size: fontSize(w.value) })))
      .padding(4)
      .rotate(() => (seededRandom() > 0.7 ? 90 : 0))
      .font("sans-serif")
      .fontSize((d) => d.size ?? MIN_FONT)
      .random(seededRandom)
      .on("end", (tags) => resolve(tags as PlacedWord[]))
      .start();
  });

  const canvas = createCanvas(width, height);
  const ctx    = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const font = pickFont();
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";

  const cx = width / 2;
  const cy = height / 2;

  placed.forEach((w, i) => {
    ctx.save();
    ctx.translate(cx + w.x, cy + w.y);
    if (w.rotate) ctx.rotate((w.rotate * Math.PI) / 180);
    ctx.fillStyle = PALETTE[i % PALETTE.length];
    ctx.font = `bold ${w.size}px ${font}`;
    ctx.fillText(w.text, 0, 0);
    ctx.restore();
  });

  return canvas.toBuffer("image/png");
}

function pickFont(): string {
  const preferred = ["Manrope", "Inter", "Helvetica", "Arial", "sans-serif"];
  const available = new Set(GlobalFonts.families.map((f) => f.family));
  return preferred.find((f) => available.has(f)) ?? "sans-serif";
}
