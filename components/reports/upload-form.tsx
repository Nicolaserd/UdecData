"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  AppWindow,
  Award,
  GraduationCap,
  History,
  LoaderCircle,
  type LucideIcon,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileUploadZone } from "./file-upload-zone";
import { ResultsTable } from "./results-table";
import { ConfirmOverwrite } from "./confirm-overwrite";
import { PinModal } from "./pin-modal";
import { errorMessage, pinHeaders, readApiJson, verifyPinRequest } from "@/lib/api-errors";

type AggregatedRow = Record<string, string | number>;

interface ExistingCategory {
  categoria: string;
  registros: number;
}

export interface UploadFormStatus {
  processing: boolean;
  requiredReady: boolean;
}

export interface UploadFormHandle {
  submit: () => Promise<void>;
}

interface UploadFormProps {
  onStatusChange?: (status: UploadFormStatus) => void;
}

interface FileConfig {
  key: string;
  label: string;
  accept: string;
  description: string;
  requiredColumns: readonly string[];
  icon: LucideIcon;
  tone?: "primary" | "secondary";
  optional?: boolean;
  categoria: string | null; // null = no genera categoría propia
}

const ACCEPT_ALL = ".csv,.xlsx,.xls";

const FILE_CONFIGS: readonly FileConfig[] = [
  {
    key: "matriculados",
    label: "Matriculados",
    accept: ACCEPT_ALL,
    description: "Formato CSV o XLSX",
    requiredColumns: ["AÑO", "SEMESTRE", "PROGRAMA", "MUNICIPIO"],
    icon: Users,
    categoria: "Matriculados",
  },
  {
    key: "admitidos",
    label: "Admitidos",
    accept: ACCEPT_ALL,
    description: "Reporte Admisiones",
    requiredColumns: ["AÑO", "SEMESTRE", "PROGRAMA", "MUNICIPIO"],
    icon: UserPlus,
    categoria: "Admitidos",
  },
  {
    key: "primiparos",
    label: "Primíparos",
    accept: ACCEPT_ALL,
    description: "Primer semestre",
    requiredColumns: ["AÑO", "SEMESTRE", "NOMBRE PROGRAMA", "MUNICIPIO"],
    icon: GraduationCap,
    categoria: "Primiparos",
  },
  {
    key: "inscritos",
    label: "Inscritos",
    accept: ACCEPT_ALL,
    description: "Base de postulantes",
    requiredColumns: ["AÑO", "SEMESTRE", "PROGRAMA", "MUNICIPIO"],
    icon: AppWindow,
    categoria: "Inscritos",
  },
  {
    key: "graduados",
    label: "Graduados",
    accept: ACCEPT_ALL,
    description: "Consolidado títulos",
    requiredColumns: ["AÑO", "SEMESTRE", "PROGRAMA", "MUNICIPIO PROGRAMA"],
    icon: Award,
    categoria: "Graduados",
  },
  {
    key: "estudiantes",
    label: "Consolidado histórico (Opcional)",
    accept: ".xlsx,.xls",
    description: "Base multianual",
    requiredColumns: [
      "Categoría",
      "Unidad regional",
      "Nivel",
      "Nivel académico",
      "Programa académico",
      "Cantidad",
      "Año",
      "Periodo",
    ],
    icon: History,
    tone: "secondary",
    optional: true,
    categoria: null,
  },
];

export const UploadForm = forwardRef<UploadFormHandle, UploadFormProps>(
  function UploadForm({ onStatusChange }, ref) {
    const [files, setFiles] = useState<Record<string, File | null>>({
      matriculados: null,
      admitidos: null,
      primiparos: null,
      inscritos: null,
      graduados: null,
      estudiantes: null,
    });
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState<AggregatedRow[] | null>(null);
    const [xlsxBlob, setXlsxBlob] = useState<Blob | null>(null);
    const [stats, setStats] = useState<{
      totalProcessed: number;
      totalAggregated: number;
      supabaseSaved: boolean;
      savedCount: number;
      skippedCount: number;
    } | null>(null);

    const [showPin, setShowPin] = useState(false);
    // Reporte ya procesado en el navegador (se reutiliza tras confirmar sobrescritura)
    const reportRef = useRef<import("@/lib/reports/build-report").BuiltReport | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [existingCategories, setExistingCategories] = useState<ExistingCategory[]>([]);
    const [detectedAnio, setDetectedAnio] = useState<number>(0);
    const [detectedPeriodo, setDetectedPeriodo] = useState<string>("");

    // Al menos un archivo no-opcional cargado
    const anyReady = FILE_CONFIGS.filter((f) => !f.optional).some(
      (f) => files[f.key] !== null
    );

    useEffect(() => {
      onStatusChange?.({ processing, requiredReady: anyReady });
    }, [onStatusChange, processing, anyReady]);

    const handleFileSelected = (key: string, file: File) => {
      setFiles((prev) => ({ ...prev, [key]: file }));
    };

    /** Categorías cargadas actualmente (excluye "estudiantes" que no tiene categoría) */
    const loadedCategories = FILE_CONFIGS.filter(
      (f) => f.categoria !== null && files[f.key] !== null
    ).map((f) => f.categoria as string);

    const processFiles = useCallback(
      async (allowedCategories: string[]) => {
        setProcessing(true);
        setShowConfirm(false);
        setProgress(20);

        try {
          // 1. Leer, validar y agregar EN EL NAVEGADOR (sin límite de tamaño de archivo)
          const { buildReport, estudiantesXlsxBlob } = await import("@/lib/reports/build-report");
          const report = reportRef.current
            ?? await buildReport(files, FILE_CONFIGS, (p) => setProgress(20 + Math.round(p * 30)));
          reportRef.current = null;

          // 2. Excel para descargar, generado localmente
          const blob = estudiantesXlsxBlob(report.aggregated);
          setXlsxBlob(blob);
          setResults(report.aggregated.map((r) => ({
            "Categoría": r.categoria,
            "Unidad regional": r.unidadRegional,
            "Nivel": r.nivel,
            "Nivel académico": r.nivelAcademico,
            "Programa académico": r.programaAcademico,
            "Cantidad": r.cantidad,
            "Año": r.año,
            "Periodo": r.periodo,
          })));

          // 3. Guardar solo las filas agregadas, en lotes pequeños (con PIN)
          const toSave = report.aggregated.filter((r) => allowedCategories.includes(r.categoria));
          const BATCH = 2000;
          let savedCount = 0;
          let saveError = "";
          for (let i = 0; i < toSave.length; i += BATCH) {
            const lote = Math.floor(i / BATCH) + 1;
            const lotes = Math.ceil(toSave.length / BATCH);
            try {
              const res = await fetch("/api/process-reports", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...pinHeaders() },
                body: JSON.stringify({ rows: toSave.slice(i, i + BATCH), allowedCategories }),
              });
              const json = await readApiJson<{ saved: number }>(
                res,
                lotes > 1 ? `guardar los datos en la base de datos (lote ${lote} de ${lotes})` : "guardar los datos en la base de datos",
              );
              savedCount += json.saved;
            } catch (err) {
              saveError = errorMessage(err, "guardar los datos en la base de datos");
              break;
            }
            setProgress(50 + Math.round(((i + BATCH) / Math.max(toSave.length, 1)) * 50));
          }
          const skippedCount = report.aggregated.length - toSave.length;
          setStats({
            totalProcessed: report.totalProcessed,
            totalAggregated: report.aggregated.length,
            supabaseSaved: !saveError,
            savedCount,
            skippedCount,
          });
          setProgress(100);

          if (report.warnings.length > 0) report.warnings.slice(0, 8).forEach((w) => toast.warning(w));
          if (report.warnings.length > 8) toast.warning(`y ${report.warnings.length - 8} avisos más (programas o municipios no reconocidos).`);
          if (saveError) {
            toast.error(savedCount > 0
              ? `${saveError} Se alcanzaron a guardar ${savedCount} registros; el Excel con todos los datos está disponible para descargar.`
              : `${saveError} El Excel con los datos procesados está disponible para descargar.`);
          } else {
            toast.success(
              `Guardados ${savedCount} registros en la base de datos${skippedCount > 0 ? ` (${skippedCount} de otras categorías no se sobrescribieron)` : ""}`
            );
          }
          toast.success(`Procesados ${report.totalProcessed} registros en ${report.aggregated.length} grupos`);
        } catch (error) {
          toast.error(errorMessage(error, "procesar y guardar los archivos"));
        } finally {
          setProcessing(false);
        }
      },
      [files]
    );

    /** Paso 2: después de que el PIN es válido, verificar duplicados y procesar */
    const handleAfterPin = useCallback(async () => {
      setProcessing(true);
      setProgress(5);
      setResults(null);
      setXlsxBlob(null);
      setStats(null);

      try {
        // Leer y validar cada archivo en el navegador: los errores dicen qué archivo
        // falló y por qué (formato, separador, columnas o contenido)
        const { buildReport } = await import("@/lib/reports/build-report");
        const report = await buildReport(files, FILE_CONFIGS, (p) => setProgress(5 + Math.round(p * 15)));
        reportRef.current = report;
        const detected = report.mainPeriod;
        if (!detected) {
          throw new Error("Los archivos no tienen filas con año y semestre válidos (AÑO desde 2000 y SEMESTRE 1 o 2).");
        }

        const { anio, periodo } = detected;
        setDetectedAnio(anio);
        setDetectedPeriodo(periodo);

        const checkResponse = await fetch("/api/check-existing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anio, periodo }),
        });

        {
          const { categories } = await readApiJson<{ categories: ExistingCategory[] }>(
            checkResponse,
            "revisar si ya existen datos de ese periodo",
          );

          // Solo mostrar conflicto para las categorías que se van a procesar
          const conflicting = categories.filter((c) =>
            loadedCategories.includes(c.categoria)
          );

          if (conflicting.length > 0) {
            setExistingCategories(conflicting);
            setShowConfirm(true);
            setProcessing(false);
            return;
          }
        }

        await processFiles(loadedCategories);
      } catch (error) {
        toast.error(errorMessage(error, "preparar la carga de datos"));
        setProcessing(false);
      }
    }, [files, loadedCategories, processFiles]);

    /** Paso 1: mostrar el modal de PIN */
    const handleSubmit = useCallback(async () => {
      if (!anyReady) return;
      setShowPin(true);
    }, [anyReady]);

    /** Validar PIN contra la API y continuar si es correcto */
    const handlePinConfirm = useCallback(
      async (pin: string): Promise<true | string> => {
        const result = await verifyPinRequest(pin);
        if (result === true) {
          setShowPin(false);
          await handleAfterPin();
        }
        return result;
      },
      [handleAfterPin]
    );

    useImperativeHandle(ref, () => ({ submit: handleSubmit }), [handleSubmit]);

    const handleConfirm = (selectedCategories: string[]) => {
      void processFiles(selectedCategories);
    };

    const handleCancelConfirm = () => {
      reportRef.current = null;
      setShowConfirm(false);
      setProcessing(false);
    };

    const handleDownload = () => {
      if (!xlsxBlob) return;
      const url = URL.createObjectURL(xlsxBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ESTUDIANTES.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div className="space-y-8">
        {/* Modal PIN */}
        {showPin && (
          <PinModal
            onConfirm={handlePinConfirm}
            onCancel={() => setShowPin(false)}
          />
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {FILE_CONFIGS.map((config) => (
            <FileUploadZone
              key={config.key}
              label={config.label}
              accept={config.accept}
              description={config.description}
              file={files[config.key]}
              onFileSelected={(file) => handleFileSelected(config.key, file)}
              requiredColumns={config.requiredColumns}
              icon={config.icon}
              tone={config.tone}
            />
          ))}
        </div>

        {showConfirm && (
          <ConfirmOverwrite
            anio={detectedAnio}
            periodo={detectedPeriodo}
            existingCategories={existingCategories}
            allCategories={loadedCategories}
            onConfirm={handleConfirm}
            onCancel={handleCancelConfirm}
          />
        )}

        {processing && (
          <div className="rounded-xl border border-[#00843d]/20 bg-[#e7ffe6] p-6">
            <div className="mb-3 flex items-center gap-3">
              <LoaderCircle className="size-5 animate-spin text-[#00682f]" />
              <p className="font-home-display text-sm font-bold text-[#00682f]">
                {progress < 20
                  ? "Verificando datos existentes..."
                  : progress < 40
                    ? "Preparando archivos..."
                    : progress < 70
                      ? "Procesando y normalizando registros..."
                      : progress < 100
                        ? "Guardando en base de datos y generando Excel..."
                        : "Finalizado"}
              </p>
            </div>
            <Progress value={progress} className="h-2 bg-white" />
            <p className="mt-2 text-xs text-[#3e4a3e]">{progress}% completado</p>
          </div>
        )}

        {stats && (
          <div className="rounded-xl border border-[#bdcabb]/15 bg-white p-6 shadow-[0_20px_40px_rgba(0,104,47,0.06)]">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="font-home-label text-xs uppercase tracking-widest text-[#6e7a6e]">
                  Registros procesados
                </p>
                <p className="font-home-display mt-2 text-3xl font-extrabold text-[#00682f]">
                  {stats.totalProcessed.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="font-home-label text-xs uppercase tracking-widest text-[#6e7a6e]">
                  Grupos agregados
                </p>
                <p className="font-home-display mt-2 text-3xl font-extrabold text-[#191c1d]">
                  {stats.totalAggregated.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="font-home-label text-xs uppercase tracking-widest text-[#6e7a6e]">
                  Guardados en BD
                </p>
                <p className="font-home-display mt-2 text-3xl font-extrabold text-[#0058be]">
                  {stats.savedCount.toLocaleString()}
                </p>
                {stats.skippedCount > 0 && (
                  <p className="mt-1 text-xs text-[#7f4f00]">
                    {stats.skippedCount} omitidos por no confirmar
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {(xlsxBlob || results) && (
          <div className="space-y-6">
            {xlsxBlob && (
              <div className="flex justify-start">
                <Button
                  onClick={handleDownload}
                  className="rounded-full bg-[#00682f] px-8 py-6 text-sm font-bold text-white hover:bg-[#00843d]"
                >
                  Descargar ESTUDIANTES.xlsx
                </Button>
              </div>
            )}
            {results && <ResultsTable data={results} />}
          </div>
        )}
      </div>
    );
  }
);
