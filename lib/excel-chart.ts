/**
 * Inyección de charts nativos de Excel en un .xlsx ya generado.
 *
 * SheetJS Community / xlsx-js-style no soportan charts. Esta utilidad abre el
 * archivo con JSZip, escribe los XML de chart + drawing + rels y registra los
 * tipos en [Content_Types].xml y la relación en xl/worksheets/_rels/sheetN.xml.rels.
 *
 * Admite varios charts por hoja (un drawing por hoja con un anchor por chart) y
 * tres tipos: `bar` (barras horizontales), `col` (columnas verticales) y `pie`.
 * Los charts referencian celdas reales de la hoja; si se pasa `cache`, además se
 * guardan los valores para que se vean en visores que no recalculan.
 */
import JSZip from "jszip";

export type ChartKind = "bar" | "col" | "pie";

export type ChartOpts = {
  /** Índice 1-based del worksheet (sheet1.xml, sheet2.xml…). */
  sheetIndex: number;
  /** Nombre del worksheet (para los rangos). */
  sheetName:  string;
  /** Rango de categorías — formato A1, ej. "$A$4:$A$25" */
  catRange:   string;
  /** Rango de valores — ej. "$B$4:$B$25" */
  valRange:   string;
  /** Celda con el nombre de la serie — ej. "$B$3" */
  serNameRef: string;
  /** Texto que aparece como nombre de serie cuando se cachea. */
  serName:    string;
  /** Título del chart. */
  title:      string;
  /** Anclas (0-indexed). */
  fromCol: number; fromRow: number;
  toCol:   number; toRow:   number;
  /** Tipo de chart (default "bar"). */
  kind?: ChartKind;
  /** Código de formato numérico (default `0"%"`). */
  numFmt?: string;
  /** Máximo del eje de valores (ej. 1 para fracciones). No aplica a `pie`. */
  valMax?: number;
  /** Unidad mayor del eje de valores (ej. 0.25). No aplica a `pie`. */
  valMajorUnit?: number;
  /** Valores cacheados (mismo orden que los rangos). */
  cache?: { cats: string[]; vals: number[] };
};

/** Inyecta todos los charts en una sola pasada. Cada hoja debe venir sin drawing previo. */
export async function injectCharts(buffer: Uint8Array, charts: ChartOpts[]): Promise<Uint8Array> {
  if (charts.length === 0) return buffer;
  const zip = await JSZip.loadAsync(buffer);

  let nextChart   = countParts(zip, /^xl\/charts\/chart\d+\.xml$/) + 1;
  let nextDrawing = countParts(zip, /^xl\/drawings\/drawing\d+\.xml$/) + 1;

  const porHoja = new Map<number, ChartOpts[]>();
  for (const c of charts) {
    const list = porHoja.get(c.sheetIndex) ?? [];
    list.push(c);
    porHoja.set(c.sheetIndex, list);
  }

  const ctPath = "[Content_Types].xml";
  let ct = await zip.file(ctPath)!.async("string");

  for (const [sheetIndex, list] of porHoja) {
    const drawingNum = nextDrawing++;
    const anchors: string[] = [];
    const rels:    string[] = [];

    list.forEach((opts, i) => {
      const chartNum = nextChart++;
      zip.file(`xl/charts/chart${chartNum}.xml`, chartXml(opts));
      ct = ct.replace(
        "</Types>",
        `<Override PartName="/xl/charts/chart${chartNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`,
      );
      anchors.push(anchorXml(opts, `rId${i + 1}`, i + 2, chartNum));
      rels.push(`<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartNum}.xml"/>`);
    });

    zip.file(`xl/drawings/drawing${drawingNum}.xml`, drawingXml(anchors));
    zip.file(
      `xl/drawings/_rels/drawing${drawingNum}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`,
    );
    ct = ct.replace(
      "</Types>",
      `<Override PartName="/xl/drawings/drawing${drawingNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`,
    );

    // worksheet — añadir <drawing r:id="rId?"/> antes de </worksheet>
    const sheetPath     = `xl/worksheets/sheet${sheetIndex}.xml`;
    const sheetRelsPath = `xl/worksheets/_rels/sheet${sheetIndex}.xml.rels`;
    const sheetFile = zip.file(sheetPath);
    if (!sheetFile) throw new Error(`No existe la hoja ${sheetPath} para insertar gráficas`);
    let sheetXml = await sheetFile.async("string");
    if (sheetXml.includes("<drawing ")) throw new Error(`La hoja ${sheetPath} ya tiene un drawing`);

    let relsXml: string | null = null;
    let nextId = 1;
    const existing = zip.file(sheetRelsPath);
    if (existing) {
      relsXml = await existing.async("string");
      const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
      if (ids.length) nextId = Math.max(...ids) + 1;
    }
    const drawingRel = `rId${nextId}`;

    // Para hojas simples generadas por SheetJS basta con anteceder </worksheet>.
    sheetXml = sheetXml.replace("</worksheet>", `<drawing r:id="${drawingRel}"/></worksheet>`);
    zip.file(sheetPath, sheetXml);

    const rel = `<Relationship Id="${drawingRel}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingNum}.xml"/>`;
    relsXml = relsXml
      ? relsXml.replace("</Relationships>", `${rel}</Relationships>`)
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel}</Relationships>`;
    zip.file(sheetRelsPath, relsXml);
  }

  zip.file(ctPath, ct);
  return await zip.generateAsync({ type: "uint8array" });
}

// ─── Generadores de XML ──────────────────────────────────────────────────────

function countParts(zip: JSZip, re: RegExp): number {
  return Object.keys(zip.files).filter((p) => re.test(p)).length;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function quoteSheet(name: string): string {
  // Excel exige comillas simples cuando el nombre contiene espacios, ' u otros caracteres
  return `'${name.replace(/'/g, "''")}'`;
}

/** Nº de celdas de un rango de una fila o una columna ("$A$5:$A$9" → 5, "$B$4:$F$4" → 5). */
function rangeLength(range: string): number {
  const m = range.replace(/\$/g, "").match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!m) return 0;
  const col = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  return Math.max(Math.abs(Number(m[4]) - Number(m[2])), Math.abs(col(m[3]) - col(m[1]))) + 1;
}

// Paleta para porciones de torta (verde institucional primero).
const PIE_COLORS = ["548235", "E07B39", "A9D08E", "5B9BD5", "FFC000", "7F7F7F", "C6E0B4", "264478"];

function chartXml(opts: ChartOpts): string {
  const sn      = quoteSheet(opts.sheetName);
  const catFull = `${sn}!${opts.catRange}`;
  const valFull = `${sn}!${opts.valRange}`;
  const serFull = `${sn}!${opts.serNameRef}`;
  const title   = escapeXml(opts.title);
  const sname   = escapeXml(opts.serName);

  const kind      = opts.kind ?? "bar";
  const isPie     = kind === "pie";
  const isCol     = kind === "col";
  const numFmt    = opts.numFmt ?? `0"%"`;
  const numFmtAttr = escapeXml(numFmt);
  const nPts      = opts.cache?.cats.length ?? rangeLength(opts.catRange);

  const catCache = opts.cache
    ? `<c:strCache><c:ptCount val="${opts.cache.cats.length}"/>` +
      opts.cache.cats.map((c, i) => `<c:pt idx="${i}"><c:v>${escapeXml(c)}</c:v></c:pt>`).join("") +
      `</c:strCache>`
    : ``;
  const valCache = opts.cache
    ? `<c:numCache><c:formatCode>${numFmtAttr}</c:formatCode><c:ptCount val="${opts.cache.vals.length}"/>` +
      opts.cache.vals.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join("") +
      `</c:numCache>`
    : `<c:numCache><c:formatCode>${numFmtAttr}</c:formatCode><c:ptCount val="0"/></c:numCache>`;

  // Relleno de serie: columnas con degradado verde (estilo Excel), barras con sólido.
  const serFill = isCol
    ? `<a:gradFill><a:gsLst>` +
        `<a:gs pos="0"><a:srgbClr val="C6E0B4"/></a:gs>` +
        `<a:gs pos="100000"><a:srgbClr val="548235"/></a:gs>` +
      `</a:gsLst><a:lin ang="5400000" scaled="1"/></a:gradFill>`
    : `<a:solidFill><a:srgbClr val="9BBB59"/></a:solidFill>`;

  const dLbls = `
          <c:dLbls>
            <c:numFmt formatCode="${numFmtAttr}" sourceLinked="0"/>
            <c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>
            <c:txPr>
              <a:bodyPr rot="0" spcFirstLastPara="1" vertOverflow="ellipsis" wrap="square" lIns="38100" tIns="19050" rIns="38100" bIns="19050" anchor="ctr" anchorCtr="1"/>
              <a:lstStyle/>
              <a:p>
                <a:pPr>
                  <a:defRPr sz="900" b="1" i="0" u="none" strike="noStrike" baseline="0">
                    <a:solidFill><a:srgbClr val="${isPie ? "FFFFFF" : "1F3826"}"/></a:solidFill>
                    <a:latin typeface="+mn-lt"/>
                  </a:defRPr>
                </a:pPr>
                <a:endParaRPr lang="es-CO"/>
              </a:p>
            </c:txPr>
            <c:dLblPos val="${isPie ? "ctr" : "outEnd"}"/>
            <c:showLegendKey val="0"/>
            <c:showVal val="1"/>
            <c:showCatName val="0"/>
            <c:showSerName val="0"/>
            <c:showPercent val="0"/>
            <c:showBubbleSize val="0"/>
          </c:dLbls>`;

  const serHead = `
          <c:idx val="0"/>
          <c:order val="0"/>
          <c:tx>
            <c:strRef>
              <c:f>${serFull}</c:f>
              <c:strCache>
                <c:ptCount val="1"/>
                <c:pt idx="0"><c:v>${sname}</c:v></c:pt>
              </c:strCache>
            </c:strRef>
          </c:tx>`;
  const serData = `
          <c:cat><c:strRef><c:f>${catFull}</c:f>${catCache}</c:strRef></c:cat>
          <c:val><c:numRef><c:f>${valFull}</c:f>${valCache}</c:numRef></c:val>`;

  let plot: string;
  if (isPie) {
    const dPts = Array.from({ length: nPts }, (_, i) =>
      `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>` +
      `<a:solidFill><a:srgbClr val="${PIE_COLORS[i % PIE_COLORS.length]}"/></a:solidFill>` +
      `<a:ln w="12700"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`,
    ).join("");
    plot = `
      <c:pieChart>
        <c:varyColors val="1"/>
        <c:ser>${serHead}
          ${dPts}${dLbls}${serData}
        </c:ser>
        <c:firstSliceAng val="0"/>
      </c:pieChart>`;
  } else {
    const scaleExtra = opts.valMax != null ? `<c:max val="${opts.valMax}"/><c:min val="0"/>` : ``;
    const majorUnit  = opts.valMajorUnit != null ? `<c:majorUnit val="${opts.valMajorUnit}"/>` : ``;
    plot = `
      <c:barChart>
        <c:barDir val="${isCol ? "col" : "bar"}"/>
        <c:grouping val="clustered"/>
        <c:varyColors val="0"/>
        <c:ser>${serHead}
          <c:spPr>
            ${serFill}
            <a:ln w="9525"><a:solidFill><a:srgbClr val="6B8E3D"/></a:solidFill></a:ln>
          </c:spPr>
          <c:invertIfNegative val="0"/>${dLbls}${serData}
        </c:ser>
        <c:gapWidth val="60"/>
        <c:axId val="111111111"/>
        <c:axId val="222222222"/>
      </c:barChart>
      <c:catAx>
        <c:axId val="111111111"/>
        <c:scaling><c:orientation val="${isCol ? "minMax" : "maxMin"}"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="${isCol ? "b" : "l"}"/>
        <c:numFmt formatCode="General" sourceLinked="0"/>
        <c:majorTickMark val="none"/>
        <c:minorTickMark val="none"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="222222222"/>
        <c:crosses val="autoZero"/>
        <c:auto val="1"/>
        <c:lblAlgn val="ctr"/>
        <c:lblOffset val="100"/>
        <c:noMultiLvlLbl val="0"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="222222222"/>
        <c:scaling><c:orientation val="minMax"/>${scaleExtra}</c:scaling>
        <c:delete val="0"/>
        <c:axPos val="${isCol ? "l" : "b"}"/>
        <c:majorGridlines/>
        <c:numFmt formatCode="${numFmtAttr}" sourceLinked="0"/>
        <c:majorTickMark val="out"/>
        <c:minorTickMark val="none"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="111111111"/>
        <c:crosses val="${isCol ? "autoZero" : "max"}"/>
        <c:crossBetween val="between"/>
        ${majorUnit}
      </c:valAx>`;
  }

  const legend = isPie ? `<c:legend><c:legendPos val="r"/><c:overlay val="0"/></c:legend>` : ``;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title>
      <c:tx>
        <c:rich>
          <a:bodyPr rot="0" spcFirstLastPara="1" vertOverflow="ellipsis" wrap="square" anchor="ctr" anchorCtr="1"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr>
              <a:defRPr sz="1400" b="1" i="0" u="none" strike="noStrike" baseline="0">
                <a:solidFill><a:srgbClr val="1F3826"/></a:solidFill>
                <a:latin typeface="+mn-lt"/>
              </a:defRPr>
            </a:pPr>
            <a:r>
              <a:rPr lang="es-CO" sz="1400" b="1"/>
              <a:t>${title}</a:t>
            </a:r>
          </a:p>
        </c:rich>
      </c:tx>
      <c:overlay val="0"/>
      <c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>
    </c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>${plot}
    </c:plotArea>
    ${legend}
    <c:plotVisOnly val="1"/>
    <c:dispBlanksAs val="gap"/>
  </c:chart>
</c:chartSpace>`;
}

function anchorXml(opts: ChartOpts, relId: string, shapeId: number, chartNum: number): string {
  return `
  <xdr:twoCellAnchor>
    <xdr:from>
      <xdr:col>${opts.fromCol}</xdr:col><xdr:colOff>0</xdr:colOff>
      <xdr:row>${opts.fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff>
    </xdr:from>
    <xdr:to>
      <xdr:col>${opts.toCol}</xdr:col><xdr:colOff>0</xdr:colOff>
      <xdr:row>${opts.toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff>
    </xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="${shapeId}" name="Chart ${chartNum}"/>
        <xdr:cNvGraphicFramePr/>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm>
        <a:off x="0" y="0"/>
        <a:ext cx="0" cy="0"/>
      </xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${relId}"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>`;
}

function drawingXml(anchors: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors.join("")}
</xdr:wsDr>`;
}
