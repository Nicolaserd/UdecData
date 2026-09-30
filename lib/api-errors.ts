/**
 * Mensajes de error específicos para las llamadas del navegador a /api.
 * Traduce el código HTTP, el mensaje del servidor y fallos de red a un texto
 * que explica qué pasó y qué hacer. Uso:
 *
 *   const res  = await fetch(url, opts);
 *   const json = await readApiJson<T>(res, "guardar la encuesta");
 *   ...
 *   } catch (err) { setError(errorMessage(err, "guardar la encuesta")); }
 */

const VERCEL_MAX_BODY_MB = "4,5";

function waitText(res: Response): string {
  const secs = Number(res.headers.get("Retry-After"));
  if (!Number.isFinite(secs) || secs <= 0) return "unos minutos";
  if (secs < 60) return `${Math.ceil(secs)} segundos`;
  const mins = Math.ceil(secs / 60);
  return `${mins} minuto${mins > 1 ? "s" : ""}`;
}

/** Mensaje específico para una respuesta HTTP fallida. `action` en infinitivo: "guardar los datos". */
export function describeHttpError(res: Response, serverMessage: string | undefined, action: string): string {
  const detail = serverMessage?.trim();
  switch (res.status) {
    case 400:
      return detail ? `No se pudo ${action}: ${detail}` : `No se pudo ${action}: los datos enviados no son válidos. Revisa el archivo y los campos del formulario.`;
    case 401:
      return detail ? `No se pudo ${action}: ${detail}` : `No se pudo ${action}: PIN incorrecto o acceso no autorizado.`;
    case 403:
      return `No se pudo ${action}: la solicitud fue bloqueada porque no se hizo desde el portal. Recarga la página e inténtalo de nuevo.`;
    case 404:
      return detail ? `No se pudo ${action}: ${detail}` : `No se pudo ${action}: no se encontraron datos para los filtros elegidos.`;
    case 413:
      return `No se pudo ${action}: el archivo es demasiado grande. El máximo que acepta el servidor es ${VERCEL_MAX_BODY_MB} MB; divide el archivo o elimina hojas y columnas que no se usan.`;
    case 429:
      return `Demasiadas solicitudes seguidas. Por seguridad se pausó esta acción; espera ${waitText(res)} e inténtalo de nuevo.`;
    case 502:
    case 503:
    case 504:
      return `No se pudo ${action}: el servidor tardó demasiado o no respondió (código ${res.status}). Inténtalo de nuevo; si el archivo es muy grande, divídelo en partes.`;
    default:
      if (res.status >= 500) {
        return detail
          ? `Error del servidor al ${action}: ${detail}`
          : `Error del servidor al ${action} (código ${res.status}). Inténtalo de nuevo en unos minutos.`;
      }
      return detail ? `No se pudo ${action}: ${detail}` : `No se pudo ${action} (código ${res.status}).`;
  }
}

/**
 * Lee la respuesta como JSON. Si el código no es 2xx lanza un Error con mensaje
 * específico. Tolera respuestas que no son JSON (p. ej. el 413 o el timeout de
 * Vercel, que devuelven texto plano).
 */
export async function readApiJson<T = Record<string, unknown>>(res: Response, action: string): Promise<T> {
  const text = await res.text();
  let json: unknown = undefined;
  try { json = text ? JSON.parse(text) : {}; } catch { /* no es JSON */ }

  if (!res.ok) {
    if (res.status === 401) verifiedPin = null; // PIN rechazado: se pedirá de nuevo
    const serverMessage = json && typeof json === "object" && "error" in json
      ? String((json as { error: unknown }).error)
      : undefined;
    throw new Error(describeHttpError(res, serverMessage, action));
  }
  if (json === undefined) {
    throw new Error(`No se pudo ${action}: el servidor respondió en un formato inesperado.`);
  }
  return json as T;
}

/** Para respuestas binarias (descargas): lanza un Error específico si no es 2xx. */
export async function ensureApiOk(res: Response, action: string): Promise<void> {
  if (res.ok) return;
  await readApiJson(res, action);
}

/** Mensaje para usar en un `catch`: distingue caídas de red de errores del servidor. */
export function errorMessage(err: unknown, action: string): string {
  if (err instanceof TypeError && /fetch|network|load failed/i.test(err.message)) {
    return `No se pudo ${action}: no hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.`;
  }
  if (err instanceof DOMException && err.name === "AbortError") {
    return `Se canceló la acción de ${action}.`;
  }
  if (err instanceof Error && err.message) return err.message;
  return `No se pudo ${action} por un error inesperado. Inténtalo de nuevo.`;
}

// ── PIN ──────────────────────────────────────────────────────────────────────
// El servidor exige el PIN en cada ruta que escribe en la BD (encabezado
// x-registro-pin). Tras verificarlo se guarda SOLO en memoria de esta pestaña
// (nunca en localStorage/cookies): al recargar la página se vuelve a pedir.

let verifiedPin: string | null = null;

export function hasVerifiedPin(): boolean {
  return verifiedPin !== null;
}

/** Encabezado con el PIN para las solicitudes que guardan datos. */
export function pinHeaders(): Record<string, string> {
  return verifiedPin ? { "x-registro-pin": verifiedPin } : {};
}

export function forgetPin(): void {
  verifiedPin = null;
}

/** true = PIN válido; string = mensaje de error específico para mostrar en el modal. */
export async function verifyPinRequest(pin: string): Promise<true | string> {
  let res: Response;
  try {
    res = await fetch("/api/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
  } catch (err) {
    return errorMessage(err, "verificar el PIN");
  }

  if (res.status === 429) {
    return `Demasiados intentos de PIN. Por seguridad el acceso quedó bloqueado; espera ${waitText(res)} e inténtalo de nuevo.`;
  }
  let data: { valid?: boolean; error?: string } = {};
  try { data = await res.json(); } catch { /* respuesta no JSON */ }

  if (res.ok && data.valid) {
    verifiedPin = pin;
    return true;
  }
  verifiedPin = null;
  if (res.ok || res.status === 401) {
    const remaining = Number(res.headers.get("X-RateLimit-Remaining"));
    const tail = Number.isFinite(remaining)
      ? remaining > 0
        ? ` Te quedan ${remaining} intento${remaining > 1 ? "s" : ""} antes de un bloqueo de 10 minutos.`
        : " Este fue el último intento: el acceso se bloqueará 10 minutos."
      : "";
    return `PIN incorrecto.${tail}`;
  }
  return describeHttpError(res, data.error, "verificar el PIN");
}
