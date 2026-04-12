"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Badge } from "@/components/ui/badge";

interface FileUploadZoneProps {
  label: string;
  accept: string;
  description: string;
  file: File | null;
  onFileSelected: (file: File) => void;
  requiredColumns?: readonly string[];
}

export function FileUploadZone({
  label,
  accept,
  description,
  file,
  onFileSelected,
  requiredColumns,
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
      ? { "text/csv": [".csv"] }
      : {
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
            ".xlsx",
          ],
        },
  });

  return (
    <div className="space-y-1">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-green-500 bg-green-50"
            : file
              ? "border-green-400 bg-green-50"
              : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input {...getInputProps()} />
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        <p className="text-sm text-gray-500 mb-2">{description}</p>
        {file ? (
          <Badge variant="default" className="bg-green-600">
            {file.name}
          </Badge>
        ) : (
          <p className="text-xs text-gray-400">
            {isDragActive
              ? "Suelta el archivo aquí"
              : `Arrastra o haz clic para seleccionar (${accept})`}
          </p>
        )}
      </div>

      {requiredColumns && requiredColumns.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowColumns(!showColumns)}
            className="text-xs text-blue-600 hover:text-blue-800 underline cursor-pointer"
          >
            {showColumns
              ? "Ocultar columnas requeridas"
              : "Ver columnas requeridas"}
          </button>
          {showColumns && (
            <div className="mt-1 bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-600">
              <p className="font-semibold mb-1.5 text-gray-700">
                El archivo debe contener estas columnas (el nombre debe
                coincidir exactamente, la posición no importa):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {requiredColumns.map((col) => (
                  <span
                    key={col}
                    className="inline-block bg-white border border-gray-300 rounded px-2 py-0.5 font-mono font-medium text-gray-800"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
