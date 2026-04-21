"use client";

import { useCallback, useRef, useState } from "react";
import { CloudUpload, LayoutDashboard, ShieldCheck } from "lucide-react";
import {
  UploadForm,
  type UploadFormHandle,
  type UploadFormStatus,
} from "@/components/reports/upload-form";
import { Dashboard } from "@/components/reports/dashboard";
import { Spinner } from "@/components/ui/spinner";
import { NavBar } from "@/components/layout/navbar";

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
      <NavBar activePage="automatizar-reportes" />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <header className="mb-10 sm:mb-16">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <span className="mb-3 block font-home-label text-xs font-medium uppercase tracking-widest text-[#00682f] sm:mb-4 sm:text-sm">
                Gestión Académica
              </span>
              <h1 className="font-home-display mb-4 text-3xl font-extrabold tracking-tight text-[#191c1d] sm:mb-6 sm:text-4xl md:text-5xl">
                Automatizar Reportes para Boletín
              </h1>
              <p className="mb-4 text-base leading-relaxed text-[#3e4a3e] sm:text-lg">
                Transforme sus datos institucionales en informes precisos.
                Cargue los archivos maestros para generar visualizaciones y
                reportes automatizados para la Universidad de Cundinamarca.
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00682f]/10 px-3 py-1.5 text-xs font-semibold text-[#00682f]">
                <ShieldCheck className="size-3.5" />
                Información estadística anonimizada
              </span>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleProcessAll}
                disabled={!uploadStatus.requiredReady || uploadStatus.processing}
                className="font-home-display inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)] px-8 py-4 font-bold text-white shadow-[0_20px_40px_rgba(0,104,47,0.15)] transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-40"
              >
                {uploadStatus.processing ? (
                  <>
                    <Spinner className="h-4 w-4 text-white" />
                    Procesando...
                  </>
                ) : (
                  "Procesar"
                )}
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-12 sm:space-y-16">
          <section className="space-y-6 sm:space-y-8">
            <h2 className="flex items-center gap-3 border-b border-[#bdcabb]/30 pb-4 font-home-display text-xl font-bold text-[#191c1d] sm:text-2xl">
              <CloudUpload className="size-5 shrink-0 text-[#00682f] sm:size-6" />
              Carga de Archivos Maestros
            </h2>
            <UploadForm
              ref={uploadFormRef}
              onStatusChange={handleUploadStatusChange}
            />
          </section>

          <section className="space-y-6 sm:space-y-8">
            <h2 className="flex items-center gap-3 border-b border-[#bdcabb]/30 pb-4 font-home-display text-xl font-bold text-[#191c1d] sm:text-2xl">
              <LayoutDashboard className="size-5 shrink-0 text-[#0058be] sm:size-6" />
              Dashboard Estadístico
            </h2>
            <Dashboard />
          </section>
        </div>
      </div>

      <footer className="w-full border-t border-slate-200 bg-slate-50 px-4 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
          <p className="text-sm text-[#3e4a3e]">
            Institutional Intelligence Unit.
          </p>
          <div className="flex flex-wrap justify-center gap-6 md:justify-end">
            <a href="#" className="text-sm text-[#3e4a3e] transition-all hover:text-[#00682f]">Privacy Policy</a>
            <a href="#" className="text-sm text-[#3e4a3e] transition-all hover:text-[#00682f]">Institutional Data</a>
            <a href="#" className="text-sm text-[#3e4a3e] transition-all hover:text-[#00682f]">Contact Support</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
