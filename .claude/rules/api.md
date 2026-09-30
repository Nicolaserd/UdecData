---
paths:
  - "app/api/**"
  - "proxy.ts"
  - "lib/security.ts"
  - "next.config.ts"
---
# Reglas de API y protección contra ataques

- `proxy.ts` protege todo `/api/*`: rate limiting por IP (niveles `auth`, `worker`, `heavy`, `default`), límite de body (`Content-Length`) y verificación de `Origin` en POST/PUT/PATCH/DELETE.
- Ruta nueva que llame a IA, procese archivos, exporte o haga consultas masivas → agrégala a `HEAVY_PATTERNS` (o `UPLOAD_PATTERNS` si recibe archivos).
- PIN y secretos: comparar siempre con `isValidPin` / `timingSafeEqual` (`lib/security.ts`), nunca con `===`.
- Validar tipos y longitudes de toda entrada. Errores al cliente: mensajes genéricos; el detalle solo en logs.
- Toda ruta que ESCRIBE en la BD empieza con `const denied = requirePin(request); if (denied) return denied;` (`lib/security.ts`, encabezado `x-registro-pin`, bloqueo tras 5 PIN incorrectos). El PIN de la UI no basta. En el navegador: `verifyPinRequest` + `pinHeaders()` (`lib/api-errors.ts`); el PIN vive solo en memoria de la pestaña.
- Errores al usuario: en el navegador `readApiJson`/`ensureApiOk`/`errorMessage` (`lib/api-errors.ts`); en el servidor `describeServerError` (`lib/server-errors.ts`). Nunca "Error desconocido".
- No quitar las cabeceras de seguridad ni `poweredByHeader: false` de `next.config.ts`.
- El rate limit es en memoria por instancia; para límites globales usar Vercel Firewall.
- Chat IA (`/api/agentes/chat`): usar `lib/ai-guard.ts` — `acquireChatSlot` (5 msg/min, 40/h por IP, 1 en curso, tope global), `runWithLlmBudget` + `consumeLlmCall` antes de cada llamada al proveedor (máx 30 por mensaje, corta si el cliente se desconecta) y `sanitizeChatInput` (recorta historial/resumen, no rechaza contexto). SQL generado por IA con `statement_timeout` 8 s.
