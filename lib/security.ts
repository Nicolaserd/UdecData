import { timingSafeEqual, createHash } from "node:crypto";

/** IP del cliente (Vercel envía x-forwarded-for / x-real-ip). */
export function clientIp(req: { headers: Headers }): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Compara el PIN recibido con PIN_REGISTRO_BD en tiempo constante
 * (evita ataques de timing). Devuelve false si el PIN no está configurado.
 */
export function isValidPin(pin: unknown): boolean {
  const expected = process.env.PIN_REGISTRO_BD;
  if (!expected || typeof pin !== "string" || pin.length === 0 || pin.length > 128) return false;
  // Hash para igualar longitudes antes de timingSafeEqual
  const a = createHash("sha256").update(pin).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

// ── PIN obligatorio en rutas que escriben en la BD ──────────────────────────
/** Encabezado con el que el navegador envía el PIN ya verificado. */
export const PIN_HEADER = "x-registro-pin";

const PIN_MAX_FAILURES = 5;
const PIN_LOCK_MS = 10 * 60_000;
const pinFailures = new Map<string, { count: number; resetAt: number }>();

function pinError(status: number, error: string, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

/**
 * Exige el PIN de registro (encabezado `x-registro-pin`) antes de escribir en la BD.
 * Devuelve una respuesta de error si no es válido, o null si puede continuar.
 * Tras 5 PIN incorrectos en 10 min bloquea la IP (evita adivinarlo por fuerza bruta
 * a través de las rutas de carga, que tienen límites de solicitudes más altos).
 */
export function requirePin(req: { headers: Headers }): Response | null {
  if (!process.env.PIN_REGISTRO_BD) {
    return pinError(500, "el servidor no tiene configurado el PIN (PIN_REGISTRO_BD). Avisa al administrador.");
  }
  const ip = clientIp(req);
  const now = Date.now();
  const f = pinFailures.get(ip);
  if (f && f.resetAt > now && f.count >= PIN_MAX_FAILURES) {
    return pinError(429, "demasiados intentos con PIN incorrecto.", {
      "Retry-After": String(Math.ceil((f.resetAt - now) / 1000)),
    });
  }

  const pin = req.headers.get(PIN_HEADER);
  if (!pin) {
    return pinError(401, "se requiere el PIN para guardar en la base de datos. Ingrésalo e inténtalo de nuevo.");
  }
  if (isValidPin(pin)) return null;

  // Solo los PIN incorrectos cuentan como intento (no las solicitudes sin PIN)
  if (!f || f.resetAt <= now) pinFailures.set(ip, { count: 1, resetAt: now + PIN_LOCK_MS });
  else f.count++;
  return pinError(401, "PIN incorrecto. Vuelve a ingresarlo para guardar en la base de datos.");
}
