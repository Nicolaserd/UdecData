import Link from "next/link";
import { UploadForm } from "@/components/reports/upload-form";
import { Dashboard } from "@/components/reports/dashboard";

export default function AutomatizarReportesPage() {
  return (
    <main className="flex-1">
      <section className="bg-green-700 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/"
            className="text-green-200 hover:text-white text-sm mb-2 inline-block"
          >
            &larr; Volver al inicio
          </Link>
          <h1 className="text-3xl font-bold">
            Automatizar Reportes para Boletín
          </h1>
          <p className="text-green-100 mt-2">
            Carga los 5 archivos fuente para generar el consolidado de
            estudiantes
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto py-8 px-4 space-y-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Cargar Archivos
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Selecciona los 5 archivos requeridos. Los nombres de programas y
            municipios serán normalizados automáticamente. El resultado se
            descargará como XLSX y se guardará en la base de datos.
          </p>
          <UploadForm />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <Dashboard />
        </div>
      </section>
    </main>
  );
}
