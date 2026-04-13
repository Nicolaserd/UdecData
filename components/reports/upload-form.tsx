"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
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

interface RequiredFileConfig {
  key: string;
  label: string;
  accept: string;
  description: string;
  requiredColumns: readonly string[];
  icon: LucideIcon;
  tone?: "primary" | "secondary";
}

const ACCEPT_ALL = ".csv,.xlsx,.xls";

const REQUIRED_FILES: readonly RequiredFileConfig[] = [
  {
    key: "matriculados",
    label: "Matriculados",
    accept: ACCEPT_ALL,
    description: "Formato CSV o XLSX",
    requiredColumns: ["AÑO", "SEMESTRE", "PROGRAMA", "MUNICIPIO"],
    icon: Users,
  },
  {
    key: "admitidos",
    label: "Admitidos",
    accept: ACCEPT_ALL,
    description: "Reporte Admisiones",
    requiredColumns: ["AÑO", "SEMESTRE", "PROGRAMA", "MUNICIPIO"],
    icon: UserPlus,
  },
  {
    key: "primiparos",
    label: "Primíparos",
    accept: ACCEPT_ALL,
    description: "Primer semestre",
    requiredColumns: ["AÑO", "SEMESTRE", "NOMBRE PROGRAMA", "MUNICIPIO"],
    icon: GraduationCap,
  },
  {
    key: "inscritos",
    label: "Inscritos",
    accept: ACCEPT_ALL,
    description: "Base de postulantes",
    requiredColumns: ["AÑO", "SEMESTRE", "PROGRAMA", "MUNICIPIO"],
    icon: AppWindow,
  },
  {
    key: "graduados",
    label: "Graduados",
    accept: ACCEPT_ALL,
    description: "Consolidado títulos",
    requiredColumns: ["AÑO", "SEMESTRE", "PROGRAMA", "MUNICIPIO PROGRAMA"],
    icon: Award,
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
  },
];

const ALL_CATEGORIES = [
  "Matriculados",
  "Admitidos",
  "Primiparos",
  "Inscritos",
  "Graduados",
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

    const [showConfirm, setShowConfirm] = useState(false);
    const [existingCategories, setExistingCategories] = useState<
      ExistingCategory[]
    >([]);
    const [detectedAnio, setDetectedAnio] = useState<number>(0);
    const [detectedPeriodo, setDetectedPeriodo] = useState<string>("");

    const requiredReady = REQUIRED_FILES.filter(
      (file) => file.key !== "estudiantes"
    ).every((file) => files[file.key] !== null);

    useEffect(() => {
      onStatusChange?.({ processing, requiredReady });
    }, [onStatusChange, processing, requiredReady]);

    const handleFileSelected = (key: string, file: File) => {
      setFiles((prev) => ({ ...prev, [key]: file }));
    };

    const readAsCSV = async (file: File): Promise<string> => {
      const ext = file.name.toLowerCase().split(".").pop() ?? "";
      if (ext === "csv" || ext === "txt") {
        return await file.text();
      }

      const { default: XLSX } = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      return XLSX.utils.sheet_to_csv(worksheet, { FS: ";" });
    };

    const processFiles = useCallback(
      async (allowedCategories: string[]) => {
        setProcessing(true);
        setShowConfirm(false);
        setProgress(20);

        try {
          const formData = new FormData();
          formData.append("matriculados", files.matriculados!);
          formData.append("admitidos", files.admitidos!);
          formData.append("primiparos", files.primiparos!);
          formData.append("inscritos", files.inscritos!);
          formData.append("graduados", files.graduados!);
          formData.append(
            "allowedCategories",
            JSON.stringify(allowedCategories)
          );

          if (files.estudiantes) {
            formData.append("estudiantes", files.estudiantes);
          }

          setProgress(40);

          const response = await fetch("/api/process-reports", {
            method: "POST",
            body: formData,
          });

          setProgress(70);

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Error procesando archivos");
          }

          const totalProcessed = parseInt(
            response.headers.get("X-Total-Processed") || "0"
          );
          const totalAggregated = parseInt(
            response.headers.get("X-Total-Aggregated") || "0"
          );
          const warnings = JSON.parse(
            response.headers.get("X-Warnings") || "[]"
          ) as string[];
          const supabaseSaved =
            response.headers.get("X-Supabase-Saved") === "true";
          const savedCount = parseInt(
            response.headers.get("X-Supabase-Saved-Count") || "0"
          );
          const skippedCount = parseInt(
            response.headers.get("X-Supabase-Skipped-Count") || "0"
          );

          const blob = await response.blob();
          setXlsxBlob(blob);
          setStats({
            totalProcessed,
            totalAggregated,
            supabaseSaved,
            savedCount,
            skippedCount,
          });

          const { default: XLSX } = await import("xlsx");
          const buffer = await blob.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json<AggregatedRow>(worksheet);
          setResults(data);

          setProgress(100);

          if (warnings.length > 0) {
            warnings.forEach((warning) => toast.warning(warning));
          }

          if (supabaseSaved) {
            toast.success(
              `Guardados ${savedCount} registros en Supabase${skippedCount > 0 ? ` (${skippedCount} omitidos)` : ""}`
            );
          } else {
            toast.info("Datos no guardados en la base de datos.");
          }

          toast.success(
            `Procesados ${totalProcessed} registros en ${totalAggregated} grupos`
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Error desconocido";
          toast.error(message);
        } finally {
          setProcessing(false);
        }
      },
      [files]
    );

    const handleSubmit = useCallback(async () => {
      if (!requiredReady) return;

      setProcessing(true);
      setProgress(5);
      setResults(null);
      setXlsxBlob(null);
      setStats(null);

      try {
        const csvText = await readAsCSV(files.matriculados!);
        const firstDataLine = csvText.split(/\r?\n/)[1];

        if (!firstDataLine) {
          throw new Error("Archivo de Matriculados vacío");
        }

        const fields = firstDataLine
          .split(";")
          .map((field) => field.replace(/"/g, "").trim());
        const headerLine = csvText.split(/\r?\n/)[0].replace(/^\uFEFF/, "");
        const headers = headerLine
          .split(";")
          .map((header) => header.replace(/"/g, "").trim());
        const anioIdx = headers.findIndex(
          (header) =>
            header === "AÑO" ||
            header === "ÁÑO" ||
            header.includes("AÑO") ||
            header.includes("ÑO")
        );
        const semIdx = headers.findIndex((header) => header === "SEMESTRE");

        let anio = 0;
        let semestre = 0;

        if (anioIdx >= 0) anio = parseInt(fields[anioIdx], 10);
        if (semIdx >= 0) semestre = parseInt(fields[semIdx], 10);

        if (isNaN(anio) || anio < 2000) anio = parseInt(fields[2], 10);
        if (isNaN(semestre)) semestre = parseInt(fields[3], 10);

        const periodo =
          semestre === 1 ? "IPA" : semestre === 2 ? "IIPA" : String(semestre);

        setDetectedAnio(anio);
        setDetectedPeriodo(periodo);

        const checkResponse = await fetch("/api/check-existing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anio, periodo }),
        });

        if (checkResponse.ok) {
          const { categories } = (await checkResponse.json()) as {
            categories: ExistingCategory[];
          };

          if (categories.length > 0) {
            setExistingCategories(categories);
            setShowConfirm(true);
            setProcessing(false);
            return;
          }
        }

        await processFiles(ALL_CATEGORIES);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error desconocido";
        toast.error(message);
        setProcessing(false);
      }
    }, [files.matriculados, processFiles, requiredReady]);

    useImperativeHandle(
      ref,
      () => ({
        submit: handleSubmit,
      }),
      [handleSubmit]
    );

    const handleConfirm = (selectedCategories: string[]) => {
      void processFiles(selectedCategories);
    };

    const handleCancelConfirm = () => {
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {REQUIRED_FILES.map((config) => (
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
            allCategories={ALL_CATEGORIES}
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
            <p className="mt-2 text-xs text-[#3e4a3e]">
              {progress}% completado
            </p>
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
