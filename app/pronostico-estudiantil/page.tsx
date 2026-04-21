"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, GraduationCap, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { NavBar } from "@/components/layout/navbar";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartPoint = {
  label: string;
  anio: number;
  periodo: string;
  total: number;
  tipo: "historico" | "pronostico";
};

type CoberturaStats = {
  totalProgramas: number;
  totalUnidadesRegionales: number;
  periodosPronosticados: string[];
  pregrado: { programas: number; unidadesRegionales: number };
  posgrado: { programas: number; unidadesRegionales: number };
};

type ApiResponse = {
  chartData: ChartPoint[];
  forecastPeriods: Array<[number, string]>;
  summary: {
    lastYear: number | null;
    lastPeriodTotal: number | null;
    firstForecastTotal: number | null;
    lastForecastTotal: number | null;
    growthPct: number | null;
  };
  cobertura: CoberturaStats;
  categorias: string[];
  unidadesRegionales: string[];
  programasPorRegion: Record<string, string[]>;
  error?: string;
};

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#bdcabb]/30 bg-white px-3 py-2 shadow-xl sm:px-4 sm:py-3">
      <p className="mb-1 font-home-display text-xs font-bold uppercase tracking-widest text-[#6e7a6e]">
        {label}
        {point.tipo === "pronostico" && (
          <span className="ml-2 rounded-full bg-[#adc6ff]/30 px-2 py-0.5 text-[#0058be]">P</span>
        )}
      </p>
      <p className="font-home-display text-lg font-extrabold text-[#191c1d] sm:text-xl">
        {payload[0].value.toLocaleString("es-CO")}
      </p>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const CATEGORIAS_LABELS: Record<string, string> = {
  Matriculados: "Matrícula",
  Inscritos: "Inscritos",
  Primiparos: "Primíparos",
  Admitidos: "Admitidos",
  Graduados: "Graduados",
};

export default function PronosticoEstudiantilPage() {
  const [categoriaActiva, setCategoriaActiva] = useState("Matriculados");
  const [unidadRegional, setUnidadRegional] = useState("");
  const [programaAcademico, setProgramaAcademico] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<"pregrado" | "posgrado" | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchData = useCallback(async (cat: string, ur: string, prog: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ categoria: cat });
      if (ur) params.set("unidad_regional", ur);
      if (prog) params.set("programa_academico", prog);
      const res = await fetch(`/api/pronostico?${params.toString()}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(categoriaActiva, unidadRegional, programaAcademico);
  }, [categoriaActiva, unidadRegional, programaAcademico, fetchData]);

  const handleDownload = async (nivel: "pregrado" | "posgrado") => {
    setDownloading(nivel);
    try {
      const res = await fetch(`/api/pronostico/download?nivel=${nivel}`);
      if (!res.ok) throw new Error("Error al generar el archivo");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+)"/);
      a.download = match?.[1] ?? `Pronostico_${nivel}.xlsx`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const unidadesRegionales = data?.unidadesRegionales ?? [];
  const programasPorRegion = data?.programasPorRegion ?? {};
  const programasDisponibles = unidadRegional
    ? (programasPorRegion[unidadRegional] ?? [])
    : [];

  const chartData =
    data?.chartData.map((d) => ({
      label: d.label,
      historico: d.tipo === "historico" ? d.total : undefined,
      pronostico: d.tipo === "pronostico" ? d.total : undefined,
      connection:
        d.tipo === "pronostico" ||
        (data.chartData[data.chartData.indexOf(d) + 1]?.tipo === "pronostico" &&
          d.tipo === "historico")
          ? d.total
          : undefined,
    })) ?? [];

  const firstForecastLabel = data?.chartData.find((d) => d.tipo === "pronostico")?.label;
  const categoriasDisponibles = data?.categorias ?? ["Matriculados", "Inscritos", "Primiparos", "Admitidos"];
  const summary = data?.summary;
  const historicalPeriodsCount = data?.chartData.filter((d) => d.tipo === "historico").length;
  const historicalPeriodsDisplay =
    !loading && historicalPeriodsCount != null
      ? historicalPeriodsCount.toLocaleString("es-CO")
      : "--";

  return (
    <main className="min-h-screen flex-1 bg-[#f8f9fa] pt-16 font-home-body text-[#191c1d]">
      <NavBar activePage="pronostico-estudiantil" />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-[#f3f4f5] px-4 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16">
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <div>
              <span className="mb-3 block font-home-label text-xs font-semibold uppercase tracking-[0.2em] text-[#00682f] sm:mb-4">
                Módulo de Analítica Avanzada
              </span>
              <h1 className="font-home-display mb-4 text-4xl font-extrabold leading-tight tracking-tighter text-[#191c1d] sm:mb-6 sm:text-5xl md:text-6xl">
                Pronóstico de{" "}
                <span className="text-[#00682f]">Población Estudiantil</span>
              </h1>
              <p className="max-w-xl font-home-body text-base leading-relaxed text-[#3e4a3e] sm:text-lg">
                Visualice las tendencias futuras del ecosistema académico.
                Nuestra herramienta utiliza modelos de media ponderada para
                anticipar el comportamiento de la matrícula, inscritos y
                admitidos.
              </p>
            </div>

            {/* Tarjeta cobertura — desktop: columna derecha / mobile+tablet: debajo del texto */}
            <div className="relative">
              <div className="absolute -right-12 -top-12 hidden h-64 w-64 rounded-full bg-[#00682f]/5 blur-3xl lg:block" />
              <div className="relative rounded-xl border border-[#bdcabb]/30 bg-white p-6 shadow-[0_20px_40px_rgba(0,104,47,0.06)] sm:p-8">
                <div className="mb-4 flex items-center gap-4 sm:mb-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#00682f] sm:h-12 sm:w-12">
                    <TrendingUp className="size-5 text-white sm:size-6" />
                  </div>
                  <div>
                    <h3 className="font-home-display font-bold text-[#191c1d]">
                      Cobertura del Pronóstico
                    </h3>
                    <p className="font-home-label text-xs text-[#6e7a6e]">
                      Periodos:{" "}
                      {loading
                        ? "..."
                        : (data?.cobertura?.periodosPronosticados ?? []).join(", ") || "—"}
                    </p>
                  </div>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 animate-pulse rounded-lg bg-[#edeeef]" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:block sm:space-y-3">
                    <div className="flex flex-col items-center justify-center rounded-lg bg-[#00682f]/5 px-3 py-3 sm:flex-row sm:justify-between sm:px-4">
                      <span className="font-home-label text-[10px] font-semibold uppercase tracking-wider text-[#3e4a3e]">
                        Total
                      </span>
                      <span className="font-home-display text-xl font-extrabold text-[#00682f] sm:text-2xl">
                        {data?.cobertura?.totalProgramas ?? "—"}
                      </span>
                    </div>
                    <div className="flex flex-col items-center justify-between rounded-lg bg-[#edeeef] px-3 py-3 sm:flex-row sm:px-4">
                      <div className="text-center sm:text-left">
                        <p className="font-home-label text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Pregrado</p>
                        <p className="hidden font-home-label text-xs text-[#6e7a6e] sm:block">
                          {data?.cobertura?.pregrado.unidadesRegionales ?? "—"} u.r.
                        </p>
                      </div>
                      <span className="font-home-display text-xl font-extrabold text-[#191c1d]">
                        {data?.cobertura?.pregrado.programas ?? "—"}
                        <span className="font-home-label text-xs font-normal text-[#6e7a6e]"> prog.</span>
                      </span>
                    </div>
                    <div className="flex flex-col items-center justify-between rounded-lg bg-[#edeeef] px-3 py-3 sm:flex-row sm:px-4">
                      <div className="text-center sm:text-left">
                        <p className="font-home-label text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Posgrado</p>
                        <p className="hidden font-home-label text-xs text-[#6e7a6e] sm:block">
                          {data?.cobertura?.posgrado.unidadesRegionales ?? "—"} u.r.
                        </p>
                      </div>
                      <span className="font-home-display text-xl font-extrabold text-[#191c1d]">
                        {data?.cobertura?.posgrado.programas ?? "—"}
                        <span className="font-home-label text-xs font-normal text-[#6e7a6e]"> prog.</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 right-0 h-full w-1/3 bg-gradient-to-l from-[#00682f]/5 to-transparent pointer-events-none" />
      </header>

      {/* ── Panel principal ───────────────────────────────────────────────────── */}
      <section className="relative z-20 mx-auto mb-12 max-w-7xl px-4 sm:-mt-12 sm:mb-20 sm:px-8">
        <div className="rounded-xl border border-[#bdcabb]/20 bg-white p-4 shadow-xl sm:p-8">

          {/* Filtros dinámicos: Unidad Regional + Programa Académico */}
          {unidadesRegionales.length > 0 && (
            <div className="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <label className="font-home-label text-[10px] font-bold uppercase tracking-widest text-[#6e7a6e]">
                  Unidad Regional
                </label>
                <select
                  value={unidadRegional}
                  onChange={(e) => {
                    setUnidadRegional(e.target.value);
                    setProgramaAcademico("");
                  }}
                  className="w-full rounded-xl border border-[#bdcabb]/50 bg-white px-3 py-2 text-sm font-medium text-[#191c1d] shadow-sm focus:border-[#00682f] focus:outline-none focus:ring-2 focus:ring-[#00682f]/20"
                >
                  <option value="">Todas las regiones</option>
                  {unidadesRegionales.map((ur) => (
                    <option key={ur} value={ur}>{ur}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label className="font-home-label text-[10px] font-bold uppercase tracking-widest text-[#6e7a6e]">
                  Programa Académico
                </label>
                <select
                  value={programaAcademico}
                  onChange={(e) => setProgramaAcademico(e.target.value)}
                  disabled={!unidadRegional}
                  className="w-full rounded-xl border border-[#bdcabb]/50 bg-white px-3 py-2 text-sm font-medium text-[#191c1d] shadow-sm focus:border-[#00682f] focus:outline-none focus:ring-2 focus:ring-[#00682f]/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <option value="">Todos los programas</option>
                  {programasDisponibles.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="mb-6 flex flex-col gap-3 sm:mb-10 sm:gap-6 md:flex-row md:items-center md:justify-between">

            {/* Mobile: select desplegable */}
            <div className="sm:hidden">
              <select
                value={categoriaActiva}
                onChange={(e) => setCategoriaActiva(e.target.value)}
                className="w-full rounded-xl border border-[#bdcabb]/50 bg-white px-4 py-2.5 text-sm font-semibold text-[#191c1d] shadow-sm focus:border-[#00682f] focus:outline-none focus:ring-2 focus:ring-[#00682f]/20"
              >
                {(categoriasDisponibles.length > 0
                  ? categoriasDisponibles
                  : Object.keys(CATEGORIAS_LABELS)
                ).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORIAS_LABELS[cat] ?? cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Desktop: pill buttons */}
            <div className="hidden sm:flex sm:flex-wrap sm:gap-2">
              <div className="flex flex-wrap gap-1.5 rounded-full bg-[#edeeef] p-1.5 sm:gap-2">
                {(categoriasDisponibles.length > 0
                  ? categoriasDisponibles
                  : Object.keys(CATEGORIAS_LABELS)
                ).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoriaActiva(cat)}
                    className={`rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                      categoriaActiva === cat
                        ? "bg-[#00682f] text-white shadow-md"
                        : "text-[#3e4a3e] hover:bg-[#e7e8e9]"
                    }`}
                  >
                    {CATEGORIAS_LABELS[cat] ?? cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-home-label text-[10px] font-bold uppercase tracking-widest text-[#6e7a6e]">
                Horizonte
              </span>
              <span className="rounded-lg bg-[#edeeef] px-3 py-1.5 text-xs font-medium text-[#191c1d] sm:px-4 sm:py-2 sm:text-sm">
                {data?.forecastPeriods && data.forecastPeriods.length > 0
                  ? `Hasta ${data.forecastPeriods[data.forecastPeriods.length - 1][0]}`
                  : "Calculando..."}
              </span>
            </div>
          </div>

          {/* Leyenda fuera del gráfico (siempre visible, sin overflow) */}
          {!loading && chartData.length > 0 && (
            <div className="mb-3 flex gap-4 sm:mb-4">
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-5 rounded bg-[#00682f]" />
                <span className="font-home-label text-xs font-semibold text-[#191c1d]">Histórico</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="block h-0.5 w-5 border-t-2 border-dashed border-[#0058be]" />
                <span className="font-home-label text-xs font-semibold text-[#191c1d]">Proyección</span>
              </div>
            </div>
          )}

          {/* Gráfico */}
          <div className="relative mb-6 h-64 w-full sm:mb-8 sm:h-80 md:h-96 lg:h-[420px]">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-[#6e7a6e]">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00682f] border-t-transparent" />
                  <span className="font-home-label text-sm">Calculando pronóstico...</span>
                </div>
              </div>
            ) : data?.error ? (
              <div className="flex h-full items-center justify-center text-red-500">
                <p className="text-sm">{data.error}</p>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-[#6e7a6e]">
                <TrendingUp className="size-10 opacity-30 sm:size-12" />
                <p className="px-4 text-center font-home-label text-sm">
                  No hay datos disponibles. Cargue datos en el módulo de Automatizar Reportes.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: isMobile ? 8 : 20,
                    left: isMobile ? -10 : 10,
                    bottom: isMobile ? 4 : 8,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#bdcabb"
                    strokeOpacity={0.3}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    hide={isMobile}
                    tick={{ fontSize: 11, fill: "#6e7a6e", fontFamily: "Work Sans" }}
                    tickLine={false}
                    axisLine={{ stroke: "#bdcabb", strokeOpacity: 0.5 }}
                    interval={1}
                    tickFormatter={(val: string) => {
                      const parts = val.split("-");
                      return parts[1] === "IPA" ? parts[0] : "";
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: isMobile ? 8 : 10, fill: "#6e7a6e", fontFamily: "Work Sans" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) =>
                      isMobile ? `${Math.round(v / 1000)}k` : v.toLocaleString("es-CO")
                    }
                    width={isMobile ? 32 : 60}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {firstForecastLabel && (
                    <ReferenceLine
                      x={firstForecastLabel}
                      stroke="#0058be"
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                      label={
                        isMobile
                          ? undefined
                          : { value: "Pronóstico", fill: "#0058be", fontSize: 10, fontFamily: "Work Sans" }
                      }
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="historico"
                    stroke="#00682f"
                    strokeWidth={isMobile ? 2 : 3}
                    dot={{ fill: "#00682f", r: isMobile ? 2 : 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#00682f" }}
                    connectNulls={false}
                    name="Histórico"
                  />
                  <Line
                    type="monotone"
                    dataKey="connection"
                    stroke="#00682f"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    name="Conexión"
                    legendType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="pronostico"
                    stroke="#0058be"
                    strokeWidth={isMobile ? 2 : 2.5}
                    strokeDasharray="8 5"
                    dot={{ fill: "#0058be", r: isMobile ? 2 : 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#0058be" }}
                    connectNulls={false}
                    name="Pronóstico"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Estadísticas resumen */}
          <div className="grid grid-cols-1 gap-4 border-t border-[#bdcabb]/20 pt-6 sm:grid-cols-3 sm:gap-6 sm:pt-8">
            <div className="flex flex-col gap-1">
              <span className="font-home-label text-[10px] font-bold uppercase tracking-widest text-[#6e7a6e]">
                Variación Estimada
              </span>
              <div className="flex items-baseline gap-2">
                <span className={`font-home-display text-3xl font-extrabold ${
                  (summary?.growthPct ?? 0) >= 0 ? "text-[#00682f]" : "text-red-600"
                }`}>
                  {loading ? "—" : summary?.growthPct != null
                    ? `${summary.growthPct >= 0 ? "+" : ""}${summary.growthPct}%`
                    : "—"}
                </span>
                <TrendingUp className={`size-4 ${(summary?.growthPct ?? 0) >= 0 ? "text-[#00682f]" : "text-red-600"}`} />
              </div>
              <span className="font-home-label text-xs text-[#6e7a6e]">respecto al último periodo</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-home-label text-[10px] font-bold uppercase tracking-widest text-[#6e7a6e]">
                Primer Periodo Proyectado
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-home-display text-3xl font-extrabold text-[#191c1d]">
                  {loading ? "—" : summary?.firstForecastTotal != null
                    ? summary.firstForecastTotal.toLocaleString("es-CO")
                    : "—"}
                </span>
                <span className="text-xs font-medium text-[#6e7a6e]">estudiantes</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-home-label text-[10px] font-bold uppercase tracking-widest text-[#6e7a6e]">
                <span>Base Hist&oacute;rica</span>
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-home-display text-3xl font-extrabold text-[#0058be]">
                  {historicalPeriodsDisplay}
                </span>
                <span className="text-xs font-medium text-[#6e7a6e]">
                  {historicalPeriodsCount === 1 ? "periodo real" : "periodos reales"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Descarga ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto mb-20 max-w-7xl px-4 sm:mb-32 sm:px-8">
        <div className="mb-8 text-center sm:mb-10">
          <h2 className="font-home-display mb-2 text-2xl font-extrabold tracking-tight text-[#191c1d] sm:text-3xl">
            Recursos y Documentación
          </h2>
          <p className="font-home-body text-sm text-[#3e4a3e] sm:text-base">
            Exporte los análisis detallados para integración en informes institucionales.
          </p>
        </div>

        <div className="grid gap-6 sm:gap-8 md:grid-cols-2">
          {(["pregrado", "posgrado"] as const).map((nivel) => (
            <div
              key={nivel}
              className="group relative rounded-xl border border-transparent bg-[#f3f4f5] p-6 transition-all duration-300 hover:border-[#00682f]/20 hover:bg-white/60 sm:p-8"
            >
              <div className="mb-6 flex items-start justify-between sm:mb-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm transition-transform duration-300 group-hover:scale-110 sm:h-14 sm:w-14">
                  <GraduationCap className="size-6 text-[#00682f] sm:size-7" />
                </div>
                <span className="rounded-full bg-[#e7e8e9] px-3 py-1 font-home-label text-[10px] font-bold uppercase">
                  XLSX
                </span>
              </div>

              <h3 className="font-home-display mb-2 text-lg font-bold text-[#191c1d] sm:mb-3 sm:text-xl">
                Descargar Pronóstico {nivel === "pregrado" ? "Pregrado" : "Posgrado"}
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-[#3e4a3e] sm:mb-8">
                {nivel === "pregrado"
                  ? "Desglose por facultades, sedes y programas académicos de pregrado. Hojas separadas por categoría con columnas históricas y de pronóstico."
                  : "Análisis de especializaciones, maestrías y doctorados. Proyecciones de inscripción por modalidad con datos históricos completos."}
              </p>

              <button
                type="button"
                onClick={() => void handleDownload(nivel)}
                disabled={downloading !== null || loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#00682f] to-[#00843d] py-3 font-home-display font-bold text-white shadow-lg shadow-[#00682f]/10 transition-all hover:shadow-[#00682f]/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:py-4"
              >
                {downloading === nivel ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generando...
                  </>
                ) : (
                  <>
                    Descargar Reporte Completo
                    <Download className="size-4" />
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="mt-auto w-full border-t border-slate-200 bg-slate-50 px-4 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
          <p className="text-sm text-[#3e4a3e]">
            © Universidad de Cundinamarca - Academic Intelligence Portal
          </p>
          <div className="flex flex-wrap justify-center gap-6 md:justify-end">
            <a href="#" className="text-sm text-[#3e4a3e] transition-all hover:text-[#00682f]">Privacy Policy</a>
            <a href="#" className="text-sm text-[#3e4a3e] transition-all hover:text-[#00682f]">Institutional Data</a>
            <a href="#" className="text-sm text-[#3e4a3e] transition-all hover:text-[#00682f]">Contact Support</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
