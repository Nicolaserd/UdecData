/**
 * Inyección de un chart nativo de Excel en un .xlsx ya generado.
 *
 * SheetJS Community / xlsx-js-style no soportan charts. Esta utilidad abre el
 * archivo con JSZip, escribe los XML de chart + drawing + rels y registra los
 * tipos en [Content_Types].xml y la relación en xl/worksheets/_rels/sheetN.xml.rels.
 */
import JSZip from "jszip";

export type BarChartOpts = {
  /** Índice 1-based del worksheet (sheet1.xml, sheet2.xml…). */
  sheetIndex: number;
  /** Nombre del worksheet (para los rangos). */
  sheetName:  string;
  /** Rango de categorías (eje Y) — formato A1, ej. "$A$4:$A$25" */
  catRange:   string;
  /** Rango de valores (eje X) — ej. "$B$4:$B$25" */
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
};

export async function injectBarChart(buffer: Uint8Array, opts: BarChartOpts): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(buffer);

  zip.file("xl/charts/chart1.xml",                  chartXml(opts));
  zip.file("xl/drawings/drawing1.xml",              drawingXml(opts));
  zip.file("xl/drawings/_rels/drawing1.xml.rels",   drawingRelsXml());

  // [Content_Types].xml — añadir los Override del chart y drawing
  const ctPath = "[Content_Types].xml";
  let ct = await zip.file(ctPath)!.async("string");
  if (!ct.includes("/xl/charts/chart1.xml")) {
    ct = ct.replace(
      "</Types>",
      `<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>` +
      `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>` +
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
  if (relsXml) {
    relsXml = relsXml.replace(
      "</Relationships>",
      `<Relationship Id="${drawingId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`,
    );
  } else {
    relsXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="${drawingId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>` +
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
        <c:barDir val="bar"/>
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
            <a:solidFill><a:srgbClr val="9BBB59"/></a:solidFill>
            <a:ln w="9525"><a:solidFill><a:srgbClr val="6B8E3D"/></a:solidFill></a:ln>
          </c:spPr>
          <c:invertIfNegative val="0"/>
          <c:dLbls>
            <c:numFmt formatCode="0&quot;%&quot;" sourceLinked="0"/>
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
                <c:formatCode>0"%"</c:formatCode>
                <c:ptCount val="0"/>
              </c:numCache>
            </c:numRef>
          </c:val>
        </c:ser>
        <c:gapWidth val="60"/>
        <c:axId val="111111111"/>
        <c:axId val="222222222"/>
      </c:barChart>
      <c:catAx>
        <c:axId val="111111111"/>
        <c:scaling><c:orientation val="maxMin"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="l"/>
        <c:crossAx val="222222222"/>
        <c:crosses val="autoZero"/>
        <c:auto val="1"/>
        <c:lblAlgn val="ctr"/>
        <c:lblOffset val="100"/>
        <c:noMultiLvlLbl val="0"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="222222222"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="b"/>
        <c:numFmt formatCode="0&quot;%&quot;" sourceLinked="0"/>
        <c:majorTickMark val="out"/>
        <c:minorTickMark val="none"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="111111111"/>
        <c:crosses val="max"/>
        <c:crossBetween val="between"/>
      </c:valAx>
    </c:plotArea>
    <c:plotVisOnly val="1"/>
    <c:dispBlanksAs val="gap"/>
  </c:chart>
</c:chartSpace>`;
}

function drawingXml(opts: BarChartOpts): string {
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
        <xdr:cNvPr id="2" name="Chart 1"/>
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

function drawingRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
</Relationships>`;
}
