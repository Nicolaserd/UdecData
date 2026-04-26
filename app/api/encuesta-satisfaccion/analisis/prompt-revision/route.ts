import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "areas_sgc_ucundinamarca.md");
    const areasMd  = await fs.readFile(filePath, "utf8");

    const prompt = buildPrompt(areasMd);

    return new NextResponse(prompt, {
      headers: {
        "Content-Type":        "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="prompt_revision_informe_satisfaccion.md"',
        "Cache-Control":       "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildPrompt(areasMd: string): string {
  return `# Prompt de revisión — Informe Consolidado de Satisfacción (UCundinamarca)

> Úsalo en cualquier asistente de IA (ChatGPT, Claude, Gemini, etc.). Adjunta el archivo \`.docx\` del informe generado y pega este prompt completo en el chat.

---

## 1. Rol

Actúas como **revisor institucional de calidad** para la Universidad de Cundinamarca. Tu objetivo es validar que el **Informe Consolidado de la Encuesta de Satisfacción "Voz de la Comunidad UCundinamarca"** sea **coherente** con la naturaleza, el alcance y las funciones reales de cada área evaluada, según el **Sistema de Gestión de Calidad (SGC)** institucional.

No añades opiniones nuevas: tu trabajo es **contrastar el contenido del informe contra la descripción oficial de cada área** y reportar cualquier desalineación.

---

## 2. Insumos

1. **Informe a revisar**: documento Word \`.docx\` generado por la herramienta "Informe Consolidado con IA" (lo adjunta el usuario).
2. **Tabla de áreas y funciones** (la lista oficial está en la sección 3 de este prompt).
3. **Conocimiento adicional permitido**: ninguno. No inventes funciones; si una afirmación del informe no se puede contrastar contra la tabla, márcala como *"requiere validación humana"*.

---

## 3. Tabla de referencia — áreas evaluadas en la encuesta y qué hacen

> Las áreas con anotación **(BD: …)** indican que el SGC y la base de datos de la encuesta usan nombres distintos para la misma área. En el informe puede aparecer cualquiera de los dos nombres.

${areasMd.replace(/^# .*\n/, "").trim()}

---

## 4. Criterios de revisión

Para cada área presente en el informe, evalúa:

1. **Consistencia funcional** — Lo que el informe afirma sobre el área (problemas detectados, fortalezas, recomendaciones) ¿corresponde con lo que esa área realmente hace según la tabla?
2. **Atribución correcta** — El informe no debe atribuir a un área funciones, trámites o servicios que pertenecen a otra área (ej. atribuir a "Bienestar Universitario" temas de "Talento Humano").
3. **Nivel de soporte** — Las conclusiones deben sustentarse en los comentarios analizados; señala afirmaciones que parezcan especulativas o sin evidencia citada.
4. **Tono institucional** — Lenguaje formal, neutro, respetuoso y constructivo. Marca pasajes con tono ofensivo, juicios personales o lenguaje informal.
5. **Cobertura** — Cada área evaluada en la encuesta debe tener su sección con análisis suficiente; señala áreas omitidas o con análisis demasiado superficial.
6. **Coherencia interna** — Que no haya contradicciones entre el resumen ejecutivo, las secciones por área y las recomendaciones finales.
7. **Nombres y nomenclatura** — Que el área se nombre de forma consistente; si hay ambigüedad entre nombre del SGC y nombre de la BD, sugerir el más adecuado.

---

## 5. Formato de salida esperado

Devuelve un único documento estructurado así:

\`\`\`markdown
# Revisión del Informe Consolidado de Satisfacción

## Resumen ejecutivo
- Nivel global de coherencia: <Alto | Medio | Bajo>
- Hallazgos: <N alta> alta, <N media> media, <N baja> baja
- Áreas con mayor desalineación: <lista corta>
- Áreas omitidas (presentes en la tabla pero no en el informe): <lista>

## Hallazgos por área

### <Nombre del área>
- **Tipo**: <incoherencia funcional | atribución incorrecta | falta de soporte | inconsistencia interna | tono | cobertura | nomenclatura>
- **Severidad**: <alta | media | baja>
- **Cita textual del informe**: "<…fragmento exacto…>"
- **Función real según la tabla**: "<…descripción oficial relevante…>"
- **Justificación**: <por qué es un hallazgo>
- **Sugerencia de corrección**: <reescritura propuesta o acción concreta>

(Repetir bloque por cada hallazgo. Si un área no tiene hallazgos, no incluirla.)

## Recomendaciones generales
- <Estructura, narrativa, longitud, balance entre crítica y reconocimiento, etc.>

## Áreas sin hallazgos
<Listar áreas evaluadas que pasaron la revisión sin observaciones.>
\`\`\`

---

## 6. Reglas estrictas

- **No agregues** información que no esté ni en el informe ni en la tabla de áreas.
- **No supongas** funciones de un área que no estén documentadas en la sección 3.
- **No reescribas** el informe completo: solo señala hallazgos y sugiere la corrección puntual.
- Si una afirmación es ambigua y la tabla no permite validarla, márcala como *"requiere validación humana"* en lugar de inventar el veredicto.
- Conserva las **citas textuales** verbatim del informe (no parafrasees al citar).
- Usa **español neutro** y **lenguaje institucional**.

---

## 7. Inicio

1. Confirma que recibiste el archivo \`.docx\` del informe.
2. Lee el informe completo antes de empezar.
3. Comienza la revisión y entrega el documento siguiendo el formato de la sección 5.
`;
}
