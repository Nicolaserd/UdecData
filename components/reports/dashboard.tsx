"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

// ── Types ──────────────────────────────────────────────
interface RawRow {
  categoria: string;
  unidadRegional: string;
  nivel: string;
  programa: string;
  cantidad: number;
  anio: number;
  periodo: string;
}

interface DashboardData {
  rows: RawRow[];
  regiones: string[];
  programas: string[];
  anios: number[];
}

const CATEGORIAS = ["Matriculados", "Admitidos", "Primiparos", "Inscritos", "Graduados"];
const COLORS: Record<string, string> = {
  Matriculados: "#00682f",
  Admitidos: "#0058be",
  Primiparos: "#a06500",
  Inscritos: "#6b7b00",
  Graduados: "#8a244d",
};

// ── Helpers ────────────────────────────────────────────
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function pctChange(prev: number, curr: number): number {
  if (prev === 0) return 0;
  return ((curr - prev) / prev) * 100;
}

const periodoOrder = (p: string) => (p === "IPA" ? 0 : p === "IIPA" ? 1 : 2);

const ALL = "__ALL__";
const SURFACE_CLASS =
  "border border-[#bdcabb]/10 bg-white shadow-[0_18px_40px_rgba(25,28,29,0.04)]";
const SELECT_CLASS =
  "min-h-12 rounded-lg border border-[#bdcabb]/70 bg-[#f8f9fa] px-4 py-3 text-sm text-[#191c1d] outline-none transition focus:border-[#00682f] focus:ring-4 focus:ring-[#00682f]/10";
const AXIS_TICK = { fill: "#6e7a6e", fontSize: 12 };
const LEGEND_STYLE = { paddingTop: 20, fontSize: 12 };
const TOOLTIP_STYLE = {
  backgroundColor: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(189,202,187,0.6)",
  borderRadius: "12px",
  boxShadow: "0 20px 40px rgba(25,28,29,0.08)",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CO").format(value);
}

function renderDelta(change: number) {
  const value =
    change > 0
      ? `+${Math.round(change * 10) / 10}%`
      : `${Math.round(change * 10) / 10}%`;

  if (change > 0) {
    return (
      <p className="mt-2 text-sm font-medium text-[#00843d]">
        {value} vs periodo anterior
      </p>
    );
  }

  if (change < 0) {
    return (
      <p className="mt-2 text-sm font-medium text-[#d92d20]">
        {value} vs periodo anterior
      </p>
    );
  }

  return (
    <p className="mt-2 text-sm font-medium text-[#6e7a6e]">
      0.0% vs periodo anterior
    </p>
  );
}

// ── Component ──────────────────────────────────────────
export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [filterRegion, setFilterRegion] = useState<string>(ALL);
  const [filterPrograma, setFilterPrograma] = useState<string>(ALL);
  const [filterAnio, setFilterAnio] = useState<string>(ALL);

  useEffect(() => {
    fetch("/api/dashboard-data")
      .then((res) => {
        if (!res.ok) throw new Error("Error cargando datos");
        return res.json();
      })
      .then((d) => setData(d as DashboardData))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ── Opciones de filtros en cascada ────────────────────
  const programasDisponibles = useMemo(() => {
    if (!data) return [];
    const base = filterRegion === ALL ? data.rows : data.rows.filter((r) => r.unidadRegional === filterRegion);
    return [...new Set(base.map((r) => r.programa))].sort();
  }, [data, filterRegion]);

  const aniosDisponibles = useMemo(() => {
    if (!data) return [];
    const base = data.rows.filter((r) => {
      if (filterRegion !== ALL && r.unidadRegional !== filterRegion) return false;
      if (filterPrograma !== ALL && r.programa !== filterPrograma) return false;
      return true;
    });
    return [...new Set(base.map((r) => r.anio))].sort((a, b) => a - b);
  }, [data, filterRegion, filterPrograma]);

  // ── Filtered rows ─────────────────────────────────────
  const filtered = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((r) => {
      if (filterRegion !== ALL && r.unidadRegional !== filterRegion) return false;
      if (filterPrograma !== ALL && r.programa !== filterPrograma) return false;
      if (filterAnio !== ALL && r.anio !== Number(filterAnio)) return false;
      return true;
    });
  }, [data, filterRegion, filterPrograma, filterAnio]);

  // ── Timeline ──────────────────────────────────────────
  const timelineData = useMemo(() => {
    if (filtered.length === 0) return [];
    const map = new Map<string, Record<string, string | number>>();
    const periodMeta = new Map<string, { anio: number; periodo: string }>();
    for (const r of filtered) {
      const key = `${r.anio}-${r.periodo}`;
      if (!map.has(key)) {
        const row: Record<string, string | number> = { periodo: key };
        for (const cat of CATEGORIAS) row[cat] = 0;
        map.set(key, row);
        periodMeta.set(key, { anio: r.anio, periodo: r.periodo });
      }
      const row = map.get(key)!;
      row[r.categoria] = (row[r.categoria] as number) + r.cantidad;
    }
    return Array.from(map.entries())
      .sort(([, , ], [, , ]) => 0) // placeholder
      .sort(([a], [b]) => {
        const ma = periodMeta.get(a)!;
        const mb = periodMeta.get(b)!;
        return ma.anio - mb.anio || periodoOrder(ma.periodo) - periodoOrder(mb.periodo);
      })
      .map(([, row]) => row);
  }, [filtered]);

  // ── Yearly stats ──────────────────────────────────────
  const yearlyStats = useMemo(() => {
    if (filtered.length === 0) return [];
    // Group total per (anio, periodo, categoria), then stats per year
    const byYearPeriod = new Map<string, number>();
    for (const r of filtered) {
      const key = `${r.anio}::${r.periodo}::${r.categoria}`;
      byYearPeriod.set(key, (byYearPeriod.get(key) ?? 0) + r.cantidad);
    }

    const byYear = new Map<number, Map<string, number[]>>();
    for (const [key, total] of byYearPeriod) {
      const [anioStr, , cat] = key.split("::");
      const anio = Number(anioStr);
      if (!byYear.has(anio)) byYear.set(anio, new Map());
      const catMap = byYear.get(anio)!;
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(total);
    }

    return Array.from(byYear.keys())
      .sort()
      .map((anio) => {
        const catMap = byYear.get(anio)!;
        const row: Record<string, string | number> = { anio: String(anio) };
        for (const cat of CATEGORIAS) {
          const vals = catMap.get(cat) ?? [];
          row[cat] = vals.reduce((s, v) => s + v, 0);
          row[`${cat}_mean`] = Math.round(mean(vals));
          row[`${cat}_std`] = Math.round(stdDev(vals));
        }
        return row;
      });
  }, [filtered]);

  // ── Growth ────────────────────────────────────────────
  const growthData = useMemo(() => {
    if (yearlyStats.length < 2) return [];
    return yearlyStats.slice(1).map((row, i) => {
      const prev = yearlyStats[i];
      const result: Record<string, string | number> = { anio: row.anio };
      for (const cat of CATEGORIAS) {
        result[cat] = Math.round(pctChange(prev[cat] as number, row[cat] as number) * 10) / 10;
      }
      return result;
    });
  }, [yearlyStats]);

  // ── Radar (region) ────────────────────────────────────
  const radarData = useMemo(() => {
    if (filtered.length === 0) return [];
    const map = new Map<string, Record<string, number>>();
    for (const r of filtered) {
      if (!map.has(r.unidadRegional)) map.set(r.unidadRegional, {});
      const cats = map.get(r.unidadRegional)!;
      cats[r.categoria] = (cats[r.categoria] ?? 0) + r.cantidad;
    }
    return Array.from(map.entries()).map(([region, cats]) => ({ region, ...cats }));
  }, [filtered]);

  // ── Summary cards ─────────────────────────────────────
  const summaryCards = useMemo(() => {
    if (timelineData.length === 0) return [];
    const last = timelineData[timelineData.length - 1];
    const prev = timelineData.length > 1 ? timelineData[timelineData.length - 2] : null;
    return CATEGORIAS.map((cat) => {
      const current = (last[cat] as number) ?? 0;
      const previous = prev ? ((prev[cat] as number) ?? 0) : 0;
      const change = prev ? pctChange(previous, current) : 0;
      return { categoria: cat, current, change };
    });
  }, [timelineData]);

  // ── Period stats ──────────────────────────────────────
  const periodStats = useMemo(() => {
    if (filtered.length === 0) return [];
    const byPeriodCat = new Map<string, number>();
    for (const r of filtered) {
      const key = `${r.periodo}::${r.anio}::${r.categoria}`;
      byPeriodCat.set(key, (byPeriodCat.get(key) ?? 0) + r.cantidad);
    }
    const byPeriodo = new Map<string, Map<string, number[]>>();
    for (const [key, total] of byPeriodCat) {
      const [periodo, , cat] = key.split("::");
      if (!byPeriodo.has(periodo)) byPeriodo.set(periodo, new Map());
      const catMap = byPeriodo.get(periodo)!;
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(total);
    }
    return Array.from(byPeriodo.entries())
      .sort(([a], [b]) => periodoOrder(a) - periodoOrder(b))
      .map(([periodo, catMap]) => {
        const row: Record<string, string | number> = { periodo };
        for (const cat of CATEGORIAS) {
          const vals = catMap.get(cat) ?? [];
          row[`${cat}_mean`] = Math.round(mean(vals));
          row[`${cat}_std`] = Math.round(stdDev(vals));
        }
        return row;
      });
  }, [filtered]);

  // ── Nivel ─────────────────────────────────────────────
  const nivelChartData = useMemo(() => {
    if (filtered.length === 0) return [];
    const map = new Map<string, Record<string, number>>();
    for (const r of filtered) {
      if (!map.has(r.nivel)) map.set(r.nivel, {});
      const cats = map.get(r.nivel)!;
      cats[r.categoria] = (cats[r.categoria] ?? 0) + r.cantidad;
    }
    return Array.from(map.entries()).map(([nivel, cats]) => ({ nivel, ...cats }));
  }, [filtered]);

  // ── Top programs ──────────────────────────────────────
  const topPrograms = useMemo(() => {
    if (filtered.length === 0) return [];
    const map = new Map<string, number>();
    for (const r of filtered) {
      map.set(r.programa, (map.get(r.programa) ?? 0) + r.cantidad);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([programa, total]) => ({ programa, total }));
  }, [filtered]);

  const handleExportDb = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export-db");
      if (!res.ok) throw new Error("Error descargando");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "BASE_DATOS_ESTUDIANTES.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Base de datos descargada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error descargando");
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setFilterRegion(ALL);
    setFilterPrograma(ALL);
    setFilterAnio(ALL);
  };

  const hasFilters = filterRegion !== ALL || filterPrograma !== ALL || filterAnio !== ALL;

  if (loading) {
    return (
      <Card className={SURFACE_CLASS}>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <Spinner className="h-8 w-8 text-[#0058be]" />
          <p className="text-sm text-[#3e4a3e]">Cargando dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <Card className={SURFACE_CLASS}>
        <CardContent className="py-16 text-center">
          <p className="font-home-display text-xl font-bold text-[#191c1d]">
            Todavia no hay datos consolidados
          </p>
          <p className="mt-3 text-sm leading-6 text-[#3e4a3e]">
            Carga archivos maestros para habilitar las visualizaciones y la
            exportacion de la base consolidada.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Export button */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-home-label text-xs uppercase tracking-[0.28em] text-[#0058be]">
            Visualizaciones activas
          </p>
          <h3 className="mt-3 font-home-display text-2xl font-bold text-[#191c1d]">
            Panel de consulta y exportacion
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#3e4a3e]">
            Filtra la base consolidada, revisa las metricas y exporta el
            historico sin salir del flujo de trabajo.
          </p>
        </div>
        <Button
          onClick={handleExportDb}
          disabled={exporting}
          className="min-h-12 rounded-lg border border-[#00682f]/20 bg-white px-5 py-3 text-sm font-bold text-[#00682f] shadow-sm hover:bg-[#00682f] hover:text-white"
        >
          {exporting ? (
            <>
              <Spinner className="mr-2 h-4 w-4 text-current" />
              Descargando...
            </>
          ) : (
            <>
              <Download className="mr-2 size-4" />
              Descargar Base de Datos (.xlsx)
            </>
          )}
        </Button>
      </div>

      {/* ── Filters ────────────────────────────────────── */}
      <Card className={SURFACE_CLASS}>
        <CardContent className="py-6">
          <div className="mb-5">
            <p className="font-home-label text-xs uppercase tracking-[0.28em] text-[#6e7a6e]">
              Filtros
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_180px_auto] xl:items-end">
            <div className="flex flex-col gap-2">
              <label className="font-home-label text-xs uppercase tracking-[0.18em] text-[#6e7a6e]">
                Unidad Regional
              </label>
              <select
                value={filterRegion}
                onChange={(e) => {
                  setFilterRegion(e.target.value);
                  setFilterPrograma(ALL);
                  setFilterAnio(ALL);
                }}
                className={SELECT_CLASS}
              >
                <option value={ALL}>Todas</option>
                {data.regiones.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-home-label text-xs uppercase tracking-[0.18em] text-[#6e7a6e]">
                Programa Académico
              </label>
              <select
                value={filterPrograma}
                onChange={(e) => {
                  setFilterPrograma(e.target.value);
                  setFilterAnio(ALL);
                }}
                className={SELECT_CLASS}
              >
                <option value={ALL}>Todos</option>
                {programasDisponibles.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-home-label text-xs uppercase tracking-[0.18em] text-[#6e7a6e]">
                Año
              </label>
              <select
                value={filterAnio}
                onChange={(e) => setFilterAnio(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value={ALL}>Todos</option>
                {aniosDisponibles.map((a) => (
                  <option key={a} value={String(a)}>{a}</option>
                ))}
              </select>
            </div>
            {hasFilters && (
              <Button
                onClick={clearFilters}
                variant="ghost"
                className="min-h-12 rounded-lg border border-transparent px-4 py-3 text-sm font-semibold text-[#3e4a3e] hover:border-[#bdcabb]/30 hover:bg-[#f3f4f5]"
              >
                Limpiar filtros
              </Button>
            )}
          </div>
          <p className="mt-4 text-xs text-[#3e4a3e]">
            {hasFilters
              ? `Filtros activos: ${formatNumber(filtered.length)} registros de ${formatNumber(data.rows.length)} visibles.`
              : `Sin filtros aplicados: ${formatNumber(data.rows.length)} registros disponibles.`}
          </p>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className={SURFACE_CLASS}>
          <CardContent className="py-16 text-center">
            <p className="font-home-display text-xl font-bold text-[#191c1d]">
              No hay datos para los filtros seleccionados.
            </p>
            <p className="mt-3 text-sm leading-6 text-[#3e4a3e]">
              Ajusta la región, el programa o el año para volver a cargar el
              tablero.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5">
            {summaryCards.map((s) => (
              <Card
                key={s.categoria}
                className="rounded-[1.25rem] border border-[#d7ddda] border-l-4 bg-white shadow-[0_14px_32px_rgba(25,28,29,0.04)]"
                style={{ borderLeftColor: COLORS[s.categoria] }}
              >
                <CardContent className="flex min-h-[150px] flex-col justify-center px-6 py-7">
                  <p className="font-home-label text-sm text-[#3e4a3e]">
                    {s.categoria}
                  </p>

                  <p
                    className="mt-3 font-home-display text-4xl font-extrabold leading-none"
                    style={{ color: COLORS[s.categoria] }}
                  >
                    {formatNumber(s.current)}
                  </p>

                  {renderDelta(s.change)}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Timeline chart */}
          <Card className={SURFACE_CLASS}>
            <CardHeader className="border-b border-[#bdcabb]/10 pb-6">
              <CardTitle className="font-home-display text-xl font-bold text-[#191c1d]">Línea de Tiempo por Periodo Académico</CardTitle>
              <CardDescription className="text-sm leading-6 text-[#3e4a3e]">
                Total de estudiantes por categoría en cada periodo (eje X = año-periodo)
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-6">
              <ResponsiveContainer width="100%" height={380}>
                <LineChart data={timelineData}>
                  <CartesianGrid stroke="#bdcabb" strokeDasharray="4 8" vertical={false} />
                  <XAxis
                    dataKey="periodo"
                    angle={-30}
                    axisLine={false}
                    height={60}
                    textAnchor="end"
                    tick={AXIS_TICK}
                    tickLine={false}
                  />
                  <YAxis axisLine={false} tick={AXIS_TICK} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={LEGEND_STYLE} />
                  {CATEGORIAS.map((cat) => (
                    <Line
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      stroke={COLORS[cat]}
                      strokeWidth={3}
                      dot={{ r: 3, fill: COLORS[cat] }}
                      activeDot={{ r: 5, fill: COLORS[cat] }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Area chart */}
          <Card className={SURFACE_CLASS}>
            <CardHeader className="border-b border-[#bdcabb]/10 pb-6">
              <CardTitle className="font-home-display text-xl font-bold text-[#191c1d]">Distribución Acumulada por Periodo</CardTitle>
              <CardDescription className="text-sm leading-6 text-[#3e4a3e]">
                Vista apilada para comparar proporciones entre categorías
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-6">
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={timelineData}>
                  <CartesianGrid stroke="#bdcabb" strokeDasharray="4 8" vertical={false} />
                  <XAxis
                    dataKey="periodo"
                    angle={-30}
                    axisLine={false}
                    height={60}
                    textAnchor="end"
                    tick={AXIS_TICK}
                    tickLine={false}
                  />
                  <YAxis axisLine={false} tick={AXIS_TICK} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={LEGEND_STYLE} />
                  {CATEGORIAS.map((cat) => (
                    <Area
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      stackId="1"
                      fill={COLORS[cat]}
                      stroke={COLORS[cat]}
                      fillOpacity={0.2}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Mean + Std Dev by Year */}
          <Card className={SURFACE_CLASS}>
            <CardHeader className="border-b border-[#bdcabb]/10 pb-6">
              <CardTitle className="font-home-display text-xl font-bold text-[#191c1d]">Media y Desviación Estándar por Año</CardTitle>
              <CardDescription className="text-sm leading-6 text-[#3e4a3e]">
                Promedio anual (barras) con desviación estándar entre periodos del mismo año
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-6">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={yearlyStats}>
                  <CartesianGrid stroke="#bdcabb" strokeDasharray="4 8" vertical={false} />
                  <XAxis dataKey="anio" axisLine={false} tick={AXIS_TICK} tickLine={false} />
                  <YAxis axisLine={false} tick={AXIS_TICK} tickLine={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => {
                      const cat = String(name).replace("_mean", "");
                      return [formatNumber(Number(value)), `Media ${cat}`];
                    }}
                  />
                  <Legend wrapperStyle={LEGEND_STYLE} />
                  {CATEGORIAS.map((cat) => (
                    <Bar
                      key={cat}
                      dataKey={`${cat}_mean`}
                      name={cat}
                      fill={COLORS[cat]}
                      fillOpacity={0.85}
                      radius={[8, 8, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-6 overflow-x-auto rounded-xl border border-[#bdcabb]/15">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#bdcabb]/20 bg-[#f3f4f5]">
                      <th className="px-4 py-3 text-left font-home-label text-xs uppercase tracking-[0.18em] text-[#6e7a6e]">Año</th>
                      {CATEGORIAS.map((cat) => (
                        <th key={cat} className="px-4 py-3 text-right font-home-label text-xs uppercase tracking-[0.18em]" style={{ color: COLORS[cat] }}>
                          σ {cat}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyStats.map((row) => (
                      <tr key={row.anio as string} className="border-b border-[#bdcabb]/15 last:border-b-0">
                        <td className="px-4 py-3 font-semibold text-[#191c1d]">{row.anio}</td>
                        {CATEGORIAS.map((cat) => (
                          <td key={cat} className="px-4 py-3 text-right text-[#3e4a3e]">
                            {formatNumber(row[`${cat}_std`] as number)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Stats by Period type */}
          <Card className={SURFACE_CLASS}>
            <CardHeader className="border-b border-[#bdcabb]/10 pb-6">
              <CardTitle className="font-home-display text-xl font-bold text-[#191c1d]">Estadísticas por Tipo de Periodo</CardTitle>
              <CardDescription className="text-sm leading-6 text-[#3e4a3e]">
                Media y desviación estándar agrupadas por IPA y IIPA a lo largo de los años
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-6">
              <div className="overflow-x-auto rounded-xl border border-[#bdcabb]/15">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#bdcabb]/20">
                      <th className="px-4 py-4 text-left font-home-label text-xs uppercase tracking-[0.18em] text-[#6e7a6e]">Periodo</th>
                      {CATEGORIAS.map((cat) => (
                        <th key={cat} colSpan={2} className="px-4 py-4 text-center font-home-label text-xs uppercase tracking-[0.18em]" style={{ color: COLORS[cat] }}>
                          {cat}
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b border-[#bdcabb]/15 bg-[#f3f4f5]">
                      <th />
                      {CATEGORIAS.map((cat) => (
                        <Fragment key={cat}>
                          <th className="px-3 py-2 text-right font-home-label text-[11px] uppercase tracking-[0.18em] text-[#6e7a6e]">μ</th>
                          <th className="px-3 py-2 text-right font-home-label text-[11px] uppercase tracking-[0.18em] text-[#6e7a6e]">σ</th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periodStats.map((row) => (
                      <tr key={row.periodo as string} className="border-b border-[#bdcabb]/15 last:border-b-0">
                        <td className="px-4 py-3 font-semibold text-[#191c1d]">{row.periodo}</td>
                        {CATEGORIAS.map((cat) => (
                          <Fragment key={cat}>
                            <td className="px-3 py-3 text-right text-[#191c1d]">
                              {formatNumber(row[`${cat}_mean`] as number)}
                            </td>
                            <td className="px-3 py-3 text-right text-[#6e7a6e]">
                              {formatNumber(row[`${cat}_std`] as number)}
                            </td>
                          </Fragment>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Growth rate chart */}
          {growthData.length > 0 && (
            <Card className={SURFACE_CLASS}>
              <CardHeader className="border-b border-[#bdcabb]/10 pb-6">
                <CardTitle className="font-home-display text-xl font-bold text-[#191c1d]">Tasa de Crecimiento Interanual (%)</CardTitle>
                <CardDescription className="text-sm leading-6 text-[#3e4a3e]">
                  Variación porcentual año a año por categoría
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-6">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={growthData}>
                    <CartesianGrid stroke="#bdcabb" strokeDasharray="4 8" vertical={false} />
                    <XAxis dataKey="anio" axisLine={false} tick={AXIS_TICK} tickLine={false} />
                    <YAxis
                      axisLine={false}
                      tick={AXIS_TICK}
                      tickFormatter={(v) => `${v}%`}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, ""]} />
                    <Legend wrapperStyle={LEGEND_STYLE} />
                    {CATEGORIAS.map((cat) => (
                      <Bar
                        key={cat}
                        dataKey={cat}
                        fill={COLORS[cat]}
                        fillOpacity={0.8}
                        radius={[8, 8, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Radar chart */}
          <Card className={SURFACE_CLASS}>
            <CardHeader className="border-b border-[#bdcabb]/10 pb-6">
              <CardTitle className="font-home-display text-xl font-bold text-[#191c1d]">Distribución por Unidad Regional</CardTitle>
              <CardDescription className="text-sm leading-6 text-[#3e4a3e]">Comparación de categorías entre sedes</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-6">
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#bdcabb" />
                  <PolarAngleAxis dataKey="region" tick={{ fill: "#3e4a3e", fontSize: 11 }} />
                  <PolarRadiusAxis tick={{ fill: "#6e7a6e", fontSize: 10 }} tickFormatter={(v: number) => v.toLocaleString("es-CO")} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => [Number(value ?? 0).toLocaleString("es-CO"), String(name)]}
                    labelFormatter={(label: string) => `Sede: ${label}`}
                  />
                  {CATEGORIAS.map((cat) => (
                    <Radar
                      key={cat}
                      name={cat}
                      dataKey={cat}
                      stroke={COLORS[cat]}
                      fill={COLORS[cat]}
                      fillOpacity={0.12}
                    />
                  ))}
                  <Legend wrapperStyle={LEGEND_STYLE} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top 10 Programs */}
          <Card className={SURFACE_CLASS}>
            <CardHeader className="border-b border-[#bdcabb]/10 pb-6">
              <CardTitle className="font-home-display text-xl font-bold text-[#191c1d]">Top 10 Programas Académicos</CardTitle>
              <CardDescription className="text-sm leading-6 text-[#3e4a3e]">
                Programas con mayor cantidad total de estudiantes (todas las categorías)
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-6">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topPrograms} layout="vertical">
                  <CartesianGrid stroke="#bdcabb" strokeDasharray="4 8" vertical={false} />
                  <XAxis type="number" axisLine={false} tick={AXIS_TICK} tickLine={false} />
                  <YAxis
                    dataKey="programa"
                    type="category"
                    width={280}
                    axisLine={false}
                    tick={{ fill: "#3e4a3e", fontSize: 11 }}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar
                    dataKey="total"
                    fill="#00843d"
                    name="Total estudiantes"
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Nivel distribution */}
          <Card className={SURFACE_CLASS}>
            <CardHeader className="border-b border-[#bdcabb]/10 pb-6">
              <CardTitle className="font-home-display text-xl font-bold text-[#191c1d]">Distribución por Nivel de Formación</CardTitle>
              <CardDescription className="text-sm leading-6 text-[#3e4a3e]">Pregrado, Tecnología y Posgrado por categoría</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={nivelChartData}>
                  <CartesianGrid stroke="#bdcabb" strokeDasharray="4 8" vertical={false} />
                  <XAxis dataKey="nivel" axisLine={false} tick={AXIS_TICK} tickLine={false} />
                  <YAxis axisLine={false} tick={AXIS_TICK} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={LEGEND_STYLE} />
                  {CATEGORIAS.map((cat) => (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      fill={COLORS[cat]}
                      fillOpacity={0.85}
                      radius={[8, 8, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
