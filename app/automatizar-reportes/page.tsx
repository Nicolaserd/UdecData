"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  CloudUpload,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import {
  UploadForm,
  type UploadFormHandle,
  type UploadFormStatus,
} from "@/components/reports/upload-form";
import { Dashboard } from "@/components/reports/dashboard";
import { Spinner } from "@/components/ui/spinner";

export default function AutomatizarReportesPage() {
  const uploadFormRef = useRef<UploadFormHandle>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadFormStatus>({
    processing: false,
    requiredReady: false,
  });

  const handleUploadStatusChange = useCallback((status: UploadFormStatus) => {
    setUploadStatus(status);
  }, []);

  const handleProcessAll = () => {
    void uploadFormRef.current?.submit();
  };

  return (
    <main className="min-h-screen flex-1 bg-[#f8f9fa] pt-16 font-home-body text-[#191c1d]">
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

              <div className="invisible absolute left-0 top-full z-50 w-48 pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="overflow-hidden rounded-[0.5rem] border border-neutral-200/50 bg-white shadow-xl">
                  <Link
                    href="/automatizar-reportes"
                    className="block px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    Automatizar Reportes para Boletín
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

      <div className="mx-auto max-w-5xl px-8 py-12">
        <header className="mb-16">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <span className="mb-4 block font-home-label text-sm font-medium uppercase tracking-widest text-[#00682f]">
                Gestión Académica
              </span>
              <h1 className="font-home-display mb-6 text-5xl font-extrabold tracking-tight text-[#191c1d]">
                Automatizar Reportes para Boletín
              </h1>
              <p className="text-lg leading-relaxed text-[#3e4a3e]">
                Transforme sus datos institucionales en informes precisos.
                Cargue los archivos maestros para generar visualizaciones y
                reportes automatizados para la Universidad de Cundinamarca.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleProcessAll}
                disabled={!uploadStatus.requiredReady || uploadStatus.processing}
                className="font-home-display inline-flex min-w-[220px] items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)] px-8 py-4 font-bold text-white shadow-[0_20px_40px_rgba(0,104,47,0.15)] transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadStatus.processing ? (
                  <>
                    <Spinner className="h-4 w-4 text-white" />
                    Procesando...
                  </>
                ) : (
                  "Procesar Todo"
                )}
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-16">
          <section className="space-y-8">
            <h2 className="flex items-center gap-3 border-b border-[#bdcabb]/30 pb-4 font-home-display text-2xl font-bold text-[#191c1d]">
              <CloudUpload className="size-6 text-[#00682f]" />
              Carga de Archivos Maestros
            </h2>
            <UploadForm
              ref={uploadFormRef}
              onStatusChange={handleUploadStatusChange}
            />
          </section>

          <section className="space-y-8">
            <h2 className="flex items-center gap-3 border-b border-[#bdcabb]/30 pb-4 font-home-display text-2xl font-bold text-[#191c1d]">
              <LayoutDashboard className="size-6 text-[#0058be]" />
              Dashboard Estadístico
            </h2>
            <Dashboard />
          </section>
        </div>
      </div>

      <footer className="w-full border-t border-slate-200 bg-slate-50 px-8 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <p className="text-sm text-[#3e4a3e]">
            © Universidad de Cundinamarca - Academic Intelligence Portal
          </p>

          <div className="flex gap-8">
            <a
              href="#"
              className="text-sm text-[#3e4a3e] transition-all hover:text-[#00682f]"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              className="text-sm text-[#3e4a3e] transition-all hover:text-[#00682f]"
            >
              Institutional Data
            </a>
            <a
              href="#"
              className="text-sm text-[#3e4a3e] transition-all hover:text-[#00682f]"
            >
              Contact Support
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
