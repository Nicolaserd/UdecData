# UdecData - Automatizar Reportes para Boletin

Aplicacion web para la Universidad de Cundinamarca que automatiza la generacion de informes consolidados de estudiantes. Transforma archivos fuente individuales (CSV o Excel) en un consolidado agregado ESTUDIANTES.xlsx con conteos por categoria, region, programa, ano y periodo.

## Funcionalidades

### Carga y procesamiento de archivos
- Carga de 5 archivos requeridos: **Matriculados**, **Admitidos**, **Primiparos**, **Inscritos** y **Graduados**
- Acepta formatos **CSV** (.csv) y **Excel** (.xlsx, .xls) en todos los campos
- Deteccion automatica del formato del archivo
- Archivo historico opcional (ESTUDIANTES.xlsx) para consolidar con datos previos

### Normalizacion inteligente (Fuzzy Matching)
- Normalizacion generica de nombres de programas academicos usando **coeficiente de Dice** (bigramas) + **distancia de Levenshtein**
- Mapeo automatico de municipios a unidades regionales (7 sedes: Chia, Facatativa, Fusagasuga, Girardot, Soacha, Ubate, Zipaquira)
- Resolucion automatica de nivel y nivel academico basado en el nombre del programa
- Manejo de acentos, mayusculas/minusculas, encoding y errores tipograficos

### Agregacion y exportacion
- Agrupacion por: Categoria, Unidad Regional, Nivel, Nivel Academico, Programa Academico, Ano, Periodo
- Conteo automatico (GROUP BY + COUNT)
- Generacion de archivo ESTUDIANTES.xlsx con formato estandarizado (8 columnas)
- Periodos en formato IPA (semestre 1) e IIPA (semestre 2)

### Persistencia en base de datos
- Almacenamiento en **Supabase** (PostgreSQL) via **Prisma ORM v7**
- Upsert con constraint UNIQUE para evitar duplicados
- Verificacion de datos existentes antes de sobrescribir
- Confirmacion por categoria: el usuario elige que categorias reemplazar

### Dashboard estadistico
- **Tarjetas resumen** con total del ultimo periodo y % de cambio vs periodo anterior
- **Filtros interactivos**: Unidad Regional, Programa Academico y Ano (por defecto muestra todo)
- **Linea de tiempo** por periodo academico (eje X = ano-periodo, ordenado IPA antes de IIPA)
- **Distribucion acumulada** (AreaChart apilado)
- **Media y desviacion estandar por ano** (barras + tabla con sigma)
- **Estadisticas por tipo de periodo** (IPA vs IIPA con mu y sigma)
- **Tasa de crecimiento interanual** (variacion % ano a ano)
- **Radar por unidad regional** (comparacion entre sedes)
- **Top 10 programas academicos** (barras horizontales)
- **Distribucion por nivel de formacion** (Pregrado, Tecnologia, Posgrado)
- **Boton de descarga** de la base de datos completa como Excel

### UX
- Loading spinners animados en botones de descarga y procesamiento
- Barra de progreso con mensajes contextuales por etapa de procesamiento
- Indicacion de columnas requeridas por archivo (expandible)
- Toasts de confirmacion, advertencia y error

## Stack tecnologico

| Tecnologia | Uso |
|---|---|
| **Next.js 16** | Framework full-stack (App Router) |
| **TypeScript** | Tipado estatico |
| **Tailwind CSS 4** | Estilos |
| **shadcn/ui** | Componentes UI (Card, Table, Progress, Badge, Button) |
| **Recharts** | Graficas del dashboard |
| **Prisma v7** | ORM con adapter pattern (@prisma/adapter-pg) |
| **Supabase** | Base de datos PostgreSQL |
| **PapaParse** | Parseo de CSV con delimitador `;` y header |
| **SheetJS (xlsx)** | Lectura/escritura de archivos Excel |
| **react-dropzone** | Zonas de carga de archivos |
| **sonner** | Notificaciones toast |
| **Dice + Levenshtein** | Fuzzy matching generico (sin dependencias externas) |

## Estructura del proyecto

```
app/
  page.tsx                           # Landing page
  automatizar-reportes/page.tsx      # Pagina principal con upload + dashboard
  api/
    process-reports/route.ts         # Pipeline: parse -> normalize -> aggregate -> save -> xlsx
    check-existing/route.ts          # Verificar datos existentes por ano+periodo
    dashboard-data/route.ts          # Datos para el dashboard (con normalizacion)
    export-db/route.ts               # Descargar BD completa como Excel
    health/route.ts                  # Health check de conexion a BD

components/
  reports/
    upload-form.tsx                  # Formulario de carga con flujo de confirmacion
    file-upload-zone.tsx             # Dropzone individual con columnas requeridas
    confirm-overwrite.tsx            # Dialogo de confirmacion por categoria
    results-table.tsx                # Tabla paginada de resultados
    dashboard.tsx                    # Dashboard completo con filtros y graficas
  ui/                                # Componentes shadcn/ui + spinner

lib/
  types.ts                          # Tipos: NormalizedStudentRow, EstudiantesRow
  prisma.ts                         # Singleton de Prisma con PrismaPg adapter
  parsers/
    parse-matriculados.ts            # Parser CSV/Excel -> NormalizedStudentRow[]
    parse-admitidos.ts
    parse-primiparos.ts
    parse-inscritos.ts
    parse-graduados.ts
    parse-estudiantes-historico.ts   # Parser del historico ESTUDIANTES.xlsx
    read-file.ts                     # Auto-deteccion CSV vs Excel
  normalization/
    fuzzy-matcher.ts                 # Dice coefficient + Levenshtein (generico)
    canonical-data.ts                # Nombres canonicos y reglas de nivel
    program-normalizer.ts            # Wrapper de fuzzy para programas
    municipio-mapper.ts              # Wrapper de fuzzy para municipios
    nivel-resolver.ts                # Inferir nivel/nivel academico del programa
  aggregation/
    aggregate-students.ts            # GROUP BY + COUNT con merge de historico
  export/
    generate-xlsx.ts                 # Generacion de ESTUDIANTES.xlsx
  supabase/
    save-estudiantes.ts              # Upsert con filtro por categorias permitidas

scripts/
  seed-historico.ts                  # Cargar ESTUDIANTES.xlsx inicial a Supabase
  normalize-db.ts                    # Normalizar nivel/periodo en BD existente
  fix-programs.ts                    # Corregir duplicados de programas
  test-fuzzy.ts                      # 91 tests del fuzzy matcher
```

## Instalacion y desarrollo

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase

# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate deploy

# (Opcional) Cargar datos historicos
npx tsx scripts/seed-historico.ts

# Iniciar servidor de desarrollo
npm run dev
```

## Variables de entorno

| Variable | Descripcion |
|---|---|
| `DATABASE_URL` | Connection string de Supabase (puerto 6543, pgbouncer) |
| `DIRECT_URL` | Connection string directo (puerto 5432, para migraciones) |

## Deploy en Vercel

1. Importar el repositorio en Vercel
2. Framework: Next.js (auto-detectado)
3. Agregar las variables de entorno `DATABASE_URL` y `DIRECT_URL`
4. Deploy automatico

El build ejecuta `prisma generate && next build` automaticamente.
