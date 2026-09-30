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
