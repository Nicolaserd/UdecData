"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BarChart2,
  CheckCircle2,
  Cloud,
  Download,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Heart,
  Loader2,
  Sparkles,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { NavBar } from "@/components/layout/navbar";
import { PinModal } from "@/components/reports/pin-modal";

type UploadState = "idle" | "previewing" | "uploading" | "success" | "error";

type FormState = {
  file:        File | null;
  anio:        string;
  periodo:     "" | "IPA" | "IIPA";
  uploadState: UploadState;
  message:     string;
  warnings:    string[];
};

type PreviewData = {
  respuestas:        number;
  registrosArea:     number;
  areasCount:        Record<string, number>;
  existing:          number;
  anio:              number;
  periodo_academico: string;
};

type BarItem = { label: string; pct: number; satisfechos: number; total: number };
type DistItem = { label: string; count: number };

type StatsResponse = {
  kpis: {
    registros:        number;
    respuestasUnicas: number;
    promedioGlobal:   number | null;
    satisfaccionPct:  number | null;
  };
  areaBars:    BarItem[];
  sedeBars:    BarItem[];
  rolBars:     BarItem[];
  distribucion: DistItem[];
  filters: {
    anios:    number[];
    periodos: string[];
    sedes:    string[];
    roles:    string[];
  };
};

const initialState = (): FormState => ({
  file: null, anio: "", periodo: "", uploadState: "idle", message: "", warnings: [],
});

// ─── PreviewModal ─────────────────────────────────────────────────────────────

function PreviewModal({
  open, data, uploading, onConfirm, onCancel,
}: {
  open: boolean; data: PreviewData | null; uploading: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !data) return null;

  const areas = Object.entries(data.areasCount).sort((a, b) => b[1] - a[1]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#edeeef] px-6 py-5">
          <div>
            <h2 className="font-[Manrope] text-lg font-bold text-[#191c1d]">Confirmar carga — Encuesta de Satisfacción</h2>
            <p className="mt-0.5 text-sm text-[#6e7a6e]">Periodo {data.periodo_academico} · {data.anio}</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-[#6e7a6e] hover:bg-[#f3f4f5]">
            <X className="size-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-[#edeeef] px-6 py-4">
          <div className="rounded-xl bg-[#f3f4f5] p-4 text-center">
            <p className="font-[Manrope] text-2xl font-extrabold text-[#191c1d]">{data.respuestas}</p>
            <p className="mt-0.5 text-xs font-medium text-[#6e7a6e]">Respuestas en archivo</p>
          </div>
          <div className="rounded-xl bg-[#00682f]/10 p-4 text-center">
            <p className="font-[Manrope] text-2xl font-extrabold text-[#00682f]">{data.registrosArea}</p>
            <p className="mt-0.5 text-xs font-medium text-[#00682f]">Registros (área x respuesta)</p>
          </div>
          <div className="rounded-xl bg-[#0058be]/10 p-4 text-center">
            <p className="font-[Manrope] text-2xl font-extrabold text-[#0058be]">{areas.length}</p>
            <p className="mt-0.5 text-xs font-medium text-[#0058be]">Áreas evaluadas</p>
          </div>
        </div>

        {data.existing > 0 && (
          <div className="px-6 pt-4">
            <div className="flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                Ya existen <strong>{data.existing} registros</strong> para {data.periodo_academico} {data.anio}.
                Se eliminarán y reemplazarán por los nuevos.
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#6e7a6e]">Detalle por área</p>
          <ul className="space-y-1.5">
            {areas.map(([area, count]) => (
              <li key={area} className="flex items-center justify-between rounded-lg border border-[#bdcabb]/30 bg-[#f8f9fa] px-3 py-2">
                <span className="text-sm text-[#191c1d]">{area}</span>
                <span className="font-[Manrope] text-sm font-bold text-[#00682f]">{count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 border-t border-[#edeeef] px-6 py-4">
          <button type="button" onClick={onCancel} disabled={uploading}
            className="w-full sm:w-auto rounded-lg border border-[#bdcabb] px-5 py-2.5 text-sm font-bold text-[#191c1d] hover:bg-[#f3f4f5] disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={uploading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {uploading ? "Guardando…" : "Confirmar y guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EncuestaSatisfaccionPage() {
  const [form, setForm] = useState<FormState>(initialState());
  const inputRef = useRef<HTMLInputElement>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [pinOpen, setPinOpen] = useState(false);

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── Sección "Descargar Resultados para Análisis"
  const [wcAnio,    setWcAnio]    = useState<string>("");
  const [wcPeriodo, setWcPeriodo] = useState<"" | "IPA" | "IIPA">("");
  const [wcLoading, setWcLoading] = useState(false);
  const [wcError,   setWcError]   = useState<string>("");

  // ── LLM: extracción y consolidado de comentarios ──
  const [llmAnio,    setLlmAnio]    = useState<string>("");
  const [llmPeriodo, setLlmPeriodo] = useState<"" | "IPA" | "IIPA">("");
  const [llmError,   setLlmError]   = useState<string>("");
  const [llmBusy,    setLlmBusy]    = useState(false);
  const [llmStage,   setLlmStage]   = useState<string>("");
  const [llmProgress, setLlmProgress] = useState<{ chunks: number; total: number; consol: number; consolTotal: number }>({ chunks: 0, total: 0, consol: 0, consolTotal: 0 });
  const [llmUrl,     setLlmUrl]     = useState<string>("");

  // ── Reset (borrado manual con PIN) de las 3 tablas de análisis
  const [resetPinOpen, setResetPinOpen] = useState(false);
  const [resetMessage, setResetMessage] = useState<string>("");
  const [filterAnio,    setFilterAnio]    = useState<string>("");
  const [filterPeriodo, setFilterPeriodo] = useState<string>("");
  const [filterSede,    setFilterSede]    = useState<string>("todas");
  const [filterRol,     setFilterRol]     = useState<string>("todos");

  const fetchStats = useCallback(async (anio: string, periodo: string, sede: string, rol: string) => {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams();
      if (anio)    params.set("anio", anio);
      if (periodo) params.set("periodo", periodo);
      if (sede !== "todas") params.set("sede", sede);
      if (rol  !== "todos") params.set("rol", rol);
      const res = await fetch(`/api/encuesta-satisfaccion/stats?${params}`);
      if (res.ok) setStats(await res.json());
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats("", "", "todas", "todos"); }, [fetchStats]);

  const runPreview = useCallback(async () => {
    if (!form.file || !form.anio || !form.periodo) return;
    setForm((p) => ({ ...p, uploadState: "previewing", message: "" }));
    try {
      const fd = new FormData();
      fd.append("file", form.file);
      fd.append("anio", form.anio);
      fd.append("periodo_academico", form.periodo);
      const res  = await fetch("/api/encuesta-satisfaccion/preview", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al analizar");
      setForm((p) => ({ ...p, uploadState: "idle" }));
      setPreviewData(json);
      setPreviewOpen(true);
    } catch (err) {
      setForm((p) => ({ ...p, uploadState: "error", message: err instanceof Error ? err.message : "Error desconocido" }));
    }
  }, [form.file, form.anio, form.periodo]);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    const res = await fetch("/api/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const { valid } = await res.json();
    if (valid) {
      setPinOpen(false);
      await runPreview();
    }
    return valid;
  }, [runPreview]);

  const runUpload = useCallback(async () => {
    if (!form.file) return;
    setForm((p) => ({ ...p, uploadState: "uploading" }));
    try {
      const fd = new FormData();
      fd.append("file", form.file);
      fd.append("anio", form.anio);
      fd.append("periodo_academico", form.periodo);
      const res  = await fetch("/api/encuesta-satisfaccion/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al guardar");
      setForm((p) => ({ ...p, uploadState: "success", message: json.message, warnings: json.warnings ?? [] }));
      setPreviewOpen(false);
      fetchStats(filterAnio, filterPeriodo, filterSede, filterRol);
    } catch (err) {
      setForm((p) => ({ ...p, uploadState: "error", message: err instanceof Error ? err.message : "Error desconocido" }));
      setPreviewOpen(false);
    }
  }, [form.file, form.anio, form.periodo, fetchStats, filterAnio, filterPeriodo, filterSede, filterRol]);

  const canSubmit = !!form.file && !!form.anio && !!form.periodo;
  const busy      = form.uploadState === "previewing" || form.uploadState === "uploading";

  const downloadWordClouds = useCallback(async () => {
    if (!wcAnio || !wcPeriodo) return;
    setWcLoading(true);
    setWcError("");
    try {
      const params = new URLSearchParams({ anio: wcAnio, periodo: wcPeriodo });
      const res    = await fetch(`/api/encuesta-satisfaccion/wordclouds?${params}`);
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "" }));
        throw new Error(error || `Error HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `nubes_de_palabras_${wcPeriodo}_${wcAnio}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setWcError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setWcLoading(false);
    }
  }, [wcAnio, wcPeriodo]);

  const verifyResetPin = useCallback(async (pin: string): Promise<boolean> => {
    setResetMessage("");
    try {
      const res = await fetch("/api/encuesta-satisfaccion/analisis/reset-all", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pin }),
      });
      const json = await res.json();
      if (res.status === 401) return false;          // PIN incorrecto → PinModal mostrará el error
      if (!res.ok) {
        setResetMessage(json.error ?? "Error al borrar datos");
        setResetPinOpen(false);
        return true;                                  // cierra modal; mostramos error debajo
      }
      const d = json.deleted;
      setResetMessage(`Se eliminaron ${d.total} registros (chunks: ${d.chunks}, consolidados: ${d.consolidados}, informes: ${d.informes}).`);
      setResetPinOpen(false);
      setLlmUrl("");
      setLlmError("");
      setLlmProgress({ chunks: 0, total: 0, consol: 0, consolTotal: 0 });
      setLlmStage("");
      return true;
    } catch (err) {
      setResetMessage(err instanceof Error ? err.message : "Error desconocido");
      setResetPinOpen(false);
      return true;
    }
  }, []);

  const generateLlmReport = useCallback(async () => {
    if (!llmAnio || !llmPeriodo) return;
    setLlmBusy(true);
    setLlmError("");
    setLlmUrl("");
    const body = JSON.stringify({ anio: llmAnio, periodo: llmPeriodo });
    const headers = { "Content-Type": "application/json" };

    try {
      // 1. Start: crear chunks
      setLlmStage("Preparando chunks…");
      const startRes  = await fetch("/api/encuesta-satisfaccion/analisis/start", { method: "POST", headers, body });
      const startJson = await startRes.json();
      if (!startRes.ok) throw new Error(startJson.error ?? "Error al iniciar");
      setLlmProgress({
        chunks:      0,
        total:       startJson.totalChunks,
        consol:      startJson.areasSinComentarios ?? 0,
        consolTotal: startJson.totalAreas,
      });

      // 2. Process: iterar hasta completar
      setLlmStage("Analizando chunks con IA (Cerebras → Groq)…");
      {
        let safety = 800;
        let done = false;
        let lastTerminal = -1;
        let stagnantLoops = 0;
        while (!done && safety-- > 0) {
          const res  = await fetch("/api/encuesta-satisfaccion/analisis/process", { method: "POST", headers, body });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Error procesando chunks");
          const terminal = (json.counts.completado ?? 0) + (json.counts.error_final ?? 0);
          setLlmProgress((p) => ({ ...p, chunks: terminal, total: json.counts.total }));
          done = json.done;
          if (terminal === lastTerminal) stagnantLoops++;
          else { stagnantLoops = 0; lastTerminal = terminal; }
          if (stagnantLoops >= 25) {
            const extra = json.ultimoError ? ` · Último error: ${json.ultimoError}` : "";
            throw new Error(`Sin progreso en los análisis — ${json.restantes} chunk(s) atascados.${extra}`);
          }
        }
      }

      // 3. Consolidate
      setLlmStage("Consolidando por área…");
      let consolidadosFinales = 0;
      let consolErroresFinales = 0;
      let consolUltimoError = "";
      {
        let safety = 200;
        let done = false;
        let lastTerminal = -1;
        let stagnantLoops = 0;
        while (!done && safety-- > 0) {
          const res  = await fetch("/api/encuesta-satisfaccion/analisis/consolidate", { method: "POST", headers, body });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Error consolidando");
          const terminal = (json.counts.completado ?? 0) + (json.counts.error ?? 0);
          setLlmProgress((p) => ({ ...p, consol: json.counts.completado, consolTotal: json.counts.total }));
          done = json.done;
          consolidadosFinales  = json.counts.completado ?? 0;
          consolErroresFinales = json.counts.error      ?? 0;
          if (json.ultimoError) consolUltimoError = json.ultimoError;
          if (terminal === lastTerminal) stagnantLoops++;
          else { stagnantLoops = 0; lastTerminal = terminal; }
          if (stagnantLoops >= 15) break; // aborta el loop pero avanza con las que sí quedaron listas
        }
      }

      // Si ninguna área quedó consolidada, no hay informe que generar
      if (consolidadosFinales === 0) {
        const tail = consolUltimoError ? ` · ${consolUltimoError}` : "";
        throw new Error(`No se pudo consolidar ninguna área.${tail}`);
      }

      // 4. Generate docx (descarga binaria directa)
      setLlmStage("Generando documento Word…");
      const genRes = await fetch("/api/encuesta-satisfaccion/analisis/generate", { method: "POST", headers, body });
      if (!genRes.ok) {
        const j = await genRes.json().catch(() => ({ error: `HTTP ${genRes.status}` }));
        throw new Error(j.error ?? "Error generando informe");
      }

      const blob     = await genRes.blob();
      const filename = genRes.headers.get("X-Informe-Filename") ?? `informe_satisfaccion_${llmPeriodo}_${llmAnio}.docx`;
      const href     = URL.createObjectURL(blob);

      // Dispara la descarga inmediatamente
      const a  = document.createElement("a");
      a.href   = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setLlmUrl(href);
      setLlmStage("Informe generado y descargado");
    } catch (err) {
      setLlmError(err instanceof Error ? err.message : "Error desconocido");
      setLlmStage("");
    } finally {
      setLlmBusy(false);
    }
  }, [llmAnio, llmPeriodo]);

  return (
    <main className="flex min-h-screen flex-col bg-[#f8f9fa] font-home-body text-[#191c1d] pt-16">
      <NavBar />

      {pinOpen && (
        <PinModal
          onConfirm={verifyPin}
          onCancel={() => setPinOpen(false)}
        />
      )}

      {resetPinOpen && (
        <PinModal
          onConfirm={verifyResetPin}
          onCancel={() => setResetPinOpen(false)}
        />
      )}

      <PreviewModal
        open={previewOpen}
        data={previewData}
        uploading={form.uploadState === "uploading"}
        onConfirm={runUpload}
        onCancel={() => setPreviewOpen(false)}
      />

      {/* ── Header ── */}
      <section className="bg-[#f8f9fa] px-6 py-12 sm:px-8 md:px-24">
        <div className="mx-auto max-w-7xl">
          <span className="mb-4 block font-[WorkSans] text-sm font-semibold uppercase tracking-widest text-[#00682f]">
            Calidad Institucional
          </span>
          <h1 className="mb-6 font-[Manrope] text-4xl font-extrabold leading-tight tracking-tight text-[#191c1d] md:text-5xl">
            Encuesta de Satisfacción:{" "}
            <span className="text-[#00843d]">Voz de la Comunidad UCundinamarca</span>
          </h1>
          <p className="mb-4 max-w-3xl text-lg leading-relaxed text-[#3e4a3e]">
            Procese y analice los resultados de la encuesta de satisfacción aplicada cada periodo
            académico. Suba el archivo Excel, indique el año y periodo (IPA o IIPA), y obtenga
            estadísticas por área, sede y rol de manera automatizada.
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00682f]/10 px-3 py-1.5 text-xs font-semibold text-[#00682f]">
            <ShieldCheck className="size-3.5" />
            Información estadística anonimizada
          </span>
        </div>
      </section>

      {/* ── Carga ── */}
      <section className="bg-[#f3f4f5] px-6 py-12 sm:px-8 md:px-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex items-center gap-3">
            <FileSpreadsheet className="size-8 text-[#00682f]" />
            <div>
              <h2 className="font-[Manrope] text-2xl font-bold text-[#191c1d]">Cargar Encuesta</h2>
              <p className="text-sm text-[#3e4a3e]">Excel oficial de la Encuesta de Satisfacción Generación Siglo XXI.</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#bdcabb]/20 bg-white p-8 shadow-[0_20px_40px_rgba(0,104,47,0.06)]">
            {/* Inputs contexto */}
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Año</label>
                <input
                  type="number"
                  value={form.anio}
                  onChange={(e) => setForm((p) => ({ ...p, anio: e.target.value, uploadState: "idle", message: "" }))}
                  placeholder="2026"
                  min={2020}
                  max={2050}
                  className="rounded-lg border border-[#bdcabb] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00682f] focus:border-[#00682f]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Periodo Académico</label>
                <select
                  value={form.periodo}
                  onChange={(e) => setForm((p) => ({ ...p, periodo: e.target.value as FormState["periodo"], uploadState: "idle", message: "" }))}
                  className="rounded-lg border border-[#bdcabb] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00682f] focus:border-[#00682f]"
                >
                  <option value="">Seleccione...</option>
                  <option value="IPA">IPA — Periodo Académico I</option>
                  <option value="IIPA">IIPA — Periodo Académico II</option>
                </select>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setForm((p) => ({ ...p, file: f, uploadState: "idle", message: "" })); }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className={`mb-6 cursor-pointer rounded-xl border-2 border-dashed p-10 flex flex-col items-center justify-center transition-colors
                ${form.file ? "border-[#00682f] bg-[#f8f9fa]" : "border-[#bdcabb] hover:border-[#bdcabb]/80 hover:bg-[#f8f9fa]"}`}
            >
              <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={(e) => setForm((p) => ({ ...p, file: e.target.files?.[0] ?? null, uploadState: "idle", message: "" }))} />
              {form.file ? (
                <>
                  <CheckCircle2 className="mb-2 size-8 text-[#00682f]" />
                  <span className="text-sm font-medium text-[#191c1d]">{form.file.name}</span>
                  <span className="mt-1 text-xs text-[#6e7a6e]">{(form.file.size / 1024).toFixed(1)} KB — Click para cambiar</span>
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
            {form.message && (
              <div className={`mb-4 flex items-start gap-2 rounded-lg p-3 text-sm ${
                form.uploadState === "error" ? "bg-red-50 text-red-700" : "bg-[#00682f]/10 text-[#00682f]"
              }`}>
                {form.uploadState === "error"
                  ? <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
                <span>{form.message}</span>
              </div>
            )}

            {/* Acciones */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <button type="button" onClick={() => setPinOpen(true)} disabled={!canSubmit || busy}
                className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded px-5 py-2.5 text-sm font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50 bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)]">
                {form.uploadState === "previewing" ? <><Loader2 className="size-4 animate-spin" /> Analizando…</>
                 : form.uploadState === "uploading" ? <><Loader2 className="size-4 animate-spin" /> Guardando…</>
                 : <><Upload className="size-4" /> Cargar encuesta</>}

              </button>

              <button type="button"
                onClick={() => { window.location.href = "/api/encuesta-satisfaccion/export-principal"; }}
                className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded border border-[#bdcabb] px-5 py-2.5 text-sm font-bold text-[#191c1d] transition-colors hover:bg-[#f3f4f5]">
                <Download className="size-4" /> Descargar tabla principal
              </button>

              <button type="button"
                onClick={() => { window.location.href = "/api/encuesta-satisfaccion/export-detalle"; }}
                className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded bg-[linear-gradient(135deg,#0058be_0%,#2170e4_100%)] px-5 py-2.5 text-sm font-bold text-white transition-all">
                <Download className="size-4" /> Descargar BD completa
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Descargar resultados para análisis ── */}
      <section className="bg-[#f8f9fa] px-6 py-12 sm:px-8 md:px-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex items-center gap-3">
            <FlaskConical className="size-8 text-[#00682f]" />
            <div>
              <h2 className="font-[Manrope] text-2xl font-bold text-[#191c1d]">Descargar Resultados para Análisis</h2>
              <p className="text-sm text-[#3e4a3e]">Reportes procesados para interpretación cualitativa y cuantitativa.</p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1 — Nubes de palabras */}
            <article className="relative flex flex-col rounded-2xl border border-[#bdcabb]/20 bg-white p-6 shadow-[0_20px_40px_rgba(0,104,47,0.06)] transition-all hover:shadow-[0_20px_40px_rgba(0,104,47,0.12)]">
              <div className="mb-5 flex items-start justify-between">
                <div className="flex size-12 items-center justify-center rounded-xl bg-[#00682f]/10">
                  <Cloud className="size-6 text-[#00682f]" />
                </div>
                <span className="rounded-full bg-[#7c4dff]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#7c4dff]">
                  Análisis cualitativo
                </span>
              </div>

              <h3 className="mb-2 font-[Manrope] text-xl font-extrabold leading-tight text-[#191c1d]">
                Nubes de Palabras por Área
              </h3>
              <p className="mb-5 text-sm leading-relaxed text-[#3e4a3e]">
                Genera una nube de palabras por cada área evaluada a partir de los comentarios.
                Limpia automáticamente stopwords, respuestas vacías (&ldquo;na&rdquo;, &ldquo;ok&rdquo;) y ruido textual.
                Se descarga un ZIP con un PNG por área.
              </p>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Año *</label>
                  <select
                    value={wcAnio}
                    onChange={(e) => { setWcAnio(e.target.value); setWcError(""); }}
                    className="rounded-lg border border-[#bdcabb] bg-white px-3 py-2 text-sm focus:border-[#00682f] focus:outline-none focus:ring-1 focus:ring-[#00682f]"
                  >
                    <option value="">Seleccione…</option>
                    {stats?.filters.anios.map((a) => <option key={a} value={String(a)}>{a}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Periodo *</label>
                  <select
                    value={wcPeriodo}
                    onChange={(e) => { setWcPeriodo(e.target.value as "" | "IPA" | "IIPA"); setWcError(""); }}
                    className="rounded-lg border border-[#bdcabb] bg-white px-3 py-2 text-sm focus:border-[#00682f] focus:outline-none focus:ring-1 focus:ring-[#00682f]"
                  >
                    <option value="">Seleccione…</option>
                    <option value="IPA">IPA</option>
                    <option value="IIPA">IIPA</option>
                  </select>
                </div>
              </div>

              {wcError && (
                <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{wcError}</span>
                </div>
              )}

              <button type="button"
                onClick={downloadWordClouds}
                disabled={!wcAnio || !wcPeriodo || wcLoading}
                className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)] px-5 py-3 text-sm font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50">
                {wcLoading
                  ? <><Loader2 className="size-4 animate-spin" /> Generando nubes…</>
                  : <><Download className="size-4" /> Descargar ZIP (PNG)</>}
              </button>
            </article>

            {/* Card 2 — Informe LLM */}
            <article className="relative flex flex-col rounded-2xl border border-[#bdcabb]/20 bg-white p-6 shadow-[0_20px_40px_rgba(0,104,47,0.06)] transition-all hover:shadow-[0_20px_40px_rgba(0,104,47,0.12)]">
              <div className="mb-5 flex items-start justify-between">
                <div className="flex size-12 items-center justify-center rounded-xl bg-[#00682f]/10">
                  <Sparkles className="size-6 text-[#00682f]" />
                </div>
                <span className="rounded-full bg-[#7c4dff]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#7c4dff]">
                  Análisis con IA
                </span>
              </div>

              <h3 className="mb-2 font-[Manrope] text-xl font-extrabold leading-tight text-[#191c1d]">
                Informe Consolidado con IA
              </h3>
              <p className="mb-5 text-sm leading-relaxed text-[#3e4a3e]">
                Analiza todos los comentarios por área usando IA (Cerebras con respaldo en Groq). Procesa en chunks,
                consolida por área en un párrafo institucional y entrega un documento Word descargable.
              </p>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Año *</label>
                  <select
                    value={llmAnio}
                    onChange={(e) => { setLlmAnio(e.target.value); setLlmError(""); }}
                    disabled={llmBusy}
                    className="rounded-lg border border-[#bdcabb] bg-white px-3 py-2 text-sm focus:border-[#00682f] focus:outline-none focus:ring-1 focus:ring-[#00682f] disabled:opacity-60"
                  >
                    <option value="">Seleccione…</option>
                    {stats?.filters.anios.map((a) => <option key={a} value={String(a)}>{a}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Periodo *</label>
                  <select
                    value={llmPeriodo}
                    onChange={(e) => { setLlmPeriodo(e.target.value as "" | "IPA" | "IIPA"); setLlmError(""); }}
                    disabled={llmBusy}
                    className="rounded-lg border border-[#bdcabb] bg-white px-3 py-2 text-sm focus:border-[#00682f] focus:outline-none focus:ring-1 focus:ring-[#00682f] disabled:opacity-60"
                  >
                    <option value="">Seleccione…</option>
                    <option value="IPA">IPA</option>
                    <option value="IIPA">IIPA</option>
                  </select>
                </div>
              </div>

              {llmBusy && (
                <div className="mb-3 rounded-lg bg-[#00682f]/5 p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-[#00682f]">
                    <Loader2 className="size-3.5 animate-spin" />
                    {llmStage}
                  </div>
                  {llmProgress.total > 0 && (
                    <div className="mb-1 flex items-center justify-between text-[10px] text-[#3e4a3e]">
                      <span>Chunks: {llmProgress.chunks}/{llmProgress.total}</span>
                      <span>{llmProgress.total > 0 ? Math.round((llmProgress.chunks / llmProgress.total) * 100) : 0}%</span>
                    </div>
                  )}
                  {llmProgress.total > 0 && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#edeeef]">
                      <div className="h-full bg-[#00682f] transition-all" style={{ width: `${llmProgress.total > 0 ? (llmProgress.chunks / llmProgress.total) * 100 : 0}%` }} />
                    </div>
                  )}
                  {llmProgress.consolTotal > 0 && (
                    <>
                      <div className="mt-2 mb-1 flex items-center justify-between text-[10px] text-[#3e4a3e]">
                        <span>Consolidados: {llmProgress.consol}/{llmProgress.consolTotal}</span>
                        <span>{llmProgress.consolTotal > 0 ? Math.round((llmProgress.consol / llmProgress.consolTotal) * 100) : 0}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#edeeef]">
                        <div className="h-full bg-[#0058be] transition-all" style={{ width: `${llmProgress.consolTotal > 0 ? (llmProgress.consol / llmProgress.consolTotal) * 100 : 0}%` }} />
                      </div>
                    </>
                  )}
                </div>
              )}

              {llmError && (
                <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{llmError}</span>
                </div>
              )}

              {llmUrl && (
                <div className="mb-3 flex items-start gap-2 rounded-lg bg-[#00682f]/10 p-3 text-xs text-[#00682f]">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <span>Informe descargado. Si no apareció, <a href={llmUrl} download className="underline font-semibold">guardar de nuevo</a>.</span>
                </div>
              )}

              <button type="button"
                onClick={generateLlmReport}
                disabled={!llmAnio || !llmPeriodo || llmBusy}
                className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)] px-5 py-3 text-sm font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50">
                {llmBusy
                  ? <><Loader2 className="size-4 animate-spin" /> Procesando…</>
                  : <><FileText className="size-4" /> Generar informe (.docx)</>}
              </button>

              {resetMessage && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#00682f]/10 p-2.5 text-[11px] text-[#00682f]">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                  <span>{resetMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => { setResetMessage(""); setResetPinOpen(true); }}
                disabled={llmBusy}
                className="mt-2 inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#c11c1c] transition-colors hover:text-[#7a1010] disabled:cursor-not-allowed disabled:opacity-50"
                title="Limpiar los registros de análisis (chunks, consolidados e informes) si algo falló"
              >
                <Trash2 className="size-3.5" />
                Borrar datos de análisis si algo falló
              </button>
            </article>
          </div>
        </div>
      </section>

      {/* ── Visualización ── */}
      <section className="bg-[#f8f9fa] px-6 py-12 sm:px-8 md:px-24">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl border border-[#bdcabb]/10 bg-white p-8 shadow-[0_20px_40px_rgba(0,104,47,0.06)]">
            <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <BarChart2 className="size-7 text-[#00682f]" />
                  <h2 className="font-[Manrope] text-2xl font-bold text-[#191c1d]">Resultados por Área</h2>
                </div>
                <p className="text-sm text-[#3e4a3e]">Promedio de satisfacción (escala 1–5) por área evaluada.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Año</label>
                  <select value={filterAnio} onChange={(e) => { setFilterAnio(e.target.value); fetchStats(e.target.value, filterPeriodo, filterSede, filterRol); }}
                    className="w-full rounded-lg border border-[#bdcabb] bg-white px-3 py-2 text-sm focus:border-[#00682f] focus:outline-none focus:ring-1 focus:ring-[#00682f]">
                    <option value="">Todos</option>
                    {stats?.filters.anios.map((a) => <option key={a} value={String(a)}>{a}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Periodo</label>
                  <select value={filterPeriodo} onChange={(e) => { setFilterPeriodo(e.target.value); fetchStats(filterAnio, e.target.value, filterSede, filterRol); }}
                    className="w-full rounded-lg border border-[#bdcabb] bg-white px-3 py-2 text-sm focus:border-[#00682f] focus:outline-none focus:ring-1 focus:ring-[#00682f]">
                    <option value="">Todos</option>
                    {stats?.filters.periodos.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Sede</label>
                  <select value={filterSede} onChange={(e) => { setFilterSede(e.target.value); fetchStats(filterAnio, filterPeriodo, e.target.value, filterRol); }}
                    className="w-full rounded-lg border border-[#bdcabb] bg-white px-3 py-2 text-sm focus:border-[#00682f] focus:outline-none focus:ring-1 focus:ring-[#00682f]">
                    <option value="todas">Todas</option>
                    {stats?.filters.sedes.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Rol</label>
                  <select value={filterRol} onChange={(e) => { setFilterRol(e.target.value); fetchStats(filterAnio, filterPeriodo, filterSede, e.target.value); }}
                    className="w-full rounded-lg border border-[#bdcabb] bg-white px-3 py-2 text-sm focus:border-[#00682f] focus:outline-none focus:ring-1 focus:ring-[#00682f]">
                    <option value="todos">Todos</option>
                    {stats?.filters.roles.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* KPIs */}
            {stats && stats.kpis.registros > 0 && (
              <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border-l-4 border-[#00682f] bg-[#f8f9fa] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Respuestas únicas</p>
                  <p className="font-[Manrope] text-2xl font-extrabold text-[#191c1d]">{stats.kpis.respuestasUnicas}</p>
                </div>
                <div className="rounded-xl border-l-4 border-[#00682f] bg-[#f8f9fa] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Registros (área)</p>
                  <p className="font-[Manrope] text-2xl font-extrabold text-[#191c1d]">{stats.kpis.registros}</p>
                </div>
                <div className="rounded-xl border-l-4 border-[#0058be] bg-[#f8f9fa] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Promedio (1-5)</p>
                  <p className="font-[Manrope] text-2xl font-extrabold text-[#191c1d]">{stats.kpis.promedioGlobal != null ? stats.kpis.promedioGlobal : "—"}</p>
                </div>
                <div className="rounded-xl border-l-4 border-[#0058be] bg-[#f8f9fa] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a6e]">Satisfacción global</p>
                  <p className="font-[Manrope] text-2xl font-extrabold text-[#191c1d]">{stats.kpis.satisfaccionPct != null ? `${stats.kpis.satisfaccionPct}%` : "—"}</p>
                  <p className="text-[9px] text-[#6e7a6e]">Satisfecho + Muy satisfecho</p>
                </div>
              </div>
            )}

            {statsLoading ? (
              <div className="flex h-72 items-center justify-center gap-3 text-[#6e7a6e]">
                <Loader2 className="size-6 animate-spin" />
                <span className="text-sm">Cargando datos…</span>
              </div>
            ) : stats && stats.areaBars.length > 0 ? (
              <div className="grid gap-8 lg:grid-cols-2">
                <ChartBar title="Satisfacción por área"  bars={stats.areaBars} color="bg-[#00843d]" />
                <ChartBar title="Satisfacción por sede"  bars={stats.sedeBars} color="bg-[#0058be]" />
                <ChartBar title="Satisfacción por rol"   bars={stats.rolBars}  color="bg-[#00682f]" />
                <DistChart title="Distribución por nivel" items={stats.distribucion} />
              </div>
            ) : (
              <div className="flex h-72 flex-col items-center justify-center gap-2 text-[#6e7a6e]">
                <Heart className="size-10 opacity-30" />
                <p className="text-sm">No hay datos para los filtros seleccionados.</p>
                <p className="text-xs">Cargue un archivo de encuesta para ver los resultados.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="mt-auto w-full border-t border-neutral-200 bg-neutral-50 py-8 text-xs">
        <div className="flex flex-col items-center justify-between gap-4 px-12 md:flex-row">
          <p className="font-home-label text-neutral-500">Institutional Intelligence Unit.</p>
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

function ChartBar({ title, bars, color }: { title: string; bars: BarItem[]; color: string }) {
  return (
    <div className="rounded-xl border border-[#bdcabb]/20 bg-[#f8f9fa] p-6">
      <div className="mb-4 flex items-start justify-between">
        <h3 className="font-[Manrope] text-lg font-bold text-[#191c1d]">{title}</h3>
        <span className="text-[10px] text-[#6e7a6e]">satisfechos / total</span>
      </div>
      {bars.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-[#6e7a6e]">Sin datos</div>
      ) : (
        <div className="space-y-3">
          {bars.map((bar) => (
            <div key={bar.label} className="flex items-center gap-2 sm:gap-3">
              <span className="w-32 sm:w-44 shrink-0 truncate text-right text-[11px] text-[#6e7a6e]" title={bar.label}>
                {bar.label}
              </span>
              <div className="relative flex-1 h-6 rounded-full bg-[#e7e8e9] overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${bar.pct}%` }} />
              </div>
              <span className="w-12 shrink-0 text-right text-[11px] font-bold text-[#191c1d]">{bar.pct}%</span>
              <span className="w-16 shrink-0 text-right text-[10px] text-[#6e7a6e]">{bar.satisfechos}/{bar.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── DistChart ────────────────────────────────────────────────────────────────

function DistChart({ title, items }: { title: string; items: DistItem[] }) {
  const total = items.reduce((s, x) => s + x.count, 0);
  const colorFor = (label: string) => {
    const k = label.toLowerCase();
    if (k.startsWith("muy insatisfecho")) return "bg-red-500";
    if (k.startsWith("insatisfecho"))     return "bg-orange-500";
    if (k.startsWith("ni satisfecho"))    return "bg-yellow-500";
    if (k.startsWith("muy satisfecho"))   return "bg-emerald-600";
    if (k.startsWith("satisfecho"))       return "bg-emerald-400";
    return "bg-gray-400";
  };

  return (
    <div className="rounded-xl border border-[#bdcabb]/20 bg-[#f8f9fa] p-6">
      <h3 className="mb-4 font-[Manrope] text-lg font-bold text-[#191c1d]">{title}</h3>
      {items.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-[#6e7a6e]">Sin datos</div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const pct = total > 0 ? Math.round((it.count / total) * 100) : 0;
            return (
              <div key={it.label} className="flex items-center gap-2 sm:gap-3">
                <span className="w-32 sm:w-44 shrink-0 truncate text-right text-[11px] text-[#6e7a6e]" title={it.label}>
                  {it.label}
                </span>
                <div className="relative flex-1 h-6 rounded-full bg-[#e7e8e9] overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${colorFor(it.label)}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-12 shrink-0 text-right text-[11px] font-bold text-[#191c1d]">{pct}%</span>
                <span className="w-10 shrink-0 text-right text-[10px] text-[#6e7a6e]">{it.count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
