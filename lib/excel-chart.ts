/**
 * Inyección de charts nativos de Excel en un .xlsx ya generado.
 *
 * SheetJS Community / xlsx-js-style no soportan charts. Esta utilidad abre el
 * archivo con JSZip, escribe los XML de chart + drawing + rels y registra los
 * tipos en [Content_Types].xml y la relación en xl/worksheets/_rels/sheetN.xml.rels.
 *
 * Soporta múltiples charts en el mismo libro vía `chartId` (cada uno usa sus
 * propios chart{id}.xml / drawing{id}.xml), y dirección de barras `bar`
 * (horizontal) o `col` (columnas verticales).
 */
import JSZip from "jszip";

export type BarChartOpts = {
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
  /** Id único del chart dentro del libro (default 1). */
  chartId?: number;
  /** Dirección de barras: "bar" horizontal (default) o "col" columnas verticales. */
  barDir?: "bar" | "col";
  /** Código de formato numérico (default `0"%"`). */
  numFmt?: string;
  /** Máximo del eje de valores (ej. 1 para fracciones). */
  valMax?: number;
  /** Unidad mayor del eje de valores (ej. 0.25). */
  valMajorUnit?: number;
};

export async function injectBarChart(buffer: Uint8Array, opts: BarChartOpts): Promise<Uint8Array> {
  const id  = opts.chartId ?? 1;
  const zip = await JSZip.loadAsync(buffer);

  zip.file(`xl/charts/chart${id}.xml`,                chartXml(opts));
  zip.file(`xl/drawings/drawing${id}.xml`,            drawingXml(opts));
  zip.file(`xl/drawings/_rels/drawing${id}.xml.rels`, drawingRelsXml(id));

  // [Content_Types].xml — añadir los Override del chart y drawing
  const ctPath = "[Content_Types].xml";
  let ct = await zip.file(ctPath)!.async("string");
  if (!ct.includes(`/xl/charts/chart${id}.xml`)) {
    ct = ct.replace(
      "</Types>",
      `<Override PartName="/xl/charts/chart${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>` +
      `<Override PartName="/xl/drawings/drawing${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>` +
      `</Types>`,
    );
    zip.file(ctPath, ct);
  }

  // worksheet — añadir <drawing r:id="rId?"/> antes de </worksheet>
  const sheetPath     = `xl/worksheets/sheet${opts.sheetIndex}.xml`;
  const sheetRelsPath = `xl/worksheets/_rels/sheet${opts.sheetIndex}.xml.rels`;

  let sheetXml = await zip.file(sheetPath)!.async("string");

  // Resolver rId único a partir de los rels existentes (si los hay)
  let nextId = 1;
  let relsXml: string | null = null;
  const existing = zip.file(sheetRelsPath);
  if (existing) {
    relsXml = await existing.async("string");
    const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
    if (ids.length) nextId = Math.max(...ids) + 1;
  }
  const drawingId = `rId${nextId}`;

  if (!sheetXml.includes("<drawing ")) {
    // Inserta antes de cualquier elemento de cierre permitido posterior. Para sheets
    // simples generados por SheetJS basta con anteceder </worksheet>.
    sheetXml = sheetXml.replace("</worksheet>", `<drawing r:id="${drawingId}"/></worksheet>`);
    zip.file(sheetPath, sheetXml);
  }

  // worksheet rels
  const relTarget = `../drawings/drawing${id}.xml`;
  if (relsXml) {
    relsXml = relsXml.replace(
      "</Relationships>",
      `<Relationship Id="${drawingId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="${relTarget}"/></Relationships>`,
    );
  } else {
    relsXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="${drawingId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="${relTarget}"/>` +
      `</Relationships>`;
  }
  zip.file(sheetRelsPath, relsXml);

  return await zip.generateAsync({ type: "uint8array" });
}

// ─── Generadores de XML ──────────────────────────────────────────────────────

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

function chartXml(opts: BarChartOpts): string {
  const sn      = quoteSheet(opts.sheetName);
  const catFull = `${sn}!${opts.catRange}`;
  const valFull = `${sn}!${opts.valRange}`;
  const serFull = `${sn}!${opts.serNameRef}`;
  const title   = escapeXml(opts.title);
  const sname   = escapeXml(opts.serName);

  const barDir   = opts.barDir ?? "bar";
  const isCol     = barDir === "col";
  const numFmt    = opts.numFmt ?? `0"%"`;
  const numFmtAttr = numFmt.replace(/"/g, "&quot;");

  // Relleno de serie: columnas con degradado verde (estilo Excel), barras con sólido.
  const serFill = isCol
    ? `<a:gradFill><a:gsLst>` +
        `<a:gs pos="0"><a:srgbClr val="C6E0B4"/></a:gs>` +
        `<a:gs pos="100000"><a:srgbClr val="548235"/></a:gs>` +
      `</a:gsLst><a:lin ang="5400000" scaled="1"/></a:gradFill>`
    : `<a:solidFill><a:srgbClr val="9BBB59"/></a:solidFill>`;

  // Escala del eje de valores
  const scaleExtra =
    (opts.valMax != null ? `<c:max val="${opts.valMax}"/><c:min val="0"/>` : ``);
  const majorUnit = opts.valMajorUnit != null ? `<c:majorUnit val="${opts.valMajorUnit}"/>` : ``;

  // Ejes según dirección
  const catAx = `
      <c:catAx>
        <c:axId val="111111111"/>
        <c:scaling><c:orientation val="${isCol ? "minMax" : "maxMin"}"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="${isCol ? "b" : "l"}"/>
        <c:crossAx val="222222222"/>
        <c:crosses val="autoZero"/>
        <c:auto val="1"/>
        <c:lblAlgn val="ctr"/>
        <c:lblOffset val="100"/>
        <c:noMultiLvlLbl val="0"/>
      </c:catAx>`;
  const valAx = `
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
      <c:layout/>
      <c:barChart>
        <c:barDir val="${barDir}"/>
        <c:grouping val="clustered"/>
        <c:varyColors val="0"/>
        <c:ser>
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
          </c:tx>
          <c:spPr>
            ${serFill}
            <a:ln w="9525"><a:solidFill><a:srgbClr val="6B8E3D"/></a:solidFill></a:ln>
          </c:spPr>
          <c:invertIfNegative val="0"/>
          <c:dLbls>
            <c:numFmt formatCode="${numFmtAttr}" sourceLinked="0"/>
            <c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>
            <c:txPr>
              <a:bodyPr rot="0" spcFirstLastPara="1" vertOverflow="ellipsis" wrap="square" lIns="38100" tIns="19050" rIns="38100" bIns="19050" anchor="ctr" anchorCtr="1"/>
              <a:lstStyle/>
              <a:p>
                <a:pPr>
                  <a:defRPr sz="900" b="1" i="0" u="none" strike="noStrike" baseline="0">
                    <a:solidFill><a:srgbClr val="1F3826"/></a:solidFill>
                    <a:latin typeface="+mn-lt"/>
                  </a:defRPr>
                </a:pPr>
                <a:endParaRPr lang="es-CO"/>
              </a:p>
            </c:txPr>
            <c:dLblPos val="outEnd"/>
            <c:showLegendKey val="0"/>
            <c:showVal val="1"/>
            <c:showCatName val="0"/>
            <c:showSerName val="0"/>
            <c:showPercent val="0"/>
            <c:showBubbleSize val="0"/>
          </c:dLbls>
          <c:cat>
            <c:strRef>
              <c:f>${catFull}</c:f>
            </c:strRef>
          </c:cat>
          <c:val>
            <c:numRef>
              <c:f>${valFull}</c:f>
              <c:numCache>
                <c:formatCode>${numFmt}</c:formatCode>
                <c:ptCount val="0"/>
              </c:numCache>
            </c:numRef>
          </c:val>
        </c:ser>
        <c:gapWidth val="60"/>
        <c:axId val="111111111"/>
        <c:axId val="222222222"/>
      </c:barChart>${catAx}${valAx}
    </c:plotArea>
    <c:plotVisOnly val="1"/>
    <c:dispBlanksAs val="gap"/>
  </c:chart>
</c:chartSpace>`;
}

function drawingXml(opts: BarChartOpts): string {
  const id = opts.chartId ?? 1;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
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
        <xdr:cNvPr id="${id + 1}" name="Chart ${id}"/>
        <xdr:cNvGraphicFramePr/>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm>
        <a:off x="0" y="0"/>
        <a:ext cx="0" cy="0"/>
      </xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;
}

function drawingRelsXml(id: number): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${id}.xml"/>
</Relationships>`;
}
