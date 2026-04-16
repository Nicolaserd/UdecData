/**
 * Lógica de pronóstico de población estudiantil.
 * Basado en media ponderada lineal sobre historial por periodo (IPA/IIPA).
 */

export type StudentRecord = {
  categoria: string;
  unidad_regional: string;
  nivel: string;
  nivel_academico: string;
  programa_academico: string;
  cantidad: number;
  anio: number;
  periodo: string;
};

export type ForecastRecord = StudentRecord & { es_pronostico: true };

export type PeriodKey = `${number}-${"IPA" | "IIPA"}`;

/** Peso lineal: el más reciente recibe el mayor peso. */
function weightedAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const n = values.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const w = i + 1;
    num += values[i] * w;
    den += w;
  }
  return Math.round(num / den);
}

/**
 * Determina los 3 periodos siguientes al último dato disponible.
 */
export function getForecastPeriods(
  data: StudentRecord[]
): Array<[number, string]> {
  const years = data.map((d) => d.anio);
  const lastYear = Math.max(...years);
  const periodsInLastYear = new Set(
    data.filter((d) => d.anio === lastYear).map((d) => d.periodo)
  );

  if (periodsInLastYear.has("IIPA")) {
    // Escenario B: ambos periodos disponibles
    return [
      [lastYear + 1, "IPA"],
      [lastYear + 1, "IIPA"],
      [lastYear + 2, "IPA"],
    ];
  } else {
    // Escenario A: solo IPA en el último año
    return [
      [lastYear, "IIPA"],
      [lastYear + 1, "IPA"],
      [lastYear + 1, "IIPA"],
    ];
  }
}

/**
 * Calcula el pronóstico para todos los programas activos.
 * Devuelve registros con la misma forma que StudentRecord.
 */
export function calcularPronosticos(data: StudentRecord[]): ForecastRecord[] {
  const forecastPeriods = getForecastPeriods(data);
  const results: ForecastRecord[] = [];

  // Programas activos: con datos en los últimos 2 años
  const lastYear = Math.max(...data.map((d) => d.anio));
  const recentYears = new Set([lastYear, lastYear - 1]);

  const activeProgramKeys = new Set(
    data
      .filter((d) => recentYears.has(d.anio))
      .map(
        (d) =>
          `${d.categoria}||${d.unidad_regional}||${d.nivel}||${d.nivel_academico}||${d.programa_academico}`
      )
  );

  // Agrupar datos históricos por serie
  const seriesMap = new Map<string, Map<string, number[]>>();

  for (const r of data) {
    const programKey = `${r.categoria}||${r.unidad_regional}||${r.nivel}||${r.nivel_academico}||${r.programa_academico}`;
    if (!activeProgramKeys.has(programKey)) continue;

    if (!seriesMap.has(programKey)) seriesMap.set(programKey, new Map());
    const periodoMap = seriesMap.get(programKey)!;

    if (!periodoMap.has(r.periodo)) periodoMap.set(r.periodo, []);
    // Insertar ordenado por año (los datos llegan ordenados del ORM)
    periodoMap.get(r.periodo)!.push(r.cantidad);
  }

  // Para el ratio IPA/IIPA a nivel de categoría+nivel (casos especiales)
  const categoryRatios = calcularRatiosCategoria(data);

  for (const [programKey, periodoMap] of seriesMap.entries()) {
    const [categoria, unidad_regional, nivel, nivel_academico, programa_academico] =
      programKey.split("||");

    // Pronósticos para IPA y IIPA por separado
    const forecastByPeriodo = new Map<string, number>();

    for (const [anio, periodo] of forecastPeriods) {
      const serieHistorica = periodoMap.get(periodo) ?? [];

      if (serieHistorica.length >= 2) {
        // Caso normal: media ponderada
        const N = Math.min(serieHistorica.length, 4);
        forecastByPeriodo.set(
          `${anio}-${periodo}`,
          weightedAverage(serieHistorica.slice(-N))
        );
      } else if (serieHistorica.length === 1) {
        // Solo un dato: usar ese valor directamente
        forecastByPeriodo.set(`${anio}-${periodo}`, serieHistorica[0]);
      } else {
        // Sin historial para este periodo: usar ratio entre periodos
        const otherPeriodo = periodo === "IPA" ? "IIPA" : "IPA";
        const otherSerie = periodoMap.get(otherPeriodo) ?? [];

        if (otherSerie.length > 0) {
          const ratioKey = `${categoria}||${nivel}`;
          const ratioObj = categoryRatios.get(ratioKey);
          const ratio = ratioObj ? ratioObj[periodo as "IPA" | "IIPA"] ?? 1 : 1;
          const baseN = Math.min(otherSerie.length, 4);
          const baseForecast = weightedAverage(otherSerie.slice(-baseN));
          forecastByPeriodo.set(
            `${anio}-${periodo}`,
            Math.round(baseForecast * ratio)
          );
        }
        // Si tampoco hay datos del otro periodo, omitir
      }
    }

    for (const [anio, periodo] of forecastPeriods) {
      const key = `${anio}-${periodo}`;
      if (forecastByPeriodo.has(key)) {
        results.push({
          categoria,
          unidad_regional,
          nivel,
          nivel_academico,
          programa_academico,
          cantidad: forecastByPeriodo.get(key)!,
          anio,
          periodo,
          es_pronostico: true,
        });
      }
    }
  }

  return results;
}

/**
 * Calcula la razón IIPA/IPA y IPA/IIPA por (categoria, nivel)
 * para usar en casos sin historial de un periodo.
 */
function calcularRatiosCategoria(
  data: StudentRecord[]
): Map<string, { IPA: number; IIPA: number }> {
  const map = new Map<
    string,
    { ipaValues: number[]; iipaValues: number[] }
  >();

  // Agrupar por (categoria, nivel, programa, unidad_regional) y calcular pares IPA-IIPA por año
  const grouped = new Map<string, Map<number, { IPA?: number; IIPA?: number }>>();

  for (const r of data) {
    const key = `${r.categoria}||${r.nivel}||${r.programa_academico}||${r.unidad_regional}`;
    if (!grouped.has(key)) grouped.set(key, new Map());
    const yearMap = grouped.get(key)!;
    if (!yearMap.has(r.anio)) yearMap.set(r.anio, {});
    yearMap.get(r.anio)![r.periodo as "IPA" | "IIPA"] = r.cantidad;
  }

  for (const [key, yearMap] of grouped.entries()) {
    const [categoria, nivel] = key.split("||");
    const ratioKey = `${categoria}||${nivel}`;
    if (!map.has(ratioKey)) map.set(ratioKey, { ipaValues: [], iipaValues: [] });
    const entry = map.get(ratioKey)!;

    for (const { IPA, IIPA } of yearMap.values()) {
      if (IPA && IIPA && IPA > 0) {
        entry.ipaValues.push(IPA);
        entry.iipaValues.push(IIPA);
      }
    }
  }

  const result = new Map<string, { IPA: number; IIPA: number }>();
  for (const [key, { ipaValues, iipaValues }] of map.entries()) {
    if (ipaValues.length === 0) continue;
    const avgIPA =
      ipaValues.reduce((a, b) => a + b, 0) / ipaValues.length;
    const avgIIPA =
      iipaValues.reduce((a, b) => a + b, 0) / iipaValues.length;
    // ratio para obtener IIPA a partir de IPA, y viceversa
    result.set(key, {
      IIPA: avgIPA > 0 ? avgIIPA / avgIPA : 1,
      IPA: avgIIPA > 0 ? avgIPA / avgIIPA : 1,
    });
  }
  return result;
}

/**
 * Construye datos para el gráfico: totales por año-periodo (histórico + pronóstico).
 * Filtra por categoría si se indica.
 */
export function buildChartData(
  historical: StudentRecord[],
  forecasts: ForecastRecord[],
  categoria?: string
): Array<{
  label: string;
  anio: number;
  periodo: string;
  total: number;
  tipo: "historico" | "pronostico";
}> {
  const filterFn = (r: { categoria: string }) =>
    !categoria || r.categoria === categoria;

  // Agrupar histórico
  const histMap = new Map<string, number>();
  for (const r of historical.filter(filterFn)) {
    const k = `${r.anio}-${r.periodo}`;
    histMap.set(k, (histMap.get(k) ?? 0) + r.cantidad);
  }

  // Agrupar pronóstico
  const foreMap = new Map<string, number>();
  for (const r of forecasts.filter(filterFn)) {
    const k = `${r.anio}-${r.periodo}`;
    foreMap.set(k, (foreMap.get(k) ?? 0) + r.cantidad);
  }

  // Ordenar periodos
  const allKeys = new Set([...histMap.keys(), ...foreMap.keys()]);
  const sorted = [...allKeys].sort((a, b) => {
    const [ay, ap] = a.split("-");
    const [by, bp] = b.split("-");
    if (ay !== by) return parseInt(ay) - parseInt(by);
    return ap === "IPA" ? -1 : 1;
  });

  return sorted.map((k) => {
    const [anio, periodo] = k.split("-");
    const isForec = foreMap.has(k) && !histMap.has(k);
    return {
      label: k,
      anio: parseInt(anio),
      periodo,
      total: isForec ? foreMap.get(k)! : histMap.get(k)!,
      tipo: isForec ? "pronostico" : "historico",
    };
  });
}

/**
 * Construye una hoja de cálculo (array de filas) para un nivel y categoría dados.
 * Columnas: Unidad Regional | Programa Académico | [año-periodo]...
 */
export function buildSheetData(
  historical: StudentRecord[],
  forecasts: ForecastRecord[],
  nivel: "pregrado" | "posgrado",
  categoria: string
): {
  headers: string[];
  rows: Array<(string | number | null)[]>;
  forecastColumns: string[];
} {
  const nivelFilter = (r: StudentRecord | ForecastRecord) =>
    r.nivel.toLowerCase() === nivel || r.nivel_academico.toLowerCase().includes(nivel === "pregrado" ? "pregrado" : "posgrado") ||
    (nivel === "pregrado"
      ? ["tecnico", "tecnólogo", "tecnologico", "tecnolog", "pregrado", "universitario"].some((n) =>
          r.nivel_academico.toLowerCase().includes(n)
        )
      : ["posgrado", "especialización", "especializacion", "maestría", "maestria", "doctorado"].some(
          (n) => r.nivel_academico.toLowerCase().includes(n)
        ));

  const histFiltered = historical.filter(
    (r) => r.categoria === categoria && nivelFilter(r)
  );
  const foreFiltered = forecasts.filter(
    (r) => r.categoria === categoria && nivelFilter(r)
  );

  // Todos los periodos ordenados
  const periodSet = new Set<string>();
  for (const r of [...histFiltered, ...foreFiltered]) {
    periodSet.add(`${r.anio}-${r.periodo}`);
  }
  const periods = [...periodSet].sort((a, b) => {
    const [ay, ap] = a.split("-");
    const [by, bp] = b.split("-");
    if (ay !== by) return parseInt(ay) - parseInt(by);
    return ap === "IPA" ? -1 : 1;
  });

  const forecastPeriodSet = new Set(
    foreFiltered.map((r) => `${r.anio}-${r.periodo}`)
  );

  // Programas únicos (region, programa)
  const programKeys = new Set<string>();
  for (const r of [...histFiltered, ...foreFiltered]) {
    programKeys.add(`${r.unidad_regional}||${r.programa_academico}`);
  }

  // Construir lookup
  const lookup = new Map<string, number>();
  for (const r of [...histFiltered, ...foreFiltered]) {
    const k = `${r.unidad_regional}||${r.programa_academico}||${r.anio}-${r.periodo}`;
    lookup.set(k, (lookup.get(k) ?? 0) + r.cantidad);
  }

  const headers = ["Unidad Regional", "Programa Académico", ...periods];
  const rows: Array<(string | number | null)[]> = [];

  const sortedPrograms = [...programKeys].sort();
  for (const pk of sortedPrograms) {
    const [region, programa] = pk.split("||");
    const row: (string | number | null)[] = [region, programa];
    for (const p of periods) {
      row.push(lookup.get(`${pk}||${p}`) ?? null);
    }
    rows.push(row);
  }

  // Fila de totales
  const totalRow: (string | number | null)[] = ["", "TOTAL"];
  for (const p of periods) {
    let sum = 0;
    for (const pk of sortedPrograms) {
      sum += lookup.get(`${pk}||${p}`) ?? 0;
    }
    totalRow.push(sum);
  }
  rows.push(totalRow);

  return { headers, rows, forecastColumns: [...forecastPeriodSet] };
}

// ─── Estadísticas de cobertura ────────────────────────────────────────────────

const NIVELES_PREGRADO = ["tecnico", "tecnólogo", "tecnologico", "pregrado", "universitario"];
const NIVELES_POSGRADO = ["posgrado", "especialización", "especializacion", "maestría", "maestria", "doctorado"];

function esPregrado(nivel_academico: string): boolean {
  const n = nivel_academico.toLowerCase();
  return NIVELES_PREGRADO.some((l) => n.includes(l));
}

function esPosgrado(nivel_academico: string): boolean {
  const n = nivel_academico.toLowerCase();
  return NIVELES_POSGRADO.some((l) => n.includes(l));
}

export type CoberturaStats = {
  totalProgramas: number;
  totalUnidadesRegionales: number;
  periodosPronosticados: string[];
  pregrado: {
    programas: number;
    unidadesRegionales: number;
  };
  posgrado: {
    programas: number;
    unidadesRegionales: number;
  };
};

/**
 * Devuelve estadísticas de cuántos programas y unidades regionales
 * quedaron cubiertos por el pronóstico, separados por nivel.
 */
export function calcularCobertura(
  forecasts: ForecastRecord[],
  forecastPeriods: Array<[number, string]>
): CoberturaStats {
  // Deduplicar por (unidad_regional, programa_academico) — independiente de categoría/periodo
  const programasUnicos = new Map<string, { nivel_academico: string; unidad_regional: string }>();
  for (const f of forecasts) {
    const k = `${f.unidad_regional}||${f.programa_academico}`;
    if (!programasUnicos.has(k)) {
      programasUnicos.set(k, { nivel_academico: f.nivel_academico, unidad_regional: f.unidad_regional });
    }
  }

  const pregradoPrograms = new Set<string>();
  const pregradoRegiones = new Set<string>();
  const posgradoPrograms = new Set<string>();
  const posgradoRegiones = new Set<string>();

  for (const [k, { nivel_academico, unidad_regional }] of programasUnicos) {
    if (esPregrado(nivel_academico)) {
      pregradoPrograms.add(k);
      pregradoRegiones.add(unidad_regional);
    } else if (esPosgrado(nivel_academico)) {
      posgradoPrograms.add(k);
      posgradoRegiones.add(unidad_regional);
    }
  }

  const todasRegiones = new Set([...programasUnicos.values()].map((e) => e.unidad_regional));

  return {
    totalProgramas: programasUnicos.size,
    totalUnidadesRegionales: todasRegiones.size,
    periodosPronosticados: forecastPeriods.map(([anio, periodo]) => `${anio}-${periodo}`),
    pregrado: {
      programas: pregradoPrograms.size,
      unidadesRegionales: pregradoRegiones.size,
    },
    posgrado: {
      programas: posgradoPrograms.size,
      unidadesRegionales: posgradoRegiones.size,
    },
  };
}
