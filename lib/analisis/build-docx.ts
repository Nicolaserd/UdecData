import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } from "docx";

type ConsolidadoInput = {
  area:    string;
  parrafo: string;
};

export async function buildInformeDocx(params: {
  anio:             number;
  periodo:          string;
  totalRespuestas:  number;
  totalComentarios: number;
  consolidados:     ConsolidadoInput[];
}): Promise<Buffer> {
  const { anio, periodo, totalRespuestas, totalComentarios, consolidados } = params;

  const fecha = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading:   HeadingLevel.TITLE,
      children:  [new TextRun({ text: "Análisis Cualitativo de la Encuesta de Satisfacción", bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children:  [new TextRun({ text: `Universidad de Cundinamarca — Generación Siglo XXI`, italics: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children:  [new TextRun({ text: `Periodo académico ${periodo} · ${anio}`, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children:  [new TextRun({ text: `Fecha de generación: ${fecha}` })],
    }),
    new Paragraph({ text: "" }),

    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Introducción", bold: true })] }),
    new Paragraph({
      children: [new TextRun(
        `El presente informe recoge el análisis cualitativo de los comentarios abiertos emitidos por la comunidad ` +
        `universitaria en la encuesta de satisfacción aplicada durante el periodo académico ${periodo} del año ${anio}. ` +
        `Se procesaron ${totalRespuestas.toLocaleString("es-CO")} registros con un total de ${totalComentarios.toLocaleString("es-CO")} ` +
        `comentarios significativos, agrupados por área evaluada.`,
      )],
    }),
    new Paragraph({ text: "" }),

    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Metodología", bold: true })] }),
    new Paragraph({
      children: [new TextRun(
        `Los comentarios se extrajeron directamente de la base de datos institucional y se agruparon por área, ` +
        `evitando la mezcla entre áreas. Tras eliminar respuestas vacías, duplicadas o sin información útil, ` +
        `se dividieron en bloques de tamaño controlado para su análisis mediante modelos de lenguaje. ` +
        `Cada bloque produjo un análisis parcial que posteriormente se consolidó en un único párrafo por área. ` +
        `El presente documento compila únicamente los consolidados finales, sin procesamiento adicional.`,
      )],
    }),
    new Paragraph({ text: "" }),

    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Desarrollo del análisis por áreas", bold: true })] }),
  ];

  for (const c of consolidados) {
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: c.area, bold: true })] }),
      new Paragraph({ children: [new TextRun(c.parrafo || "Sin consolidado disponible.")] }),
      new Paragraph({ text: "" }),
    );
  }

  children.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Consideraciones finales", bold: true })] }),
    new Paragraph({
      children: [new TextRun(
        `Los hallazgos presentados constituyen un insumo para la toma de decisiones institucionales. Se recomienda ` +
        `socializar los resultados con las dependencias correspondientes y definir planes de mejora concretos frente a ` +
        `las problemáticas recurrentes identificadas en cada área.`,
      )],
    }),
  );

  const doc = new Document({
    creator:     "Universidad de Cundinamarca",
    title:       `Análisis Cualitativo ${periodo} ${anio}`,
    description: `Consolidado de comentarios por área — encuesta de satisfacción`,
    sections:    [{ children }],
  });

  return Packer.toBuffer(doc);
}
