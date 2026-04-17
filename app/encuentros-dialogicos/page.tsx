"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BarChart2,
  CheckCircle2,
  Download,
  GraduationCap,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Upload,
  Users,
  X,
} from "lucide-react";
import { NavBar } from "@/components/layout/navbar";

// ─── Columnas requeridas ──────────────────────────────────────────────────────

const COLUMNAS_ESTUDIANTES = [
  "CATEGORIA",
  "SUBCATEGORIA",
  "ACTIVIDAD",
  "FECHA DE CUMPLIMIENTO",
  "CALIFICACION DE CUMPLIMIENTO",
  "EFECTIVIDAD",
  "PROGRAMA",
  "UNIDAD REGIONAL",
  "FACULTAD",
  "AÑO",
  "ENCUENTRO",
  "FORMULADO",
] as const;

const COLUMNAS_DOCENTES = [
  "CATEGORIA",
  "SUBCATEGORIA",
  "ACTIVIDAD",
  "FECHA DE CUMPLIMIENTO",
  "CALIFICACION DE CUMPLIMIENTO",
  "PROGRAMA",
  "UNIDAD REGIONAL",
  "FACULTAD",
  "AÑO",
  "ENCUENTRO",
  "FORMULADO",
  "CALIFICACIÓN",
] as const;

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

// ─── Columnas encuestas ───────────────────────────────────────────────────────

// Todas las columnas del Excel que mapean a campos de encuestas_docentes en BD.
// Las dos primeras son obligatorias; las demás opcionales pero deben existir para poblar la BD.
const COLUMNAS_ENC_DOCENTES = [
  // ── Obligatorias (fila omitida si faltan) ──
  "UNIDAD REGIONAL",
  "FACULTAD",
  // ── Programa (se extrae de la primera columna de facultad con valor) ──
  "FACULTAD DE CIENCIAS ADMINISTRATIVAS, ECONÓMICAS Y CONTABLES",
  "FACULTAD DE CIENCIAS AGROPECUARIAS",
  "FACULTAD DE CIENCIAS DEL DEPORTE Y LA EDUCACIÓN FÍSICA",
  "FACULTAD DE EDUCACIÓN",
  "FACULTAD DE INGENIERÍA",
  "FACULTAD DE CIENCIAS DE LA SALUD",
  "FACULTAD DE CIENCIAS SOCIALES, HUMANIDADES Y CIENCIAS POLÍTICAS",
  "DOCTORADO",
  "MAESTRIAS",
  "ESPECIALIZACIONES",
  "POSGRADOS",
  // ── Respuestas de percepción ──
  "EN UNA ESCALA DEL 1 AL 5, ¿CÓMO CALIFICARÍAS TU EXPERIENCIA...?",
  "CONSIDERAS QUE LA PROFUNDIDAD CON LA QUE SE ABORDARON LOS TEMAS FUE:",
  "CONSIDERAS QUE LA OPORTUNIDAD DE EXPRESAR TU OPINIÓN FUE:",
  "CLARIDAD EN LAS RESPUESTAS A LA COMUNIDAD ESTUDIANTIL",
  "CONVOCATORIA, PUBLICIDAD Y DIFUSIÓN DEL EVENTO",
  "ORGANIZACIÓN DEL EVENTO",
  "MECANISMOS DE PARTICIPACIÓN",
  "PARTICIPACIÓN DE LA COMUNIDAD UNIVERSITARIA",
  "USO DE CANALES DIGITALES",
  "¿QUÉ ASPECTOS DEL EVENTO CREES QUE PODRÍAN MEJORARSE?",
] as const;

// Todas las columnas del Excel que mapean a campos de encuestas_estudiantes en BD.
// UNIDAD REGIONAL y al menos una columna de FACULTAD son obligatorias.
const COLUMNAS_ENC_ESTUDIANTES = [
  // ── Obligatorias (fila omitida si faltan) ──
  "UNIDAD REGIONAL A LA QUE PERTENECE",
  // ── Programa (se extrae de la primera columna de facultad con valor) ──
  "FACULTAD DE CIENCIAS ADMINISTRATIVAS, ECONÓMICAS Y CONTABLES",
  "FACULTAD DE CIENCIAS AGROPECUARIAS",
  "FACULTAD DE CIENCIAS DEL DEPORTE Y LA EDUCACIÓN FÍSICA",
  "FACULTAD DE EDUCACIÓN",
  "FACULTAD DE INGENIERÍA",
  "FACULTAD DE CIENCIAS DE LA SALUD",
  "FACULTAD DE CIENCIAS SOCIALES, HUMANIDADES Y CIENCIAS POLÍTICAS",
  "DOCTORADO",
  "MAESTRIAS",
  "ESPECIALIZACIONES",
  "POSGRADOS",
  // ── Otras columnas de la encuesta ──
  "SEMESTRE QUE CURSA",
  "EN UNA ESCALA DE 1 A 5 SIENDO 1 MENOS SATISFECHO... ¿CÓMO CALIFICA SU EXPERIENCIA GENERAL?",
  "¿CÓMO CALIFICA LA PROFUNDIDAD CON LA QUE SE ABORDARON LOS TEMAS?",
  "¿HA RECIBIDO RETROALIMENTACIÓN SOBRE LOS COMPROMISOS?",
  "¿CÓMO CALIFICA EL SEGUIMIENTO DE LOS COMPROMISOS?",
  "¿QUÉ ASPECTOS CONSIDERA QUE PODRÍAN MEJORARSE?",
] as const;

// ─── Encuesta types ───────────────────────────────────────────────────────────

type EncuestaSection = {
  file:        File | null;
  encuentro:   string;
  anio:        string;
  uploadState: UploadState;
  message:     string;
  warnings:    string[];
  inserted:    number;
};

type EncuestaPreviewData = {
  existing: number;
  incoming: number;
  encuentro: string;
  anio:      number;
};

type EncuestaModalState = {
  open:  boolean;
  tipo:  "estudiantes" | "docentes";
  data:  EncuestaPreviewData | null;
};

type EncuestaStatsResponse = {
  estudiantes: { bars: BarData[]; avgScore: number | null; total: number };
  docentes:    { bars: BarData[]; avgScore: number | null; total: number };
  filters:     { anios: number[]; encuentros: string[] };
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

const initialEncuestaSection = (): EncuestaSection => ({
  file:        null,
  encuentro:   "",
  anio:        "",
  uploadState: "idle",
  message:     "",
  warnings:    [],
  inserted:    0,
});

// ─── ColumnasInfo ─────────────────────────────────────────────────────────────

function ColumnasInfo({ columnas, note }: { columnas: readonly string[]; note?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0058be] underline-offset-2 hover:underline"
      >
        Columnas estándar
        <Info className="size-3.5" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-80 rounded-xl border border-[#bdcabb]/30 bg-[#191c1d] p-4 shadow-xl">
          <p className="mb-3 text-xs leading-relaxed text-[#e1e3e4]">
            Columnas mínimas requeridas. El nombre no distingue mayúsculas/minúsculas,
            tildes ni espacios al inicio/fin.
          </p>
          <ul className="space-y-1">
            {columnas.map((col) => (
              <li key={col} className="flex items-center gap-2 text-[11px] text-white">
                <span className="size-1.5 shrink-0 rounded-full bg-[#71dc8a]" />
                <code className="font-mono break-all">{col}</code>
              </li>
            ))}
          </ul>
          {note && (
            <p className="mt-3 text-[10px] leading-relaxed text-[#bdcabb] border-t border-[#bdcabb]/20 pt-2">
              {note}
            </p>
          )}
          {/* Arrow */}
          <div className="absolute -bottom-1.5 left-4 size-3 rotate-45 rounded-sm border-b border-r border-[#bdcabb]/30 bg-[#191c1d]" />
        </div>
      )}
    </div>
  );
}

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
  columnas,
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
  columnas: readonly string[];
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

      {/* Columnas requeridas */}
      <div className="mt-4 pt-4 border-t border-[#edeeef]">
        <ColumnasInfo columnas={columnas} />
      </div>
    </div>
  );
}

// ─── EncuestaPreviewModal ─────────────────────────────────────────────────────

function EncuestaPreviewModal({
  modal,
  uploading,
  onConfirm,
  onCancel,
}: {
  modal:     EncuestaModalState;
  uploading: boolean;
  onConfirm: () => void;
  onCancel:  () => void;
}) {
  if (!modal.open || !modal.data) return null;
  const { data } = modal;
  const label = modal.tipo === "estudiantes" ? "Encuesta Estudiantes" : "Encuesta Docentes";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#edeeef] px-6 py-5">
          <div>
            <h2 className="font-[Manrope] text-lg font-bold text-[#191c1d]">
              Confirmar carga — {label}
            </h2>
            <p className="mt-0.5 text-sm text-[#6e7a6e]">
              {data.encuentro} · {data.anio}
            </p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-[#6e7a6e] hover:bg-[#f3f4f5]">
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-[#00682f]/8 p-4">
            <span className="text-sm font-medium text-[#191c1d]">Respuestas a insertar</span>
            <span className="font-[Manrope] text-2xl font-bold text-[#00682f]">{data.incoming}</span>
          </div>

          {data.existing > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                Ya existen <strong>{data.existing} respuestas</strong> para este encuentro y año.
                Serán eliminadas y reemplazadas por las nuevas.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-[#edeeef] px-6 py-4">
          <button type="button" onClick={onCancel} disabled={uploading}
            className="rounded-lg px-5 py-2 text-sm font-semibold text-[#6e7a6e] hover:bg-[#f3f4f5] disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)] px-5 py-2 text-sm font-bold text-white disabled:opacity-50 hover:opacity-90">
            {uploading ? <><Loader2 className="size-4 animate-spin" /> Guardando…</> : <><CheckCircle2 className="size-4" /> Confirmar y guardar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EncuestaUploadCard ───────────────────────────────────────────────────────

function EncuestaUploadCard({
  title,
  description,
  icon,
  accentColor,
  columnas,
  columnasNote,
  state,
  onFieldChange,
  onPreview,
  onExport,
}: {
  title:       string;
  description: string;
  icon:        React.ReactNode;
  accentColor: "primary" | "secondary";
  columnas:    readonly string[];
  columnasNote?: string;
  state:       EncuestaSection;
  onFieldChange: (field: "file" | "encuentro" | "anio", value: File | string | null) => void;
  onPreview:   () => void;
  onExport:    () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const accent = accentColor === "primary"
    ? { bg: "bg-[#00682f]/10", text: "text-[#00682f]", border: "border-[#00682f]", btn: "bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)]", ring: "focus:ring-[#00682f] focus:border-[#00682f]" }
    : { bg: "bg-[#0058be]/10", text: "text-[#0058be]", border: "border-[#0058be]", btn: "bg-[linear-gradient(135deg,#0058be_0%,#2170e4_100%)]", ring: "focus:ring-[#0058be] focus:border-[#0058be]" };

  const busy    = state.uploadState === "previewing" || state.uploadState === "uploading";
  const canSend = !!state.file && !!state.encuentro.trim() && !!state.anio;

  return (
    <div className="flex flex-col rounded-xl border border-[#bdcabb]/20 bg-white p-8 shadow-[0_20px_40px_rgba(0,104,47,0.06)] transition-all hover:shadow-[0_20px_40px_rgba(0,104,47,0.12)]">
      <div className="mb-6 flex items-start justify-between">
        <div className={`rounded-xl p-3 ${accent.bg} ${accent.text}`}>{icon}</div>
        <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
          state.uploadState === "success" ? "bg-[#00682f]/10 text-[#00682f]" : "bg-[#edeeef] text-[#6e7a6e]"
        }`}>
          {state.uploadState === "success" ? "Cargado" : "Carga pendiente"}
        </span>
      </div>

      <h3 className="mb-2 font-[Manrope] text-xl font-bold text-[#191c1d]">{title}</h3>
      <p className="mb-6 flex-grow text-sm leading-relaxed text-[#3e4a3e]">{description}</p>

      {/* Inputs de contexto */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Número de encuentro</label>
          <input
            type="text"
            value={state.encuentro}
            onChange={(e) => onFieldChange("encuentro", e.target.value)}
            placeholder="Ej: TERCER ENCUENTRO"
            className={`rounded-lg border border-[#bdcabb] px-3 py-2 text-sm focus:outline-none focus:ring-1 ${accent.ring}`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Año</label>
          <input
            type="number"
            value={state.anio}
            onChange={(e) => onFieldChange("anio", e.target.value)}
            placeholder="2026"
            min={2020}
            max={2050}
            className={`rounded-lg border border-[#bdcabb] px-3 py-2 text-sm focus:outline-none focus:ring-1 ${accent.ring}`}
          />
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFieldChange("file", f); }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className={`mb-6 cursor-pointer rounded-xl border-2 border-dashed p-8 flex flex-col items-center justify-center transition-colors
          ${state.file ? `${accent.border} bg-[#f8f9fa]` : "border-[#bdcabb] hover:border-[#bdcabb]/80 hover:bg-[#f8f9fa]"}`}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={(e) => onFieldChange("file", e.target.files?.[0] ?? null)} />
        {state.file ? (
          <>
            <CheckCircle2 className={`mb-2 size-8 ${accent.text}`} />
            <span className="text-sm font-medium text-[#191c1d]">{state.file.name}</span>
            <span className="mt-1 text-xs text-[#6e7a6e]">{(state.file.size / 1024).toFixed(1)} KB — Click para cambiar</span>
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
        <div className={`mb-4 flex items-start gap-2 rounded-lg p-3 text-sm ${
          state.uploadState === "error" ? "bg-red-50 text-red-700" : "bg-[#00682f]/10 text-[#00682f]"
        }`}>
          {state.uploadState === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
          <span>{state.message}</span>
        </div>
      )}

      {state.warnings.length > 0 && (
        <details className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
          <summary className="cursor-pointer font-semibold">{state.warnings.length} advertencia(s)</summary>
          <ul className="mt-2 space-y-1 pl-4">
            {state.warnings.map((w, i) => <li key={i} className="list-disc">{w}</li>)}
          </ul>
        </details>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onPreview} disabled={!canSend || busy}
          className={`inline-flex items-center gap-2 rounded px-5 py-2.5 text-sm font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50 ${accent.btn}`}>
          {state.uploadState === "previewing" ? <><Loader2 className="size-4 animate-spin" /> Analizando…</>
           : state.uploadState === "uploading" ? <><Loader2 className="size-4 animate-spin" /> Guardando…</>
           : <><Upload className="size-4" /> Cargar encuesta</>}
        </button>
        <button type="button" onClick={onExport}
          className="inline-flex items-center gap-2 rounded border border-[#bdcabb] px-5 py-2.5 text-sm font-bold text-[#191c1d] transition-colors hover:bg-[#f3f4f5]">
          <Download className="size-4" /> Descargar BD
        </button>
      </div>

      {/* Columnas requeridas */}
      <div className="mt-4 pt-4 border-t border-[#edeeef]">
        <ColumnasInfo columnas={columnas} note={columnasNote} />
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

  // ── Estado encuestas ──────────────────────────────────────────────────────
  const [encEst,  setEncEst]  = useState<EncuestaSection>(initialEncuestaSection());
  const [encDoc,  setEncDoc]  = useState<EncuestaSection>(initialEncuestaSection());
  const [encModal,setEncModal]= useState<EncuestaModalState>({ open: false, tipo: "estudiantes", data: null });
  const [encStats,    setEncStats]     = useState<EncuestaStatsResponse | null>(null);
  const [encStatsLoading, setEncStatsLoading] = useState(false);
  const [encAnio,     setEncAnio]      = useState<string>("");
  const [encEncuentro,setEncEncuentro] = useState<string>("");

  const fetchEncuestaStats = useCallback(async (anio: string, encuentro: string) => {
    setEncStatsLoading(true);
    try {
      const params = new URLSearchParams();
      if (anio)      params.set("anio",      anio);
      if (encuentro) params.set("encuentro", encuentro);
      const res = await fetch(`/api/encuentros-dialogicos/stats-encuesta?${params}`);
      if (res.ok) setEncStats(await res.json());
    } finally {
      setEncStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchEncuestaStats("", ""); }, [fetchEncuestaStats]);

  const handleEncAnioChange      = (v: string) => { setEncAnio(v); setEncEncuentro(""); fetchEncuestaStats(v, ""); };
  const handleEncEncuentroChange = (v: string) => { setEncEncuentro(v); fetchEncuestaStats(encAnio, v); };

  const runEncuestaPreview = useCallback(async (tipo: "estudiantes" | "docentes") => {
    const s = tipo === "estudiantes" ? encEst : encDoc;
    const setter = tipo === "estudiantes" ? setEncEst : setEncDoc;
    if (!s.file || !s.encuentro.trim() || !s.anio) return;

    setter((p) => ({ ...p, uploadState: "previewing", message: "" }));
    try {
      const fd = new FormData();
      fd.append("file",      s.file);
      fd.append("tipo",      tipo);
      fd.append("encuentro", s.encuentro.trim());
      fd.append("anio",      s.anio);
      const res  = await fetch("/api/encuentros-dialogicos/preview-encuesta", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al analizar");
      setter((p) => ({ ...p, uploadState: "idle" }));
      setEncModal({ open: true, tipo, data: json });
    } catch (err) {
      setter((p) => ({ ...p, uploadState: "error", message: err instanceof Error ? err.message : "Error desconocido" }));
    }
  }, [encEst, encDoc]);

  const runEncuestaUpload = useCallback(async () => {
    const tipo   = encModal.tipo;
    const s      = tipo === "estudiantes" ? encEst : encDoc;
    const setter = tipo === "estudiantes" ? setEncEst : setEncDoc;
    if (!s.file) return;

    setter((p) => ({ ...p, uploadState: "uploading" }));
    try {
      const fd = new FormData();
      fd.append("file",      s.file);
      fd.append("encuentro", s.encuentro.trim());
      fd.append("anio",      s.anio);
      const endpoint = tipo === "estudiantes"
        ? "/api/encuentros-dialogicos/upload-encuesta-estudiantes"
        : "/api/encuentros-dialogicos/upload-encuesta-docentes";
      const res  = await fetch(endpoint, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al guardar");
      setter((p) => ({ ...p, uploadState: "success", message: json.message, warnings: json.warnings ?? [], inserted: json.inserted ?? 0 }));
      setEncModal({ open: false, tipo: "estudiantes", data: null });
      fetchEncuestaStats(encAnio, encEncuentro);
    } catch (err) {
      setter((p) => ({ ...p, uploadState: "error", message: err instanceof Error ? err.message : "Error desconocido" }));
      setEncModal((m) => ({ ...m, open: false }));
    }
  }, [encModal.tipo, encEst, encDoc, fetchEncuestaStats, encAnio, encEncuentro]);

  const isEncUploading =
    (encModal.tipo === "estudiantes" && encEst.uploadState === "uploading") ||
    (encModal.tipo === "docentes"    && encDoc.uploadState === "uploading");

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

      {/* Modal planes */}
      <PreviewModal
        modal={modal}
        uploading={isUploading}
        onConfirm={runUpload}
        onCancel={() => setModal((m) => ({ ...m, open: false }))}
      />

      {/* Modal encuestas */}
      <EncuestaPreviewModal
        modal={encModal}
        uploading={isEncUploading}
        onConfirm={runEncuestaUpload}
        onCancel={() => setEncModal((m) => ({ ...m, open: false }))}
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
              columnas={COLUMNAS_ESTUDIANTES}
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
              columnas={COLUMNAS_DOCENTES}
              state={docentes}
              onFileChange={(f) => setDocentes((p) => ({ ...p, file: f, uploadState: "idle", message: "", warnings: [] }))}
              onPreview={() => runPreview("docentes")}
              onExport={() => { window.location.href = "/api/encuentros-dialogicos/export-docentes"; }}
              exportLabel="Descargar BD Docentes"
            />
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

      {/* ── Encuestas de Percepción ── */}
      <section className="bg-[#f3f4f5] px-6 py-12 sm:px-8 md:px-24">
        <div className="mx-auto max-w-7xl">
          {/* Título sección */}
          <div className="mb-10 flex items-center gap-3">
            <BarChart2 className="size-8 text-[#00682f]" />
            <div>
              <h2 className="font-[Manrope] text-2xl font-bold text-[#191c1d]">Encuestas de Percepción</h2>
              <p className="text-sm text-[#3e4a3e]">Resultados anonimizados de las encuestas aplicadas en cada encuentro.</p>
            </div>
          </div>

          {/* Cards upload */}
          <div className="grid gap-8 md:grid-cols-2 mb-12">
            <EncuestaUploadCard
              title="Encuesta Docentes"
              description="Cargue el archivo de resultados de percepción de gestores del conocimiento. El programa se extrae automáticamente por facultad."
              icon={<GraduationCap className="size-7" />}
              accentColor="primary"
              columnas={COLUMNAS_ENC_DOCENTES}
              columnasNote="El programa se extrae de la primera columna de FACULTAD que tenga valor. Solo se requiere una de ellas."
              state={encDoc}
              onFieldChange={(field, value) => setEncDoc((p) => ({
                ...p,
                ...(field === "file"      ? { file: value as File | null, uploadState: "idle", message: "" }
                  : field === "encuentro" ? { encuentro: value as string }
                  : { anio: value as string }),
              }))}
              onPreview={() => runEncuestaPreview("docentes")}
              onExport={() => { window.location.href = "/api/encuentros-dialogicos/export-encuesta-docentes"; }}
            />

            <EncuestaUploadCard
              title="Encuesta Estudiantes"
              description="Cargue el archivo de resultados de percepción de estudiantes. El programa se extrae automáticamente de las columnas de facultad."
              icon={<Users className="size-7" />}
              accentColor="secondary"
              columnas={COLUMNAS_ENC_ESTUDIANTES}
              columnasNote="Al menos una columna de FACULTAD debe contener el nombre del programa del encuestado."
              state={encEst}
              onFieldChange={(field, value) => setEncEst((p) => ({
                ...p,
                ...(field === "file"      ? { file: value as File | null, uploadState: "idle", message: "" }
                  : field === "encuentro" ? { encuentro: value as string }
                  : { anio: value as string }),
              }))}
              onPreview={() => runEncuestaPreview("estudiantes")}
              onExport={() => { window.location.href = "/api/encuentros-dialogicos/export-encuesta-estudiantes"; }}
            />
          </div>

          {/* Visualización encuestas */}
          <div className="rounded-xl border border-[#bdcabb]/10 bg-white p-8 shadow-[0_20px_40px_rgba(0,104,47,0.06)]">
            <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="mb-1 font-[Manrope] text-xl font-bold text-[#191c1d]">Resultados de Percepción</h3>
                <p className="text-sm text-[#3e4a3e]">Promedio de satisfacción (escala 1–5) por unidad regional.</p>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Año</label>
                  <select value={encAnio} onChange={(e) => handleEncAnioChange(e.target.value)}
                    className="rounded-lg border border-[#bdcabb] bg-white px-4 py-2 text-sm focus:border-[#00682f] focus:outline-none focus:ring-1 focus:ring-[#00682f]">
                    <option value="">Todos</option>
                    {encStats?.filters.anios.map((a) => <option key={a} value={String(a)}>{a}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Encuentro</label>
                  <select value={encEncuentro} onChange={(e) => handleEncEncuentroChange(e.target.value)}
                    className="rounded-lg border border-[#bdcabb] bg-white px-4 py-2 text-sm focus:border-[#00682f] focus:outline-none focus:ring-1 focus:ring-[#00682f] min-w-[200px]">
                    <option value="">Todos</option>
                    {encStats?.filters.encuentros.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Métricas resumen */}
            {encStats && (encStats.estudiantes.total > 0 || encStats.docentes.total > 0) && (
              <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  { label: "Respuestas docentes",      value: String(encStats.docentes.total),    color: "border-[#00682f]" },
                  { label: "Satisfacción docentes",    value: encStats.docentes.avgScore    != null ? `${encStats.docentes.avgScore}/5`    : "—", color: "border-[#00682f]" },
                  { label: "Respuestas estudiantes",   value: String(encStats.estudiantes.total), color: "border-[#0058be]" },
                  { label: "Satisfacción estudiantes", value: encStats.estudiantes.avgScore != null ? `${encStats.estudiantes.avgScore}/5` : "—", color: "border-[#0058be]" },
                ].map((m) => (
                  <div key={m.label} className={`rounded-xl border-l-4 ${m.color} bg-[#f8f9fa] p-4`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">{m.label}</p>
                    <p className="font-[Manrope] text-2xl font-extrabold text-[#191c1d]">{m.value}</p>
                  </div>
                ))}
              </div>
            )}

            {encStatsLoading ? (
              <div className="flex h-72 items-center justify-center gap-3 text-[#6e7a6e]">
                <Loader2 className="size-6 animate-spin" />
                <span className="text-sm">Cargando datos…</span>
              </div>
            ) : encStats && (encStats.estudiantes.bars.length > 0 || encStats.docentes.bars.length > 0) ? (
              <div className="grid gap-8 lg:grid-cols-2">
                <ChartBar title="Satisfacción Docentes"    globalPct={encStats.docentes.avgScore    != null ? Math.round(encStats.docentes.avgScore    * 20) : null} total={encStats.docentes.total}    bars={encStats.docentes.bars}    color="bg-[#00843d]" />
                <ChartBar title="Satisfacción Estudiantes" globalPct={encStats.estudiantes.avgScore != null ? Math.round(encStats.estudiantes.avgScore * 20) : null} total={encStats.estudiantes.total} bars={encStats.estudiantes.bars} color="bg-[#0058be]" />
              </div>
            ) : (
              <div className="flex h-72 flex-col items-center justify-center gap-2 text-[#6e7a6e]">
                <BarChart2 className="size-10 opacity-30" />
                <p className="text-sm">No hay datos de encuestas para los filtros seleccionados.</p>
                <p className="text-xs">Cargue un archivo de encuesta para ver los resultados.</p>
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
      <div className="mb-6 flex items-start justify-between">
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
        <div className="space-y-3">
          {bars.map((bar) => (
            <div key={bar.label} className="group/bar flex items-center gap-3">
              <span className="w-36 shrink-0 truncate text-right text-[11px] text-[#6e7a6e]" title={bar.label}>
                {bar.label}
              </span>
              <div className="relative flex-1 h-6 rounded-full bg-[#e7e8e9] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${color}`}
                  style={{ width: `${bar.pct}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-[11px] font-bold text-[#191c1d]">
                {bar.pct}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
