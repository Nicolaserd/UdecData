# Regla: mantener al día el diagrama de arquitectura (Archify)

Diagrama: `.archify/architecture-udec-data-*/` (`candidate.json` + `udec-data.html`), generado con la skill `archify`.

## Cuándo SÍ actualizarlo
Solo si el cambio altera lo que el diagrama muestra:
- Se agrega, quita o renombra un componente: módulo/página principal, grupo de rutas API, servicio externo (proveedor de IA, BD, storage), librería de infraestructura (Prisma, proxy).
- Cambia un flujo de datos o quién lee/escribe: p. ej. procesamiento que pasa del servidor al navegador, una ruta que ahora escribe en la BD, un nuevo proveedor de respaldo.
- Cambia una frontera de seguridad o despliegue: PIN/autenticación, límites en `proxy.ts`, región o plataforma (Vercel, Neon).
- Un proveedor cambia de estado (activo/inactivo) o de modelo principal.
- Las rutas/líneas citadas en `sources` del candidate se movieron o dejaron de existir.

## Cuándo NO
Corrección de bugs internos, textos o mensajes de error, estilos/UI, refactor sin cambiar flujos, dependencias, tests, docs. En esos casos no se toca el diagrama.

## Cómo
1. Commit primero del código (las evidencias se validan contra el commit, no contra el working tree).
2. Editar `candidate.json`: componentes, conexiones, `sources` (path + líneas del commit nuevo), tarjetas y `meta.repository.revision` = hash del commit.
3. `node ~/.claude/skills/archify/bin/archify.mjs finalize architecture <candidate.json> <udec-data.html> --repo-root . --quality showcase --json` — debe pasar los 4 gates.
4. Commit aparte: `docs: actualizar diagrama de arquitectura (…motivo…)`. Solo `candidate.json` y el `.html` (los recibos `.json` están en .gitignore).
5. En la respuesta al usuario, decir si se actualizó el diagrama o por qué no hizo falta.
