"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { FileUploadZone } from "./file-upload-zone";
import { ResultsTable } from "./results-table";
import { ConfirmOverwrite } from "./confirm-overwrite";

type AggregatedRow = Record<string, string | number>;

interface ExistingCategory {
  categoria: string;
  registros: number;
}

const REQUIRED_FILES = [
  {
    key: "matriculados",
    label: "Matriculados",
    accept: ".csv",
    description: "Reporte general de Matriculados (CSV, delimitado por ;)",
    requiredColumns: ["AÑO", "SEMESTRE", "PROGRAMA", "MUNICIPIO"],
  },
  {
    key: "admitidos",
    label: "Admitidos",
    accept: ".csv",
    description: "Reporte general de Admitidos (CSV, delimitado por ;)",
    requiredColumns: ["AÑO", "SEMESTRE", "PROGRAMA", "MUNICIPIO"],
  },
  {
    key: "primiparos",
    label: "Primíparos",
    accept: ".csv",
    description: "Reporte general de Estudiantes Primer Curso (CSV, delimitado por ;)",
    requiredColumns: ["AÑO", "SEMESTRE", "NOMBRE PROGRAMA", "MUNICIPIO"],
  },
  {
    key: "inscritos",
    label: "Inscritos",
    accept: ".xlsx",
    description: "Reporte general de Inscrito programa (XLSX)",
    requiredColumns: ["AÑO", "SEMESTRE", "PROGRAMA", "MUNICIPIO"],
  },
  {
    key: "graduados",
    label: "Graduados",
    accept: ".csv",
    description: "Reporte general de Graduados (CSV, delimitado por ;)",
    requiredColumns: ["AÑO", "SEMESTRE", "PROGRAMA", "MUNICIPIO PROGRAMA"],
  },
] as const;

const ALL_CATEGORIES = [
  "Matriculados",
  "Admitidos",
  "Primiparos",
  "Inscritos",
  "Graduados",
];

export function UploadForm() {
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

  // Confirmation state
  const [showConfirm, setShowConfirm] = useState(false);
  const [existingCategories, setExistingCategories] = useState<
    ExistingCategory[]
  >([]);
  const [detectedAnio, setDetectedAnio] = useState<number>(0);
  const [detectedPeriodo, setDetectedPeriodo] = useState<string>("");

  const requiredReady = REQUIRED_FILES.every((f) => files[f.key] !== null);

  const handleFileSelected = (key: string, file: File) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  // Step 1: Detect año+periodo from one CSV, then check existing data
  const handleSubmit = async () => {
    if (!requiredReady) return;

    setProcessing(true);
    setProgress(5);
    setResults(null);
    setXlsxBlob(null);
    setStats(null);

    try {
      // Read año and semestre from the first CSV (matriculados)
      const csvText = await files.matriculados!.text();
      const firstDataLine = csvText.split(/\r?\n/)[1];
      if (!firstDataLine) throw new Error("Archivo de Matriculados vacío");

      const fields = firstDataLine.split(";").map((f) => f.replace(/"/g, "").trim());
      // Find AÑO and SEMESTRE by header position
      const headerLine = csvText.split(/\r?\n/)[0].replace(/^\uFEFF/, "");
      const headers = headerLine.split(";").map((h) => h.replace(/"/g, "").trim());
      const anioIdx = headers.findIndex((h) => h === "AÑO" || h === "\u00C1\u00D1O" || h.includes("AÑO") || h.includes("O"));
      const semIdx = headers.findIndex((h) => h === "SEMESTRE");

      let anio = 0;
      let semestre = 0;

      if (anioIdx >= 0) anio = parseInt(fields[anioIdx], 10);
      if (semIdx >= 0) semestre = parseInt(fields[semIdx], 10);

      // Fallback: try common positions (3rd and 4th columns, 0-indexed: 2 and 3)
      if (isNaN(anio) || anio < 2000) anio = parseInt(fields[2], 10);
      if (isNaN(semestre)) semestre = parseInt(fields[3], 10);

      const periodo = semestre === 1 ? "IPA" : semestre === 2 ? "IIPA" : String(semestre);

      setDetectedAnio(anio);
      setDetectedPeriodo(periodo);

      // Check what already exists in the database
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
          // There's existing data — ask user for confirmation
          setExistingCategories(categories);
          setShowConfirm(true);
          setProcessing(false);
          return;
        }
      }

      // No existing data — proceed directly with all categories
      await processFiles(ALL_CATEGORIES);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      toast.error(message);
      setProcessing(false);
    }
  };

  // Step 2: Process files after confirmation
  const processFiles = async (allowedCategories: string[]) => {
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

      // Parse XLSX for preview
      const { default: XLSX } = await import("xlsx");
      const buffer = await blob.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<AggregatedRow>(sheet);
      setResults(data);

      setProgress(100);

      if (warnings.length > 0) {
        warnings.forEach((w) => toast.warning(w));
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
  };

  const handleConfirm = (selectedCategories: string[]) => {
    processFiles(selectedCategories);
  };

  const handleCancelConfirm = () => {
    setShowConfirm(false);
    setProcessing(false);
  };

  const handleDownload = () => {
    if (!xlsxBlob) return;
    const url = URL.createObjectURL(xlsxBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ESTUDIANTES.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 5 archivos requeridos */}
      <div className="grid gap-4 md:grid-cols-2">
        {REQUIRED_FILES.map((config) => (
          <FileUploadZone
            key={config.key}
            label={config.label}
            accept={config.accept}
            description={config.description}
            file={files[config.key]}
            onFileSelected={(file) => handleFileSelected(config.key, file)}
            requiredColumns={config.requiredColumns}
          />
        ))}
      </div>

      {/* Archivo histórico opcional */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Consolidado histórico (opcional)
        </h3>
        <p className="text-xs text-gray-500 mb-2">
          Sube el archivo ESTUDIANTES.xlsx existente para consolidar los datos
          nuevos con el histórico. Si no lo subes, solo se generará el reporte
          del periodo actual.
        </p>
        <FileUploadZone
          label="ESTUDIANTES.xlsx"
          accept=".xlsx"
          description="Consolidado histórico de estudiantes (XLSX)"
          file={files.estudiantes}
          onFileSelected={(file) => handleFileSelected("estudiantes", file)}
          requiredColumns={[
            "Categoría",
            "Unidad regional",
            "Nivel",
            "Nivel académico",
            "Programa académico",
            "Cantidad",
            "Año",
            "Periodo",
          ]}
        />
      </div>

      <div className="flex gap-4">
        <Button
          onClick={handleSubmit}
          disabled={!requiredReady || processing}
          className="bg-green-700 hover:bg-green-800"
        >
          {processing ? (
            <>
              <Spinner className="h-4 w-4 mr-2" />
              Procesando...
            </>
          ) : (
            "Procesar Archivos"
          )}
        </Button>

        {xlsxBlob && (
          <Button onClick={handleDownload} variant="outline">
            Descargar ESTUDIANTES.xlsx
          </Button>
        )}
      </div>

      {/* Confirmation dialog */}
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
        <div className="space-y-3 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Spinner className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">
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
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-green-600">{progress}% completado</p>
        </div>
      )}

      {stats && (
        <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-700 space-y-1">
          <p>
            Registros procesados: <strong>{stats.totalProcessed}</strong>
          </p>
          <p>
            Grupos agregados: <strong>{stats.totalAggregated}</strong>
          </p>
          <p>
            Guardados en BD: <strong>{stats.savedCount}</strong>
            {stats.skippedCount > 0 && (
              <span className="text-amber-600">
                {" "}
                ({stats.skippedCount} omitidos por no confirmar)
              </span>
            )}
          </p>
        </div>
      )}

      {results && <ResultsTable data={results} />}
    </div>
  );
}
