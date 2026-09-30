import { NextRequest, NextResponse } from "next/server";

/**
 * Protección de /api/*:
 *  1. Rate limiting por IP (ventana fija en memoria, por instancia).
 *  2. Límite de tamaño del body según Content-Length.
 *  3. Verificación de origen (anti-CSRF) en métodos que modifican datos.
 *
 * El store en memoria es por instancia serverless: frena abusos y bucles, pero
 * para límites globales complementar con Vercel Firewall.
 */

type Tier = "auth" | "worker" | "heavy" | "default";

const LIMITS: Record<Tier, { max: number; windowMs: number }> = {
  auth:    { max: 5,   windowMs: 10 * 60_000 }, // intentos de PIN
  worker:  { max: 120, windowMs: 60_000 },      // bucles de análisis (process/consolidate)
  heavy:   { max: 20,  windowMs: 60_000 },      // IA, uploads, exports
  default: { max: 120, windowMs: 60_000 },
};

const MB = 1024 * 1024;
const MAX_BODY_UPLOAD  = 15 * MB;
const MAX_BODY_DEFAULT = 1 * MB;

const AUTH_ROUTES = [
  "/api/verify-pin",
  "/api/encuesta-satisfaccion/analisis/reset-all",
];

const WORKER_ROUTES = [
  "/api/encuesta-satisfaccion/analisis/process",
  "/api/encuesta-satisfaccion/analisis/consolidate",
];

const HEAVY_PATTERNS = [
  /^\/api\/agentes\/chat$/,
  /^\/api\/encuesta-satisfaccion\/analisis\//,
  /^\/api\/encuesta-satisfaccion\/(upload|preview|wordclouds|export-[^/]+|satisfaccion-grupos)$/,
  /^\/api\/encuentros-dialogicos\/(upload-[^/]+|export-[^/]+|preview-[^/]+|normalize-db)$/,
  /^\/api\/(process-reports|export-db|pronostico)(\/|$)/,
];

// Rutas que reciben archivos (body grande permitido)
const UPLOAD_PATTERNS = [
  /\/upload(-[^/]+)?$/,
  /\/preview(-[^/]+)?$/,
  /^\/api\/process-reports$/,
  /^\/api\/check-existing$/,
  /^\/api\/pronostico$/,
];

function tierFor(path: string): Tier {
  if (AUTH_ROUTES.includes(path)) return "auth";
  if (WORKER_ROUTES.includes(path)) return "worker";
  if (HEAVY_PATTERNS.some((re) => re.test(path))) return "heavy";
  return "default";
}

const buckets = new Map<string, { count: number; resetAt: number }>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

function hit(key: string, tier: Tier, now: number) {
  const { max, windowMs } = LIMITS[tier];
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  return { allowed: b.count <= max, remaining: Math.max(0, max - b.count), resetAt: b.resetAt, max };
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const now = Date.now();
  sweep(now);

  // 1. Origen (anti-CSRF): si el navegador envía Origin, debe coincidir con el host
  if (MUTATING.has(req.method)) {
    const origin = req.headers.get("origin");
    if (origin) {
      let originHost = "";
      try { originHost = new URL(origin).host; } catch { /* origin inválido */ }
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      if (!originHost || originHost !== host) {
        return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
      }
    }
  }

  // 2. Tamaño del body
  const len = Number(req.headers.get("content-length") ?? 0);
  const maxBody = UPLOAD_PATTERNS.some((re) => re.test(path)) ? MAX_BODY_UPLOAD : MAX_BODY_DEFAULT;
  if (len > maxBody) {
    return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
  }

  // 3. Rate limiting por IP y nivel
  const tier = tierFor(path);
  const key = `${tier}:${tier === "auth" || tier === "worker" ? path : ""}:${clientIp(req)}`;
  const r = hit(key, tier, now);
  if (!r.allowed) {
    const retryAfter = Math.ceil((r.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(r.max),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Limit", String(r.max));
  res.headers.set("X-RateLimit-Remaining", String(r.remaining));
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
