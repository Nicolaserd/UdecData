"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { LucideIcon } from "lucide-react";
import { Info, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FileUploadZoneProps {
  label: string;
  accept: string;
  description: string;
  file: File | null;
  onFileSelected: (file: File) => void;
  requiredColumns?: readonly string[];
  icon: LucideIcon;
  tone?: "primary" | "secondary";
}

export function FileUploadZone({
  label,
  accept,
  description,
  file,
  onFileSelected,
  requiredColumns,
  icon: Icon,
  tone = "primary",
}: FileUploadZoneProps) {
  const [showColumns, setShowColumns] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelected(acceptedFiles[0]);
      }
    },
    [onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: accept.includes("csv")
      ? {
          "text/csv": [".csv"],
          "application/vnd.ms-excel": [".xls"],
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            [".xlsx"],
        }
      : {
          "application/vnd.ms-excel": [".xls"],
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            [".xlsx"],
        },
  });

  const isSecondary = tone === "secondary";
  const iconWrapperClass = isSecondary
    ? "bg-[#0058be]/5 text-[#0058be] group-hover:bg-[#0058be] group-hover:text-white"
    : "bg-[#00682f]/5 text-[#00682f] group-hover:bg-[#00682f] group-hover:text-white";
  const infoButtonClass = isSecondary ? "text-[#0058be]" : "text-[#00682f]";
  const activeBorderClass = isSecondary
    ? "border-[#0058be] bg-[#0058be]/5"
    : "border-[#00682f] bg-[#00682f]/5";

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#bdcabb]/15 bg-white p-6 transition-all duration-200 hover:border-[#00682f]/30">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg transition-all ${iconWrapperClass}`}
          >
            <Icon className="size-5" />
          </div>
          <div>
            <h3 className="font-home-display text-base font-bold text-[#191c1d]">
              {label}
            </h3>
            <p className="font-home-label text-xs text-[#3e4a3e]">
              {description}
            </p>
          </div>
        </div>

        {requiredColumns && requiredColumns.length > 0 && (
          <button
            type="button"
            onClick={() => setShowColumns((prev) => !prev)}
            className={`font-home-label inline-flex items-center gap-1 text-xs font-medium hover:underline ${infoButtonClass}`}
          >
            Columnas Estándar
            <Info className="size-3.5" />
          </button>
        )}
      </div>

      {showColumns && requiredColumns && requiredColumns.length > 0 && (
        <div className="mb-4 rounded-lg border border-[#bdcabb]/30 bg-[#2e3132] p-3 text-[10px] text-[#f0f1f2] shadow-lg">
          <p className="font-home-label mb-2 leading-relaxed">
            El archivo debe contener estas columnas; el nombre debe coincidir
            exactamente y la posición no importa.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {requiredColumns.map((col) => (
              <span
                key={col}
                className="rounded border border-white/15 bg-white/10 px-2 py-0.5 font-mono font-medium"
              >
                {col}
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        {...getRootProps()}
        className={`mt-auto flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragActive || file
            ? activeBorderClass
            : "border-[#bdcabb] bg-[#f3f4f5]/30 hover:border-[#00682f]"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mb-2 size-6 text-[#6e7a6e]" />
        {file ? (
          <div className="space-y-2">
            <span className="text-sm font-medium text-[#191c1d]">
              Archivo seleccionado
            </span>
            <div>
              <Badge className="bg-[#00682f] text-white">{file.name}</Badge>
            </div>
          </div>
        ) : (
          <>
            <span className="text-sm font-medium text-[#3e4a3e]">
              Arrastre o seleccione archivo
            </span>
            <span className="mt-1 text-xs text-[#6e7a6e]">{accept}</span>
          </>
        )}
      </div>
    </div>
  );
}
