# UdecData - Portal de Inteligencia Academica

Aplicacion web para la Universidad de Cundinamarca que centraliza reportes
academicos, analitica institucional, pronostico de poblacion estudiantil,
gestion de Encuentros Dialogicos y agentes de IA para consulta y soporte.

El proyecto esta construido con Next.js App Router y usa PostgreSQL/Supabase
como fuente principal de datos. El modulo de agentes de IA puede consultar la
base de datos en modo solo lectura para responder preguntas institucionales con
datos reales.

## Modulos principales

### Automatizar Reportes para Boletin

- Carga de archivos de **Matriculados**, **Admitidos**, **Primiparos**,
  **Inscritos** y **Graduados**.
- Soporte para CSV y Excel (`.csv`, `.xlsx`, `.xls`).
- Archivo historico opcional `ESTUDIANTES.xlsx` para consolidar datos previos.
- Normalizacion de programas, municipios, unidades regionales, niveles y
  periodos academicos.
- Agrupacion por categoria, unidad regional, nivel, nivel academico, programa,
  anio y periodo.
- Exportacion de `ESTUDIANTES.xlsx` con estructura institucional.
- Persistencia en Supabase mediante Prisma, con validacion previa de datos
  existentes y confirmacion de sobrescritura por categoria.
- Dashboard con filtros, tarjetas resumen, graficas por periodo, distribucion,
  radar por sede, top programas y descarga completa de la base.

### Pronostico de Poblacion Estudiantil

- Consume la tabla `estudiantes` normalizada.
- Calcula los siguientes 3 periodos academicos a partir del ultimo periodo
  disponible.
- Usa media ponderada lineal por serie historica de categoria, sede, nivel y
  programa.
- Maneja escenarios con datos faltantes entre `IPA` e `IIPA` usando ratios por
  categoria y nivel.
- Muestra historico y pronostico en grafica de linea.
- Permite filtrar por categoria y descargar reportes Excel para pregrado y
  posgrado.

### Encuentros Dialogicos

- Carga de planes de mejoramiento de estudiantes y docentes.
- Vista previa antes de guardar: nuevos registros, registros a actualizar y
  filas omitidas.
- Upsert de planes con llaves unicas por encuentro, anio, programa, sede,
  facultad y actividad.
- Carga de encuestas de percepcion de estudiantes y docentes.
- Estadisticas de cumplimiento y satisfaccion con filtros por anio, programa y
  encuentro.
- Exportacion de bases de planes y encuestas en Excel.

## Agentes de IA

La ruta `/agentes` implementa un chat institucional con dos agentes:

| Agente | Rol | Acceso a datos |
|---|---|---|
| `analista` | Analista de Datos Academicos | Puede consultar la base institucional en modo solo lectura |
| `soporte` | Agente de Soporte | Orienta sobre el uso del portal sin consultar datos especificos de BD |

El usuario puede cambiar entre agentes, iniciar chats nuevos, cargar
conversaciones guardadas y ajustar el modelo de IA desde el modal de
configuracion.

### Agente Analista

El Analista esta pensado para preguntas como:

- Total de matriculados por anio, periodo, sede o programa.
- Comparativas entre unidades regionales.
- Tendencias de primiparos, inscritos, admitidos o graduados.
- Promedios de encuestas de estudiantes y docentes.
- Cumplimiento de planes de mejoramiento.

Su contexto de base de datos esta definido en `lib/ai/db-context.ts`. Ese
contexto explica al modelo las tablas permitidas, columnas clave, reglas de
negocio y ejemplos SQL. La base se consulta con `pg` directamente desde
`app/api/agentes/chat/route.ts`.

Tablas disponibles para el Analista:

- `estudiantes`
- `encuestas_estudiantes`
- `encuestas_docentes`
- `planes_mejoramiento_estudiantes`
- `planes_mejoramiento_docentes`

Reglas importantes del Analista:

- Para totales de estudiantes siempre usa `SUM(cantidad)`.
- Para matricula anual sin doble conteo usa `periodo = 'IPA'`.
- La columna de anio en PostgreSQL debe escribirse como `"a&ntilde;o"` dentro del SQL.
- `Primiparos` es el valor exacto de categoria para estudiantes de primer
  ingreso.
- Las encuestas usan promedios (`AVG`) sobre escalas de satisfaccion.
- `calificacion_cumplimiento` se interpreta en escala `0` a `1`, no `0` a
  `100`.

### Flujo del Analista

El endpoint principal es:

```txt
POST /api/agentes/chat
```

Cuando el agente activo es `analista`, el servidor ejecuta un flujo por fases y
lo transmite al frontend como NDJSON (`application/x-ndjson`). La UI muestra el
avance en vivo: plan, SQL generado, ejecucion e interpretacion.

Flujo completo:

1. **Pre-check de contexto**
   - Revisa si la pregunta puede responderse con el resumen o historial reciente.
   - Si no requiere datos nuevos, responde directamente.
   - Si necesita cifras reales, pasa a planificacion.

2. **Planificacion**
   - El modelo genera un plan sin SQL.
   - Cada item del plan representa una dimension distinta: total, sede,
     programa, nivel, periodo, etc.
   - El plan se limita a maximo 4 consultas.

3. **Resumen del plan**
   - El sistema crea una frase corta que resume que se va a consultar.
   - Este resumen se usa como contexto para las fases siguientes.

4. **Validacion del plan**
   - Otro paso del modelo valida si el plan responde la pregunta del usuario.
   - Si no responde, el sistema pregunta si la BD puede contestar esa solicitud.
   - Si la BD si puede, mejora el plan y reintenta.
   - Hay hasta 4 intentos de mejora.

5. **Generacion de SQL por item**
   - Para cada item validado, el modelo genera una consulta SQL.
   - La respuesta debe venir como un unico bloque `SELECT`.
   - No se aceptan escrituras ni consultas libres.

6. **Validacion de seguridad SQL**
   - Solo se permiten consultas que empiezan por `SELECT`.
   - Se bloquean `INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, `ALTER`,
     `TRUNCATE`, `GRANT`, `REVOKE`, `MERGE`, `CALL`, `EXEC`, `COPY`,
     `VACUUM`, `ANALYZE` y `EXPLAIN ANALYZE`.
   - No se permiten comentarios SQL ni punto y coma.
   - Solo se permiten las tablas institucionales listadas arriba.

7. **Ejecucion read-only**
   - El servidor abre una transaccion `BEGIN READ ONLY`.
   - Si la consulta no trae `LIMIT`, agrega `LIMIT 200`.
   - Si trae `LIMIT`, lo reduce a maximo `300`.
   - En error ejecuta `ROLLBACK`; en exito ejecuta `COMMIT`.

8. **Compresion de resultados**
   - Normaliza valores nulos numericos a `0`.
   - Devuelve muestra de hasta 15 filas.
   - Agrega estadisticas numericas (`min`, `max`, `avg`, `sum`) cuando aplica.
   - Esto evita respuestas demasiado grandes para el modelo.

9. **Interpretacion**
   - El modelo interpreta cada resultado en espanol formal.
   - No muestra nombres tecnicos de tablas ni SQL al usuario final.
   - Cada interpretacion se envia en vivo a la interfaz.

10. **Composicion final**
    - Genera un parrafo introductorio.
    - Agrega bullets con cada interpretacion.
    - Devuelve metadatos del modelo usado, trazas de fallback y SQL ejecutado.

### Agente de Soporte

El agente `soporte` no ejecuta SQL. Su proposito es orientar al usuario sobre:

- Dashboard de Estudiantes.
- Automatizacion de Reportes.
- Pronostico Estudiantil.
- Encuentros Dialogicos.
- Planes de Mejoramiento.
- Uso de los Agentes de IA.

Flujo del Soporte:

1. Recibe la pregunta, historial y resumen disponible.
2. Genera una respuesta con el modelo seleccionado o la cola de fallback.
3. Ejecuta una validacion/refinamiento final para asegurar claridad.
4. Responde en espanol, sin revelar informacion sensible ni datos especificos
   de BD.

### Modelos y proveedores

Los modelos disponibles estan definidos en `lib/ai/model-options.ts`.

Proveedores soportados:

- Groq
- Cerebras
- Kimi
- OpenRouter

El sistema maneja dos colas de fallback, una para `analista` y otra para
`soporte`. Si `autoSwitch` esta activo, el backend intenta el modelo preferido y
luego avanza por la cola cuando un proveedor falla, no tiene API key o devuelve
error.

El modal `components/agentes/SettingsModal.tsx` permite:

- Elegir modelo preferido.
- Activar o desactivar cambio automatico de modelo.
- Ingresar una API key personalizada para la sesion.

Las API keys personalizadas se envian con la solicitud y se usan solo para esa
sesion del navegador. Si no se ingresa una, el servidor usa las variables de
entorno correspondientes.

### Historial, resumen y titulos

La persistencia del chat usa los modelos Prisma `Chat` y `ChatMessage`:

- `Chat`: conversacion por agente, titulo, fecha de creacion y actualizacion.
- `ChatMessage`: mensajes `user` y `assistant` asociados a un chat.

Limites actuales:

- Maximo 20 chats guardados por agente.
- Maximo 30 mensajes por chat.
- Maximo 10 mensajes recientes como contexto directo.

Cuando el chat supera la ventana de contexto, el frontend pide al backend un
resumen corto de la conversacion reciente. Ese resumen se combina con los
ultimos mensajes para mantener continuidad sin enviar todo el historial.

Tambien se genera un titulo automatico de maximo 6 palabras a partir del
resumen de la conversacion.

### Streaming hacia la interfaz

El backend envia eventos NDJSON con estos pasos:

- `planning`: plan de consulta.
- `executing`: SQL generado y estado de ejecucion.
- `interpreting`: interpretacion parcial de resultados.
- `validating_answer`: validacion de coherencia.
- `translating`: verificacion de idioma.
- `done`: respuesta final.

La pagina `app/agentes/page.tsx` lee el stream con `ReadableStream`, actualiza
la burbuja de progreso y luego guarda la respuesta final en BD.

## Stack tecnologico

| Tecnologia | Uso |
|---|---|
| Next.js 16 | Framework full-stack con App Router |
| React 19 | UI cliente |
| TypeScript | Tipado estatico |
| Tailwind CSS 4 | Estilos |
| shadcn/ui y componentes propios | Botones, tablas, cards, progreso y UI base |
| Lucide React | Iconografia |
| Recharts | Graficas del dashboard y pronostico |
| Prisma v7 | ORM para PostgreSQL |
| Supabase/PostgreSQL | Base de datos institucional |
| pg | Consultas read-only directas desde el agente analista |
| PapaParse | Lectura de CSV |
| SheetJS (`xlsx`) | Lectura y escritura de Excel |
| react-dropzone | Carga de archivos |
| sonner | Notificaciones toast |
| Dice + Levenshtein | Normalizacion fuzzy sin dependencias externas |

## Estructura del proyecto

```txt
app/
  page.tsx
  automatizar-reportes/page.tsx
  pronostico-estudiantil/page.tsx
  encuentros-dialogicos/page.tsx
  agentes/page.tsx
  api/
    process-reports/route.ts
    check-existing/route.ts
    dashboard-data/route.ts
    export-db/route.ts
    pronostico/route.ts
    pronostico/download/route.ts
    agentes/chat/route.ts
    agentes/chats/route.ts
    agentes/chats/[id]/route.ts
    agentes/chats/[id]/messages/route.ts
    encuentros-dialogicos/*

components/
  agentes/
    SettingsModal.tsx
    UsageBar.tsx
  reports/
    upload-form.tsx
    dashboard.tsx
    results-table.tsx
    file-upload-zone.tsx
    confirm-overwrite.tsx
  layout/
    navbar.tsx
  ui/

lib/
  ai/
    db-context.ts
    model-options.ts
  aggregation/
    aggregate-students.ts
  export/
    generate-xlsx.ts
  normalization/
    canonical-data.ts
    fuzzy-matcher.ts
    municipio-mapper.ts
    nivel-resolver.ts
    program-normalizer.ts
  parsers/
    parse-matriculados.ts
    parse-admitidos.ts
    parse-primiparos.ts
    parse-inscritos.ts
    parse-graduados.ts
    parse-estudiantes-historico.ts
    read-file.ts
  supabase/
    save-estudiantes.ts
  pronostico.ts
  prisma.ts
  types.ts

prisma/
  schema.prisma
  migrations/

scripts/
  seed-historico.ts
  seed-encuestas.ts
  normalize-db.ts
  normalize-programs-db.ts
  fix-programs.ts
  test-fuzzy.ts
```

## Variables de entorno

| Variable | Descripcion |
|---|---|
| `DATABASE_URL` | Connection string de Supabase/PostgreSQL usada por Prisma y consultas read-only |
| `DIRECT_URL` | Connection string directo para migraciones |
| `GROQ_API_KEY` | API key del proveedor Groq |
| `CEREBRAS_API_KEY` | API key del proveedor Cerebras |
| `KIMI_API_KEY` | API key del proveedor Kimi/Moonshot |
| `OPENROUTER_API_KEY` | API key de OpenRouter |

No todas las claves de IA son obligatorias si el proveedor correspondiente no
se usa. Con `autoSwitch` activo, el sistema salta modelos sin API key y prueba
el siguiente disponible.

## Instalacion y desarrollo

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Comandos utiles:

```bash
npm run build
npm run lint
npx tsx scripts/seed-historico.ts
npx tsx scripts/normalize-db.ts
npx tsx scripts/test-fuzzy.ts
```

## Deploy en Vercel

1. Importar el repositorio en Vercel.
2. Framework: Next.js.
3. Configurar `DATABASE_URL`, `DIRECT_URL` y las API keys de IA necesarias.
4. Ejecutar deploy.

El build ejecuta:

```bash
prisma generate && next build
```

## Notas de seguridad del agente IA

- El Analista no recibe permisos de escritura sobre la base.
- El SQL generado por modelos se valida antes de ejecutarse.
- La ejecucion se realiza dentro de una transaccion `READ ONLY`.
- Solo se permiten tablas institucionales explicitamente listadas.
- La UI muestra trazas de modelos usados o fallidos, pero no expone API keys.
- El agente de Soporte tiene instrucciones explicitas para no revelar secretos,
  URLs de BD, IDs sensibles ni claves API.
