import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { prisma } from "@/lib/prisma";
import { normKey } from "@/lib/parsers/encuesta-satisfaccion";
import { injectBarChart } from "@/lib/excel-chart";

export const runtime     = "nodejs";
export const maxDuration = 60;

const NIVELES = [
  "Muy insatisfecho",
  "Insatisfecho",
  "Ni satisfecho ni insatisfecho",
  "Satisfecho",
  "Muy satisfecho",
] as const;

type Grupo = "Administrativo" | "Docente" | "Estudiante" | "Graduado";
const GRUPOS: readonly Grupo[] = ["Administrativo", "Docente", "Estudiante", "Graduado"];

// Fuente: grupos_evalua_area_iipa_2025.md (claves normalizadas con normKey)
const AREA_GRUPOS: Record<string, readonly Grupo[]> = {
  "procesos financieros":              ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "talento humano":                    ["Administrativo", "Docente"],
  "direccion de talento humano":       ["Administrativo", "Docente"],
  "admisiones y registro":             ["Administrativo", "Docente", "Estudiante"],
  "direccion de investigacion":        ["Administrativo", "Docente", "Estudiante"],
  "interaccion social universitaria":  ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "bienestar universitario":           ["Administrativo", "Docente", "Estudiante"],
  "dialogando con el mundo":           ["Administrativo", "Docente", "Estudiante"],
  "oficina de graduados":              ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "educacion virtual":                 ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "educacion virtual y a distancia":   ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "atencion al ciudadano":             ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "planeacion institucional":          ["Administrativo", "Estudiante"],
  "bienes y servicios":                ["Administrativo", "Docente", "Estudiante"],
  "comunicaciones":                    ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "oficina asesora de comunicaciones": ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "autoevaluacion y acreditacion":     ["Administrativo", "Docente", "Estudiante"],
  "formacion y aprendizaje":           ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "planta fisica":                     ["Administrativo", "Docente", "Estudiante", "Graduado"],
  "laboratorios":                      ["Docente", "Estudiante"],
  "espacios deportivos":               ["Administrativo", "Docente", "Estudiante"],
  "biblioclic":                        ["Administrativo", "Docente", "Estudiante"],
  "biblioteca biblioclic":             ["Administrativo", "Docente", "Estudiante"],
  "instituto de posgrados":            ["Administrativo", "Docente", "Estudiante"],
};

const AREA_ORDER = [
  "procesos financieros",
  "talento humano",
  "admisiones y registro",
  "direccion de investigacion",
  "interaccion social universitaria",
  "bienestar universitario",
  "dialogando con el mundo",
  "oficina de graduados",
  "educacion virtual y a distancia",
  "educacion virtual",
  "atencion al ciudadano",
  "planeacion institucional",
  "bienes y servicios",
  "comunicaciones",
  "autoevaluacion y acreditacion",
  "formacion y aprendizaje",
  "planta fisica",
  "laboratorios",
  "espacios deportivos",
  "biblioclic",
  "instituto de posgrados",
];

function gruposParaArea(area: string): readonly Grupo[] {
  const k = normKey(area);
  if (AREA_GRUPOS[k]) return AREA_GRUPOS[k];
  for (const [key, grupos] of Object.entries(AREA_GRUPOS)) {
    if (k.includes(key) || key.includes(k)) return grupos;
  }
  return GRUPOS;
}

function ordenAreaIdx(area: string): number {
  const k = normKey(area);
  const idx = AREA_ORDER.indexOf(k);
  if (idx >= 0) return idx;
  for (let i = 0; i < AREA_ORDER.length; i++) {
    const ref = AREA_ORDER[i];
    if (k.includes(ref) || ref.includes(k)) return i;
  }
  return AREA_ORDER.length + 1;
}

function normalizeRol(rol: string): Grupo | null {
  const k = normKey(rol);
  if (k.includes("administrativo")) return "Administrativo";
  if (k.includes("docente"))        return "Docente";
  if (k.includes("estudiante"))     return "Estudiante";
  if (k.includes("graduado") || k.includes("egresado")) return "Graduado";
  return null;
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const COL_HEADER = "A9D08E";
const COL_TOTAL  = "E2EFDA";
const BORDER      = { style: "thin" as const, color: { rgb: "808080" } };
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

type CellStyle = XLSX.CellStyle;

const styleAreaTitle: CellStyle = {
  font: { bold: true, sz: 13, color: { rgb: "1F4E2C" } },
  alignment: { horizontal: "left", vertical: "center" },
};

const styleHeader: CellStyle = {
  font: { bold: true, sz: 11, color: { rgb: "1F3826" } },
  fill: { patternType: "solid", fgColor: { rgb: COL_HEADER } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: ALL_BORDERS,
};

const styleGroupLabel: CellStyle = {
  font: { bold: true, sz: 11 },
  alignment: { horizontal: "left", vertical: "center" },
  border: ALL_BORDERS,
};

const styleData: CellStyle = {
  font: { sz: 11 },
  alignment: { horizontal: "center", vertical: "center" },
  border: ALL_BORDERS,
};

const styleDataHighlight: CellStyle = {
  font: { bold: true, sz: 11, color: { rgb: "1F3826" } },
  fill: { patternType: "solid", fgColor: { rgb: COL_HEADER } },
  alignment: { horizontal: "center", vertical: "center" },
  border: ALL_BORDERS,
};

const styleTotalLabel: CellStyle = {
  font: { bold: true, sz: 11 },
  fill: { patternType: "solid", fgColor: { rgb: COL_TOTAL } },
  alignment: { horizontal: "left", vertical: "center" },
  border: ALL_BORDERS,
};

const styleTotalData: CellStyle = {
  font: { bold: true, sz: 11 },
  fill: { patternType: "solid", fgColor: { rgb: COL_TOTAL } },
  alignment: { horizontal: "center", vertical: "center" },
  border: ALL_BORDERS,
};

const styleTotalHighlight: CellStyle = {
  font: { bold: true, sz: 11, color: { rgb: "1F3826" } },
  fill: { patternType: "solid", fgColor: { rgb: COL_HEADER } },
  alignment: { horizontal: "center", vertical: "center" },
  border: ALL_BORDERS,
};

// ─── Estilos hoja "Resumen general" ──────────────────────────────────────────

const styleChartTitle: CellStyle = {
  font: { bold: true, sz: 14, color: { rgb: "1F3826" } },
  alignment: { horizontal: "center", vertical: "center" },
};

const styleResumenAreaCell: CellStyle = {
  font: { sz: 11, color: { rgb: "191C1D" } },
  alignment: { horizontal: "left", vertical: "center" },
  border: ALL_BORDERS,
};

const styleResumenPctCell: CellStyle = {
  font: { bold: true, sz: 11, color: { rgb: "1F3826" } },
  fill: { patternType: "solid", fgColor: { rgb: COL_HEADER } },
  alignment: { horizontal: "center", vertical: "center" },
  border: ALL_BORDERS,
};

// ─── Helpers de celdas ───────────────────────────────────────────────────────

type RawCell =
  | { kind: "title";        text: string }
  | { kind: "subtitle";     text: string }
  | { kind: "areaTitle";    text: string }
  | { kind: "header";       text: string }
  | { kind: "groupLabel";   text: string }
  | { kind: "totalLabel";   text: string }
  | { kind: "data";         value: number; highlight?: boolean }
  | { kind: "totalData";    value: number; highlight?: boolean }
  | { kind: "chartTitle";   text: string }
  | { kind: "resumenArea"; text: string }
  | { kind: "resumenPct";  value: number }
  | null;

function cellFor(raw: RawCell): XLSX.CellObject | null {
  if (!raw) return null;
  switch (raw.kind) {
    case "title":      return { t: "s", v: raw.text, s: { font: { bold: true, sz: 14, color: { rgb: "00682F" } } } };
    case "subtitle":   return { t: "s", v: raw.text, s: { font: { italic: true, sz: 10, color: { rgb: "6E7A6E" } } } };
    case "areaTitle":  return { t: "s", v: raw.text, s: styleAreaTitle };
    case "header":     return { t: "s", v: raw.text, s: styleHeader };
    case "groupLabel": return { t: "s", v: raw.text, s: styleGroupLabel };
    case "totalLabel": return { t: "s", v: raw.text, s: styleTotalLabel };
    case "data":       return { t: "n", v: raw.value, z: "0.00%", s: raw.highlight ? styleDataHighlight : styleData };
    case "totalData":  return { t: "n", v: raw.value, z: "0.00%", s: raw.highlight ? styleTotalHighlight : styleTotalData };
    case "chartTitle": return { t: "s", v: raw.text, s: styleChartTitle };
    case "resumenArea": return { t: "s", v: raw.text, s: styleResumenAreaCell };
    case "resumenPct":  return { t: "n", v: raw.value, z: '0"%"', s: styleResumenPctCell };
  }
}

function gridToSheet(grid: RawCell[][], merges: XLSX.Range[], cols: XLSX.ColInfo[], minCols: number, rows?: XLSX.RowInfo[]): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  let maxR = 0, maxC = 0;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      const cell = cellFor(row[c]);
      if (!cell) continue;
      const addr = XLSX.utils.encode_cell({ r, c });
      ws[addr] = cell;
      if (r > maxR) maxR = r;
      if (c > maxC) maxC = c;
    }
  }
  if (maxC < minCols - 1) maxC = minCols - 1;
  ws["!ref"]    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  ws["!cols"]   = cols;
  ws["!merges"] = merges;
  if (rows) ws["!rows"] = rows;
  return ws;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const anio    = Number(searchParams.get("anio"));
    const periodo = (searchParams.get("periodo") ?? "").toUpperCase();

    if (!anio)
      return NextResponse.json({ error: "El año es obligatorio" }, { status: 400 });
    if (periodo !== "IPA" && periodo !== "IIPA")
      return NextResponse.json({ error: "El periodo debe ser IPA o IIPA" }, { status: 400 });

    const rows = await prisma.encuestaSatisfaccion.findMany({
      where:  { anio, periodo_academico: periodo, nivel_satisfaccion: { not: null } },
      select: { area: true, rol: true, nivel_satisfaccion: true },
    });

    if (rows.length === 0)
      return NextResponse.json(
        { error: `No hay registros con nivel de satisfacción para ${periodo} ${anio}` },
        { status: 404 },
      );

    // counts: area -> grupo -> nivel -> count
    const counts = new Map<string, Map<Grupo, Map<string, number>>>();
    for (const r of rows) {
      if (!r.nivel_satisfaccion) continue;
      const grupo = normalizeRol(r.rol);
      if (!grupo) continue;
      let byGrupo = counts.get(r.area);
      if (!byGrupo) { byGrupo = new Map(); counts.set(r.area, byGrupo); }
      let byNivel = byGrupo.get(grupo);
      if (!byNivel) { byNivel = new Map(); byGrupo.set(grupo, byNivel); }
      byNivel.set(r.nivel_satisfaccion, (byNivel.get(r.nivel_satisfaccion) ?? 0) + 1);
    }

    // ─── Hoja 1: Satisfacción por grupo ───────────────────────────────────────
    const grid: RawCell[][] = [];
    const merges: XLSX.Range[] = [];
    const N_COLS = 1 + NIVELES.length + 1;

    grid.push([{ kind: "title", text: `Tabla de satisfacción por grupo de interés — ${periodo} ${anio}` }]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: N_COLS - 1 } });

    grid.push([{ kind: "subtitle", text: `Fuente: Encuesta de Satisfacción Voz de la Comunidad UCundinamarca · Periodo ${periodo} ${anio}.` }]);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: N_COLS - 1 } });

    grid.push([null]);

    const areasOrdenadas = [...counts.keys()].sort((a, b) => {
      const da = ordenAreaIdx(a);
      const db = ordenAreaIdx(b);
      if (da !== db) return da - db;
      return a.localeCompare(b, "es");
    });

    const headers: RawCell[] = [
      { kind: "header", text: "Grupo de Interés" },
      ...NIVELES.map((n) => ({ kind: "header" as const, text: n })),
      { kind: "header", text: "Nivel de satisfacción" },
    ];

    // Acumula nivel de satisfacción "Total grupos" por área para hoja 2
    const totalSatPorArea: { area: string; pct: number }[] = [];

    for (const area of areasOrdenadas) {
      const areaRowIdx = grid.length;
      grid.push([{ kind: "areaTitle", text: area }]);
      merges.push({ s: { r: areaRowIdx, c: 0 }, e: { r: areaRowIdx, c: N_COLS - 1 } });

      grid.push([...headers]);

      const allowed = gruposParaArea(area);
      const byGrupo = counts.get(area)!;

      const totalNiveles = new Map<string, number>();
      let totalAll = 0;

      for (const grupo of allowed) {
        const niveles = byGrupo.get(grupo);
        const total   = niveles ? [...niveles.values()].reduce((s, x) => s + x, 0) : 0;
        const row: RawCell[] = [{ kind: "groupLabel", text: grupo }];
        let satisfechos = 0;

        for (const nivel of NIVELES) {
          const c = niveles?.get(nivel) ?? 0;
          const prop = total > 0 ? c / total : 0;
          row.push({ kind: "data", value: prop });
          totalNiveles.set(nivel, (totalNiveles.get(nivel) ?? 0) + c);
          if (nivel === "Satisfecho" || nivel === "Muy satisfecho") satisfechos += c;
        }
        const propSat = total > 0 ? satisfechos / total : 0;
        row.push({ kind: "data", value: propSat, highlight: true });
        totalAll += total;
        grid.push(row);
      }

      const totalRow: RawCell[] = [{ kind: "totalLabel", text: "Total grupos" }];
      let satTot = 0;
      for (const nivel of NIVELES) {
        const c = totalNiveles.get(nivel) ?? 0;
        totalRow.push({ kind: "totalData", value: totalAll > 0 ? c / totalAll : 0 });
        if (nivel === "Satisfecho" || nivel === "Muy satisfecho") satTot += c;
      }
      totalRow.push({ kind: "totalData", value: totalAll > 0 ? satTot / totalAll : 0, highlight: true });
      grid.push(totalRow);
      grid.push([null]);

      // Aproximación al entero superior si hay decimales
      const pctEntero = totalAll > 0 ? Math.ceil((satTot / totalAll) * 100) : 0;
      if (totalAll > 0) totalSatPorArea.push({ area, pct: pctEntero });
    }

    const ws1 = gridToSheet(grid, merges, [
      { wch: 22 },
      { wch: 18 }, { wch: 16 }, { wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 22 },
    ], N_COLS);

    // ─── Hoja 2: Resumen general (tabla + chart nativo) ──────────────────────
    // Layout:
    //   A1     → título (merged A1:B1)
    //   A3,B3  → headers "Área", "Nivel de satisfacción"
    //   A4..N  → datos (ordenados desc por pct)
    //   Chart anclado a la derecha referenciando esos rangos.
    const grid2:   RawCell[][]  = [];
    const merges2: XLSX.Range[] = [];

    grid2.push([{ kind: "chartTitle", text: `Resumen general nivel de satisfacción — ${periodo} ${anio}` }]);
    merges2.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } });

    grid2.push([null]);

    grid2.push([
      { kind: "header", text: "Área" },
      { kind: "header", text: "Nivel de satisfacción" },
    ]);

    const areasSorted = [...totalSatPorArea].sort((a, b) => b.pct - a.pct);
    for (const { area, pct } of areasSorted) {
      grid2.push([
        { kind: "resumenArea", text: area },
        { kind: "resumenPct",  value: pct },
      ]);
    }

    const ws2 = gridToSheet(
      grid2,
      merges2,
      [{ wch: 40 }, { wch: 22 }],
      2,
    );

    // ─── Workbook ─────────────────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Satisfacción por grupos");
    XLSX.utils.book_append_sheet(wb, ws2, "Resumen general");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    // Inyecta el chart nativo en la hoja 2 (sheet2.xml).
    const lastRow1Based = 3 + areasSorted.length; // header en fila 3 → datos hasta 3+N
    const body = areasSorted.length > 0
      ? await injectBarChart(new Uint8Array(buffer), {
          sheetIndex: 2,
          sheetName:  "Resumen general",
          catRange:   `$A$4:$A$${lastRow1Based}`,
          valRange:   `$B$4:$B$${lastRow1Based}`,
          serNameRef: "$B$3",
          serName:    "Nivel de satisfacción",
          title:      `Resumen general nivel de satisfacción — ${periodo} ${anio}`,
          fromCol: 3,  fromRow: 1,
          toCol:   18, toRow:   Math.max(28, 3 + areasSorted.length + 2),
        })
      : new Uint8Array(buffer);

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="satisfaccion_grupos_${periodo}_${anio}.xlsx"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
