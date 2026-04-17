"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  Upload,
  Users,
  X,
} from "lucide-react";
import { NavBar } from "@/components/layout/navbar";

// ─── Types ────────────────────────────────────────────────────────────────────

type UploadState = "idle" | "previewing" | "uploading" | "success" | "error";

type SectionState = {
  file: File | null;
  uploadState: UploadState;
  message: string;
  warnings: string[];
  upserted: number;
};

type BarData = { label: string; pct: number; count: number };

type StatsResponse = {
  estudiantes: { bars: BarData[]; globalPct: number | null; total: number };
  docentes:    { bars: BarData[]; globalPct: number | null; total: number };
  filters:     { anios: number[]; programas: string[]; encuentros: string[] };
};

type PreviewRow = {
  plan: string;
  actividad: string;
  programa: string;
  unidad_regional: string;
  encuentro: string;
  anio: number;
  status: "nuevo" | "actualizar";
};

type PreviewData = {
  total: number;
  nuevos: number;
  actualizar: number;
  omitidos: number;
  rows: PreviewRow[];
};

type ModalState = {
  open: boolean;
  tipo: "estudiantes" | "docentes";
  data: PreviewData | null;
};

const initialSection = (): SectionState => ({
  file: null,
  uploadState: "idle",
  message: "",
  warnings: [],
  upserted: 0,
});

// ─── PreviewModal ──────────────────────────────────────────────────────────────

function PreviewModal({
  modal,
  uploading,
  onConfirm,
  onCancel,
}: {
  modal: ModalState;
  uploading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!modal.open || !modal.data) return null;
  const { data } = modal;

  const nuevos     = data.rows.filter((r) => r.status === "nuevo");
  const actualizar = data.rows.filter((r) => r.status === "actualizar");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Panel */}
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#edeeef] px-6 py-5">
          <div>
            <h2 className="font-[Manrope] text-lg font-bold text-[#191c1d]">
              Confirmar carga —{" "}
              {modal.tipo === "estudiantes" ? "Plan Estudiantil" : "Plan Docentes"}
            </h2>
            <p className="mt-0.5 text-sm text-[#6e7a6e]">
              Revisa los cambios antes de guardar en la base de datos.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-[#6e7a6e] hover:bg-[#f3f4f5]"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 border-b border-[#edeeef] px-6 py-4">
          <div className="rounded-xl bg-[#f3f4f5] p-4 text-center">
            <p className="font-[Manrope] text-2xl font-extrabold text-[#191c1d]">{data.total}</p>
            <p className="mt-0.5 text-xs font-medium text-[#6e7a6e]">Total en archivo</p>
          </div>
          <div className="rounded-xl bg-[#00682f]/10 p-4 text-center">
            <p className="font-[Manrope] text-2xl font-extrabold text-[#00682f]">{data.nuevos}</p>
            <p className="mt-0.5 text-xs font-medium text-[#00682f]">Nuevos registros</p>
          </div>
          <div className="rounded-xl bg-[#2170e4]/10 p-4 text-center">
            <p className="font-[Manrope] text-2xl font-extrabold text-[#0058be]">{data.actualizar}</p>
            <p className="mt-0.5 text-xs font-medium text-[#0058be]">Se actualizarán</p>
          </div>
        </div>

        {/* Detail list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {nuevos.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Plus className="size-4 text-[#00682f]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#00682f]">
                  Nuevos ({nuevos.length})
                </span>
              </div>
              <ul className="space-y-1.5">
                {nuevos.map((r, i) => (
                  <li key={i} className="rounded-lg border border-[#00682f]/20 bg-[#00682f]/5 px-3 py-2">
                    <p className="text-xs font-semibold text-[#191c1d] truncate">{r.plan}</p>
                    <p className="mt-0.5 text-[11px] text-[#6e7a6e] truncate">{r.actividad}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {actualizar.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <RefreshCw className="size-4 text-[#0058be]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#0058be]">
                  Se sobreescribirán ({actualizar.length})
                </span>
              </div>
              <ul className="space-y-1.5">
                {actualizar.map((r, i) => (
                  <li key={i} className="rounded-lg border border-[#0058be]/20 bg-[#0058be]/5 px-3 py-2">
                    <p className="text-xs font-semibold text-[#191c1d] truncate">{r.plan}</p>
                    <p className="mt-0.5 text-[11px] text-[#6e7a6e] truncate">{r.actividad}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.omitidos > 0 && (
            <p className="text-xs text-[#6e7a6e]">
              ⚠ {data.omitidos} fila(s) omitidas por datos incompletos.
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 border-t border-[#edeeef] px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            className="rounded-lg border border-[#bdcabb] px-5 py-2.5 text-sm font-bold text-[#191c1d] hover:bg-[#f3f4f5] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            {uploading ? "Guardando…" : "Confirmar y guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── UploadCard ───────────────────────────────────────────────────────────────

function UploadCard({
  title,
  description,
  icon,
  accentColor,
  state,
  onFileChange,
  onPreview,
  onExport,
  exportLabel,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  accentColor: "primary" | "secondary";
  state: SectionState;
  onFileChange: (file: File | null) => void;
  onPreview: () => void;
  onExport: () => void;
  exportLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const accent =
    accentColor === "primary"
      ? {
          bg: "bg-[#00682f]/10",
          text: "text-[#00682f]",
          border: "border-[#00682f]",
          btn: "bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)]",
        }
      : {
          bg: "bg-[#0058be]/10",
          text: "text-[#0058be]",
          border: "border-[#0058be]",
          btn: "bg-[linear-gradient(135deg,#0058be_0%,#2170e4_100%)]",
        };

  const busy = state.uploadState === "previewing" || state.uploadState === "uploading";

  return (
    <div className="group flex flex-col rounded-xl border border-[#bdcabb]/20 bg-white p-8 shadow-[0_20px_40px_rgba(0,104,47,0.06)] transition-all hover:shadow-[0_20px_40px_rgba(0,104,47,0.12)]">
      <div className="mb-6 flex items-start justify-between">
        <div className={`rounded-xl p-3 ${accent.bg} ${accent.text}`}>{icon}</div>
        <span
          className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
            state.uploadState === "success"
              ? "bg-[#00682f]/10 text-[#00682f]"
              : "bg-[#edeeef] text-[#6e7a6e]"
          }`}
        >
          {state.uploadState === "success" ? "Cargado" : "Carga pendiente"}
        </span>
      </div>

      <h3 className="mb-2 font-[Manrope] text-xl font-bold text-[#191c1d]">{title}</h3>
      <p className="mb-8 flex-grow text-sm leading-relaxed text-[#3e4a3e]">{description}</p>

      {/* Drop zone */}
      <div
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFileChange(f); }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className={`mb-6 cursor-pointer rounded-xl border-2 border-dashed p-10 flex flex-col items-center justify-center transition-colors
          ${state.file ? `${accent.border} bg-[#f8f9fa]` : "border-[#bdcabb] hover:border-[#bdcabb]/80 hover:bg-[#f8f9fa]"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        {state.file ? (
          <>
            <CheckCircle2 className={`mb-2 size-8 ${accent.text}`} />
            <span className="text-sm font-medium text-[#191c1d]">{state.file.name}</span>
            <span className="mt-1 text-xs text-[#6e7a6e]">
              {(state.file.size / 1024).toFixed(1)} KB — Click para cambiar
            </span>
          </>
        ) : (
          <>
            <Upload className="mb-2 size-8 text-[#6e7a6e]" />
            <span className="text-sm font-medium text-[#3e4a3e]">Arrastrar archivo aquí</span>
            <span className="mt-1 text-xs text-[#6e7a6e]">o click para seleccionar · XLSX · Máx 25MB</span>
          </>
        )}
      </div>

      {/* Feedback */}
      {state.message && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg p-3 text-sm ${
            state.uploadState === "error" ? "bg-red-50 text-red-700" : "bg-[#00682f]/10 text-[#00682f]"
          }`}
        >
          {state.uploadState === "error" ? (
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{state.message}</span>
        </div>
      )}

      {state.warnings.length > 0 && (
        <details className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
          <summary className="cursor-pointer font-semibold">
            {state.warnings.length} advertencia(s)
          </summary>
          <ul className="mt-2 space-y-1 pl-4">
            {state.warnings.map((w, i) => <li key={i} className="list-disc">{w}</li>)}
          </ul>
        </details>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onPreview}
          disabled={!state.file || busy}
          className={`inline-flex items-center gap-2 rounded px-5 py-2.5 text-sm font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50 ${accent.btn}`}
        >
          {state.uploadState === "previewing" ? (
            <><Loader2 className="size-4 animate-spin" /> Analizando…</>
          ) : state.uploadState === "uploading" ? (
            <><Loader2 className="size-4 animate-spin" /> Guardando…</>
          ) : (
            <><Upload className="size-4" /> Cargar planes de mejoramiento</>
          )}
        </button>

        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-2 rounded border border-[#bdcabb] px-5 py-2.5 text-sm font-bold text-[#191c1d] transition-colors hover:bg-[#f3f4f5]"
        >
          <Download className="size-4" />
          {exportLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EncuentrosDialogicosPage() {
  const [estudiantes, setEstudiantes] = useState<SectionState>(initialSection());
  const [docentes,    setDocentes]    = useState<SectionState>(initialSection());

  // ── Modal ──
  const [modal, setModal] = useState<ModalState>({ open: false, tipo: "estudiantes", data: null });

  // ── Stats ──
  const [stats,             setStats]             = useState<StatsResponse | null>(null);
  const [statsLoading,      setStatsLoading]      = useState(false);
  const [selectedAnio,      setSelectedAnio]      = useState<string>("");
  const [selectedPrograma,  setSelectedPrograma]  = useState<string>("todos");
  const [selectedEncuentro, setSelectedEncuentro] = useState<string>("todos");

  const fetchStats = useCallback(async (anio: string, programa: string, encuentro: string) => {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams();
      if (anio) params.set("anio", anio);
      if (programa  !== "todos") params.set("programa",  programa);
      if (encuentro !== "todos") params.set("encuentro", encuentro);
      const res = await fetch(`/api/encuentros-dialogicos/stats?${params}`);
      if (res.ok) setStats(await res.json());
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats("", "todos", "todos"); }, [fetchStats]);

  const handleAnioChange      = (v: string) => { setSelectedAnio(v); setSelectedPrograma("todos"); setSelectedEncuentro("todos"); fetchStats(v, "todos", "todos"); };
  const handleProgramaChange  = (v: string) => { setSelectedPrograma(v); setSelectedEncuentro("todos"); fetchStats(selectedAnio, v, "todos"); };
  const handleEncuentroChange = (v: string) => { setSelectedEncuentro(v); fetchStats(selectedAnio, selectedPrograma, v); };

  // ── Preview (paso 1) ──────────────────────────────────────────────────────
  const runPreview = useCallback(async (tipo: "estudiantes" | "docentes") => {
    const setter = tipo === "estudiantes" ? setEstudiantes : setDocentes;
    const file   = tipo === "estudiantes" ? estudiantes.file : docentes.file;
    if (!file) return;

    setter((p) => ({ ...p, uploadState: "previewing", message: "" }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("tipo", tipo);
      const res  = await fetch("/api/encuentros-dialogicos/preview-planes", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al analizar");
      setter((p) => ({ ...p, uploadState: "idle" }));
      setModal({ open: true, tipo, data: json });
    } catch (err) {
      setter((p) => ({
        ...p,
        uploadState: "error",
        message: err instanceof Error ? err.message : "Error desconocido",
      }));
    }
  }, [estudiantes.file, docentes.file]);

  // ── Upload real (paso 2, desde modal) ────────────────────────────────────
  const runUpload = useCallback(async () => {
    const tipo   = modal.tipo;
    const setter = tipo === "estudiantes" ? setEstudiantes : setDocentes;
    const file   = tipo === "estudiantes" ? estudiantes.file : docentes.file;
    if (!file) return;

    setter((p) => ({ ...p, uploadState: "uploading" }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const endpoint = tipo === "estudiantes"
        ? "/api/encuentros-dialogicos/upload-estudiantes"
        : "/api/encuentros-dialogicos/upload-docentes";
      const res  = await fetch(endpoint, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al guardar");
      setter((p) => ({
        ...p,
        uploadState: "success",
        message: json.message,
        warnings: json.warnings ?? [],
        upserted: json.upserted ?? 0,
      }));
      setModal({ open: false, tipo: "estudiantes", data: null });
      fetchStats(selectedAnio, selectedPrograma, selectedEncuentro);
    } catch (err) {
      setter((p) => ({
        ...p,
        uploadState: "error",
        message: err instanceof Error ? err.message : "Error desconocido",
      }));
      setModal((m) => ({ ...m, open: false }));
    }
  }, [modal.tipo, estudiantes.file, docentes.file, fetchStats, selectedAnio, selectedPrograma, selectedEncuentro]);

  const isUploading =
    (modal.tipo === "estudiantes" && estudiantes.uploadState === "uploading") ||
    (modal.tipo === "docentes"    && docentes.uploadState    === "uploading");

  return (
    <main className="flex min-h-screen flex-col bg-[#f8f9fa] font-home-body text-[#191c1d] pt-16">
      <NavBar activePage="encuentros-dialogicos" />

      {/* Modal de confirmación */}
      <PreviewModal
        modal={modal}
        uploading={isUploading}
        onConfirm={runUpload}
        onCancel={() => setModal((m) => ({ ...m, open: false }))}
      />

      {/* ── Header ── */}
      <section className="bg-[#f8f9fa] px-6 py-12 sm:px-8 md:px-24">
        <div className="mx-auto max-w-7xl">
          <span className="mb-4 block font-[WorkSans] text-sm font-semibold uppercase tracking-widest text-[#00682f]">
            Estrategia Institucional
          </span>
          <h1 className="mb-6 font-[Manrope] text-4xl font-extrabold leading-tight tracking-tight text-[#191c1d] md:text-5xl">
            Encuentros Dialógicos:{" "}
            <span className="text-[#00843d]">Espacios de Transformación</span>
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-[#3e4a3e]">
            Los Encuentros Dialógicos son la piedra angular de nuestra retroalimentación académica.
            Un proceso sistemático diseñado para fortalecer el diálogo entre la comunidad educativa,
            identificar brechas de aprendizaje y concertar planes de mejora continua que garanticen
            la excelencia en cada facultad.
          </p>
        </div>
      </section>

      {/* ── Planes de Mejoramiento ── */}
      <section className="bg-[#f3f4f5] px-6 py-12 sm:px-8 md:px-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex items-center gap-3">
            <Users className="size-8 text-[#00682f]" />
            <h2 className="font-[Manrope] text-2xl font-bold text-[#191c1d]">
              Planes de Mejoramiento
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <UploadCard
              title="Plan Estudiantil"
              description="Cargue los archivos consolidados de los encuentros con estudiantes. La columna Plan de Mejoramiento se genera automáticamente. Formatos aceptados: XLSX."
              icon={<Users className="size-7" />}
              accentColor="primary"
              state={estudiantes}
              onFileChange={(f) => setEstudiantes((p) => ({ ...p, file: f, uploadState: "idle", message: "", warnings: [] }))}
              onPreview={() => runPreview("estudiantes")}
              onExport={() => { window.location.href = "/api/encuentros-dialogicos/export-estudiantes"; }}
              exportLabel="Descargar BD Estudiantes"
            />

            <UploadCard
              title="Plan Docentes"
              description="Gestione y suba los compromisos académicos derivados de las sesiones con el cuerpo docente. La columna Plan de Mejoramiento se genera automáticamente. Formatos aceptados: XLSX."
              icon={<GraduationCap className="size-7" />}
              accentColor="secondary"
              state={docentes}
              onFileChange={(f) => setDocentes((p) => ({ ...p, file: f, uploadState: "idle", message: "", warnings: [] }))}
              onPreview={() => runPreview("docentes")}
              onExport={() => { window.location.href = "/api/encuentros-dialogicos/export-docentes"; }}
              exportLabel="Descargar BD Docentes"
            />
          </div>

          {/* Fórmula */}
          <div className="mt-8 rounded-xl border border-[#bdcabb]/30 bg-white p-6 shadow-sm">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#6e7a6e]">
              Fórmula — Plan de Mejoramiento
            </p>
            <code className="block rounded bg-[#f3f4f5] px-4 py-3 text-sm text-[#191c1d]">
              MAYUSC(&quot;plan de mejoramiento &quot; &amp; [ENCUENTRO] &amp; &quot; &quot; &amp; [AÑO] &amp; &quot; : &quot; &amp; [PROGRAMA] &amp; &quot; &quot; &amp; [UNIDAD REGIONAL] &amp; &quot; &quot; &amp; [FACULTAD])
            </code>
            <p className="mt-2 text-xs text-[#6e7a6e]">
              Los campos de texto se normalizan automáticamente al cargar el archivo.
            </p>
          </div>
        </div>
      </section>

      {/* ── Visualización de Cumplimiento ── */}
      <section className="bg-[#f8f9fa] px-6 py-12 sm:px-8 md:px-24">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl border border-[#bdcabb]/10 bg-white p-8 shadow-[0_20px_40px_rgba(0,104,47,0.06)]">
            <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="mb-2 font-[Manrope] text-2xl font-bold text-[#191c1d]">
                  Visualización de Cumplimiento
                </h2>
                <p className="text-sm text-[#3e4a3e]">
                  Promedio de calificación de cumplimiento por unidad regional.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Año</label>
                  <select value={selectedAnio} onChange={(e) => handleAnioChange(e.target.value)}
                    className="rounded-lg border border-[#bdcabb] bg-white px-4 py-2 text-sm focus:border-[#00682f] focus:outline-none focus:ring-1 focus:ring-[#00682f]">
                    <option value="">Todos</option>
                    {stats?.filters.anios.map((a) => <option key={a} value={String(a)}>{a}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Programa</label>
                  <select value={selectedPrograma} onChange={(e) => handleProgramaChange(e.target.value)}
                    className="rounded-lg border border-[#bdcabb] bg-white px-4 py-2 text-sm focus:border-[#00682f] focus:outline-none focus:ring-1 focus:ring-[#00682f] min-w-[200px]">
                    <option value="todos">Todos los programas</option>
                    {stats?.filters.programas.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Tipo de encuentro</label>
                  <select value={selectedEncuentro} onChange={(e) => handleEncuentroChange(e.target.value)}
                    className="rounded-lg border border-[#bdcabb] bg-white px-4 py-2 text-sm focus:border-[#00682f] focus:outline-none focus:ring-1 focus:ring-[#00682f] min-w-[200px]">
                    <option value="todos">Todos</option>
                    {stats?.filters.encuentros.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {statsLoading ? (
              <div className="flex h-72 items-center justify-center gap-3 text-[#6e7a6e]">
                <Loader2 className="size-6 animate-spin" />
                <span className="text-sm">Cargando datos…</span>
              </div>
            ) : stats && (stats.estudiantes.bars.length > 0 || stats.docentes.bars.length > 0) ? (
              <div className="grid gap-8 lg:grid-cols-2">
                <ChartBar title="Cumplimiento Estudiantes" globalPct={stats.estudiantes.globalPct} total={stats.estudiantes.total} bars={stats.estudiantes.bars} color="bg-[#00843d]" />
                <ChartBar title="Cumplimiento Docentes"    globalPct={stats.docentes.globalPct}    total={stats.docentes.total}    bars={stats.docentes.bars}    color="bg-[#0058be]" />
              </div>
            ) : (
              <div className="flex h-72 flex-col items-center justify-center gap-2 text-[#6e7a6e]">
                <Users className="size-10 opacity-30" />
                <p className="text-sm">No hay datos para los filtros seleccionados.</p>
                <p className="text-xs">Cargue un archivo para ver las estadísticas.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto w-full border-t border-neutral-200 bg-neutral-50 py-8 text-xs">
        <div className="flex flex-col items-center justify-between gap-4 px-12 md:flex-row">
          <p className="font-home-label text-neutral-500">
            © 2024 Universidad de Cundinamarca. Institutional Intelligence Unit.
          </p>
          <div className="flex flex-wrap gap-6">
            {["Privacy Policy", "Terms of Service", "Contact Support", "Documentation"].map((label) => (
              <a key={label} href="#" className="font-home-label text-neutral-500 transition-opacity hover:opacity-80 hover:text-neutral-800">{label}</a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}

// ─── ChartBar ─────────────────────────────────────────────────────────────────

function ChartBar({ title, globalPct, total, bars, color }: {
  title: string; globalPct: number | null; total: number; bars: BarData[]; color: string;
}) {
  return (
    <div className="rounded-xl border border-[#bdcabb]/20 bg-[#f8f9fa] p-6">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h3 className="font-[Manrope] text-lg font-bold text-[#191c1d]">{title}</h3>
          <p className="text-xs text-[#6e7a6e]">{total} registros</p>
        </div>
        <div className="text-right">
          <span className="font-[Manrope] text-2xl font-bold text-[#00843d]">
            {globalPct != null ? `${globalPct}%` : "—"}
          </span>
          <p className="text-[10px] text-[#6e7a6e]">promedio global</p>
        </div>
      </div>

      {bars.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-[#6e7a6e]">Sin datos</div>
      ) : (
        <div className="flex h-64 items-end gap-4 px-2">
          <div className="flex h-full flex-col justify-between border-r border-[#bdcabb]/30 pr-2 text-[10px] text-[#6e7a6e]">
            <span>100%</span><span>50%</span><span>0%</span>
          </div>
          <div className="flex flex-1 h-full items-end justify-between gap-2">
            {bars.map((bar) => (
              <div key={bar.label} className="group/bar flex flex-1 flex-col items-center gap-1 justify-end h-full" title={`${bar.label}: ${bar.pct}%`}>
                <span className="invisible group-hover/bar:visible text-[9px] font-bold text-[#191c1d] bg-white border border-[#bdcabb]/30 rounded px-1 py-0.5 shadow-sm whitespace-nowrap">
                  {bar.pct}%
                </span>
                <div className={`w-full rounded-t-lg transition-all hover:opacity-80 ${color}`}
                  style={{ height: `${bar.pct}%`, minHeight: bar.pct > 0 ? "4px" : "0" }} />
                <span className="w-full truncate text-center text-[9px] uppercase text-[#6e7a6e]" title={bar.label}>
                  {bar.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
