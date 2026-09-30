---
paths:
  - "package.json"
  - "pnpm-lock.yaml"
  - "pnpm-workspace.yaml"
---
# Reglas de paquetes y versiones

## pnpm
- Versión fijada en `devEngines.packageManager` de `package.json` (npm falla con EBADDEVENGINES).
- Lockfile único: `pnpm-lock.yaml` (commitearlo). Borrar `package-lock.json`/`yarn.lock` si aparecen.
- `pnpm-workspace.yaml`: `minimumReleaseAge: 1440` (no instalar versiones con < 24 h), `allowBuilds` (únicos postinstall permitidos) y `overrides` de seguridad. No desactivar ni ampliar sin justificar.
- Vercel: `pnpm install --frozen-lockfile`.

## Versiones
- `next` y `eslint-config-next` misma versión exacta = `pnpm view next dist-tags.latest`. `react` = `react-dom`, exactas.
- Resto: última estable. Nada de `-alpha/-beta/-rc/-canary/-next`.
- Major: leer guía de migración; `pnpm build` y `pnpm lint` deben pasar.
- Tras cambiar dependencias: `pnpm audit --prod` debe quedar en 0 high/critical.

## Librería nueva — verificar todo
1. ¿Se resuelve con código propio o algo ya instalado? Entonces no agregar.
2. Release en los últimos 12 meses y repo activo.
3. Adopción amplia (≥ 100k descargas/semana) u organización reconocida.
4. Sin vulnerabilidades high/critical.
5. Nombre exacto verificado (typosquatting): `pnpm view <pkg>`.
6. Licencia MIT / Apache-2.0 / BSD / ISC.
7. Herramientas de build (CLI, tipos) → `devDependencies`.

## Excepciones
- `xlsx`: desde el CDN oficial `https://cdn.sheetjs.com/xlsx-X.Y.Z/xlsx-X.Y.Z.tgz` (≥ 0.20.2), nunca desde npm (0.18.5 vulnerable). El lockfile debe tener su `integrity`.
- `exceljs`: descartado (sin mantenimiento, dependencias obsoletas).
- `xlsx-js-style`: solo escritura con estilos; prohibido para leer archivos.
