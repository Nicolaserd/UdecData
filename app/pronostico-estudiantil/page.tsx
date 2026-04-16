"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  ChevronDown,
  Download,
  GraduationCap,
  Settings,
  TrendingUp,
} from "lucide-react";
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
  error?: string;
};

// ─── Tooltip personalizado ────────────────────────────────────────────────────

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
    <div className="rounded-lg border border-[#bdcabb]/30 bg-white px-4 py-3 shadow-xl">
      <p className="mb-1 font-home-display text-xs font-bold uppercase tracking-widest text-[#6e7a6e]">
        {label}
        {point.tipo === "pronostico" && (
          <span className="ml-2 rounded-full bg-[#adc6ff]/30 px-2 py-0.5 text-[#0058be]">
            Pronóstico
          </span>
        )}
      </p>
      <p className="font-home-display text-xl font-extrabold text-[#191c1d]">
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
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<"pregrado" | "posgrado" | null>(null);

  const fetchData = useCallback(async (cat: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pronostico?categoria=${encodeURIComponent(cat)}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(categoriaActiva);
  }, [categoriaActiva, fetchData]);

  const handleCategoriaChange = (cat: string) => {
    setCategoriaActiva(cat);
  };

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

  // Datos para el gráfico: histórico + pronóstico en la misma línea
  const chartData =
    data?.chartData.map((d) => ({
      label: d.label,
      historico: d.tipo === "historico" ? d.total : undefined,
      pronostico: d.tipo === "pronostico" ? d.total : undefined,
      // Punto de conexión entre las dos líneas
      connection:
        d.tipo === "pronostico" ||
        (data.chartData[data.chartData.indexOf(d) + 1]?.tipo === "pronostico" &&
          d.tipo === "historico")
          ? d.total
          : undefined,
    })) ?? [];

  // Primera etiqueta de pronóstico para la línea de referencia
  const firstForecastLabel = data?.chartData.find((d) => d.tipo === "pronostico")?.label;

  const categoriasDisponibles = data?.categorias ?? ["Matriculados", "Inscritos", "Primiparos", "Admitidos"];
  const summary = data?.summary;

  return (
    <main className="min-h-screen flex-1 bg-[#f8f9fa] pt-16 font-home-body text-[#191c1d]">
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 z-50 w-full border-b border-neutral-200/50 bg-[#f8f9fa] transition-all duration-300 ease-in-out">
        <div className="flex h-16 w-full max-w-full items-center justify-between px-4 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <span className="font-home-display text-xl font-bold tracking-tight text-[#00682f]">
              Academic Intelligence Portal
            </span>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <Link
              href="/"
              className="font-home-display pb-1 text-gray-600 transition-colors hover:text-[#00682f]"
            >
              Home
            </Link>

            <div className="group relative">
              <button
                type="button"
                className="font-home-display flex items-center gap-1 border-b-2 border-[#00682f] pb-1 font-bold text-[#00682f]"
              >
                Servicios
                <ChevronDown className="size-4" />
              </button>

              <div className="invisible absolute left-0 top-full z-50 w-64 pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="overflow-hidden rounded-[0.5rem] border border-neutral-200/50 bg-white shadow-xl">
                  <Link
                    href="/automatizar-reportes"
                    className="block px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    Automatizar Reportes para Boletín
                  </Link>
                  <Link
                    href="/pronostico-estudiantil"
                    className="block bg-[#00682f]/5 px-4 py-3 text-sm font-semibold text-[#00682f] transition-colors hover:bg-[#00682f]/10"
                  >
                    Pronóstico de Población Estudiantil
                  </Link>
                </div>
              </div>
            </div>
          </nav>

          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Notificaciones"
              className="rounded-md p-2 text-neutral-500 transition-all duration-150 ease-in-out hover:bg-gray-100 active:scale-95"
            >
              <Bell className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Configuración"
              className="rounded-md p-2 text-neutral-500 transition-all duration-150 ease-in-out hover:bg-gray-100 active:scale-95"
            >
              <Settings className="size-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-[#f3f4f5] px-8 pb-24 pt-16">
        <div className="mx-auto max-w-7xl relative z-10">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="mb-4 block font-home-label text-xs font-semibold uppercase tracking-[0.2em] text-[#00682f]">
                Módulo de Analítica Avanzada
              </span>
              <h1 className="font-home-display mb-6 text-5xl font-extrabold leading-tight tracking-tighter text-[#191c1d] md:text-6xl">
                Pronóstico de{" "}
                <span className="text-[#00682f]">Población Estudiantil</span>
              </h1>
              <p className="max-w-xl font-home-body text-lg leading-relaxed text-[#3e4a3e]">
                Visualice las tendencias futuras del ecosistema académico.
                Nuestra herramienta utiliza modelos de media ponderada para
                anticipar el comportamiento de la matrícula, inscritos y
                admitidos.
              </p>
            </div>

            {/* Tarjeta de cobertura del pronóstico */}
            <div className="relative hidden lg:block">
              <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-[#00682f]/5 blur-3xl" />
              <div className="relative rounded-xl border border-[#bdcabb]/30 bg-white p-8 shadow-[0_20px_40px_rgba(0,104,47,0.06)]">
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#00682f]">
                    <TrendingUp className="size-6 text-white" />
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
                  <div className="space-y-3">
                    {/* Total */}
                    <div className="flex items-center justify-between rounded-lg bg-[#00682f]/5 px-4 py-3">
                      <span className="font-home-label text-xs font-semibold uppercase tracking-wider text-[#3e4a3e]">
                        Total programas
                      </span>
                      <span className="font-home-display text-2xl font-extrabold text-[#00682f]">
                        {data?.cobertura?.totalProgramas ?? "—"}
                      </span>
                    </div>

                    {/* Pregrado */}
                    <div className="flex items-center justify-between rounded-lg bg-[#edeeef] px-4 py-3">
                      <div>
                        <p className="font-home-label text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">
                          Pregrado
                        </p>
                        <p className="font-home-label text-xs text-[#6e7a6e]">
                          {data?.cobertura?.pregrado.unidadesRegionales ?? "—"} unidades regionales
                        </p>
                      </div>
                      <span className="font-home-display text-xl font-extrabold text-[#191c1d]">
                        {data?.cobertura?.pregrado.programas ?? "—"}
                        <span className="ml-1 font-home-label text-xs font-normal text-[#6e7a6e]">prog.</span>
                      </span>
                    </div>

                    {/* Posgrado */}
                    <div className="flex items-center justify-between rounded-lg bg-[#edeeef] px-4 py-3">
                      <div>
                        <p className="font-home-label text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">
                          Posgrado
                        </p>
                        <p className="font-home-label text-xs text-[#6e7a6e]">
                          {data?.cobertura?.posgrado.unidadesRegionales ?? "—"} unidades regionales
                        </p>
                      </div>
                      <span className="font-home-display text-xl font-extrabold text-[#191c1d]">
                        {data?.cobertura?.posgrado.programas ?? "—"}
                        <span className="ml-1 font-home-label text-xs font-normal text-[#6e7a6e]">prog.</span>
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

      {/* ── Panel principal ─────────────────────────────────────────────────── */}
      <section className="relative z-20 -mt-12 mb-20 max-w-7xl mx-auto px-8">
        <div className="rounded-xl border border-[#bdcabb]/20 bg-white p-8 shadow-xl">

          {/* Filtros */}
          <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2 rounded-full bg-[#edeeef] p-1.5">
              {(categoriasDisponibles.length > 0
                ? categoriasDisponibles
                : Object.keys(CATEGORIAS_LABELS)
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoriaChange(cat)}
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

            <div className="flex items-center gap-3">
              <span className="font-home-label text-[10px] font-bold uppercase tracking-widest text-[#6e7a6e]">
                Horizonte
              </span>
              <span className="rounded-lg bg-[#edeeef] px-4 py-2 text-sm font-medium text-[#191c1d]">
                {data?.forecastPeriods && data.forecastPeriods.length > 0
                  ? `Hasta ${data.forecastPeriods[data.forecastPeriods.length - 1][0]}`
                  : "Calculando..."}
              </span>
            </div>
          </div>

          {/* Gráfico */}
          <div className="relative mb-8 h-[420px] w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-[#6e7a6e]">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00682f] border-t-transparent" />
                  <span className="font-home-label text-sm">Calculando pronóstico...</span>
                </div>
              </div>
            ) : data?.error ? (
              <div className="flex h-full items-center justify-center text-red-500">
                <p>{data.error}</p>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-[#6e7a6e]">
                <TrendingUp className="size-12 opacity-30" />
                <p className="font-home-label text-sm">
                  No hay datos disponibles. Cargue datos en el módulo de Automatizar Reportes.
                </p>
              </div>
            ) : (
              <>
                {/* Leyenda */}
                <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
                  <div className="flex items-center gap-3 rounded-lg border border-[#bdcabb]/30 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-sm">
                    <span className="h-0.5 w-6 rounded bg-[#00682f]" />
                    <span className="font-home-label text-xs font-semibold text-[#191c1d]">
                      Datos Históricos
                    </span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-[#bdcabb]/30 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-sm">
                    <span className="h-0.5 w-6 rounded border-t-2 border-dashed border-[#0058be]" />
                    <span className="font-home-label text-xs font-semibold text-[#191c1d]">
                      Proyección
                    </span>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 20, right: 160, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#bdcabb"
                      strokeOpacity={0.3}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "#6e7a6e", fontFamily: "Work Sans" }}
                      tickLine={false}
                      axisLine={{ stroke: "#bdcabb", strokeOpacity: 0.5 }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#6e7a6e", fontFamily: "Work Sans" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => v.toLocaleString("es-CO")}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {firstForecastLabel && (
                      <ReferenceLine
                        x={firstForecastLabel}
                        stroke="#0058be"
                        strokeDasharray="4 4"
                        strokeOpacity={0.5}
                        label={{
                          value: "Pronóstico",
                          fill: "#0058be",
                          fontSize: 10,
                          fontFamily: "Work Sans",
                        }}
                      />
                    )}
                    {/* Línea histórica */}
                    <Line
                      type="monotone"
                      dataKey="historico"
                      stroke="#00682f"
                      strokeWidth={3}
                      dot={{ fill: "#00682f", r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#00682f" }}
                      connectNulls={false}
                      name="Histórico"
                    />
                    {/* Línea de conexión (último histórico + primeros pronósticos) */}
                    <Line
                      type="monotone"
                      dataKey="connection"
                      stroke="#00682f"
                      strokeWidth={2}
                      strokeDasharray="0"
                      dot={false}
                      connectNulls
                      name="Conexión"
                      legendType="none"
                    />
                    {/* Línea de pronóstico */}
                    <Line
                      type="monotone"
                      dataKey="pronostico"
                      stroke="#0058be"
                      strokeWidth={2.5}
                      strokeDasharray="8 5"
                      dot={{ fill: "#0058be", r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#0058be" }}
                      connectNulls={false}
                      name="Pronóstico"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </div>

          {/* Estadísticas resumen */}
          <div className="grid grid-cols-3 gap-6 border-t border-[#bdcabb]/20 pt-8">
            <div className="flex flex-col gap-1">
              <span className="font-home-label text-[10px] font-bold uppercase tracking-widest text-[#6e7a6e]">
                Variación Estimada
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className={`font-home-display text-3xl font-extrabold ${
                    (summary?.growthPct ?? 0) >= 0 ? "text-[#00682f]" : "text-red-600"
                  }`}
                >
                  {loading
                    ? "—"
                    : summary?.growthPct != null
                    ? `${summary.growthPct >= 0 ? "+" : ""}${summary.growthPct}%`
                    : "—"}
                </span>
                <TrendingUp
                  className={`size-4 ${
                    (summary?.growthPct ?? 0) >= 0 ? "text-[#00682f]" : "text-red-600"
                  }`}
                />
              </div>
              <span className="font-home-label text-xs text-[#6e7a6e]">
                respecto al último periodo
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-home-label text-[10px] font-bold uppercase tracking-widest text-[#6e7a6e]">
                Primer Periodo Proyectado
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-home-display text-3xl font-extrabold text-[#191c1d]">
                  {loading
                    ? "—"
                    : summary?.firstForecastTotal != null
                    ? summary.firstForecastTotal.toLocaleString("es-CO")
                    : "—"}
                </span>
                <span className="text-xs font-medium text-[#6e7a6e]">estudiantes</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-home-label text-[10px] font-bold uppercase tracking-widest text-[#6e7a6e]">
                Confianza Estadística
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-home-display text-3xl font-extrabold text-[#0058be]">
                  Alta
                </span>
                <span className="text-xs font-medium text-[#6e7a6e]">(P &lt; 0.05)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Sección de descarga ─────────────────────────────────────────────── */}
      <section className="mx-auto mb-32 max-w-7xl px-8">
        <div className="mb-10 text-center">
          <h2 className="font-home-display mb-2 text-3xl font-extrabold tracking-tight text-[#191c1d]">
            Recursos y Documentación
          </h2>
          <p className="font-home-body text-[#3e4a3e]">
            Exporte los análisis detallados para integración en informes
            institucionales.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Card Pregrado */}
          <div className="group relative rounded-xl border border-transparent bg-[#f3f4f5] p-8 transition-all duration-300 hover:border-[#00682f]/20 hover:bg-white/60">
            <div className="mb-8 flex items-start justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white shadow-sm transition-transform duration-300 group-hover:scale-110">
                <GraduationCap className="size-7 text-[#00682f]" />
              </div>
              <div className="flex gap-2">
                <span className="rounded-full bg-[#e7e8e9] px-3 py-1 font-home-label text-[10px] font-bold uppercase">
                  XLSX
                </span>
              </div>
            </div>

            <h3 className="font-home-display mb-3 text-xl font-bold text-[#191c1d]">
              Descargar Pronóstico Pregrado
            </h3>
            <p className="mb-8 text-sm leading-relaxed text-[#3e4a3e]">
              Desglose por facultades, sedes y programas académicos para el
              nivel de pregrado. Hojas separadas por categoría (Inscritos,
              Admitidos, Matriculados, Primíparos) con columnas históricas y de
              pronóstico marcadas.
            </p>

            <button
              type="button"
              onClick={() => void handleDownload("pregrado")}
              disabled={downloading !== null || loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#00682f] to-[#00843d] py-4 font-home-display font-bold text-white shadow-lg shadow-[#00682f]/10 transition-all hover:shadow-[#00682f]/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloading === "pregrado" ? (
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

          {/* Card Posgrado */}
          <div className="group relative rounded-xl border border-transparent bg-[#f3f4f5] p-8 transition-all duration-300 hover:border-[#00682f]/20 hover:bg-white/60">
            <div className="mb-8 flex items-start justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white shadow-sm transition-transform duration-300 group-hover:scale-110">
                <GraduationCap className="size-7 text-[#00682f]" />
              </div>
              <div className="flex gap-2">
                <span className="rounded-full bg-[#e7e8e9] px-3 py-1 font-home-label text-[10px] font-bold uppercase">
                  XLSX
                </span>
              </div>
            </div>

            <h3 className="font-home-display mb-3 text-xl font-bold text-[#191c1d]">
              Descargar Pronóstico Posgrado
            </h3>
            <p className="mb-8 text-sm leading-relaxed text-[#3e4a3e]">
              Análisis de especializaciones, maestrías y doctorados. Tendencias
              de demanda y proyecciones de inscripción por modalidad, con
              indicadores históricos desde el primer año disponible en la base
              de datos.
            </p>

            <button
              type="button"
              onClick={() => void handleDownload("posgrado")}
              disabled={downloading !== null || loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#00682f] to-[#00843d] py-4 font-home-display font-bold text-white shadow-lg shadow-[#00682f]/10 transition-all hover:shadow-[#00682f]/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloading === "posgrado" ? (
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
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="mt-auto w-full border-t border-slate-200 bg-slate-50 px-8 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <p className="text-sm text-[#3e4a3e]">
            © Universidad de Cundinamarca - Academic Intelligence Portal
          </p>
          <div className="flex gap-8">
            <a href="#" className="text-sm text-[#3e4a3e] transition-all hover:text-[#00682f]">
              Privacy Policy
            </a>
            <a href="#" className="text-sm text-[#3e4a3e] transition-all hover:text-[#00682f]">
              Institutional Data
            </a>
            <a href="#" className="text-sm text-[#3e4a3e] transition-all hover:text-[#00682f]">
              Contact Support
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
