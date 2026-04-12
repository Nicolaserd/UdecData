"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
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
  Matriculados: "#16a34a",
  Admitidos: "#2563eb",
  Primiparos: "#d97706",
  Inscritos: "#7c3aed",
  Graduados: "#dc2626",
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

// ── Component ──────────────────────────────────────────
export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

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
      <div className="text-center py-12 text-gray-500">
        Cargando dashboard...
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <Card className="border-gray-200">
        <CardContent className="py-12 text-center text-gray-500">
          No hay datos en la base de datos. Carga archivos para ver el dashboard.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Export button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-gray-800">
          Dashboard Estadístico
        </h2>
        <Button onClick={handleExportDb} variant="outline">
          Descargar Base de Datos (.xlsx)
        </Button>
      </div>

      {/* ── Filters ────────────────────────────────────── */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Unidad Regional</label>
              <select
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 min-w-[180px]"
              >
                <option value={ALL}>Todas</option>
                {data.regiones.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Programa Académico</label>
              <select
                value={filterPrograma}
                onChange={(e) => setFilterPrograma(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 min-w-[280px]"
              >
                <option value={ALL}>Todos</option>
                {data.programas.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Año</label>
              <select
                value={filterAnio}
                onChange={(e) => setFilterAnio(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 min-w-[100px]"
              >
                <option value={ALL}>Todos</option>
                {data.anios.map((a) => (
                  <option key={a} value={String(a)}>{a}</option>
                ))}
              </select>
            </div>
            {hasFilters && (
              <Button onClick={clearFilters} variant="ghost" className="text-sm text-gray-500">
                Limpiar filtros
              </Button>
            )}
          </div>
          {hasFilters && (
            <p className="text-xs text-green-700 mt-2">
              Filtros activos — mostrando {filtered.length.toLocaleString()} registros de {data.rows.length.toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No hay datos para los filtros seleccionados.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {summaryCards.map((s) => (
              <Card key={s.categoria} className="border-l-4" style={{ borderLeftColor: COLORS[s.categoria] }}>
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-gray-500 font-medium">{s.categoria}</p>
                  <p className="text-2xl font-bold" style={{ color: COLORS[s.categoria] }}>
                    {s.current.toLocaleString()}
                  </p>
                  {s.change !== 0 && (
                    <p className={`text-xs font-medium ${s.change > 0 ? "text-green-600" : "text-red-600"}`}>
                      {s.change > 0 ? "+" : ""}{Math.round(s.change * 10) / 10}% vs periodo anterior
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Timeline chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Línea de Tiempo por Periodo Académico</CardTitle>
              <CardDescription>
                Total de estudiantes por categoría en cada periodo (eje X = año-periodo)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={380}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" fontSize={11} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {CATEGORIAS.map((cat) => (
                    <Line
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      stroke={COLORS[cat]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Area chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribución Acumulada por Periodo</CardTitle>
              <CardDescription>
                Vista apilada para comparar proporciones entre categorías
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" fontSize={11} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {CATEGORIAS.map((cat) => (
                    <Area
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      stackId="1"
                      fill={COLORS[cat]}
                      stroke={COLORS[cat]}
                      fillOpacity={0.4}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Mean + Std Dev by Year */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Media y Desviación Estándar por Año</CardTitle>
              <CardDescription>
                Promedio anual (barras) con desviación estándar entre periodos del mismo año
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={yearlyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="anio" />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name) => {
                      const cat = String(name).replace("_mean", "");
                      return [Number(value).toLocaleString(), `Media ${cat}`];
                    }}
                  />
                  <Legend />
                  {CATEGORIAS.map((cat) => (
                    <Bar
                      key={cat}
                      dataKey={`${cat}_mean`}
                      name={cat}
                      fill={COLORS[cat]}
                      fillOpacity={0.8}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Año</th>
                      {CATEGORIAS.map((cat) => (
                        <th key={cat} className="text-right py-2 px-3 font-medium" style={{ color: COLORS[cat] }}>
                          σ {cat}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyStats.map((row) => (
                      <tr key={row.anio as string} className="border-b border-gray-100">
                        <td className="py-2 px-3 font-medium">{row.anio}</td>
                        {CATEGORIAS.map((cat) => (
                          <td key={cat} className="text-right py-2 px-3 text-gray-700">
                            {(row[`${cat}_std`] as number).toLocaleString()}
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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estadísticas por Tipo de Periodo</CardTitle>
              <CardDescription>
                Media y desviación estándar agrupadas por IPA y IIPA a lo largo de los años
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Periodo</th>
                      {CATEGORIAS.map((cat) => (
                        <th key={cat} colSpan={2} className="text-center py-2 px-3 font-medium" style={{ color: COLORS[cat] }}>
                          {cat}
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b bg-gray-50">
                      <th />
                      {CATEGORIAS.map((cat) => (
                        <Fragment key={cat}>
                          <th className="text-right py-1 px-2 text-xs text-gray-500">μ</th>
                          <th className="text-right py-1 px-2 text-xs text-gray-500">σ</th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periodStats.map((row) => (
                      <tr key={row.periodo as string} className="border-b border-gray-100">
                        <td className="py-2 px-3 font-medium">{row.periodo}</td>
                        {CATEGORIAS.map((cat) => (
                          <Fragment key={cat}>
                            <td className="text-right py-2 px-2 text-gray-700">
                              {(row[`${cat}_mean`] as number).toLocaleString()}
                            </td>
                            <td className="text-right py-2 px-2 text-gray-500">
                              {(row[`${cat}_std`] as number).toLocaleString()}
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tasa de Crecimiento Interanual (%)</CardTitle>
                <CardDescription>
                  Variación porcentual año a año por categoría
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="anio" />
                    <YAxis tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v) => [`${v}%`, ""]} />
                    <Legend />
                    {CATEGORIAS.map((cat) => (
                      <Bar key={cat} dataKey={cat} fill={COLORS[cat]} fillOpacity={0.75} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Radar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribución por Unidad Regional</CardTitle>
              <CardDescription>Comparación de categorías entre sedes</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="region" fontSize={11} />
                  <PolarRadiusAxis fontSize={10} />
                  {CATEGORIAS.map((cat) => (
                    <Radar
                      key={cat}
                      name={cat}
                      dataKey={cat}
                      stroke={COLORS[cat]}
                      fill={COLORS[cat]}
                      fillOpacity={0.15}
                    />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top 10 Programs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top 10 Programas Académicos</CardTitle>
              <CardDescription>
                Programas con mayor cantidad total de estudiantes (todas las categorías)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topPrograms} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="programa" type="category" width={280} fontSize={11} tick={{ fill: "#374151" }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#16a34a" name="Total estudiantes" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Nivel distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribución por Nivel de Formación</CardTitle>
              <CardDescription>Pregrado, Tecnología y Posgrado por categoría</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={nivelChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nivel" fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {CATEGORIAS.map((cat) => (
                    <Bar key={cat} dataKey={cat} fill={COLORS[cat]} fillOpacity={0.8} />
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
