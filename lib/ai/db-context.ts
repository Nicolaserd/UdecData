/**
 * English-language context for each table in the institutional database.
 * Injected into plan and query prompts so small models understand the schema
 * before deciding whether to query the database.
 */
export const DB_CONTEXT = `
# Institutional Database — Universidad de Cundinamarca (UdeC)
Read-only PostgreSQL database. All data is real and up to date.

---

## Table: estudiantes
Stores **aggregated** student headcounts grouped by academic attributes.
Each row is NOT an individual student — it represents a group sharing the same
category, regional campus, level, program, year, and semester.

**Key columns:**
| Column | Type | Description |
|---|---|---|
| categoria | text | Student classification (see values below) |
| unidad_regional | text | Campus/regional center name |
| nivel | text | Broad level: Pregrado, Posgrado, Tecnología |
| nivel_academico | text | Specific level: Especialización, Maestría, Técnico, etc. |
| programa_academico | text | Exact academic program name |
| cantidad | integer | Headcount for this group — always use SUM(cantidad) |
| "año" | integer | Year (always quote with double quotes in SQL) |
| periodo | text | Semester: IPA = 1st semester, IIPA = 2nd semester |

**categoria values — critical:**
- \`Matriculados\` → active enrolled students that semester (most common metric)
- \`Primiparos\` → **PRIMÍPAROS** — students enrolling for the FIRST TIME (exact DB value, no accent)
- \`Graduados\` → students who obtained their degree
- \`Inscritos\` → applicants who registered (not yet admitted)
- \`Admitidos\` → accepted applicants (not yet enrolled)

**Rules:**
- NEVER mix categories in a SUM — always filter by exactly one categoria value
- For annual totals without double-counting: \`WHERE periodo = 'IPA'\`
- Primíparos = \`categoria = 'Primiparos'\` (exact value in DB, no accent)

---

## Table: encuestas_estudiantes
Student perception surveys from **Encuentros Dialógicos**.
One row per student response per event.
**Available years: 2025, 2026 only.**

**Key columns:**
| Column | Type | Description |
|---|---|---|
| experiencia_general | integer (1–5) | Overall experience rating (1=very bad, 5=excellent) |
| profundidad_temas | text | Excelente / Buena / Regular / Mala / Muy mala (can be null) |
| retroalimentacion | text | Feedback quality perception |
| seguimiento_compromisos | text | Follow-up on commitments |
| aspectos_mejora | text | Improvement areas suggested |
| programa | text | Student's academic program |
| "año" | integer | Year (2025 or 2026) |
| numero_encuentro | text | Encounter identifier (text, not integer) |
| unidad_regional | text | Campus |

---

## Table: encuestas_docentes
Faculty perception surveys from **Encuentros Dialógicos**.
One row per faculty member response per event.
**Available years: 2025, 2026 only.**

**Key columns:**
| Column | Type | Description |
|---|---|---|
| experiencia | integer (1–5) | Overall experience rating (1=very bad, 5=excellent) |
| profundidad_temas | text | Depth of topics |
| oportunidad_opinion | text | Opportunity to voice opinions |
| claridad_respuestas | text | Clarity of responses |
| convocatoria | text | Event outreach |
| organizacion | text | Event logistics |
| mecanismos_participacion | text | Participation mechanisms |
| participacion_comunidad | text | Community participation |
| uso_canales_digitales | text | Use of digital channels |
| aspectos_mejora | text | Improvement areas suggested |
| facultad | text | Faculty/school name |
| programa | text | Academic program |
| "año" | integer | Year (2025 or 2026) |
| encuentro | text | Encounter identifier |
| unidad_regional | text | Campus |

---

## Table: planes_mejoramiento_estudiantes
Improvement plans from student Encuentros Dialógicos (54 records).

**Known categoria values: 'Académica', 'Infraestructura'**

**Key columns:**
| Column | Type | Description |
|---|---|---|
| categoria | text | 'Académica' or 'Infraestructura' |
| subcategoria | text | Sub-category |
| plan_de_mejoramiento | text | Plan description |
| actividad | text | Specific activity |
| fecha_cumplimiento | text | Deadline |
| evidencias_cumplimiento | text | Evidence provided |
| calificacion_cumplimiento | float (0–1) | Fulfillment score — scale is 0 to 1, NOT 0 to 100 |
| efectividad | text | Effectiveness assessment |
| programa | text | Academic program |
| unidad_regional | text | Campus |
| facultad | text | Faculty |
| "año" | integer | Year |
| encuentro | text | Source encounter |

---

## Table: planes_mejoramiento_docentes
Improvement plans from faculty Encuentros Dialógicos (4 records).

**Known categoria values: 'Académico'**

**Key columns:**
| Column | Type | Description |
|---|---|---|
| categoria | text | 'Académico' |
| subcategoria | text | Sub-category |
| plan_de_mejoramiento | text | Plan description |
| actividad | text | Specific activity |
| calificacion_cumplimiento | float (0–1) | Fulfillment score — scale is 0 to 1, NOT 0 to 100 |
| calificacion | text | Additional note |
| programa | text | Academic program |
| unidad_regional | text | Campus |
| facultad | text | Faculty |
| "año" | integer | Year |

---

## Global SQL rules
- Column \`"año"\` must always be written with double quotes in PostgreSQL
- For annual enrollment without double-counting: \`WHERE periodo = 'IPA'\`
- Use \`SUM(cantidad)\` for student totals, \`AVG()\` for survey scores
- \`calificacion_cumplimiento\` is on a 0–1 scale (e.g. 0.64 = 64% fulfillment)
- Survey data only exists for years 2025 and 2026
- Never use \`SELECT *\` — always specify columns and aggregate with GROUP BY
- Max 200 rows returned per query (enforced by server)
`.trim();
