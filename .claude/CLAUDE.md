# Automatizar UdeC — reglas esenciales

Next.js (App Router) + TypeScript + Prisma 7 → **Neon** (PostgreSQL). Supabase solo para Storage.
Reglas detalladas en `.claude/rules/` (se cargan solas según los archivos que toques).

1. **Solo `pnpm`** (`pnpm add | remove | install | exec | dlx`). Nunca npm/npx/yarn/bun.
2. **Versiones estables más recientes**; Next.js = dist-tag `latest`. Nada de canary/beta/rc.
3. **Solo librerías confiables** — criterios en `rules/paquetes.md` antes de agregar una.
4. **Secretos solo en `.env`** (`DATABASE_URL`, `DIRECT_URL`, claves IA). Nunca en código, logs ni `NEXT_PUBLIC_*`.
5. **Git: autoría solo del dueño del repo** (`git config user.*` actual). Sin Co-Authored-By ni firmas de IA.
6. Commits/push solo cuando el usuario lo pida.
7. Si un cambio altera la arquitectura (componentes, flujos, seguridad, proveedores), actualizar el diagrama Archify según `rules/diagrama.md`; si no, no tocarlo.

Hook `.claude/hooks/guard.mjs` (PreToolUse) bloquea automáticamente las violaciones de 1 y 5.

Comandos: `pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm audit --prod` · `pnpm exec prisma migrate dev`
