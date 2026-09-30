---
paths:
  - "app/api/**"
  - "lib/**"
  - "prisma/**"
  - "prisma.config.ts"
  - "scripts/**"
---
# Reglas de base de datos (Neon + Prisma)

- Acceso solo vía `lib/prisma.ts` (pool `max: 5`, `statement_timeout` 30 s). No crear otros clientes en código de la app.
- `DATABASE_URL` = pooled (app); `DIRECT_URL` = directa (migraciones). Ambas solo en `.env`.
- Valores únicos o conteos distintos: `groupBy({ by })` (SQL). **Nunca** `findMany({ distinct })`: trae todas las filas y deduplica en Node.
- Consultas acotadas: `take`/filtros; no devolver tablas completas salvo en exports protegidos.
- SQL crudo solo con `prisma.$queryRaw` (template tag). Prohibido `$queryRawUnsafe` / `$executeRawUnsafe` con datos de usuario.
- Migraciones: `pnpm exec prisma migrate dev` / `migrate deploy`. Nunca `db push --accept-data-loss` contra producción.
- Excel: leer con `xlsx` (`XLSX.read(fs.readFileSync(ruta), { type: "buffer" })`, no `readFile`). `xlsx-js-style` solo para escribir.
