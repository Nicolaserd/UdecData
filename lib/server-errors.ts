/**
 * Traduce excepciones del servidor (Prisma/Postgres, lectura de Excel) a un
 * mensaje específico en español para el usuario. El detalle técnico completo se
 * deja en los logs del servidor.
 */

type PrismaLikeError = { code?: string; meta?: Record<string, unknown>; message?: string };

function fieldList(meta: Record<string, unknown> | undefined): string {
  const target = meta?.target ?? meta?.field_name ?? meta?.column_name;
  if (Array.isArray(target)) return target.join(", ");
  return target ? String(target) : "";
}

export function describeServerError(error: unknown, action: string): string {
  const e = (error ?? {}) as PrismaLikeError;
  const raw = e.message ?? String(error ?? "");
  const lower = raw.toLowerCase();

  switch (e.code) {
    case "P1000":
      return `No se pudo ${action}: la base de datos rechazó las credenciales. Avisa al administrador (revisar DATABASE_URL).`;
    case "P1001":
    case "P1002":
    case "P1017":
      return `No se pudo ${action}: no hay conexión con la base de datos en este momento. Inténtalo de nuevo en unos segundos.`;
    case "P2000":
      return `No se pudo ${action}: un valor del archivo es demasiado largo para la columna ${fieldList(e.meta) || "correspondiente"}.`;
    case "P2002":
      return `No se pudo ${action}: ya existe un registro con los mismos datos (${fieldList(e.meta) || "clave única"}). Revisa que el archivo no tenga filas duplicadas.`;
    case "P2003":
      return `No se pudo ${action}: el archivo hace referencia a un registro que no existe (${fieldList(e.meta) || "relación"}).`;
    case "P2011":
      return `No se pudo ${action}: falta un valor obligatorio en la columna ${fieldList(e.meta) || "requerida"}.`;
    case "P2024":
      return `No se pudo ${action}: la base de datos está ocupada (sin conexiones libres). Inténtalo de nuevo en un momento.`;
    case "P2028":
      return `No se pudo ${action}: la transacción tardó demasiado y se canceló. Si el archivo es grande, divídelo en partes.`;
  }

  if (lower.includes("statement timeout") || lower.includes("canceling statement")) {
    return `No se pudo ${action}: la operación en la base de datos tardó más de lo permitido. Si el archivo es grande, divídelo en partes.`;
  }
  if (lower.includes("authentication failed")) {
    return `No se pudo ${action}: la base de datos rechazó las credenciales. Avisa al administrador (revisar DATABASE_URL).`;
  }
  if (lower.includes("can't reach database") || lower.includes("econnrefused") || lower.includes("connection terminated")) {
    return `No se pudo ${action}: no hay conexión con la base de datos en este momento. Inténtalo de nuevo en unos segundos.`;
  }
  if (lower.includes("unsupported file") || lower.includes("corrupted zip") || lower.includes("end of data reached")) {
    return `No se pudo ${action}: el archivo no es un Excel válido o está dañado. Ábrelo en Excel, guárdalo como .xlsx e inténtalo de nuevo.`;
  }
  if (lower.includes("database_url")) {
    return `No se pudo ${action}: el servidor no tiene configurada la base de datos. Avisa al administrador.`;
  }

  // Sin traducción conocida: conservar el detalle pero con contexto
  const detail = raw.split("\n").map((l) => l.trim()).filter(Boolean).at(-1) ?? "error inesperado";
  return `No se pudo ${action}: ${detail.slice(0, 300)}`;
}
