/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileText,
  Headset,
  LineChart,
  PlusCircle,
  Settings,
  Sparkles,
  Workflow,
} from "lucide-react";

const heroImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDuteX-lXFPJnFu556Os3BatGQQHpBErak1KYwdDhFRc_xYE-wa-ASSxmoRgwnjo7NYrM4isBrjUtQwacOpg0ynHPXxzs4VThBXRdzOixmwcHhwOinzKieSVG_8tMgiQsFsyIM1GBtMVQfoba25mbJzvmPAUymJ_fJyIKeDrhAKGLMDbLlkfxeFqW5Z4bzBhdZdVtsUYGVPo5DiozrorZPgwOBQJmUVnRIcsMuCM5LSqmdRT0VQpcyni78d6KW6EmIABKRgxz6GJKI";

const serviceImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBfoWuDQee-V1IeHlkb-SCSEwil6Cf2t8qzOmpERiL1CdAYa9G8AB-IyuAMFFbPC5o5EK3KFLi9YdNPM1caydn6L5fCWi2xUuqYR9Xfwsa6rOQLFhASsHogednbPdO9Rdo_bo714YVxmKTmOmj3qwXdEG_-279h70m8EZSodF0R2KcaDAMWShTyhtsTIcDRnkr9pni9Xm_1kL7C8IvmxiM9qqWC_R8gTgtgLDi9SvAif_SDMHRXqAA3zJhKPvqNUwLFHpu5NGGNzV8";

export default function HomePage() {
  return (
    <main className="flex-1 bg-[#f8f9fa] font-home-body text-[#191c1d] pt-16">
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
              className="font-home-display border-b-2 border-[#00682f] pb-1 text-[#00682f]"
            >
              Home
            </Link>

            <div className="group relative">
              <button
                type="button"
                className="font-home-display flex items-center gap-1 pb-1 text-gray-600 transition-colors hover:text-[#00682f]"
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

      <section className="relative flex min-h-[500px] items-center overflow-hidden bg-[#f8f9fa] px-8 md:px-24">
        <div className="absolute right-0 top-0 hidden h-full w-1/2 opacity-10 lg:block">
          <img
            src={heroImage}
            alt="Campus universitario moderno con arquitectura en vidrio y entorno verde."
            className="h-full w-full object-cover"
          />
        </div>

        <div className="relative z-10 max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#00682f]/10 px-3 py-1">
            <Sparkles className="size-4 text-[#00682f]" />
            <span className="font-home-label text-xs font-medium uppercase tracking-wider text-[#00682f]">
              Innovación Institucional
            </span>
          </div>

          <h1 className="font-home-display mb-6 text-5xl font-extrabold leading-tight tracking-[-0.05em] text-[#191c1d] md:text-7xl">
            Universidad de <br />
            <span className="text-[#00682f]">Cundinamarca</span>
          </h1>

          <p className="mb-8 max-w-2xl text-xl leading-relaxed text-[#3e4a3e]">
            &nbsp;
          </p>

          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              className="font-home-display inline-flex items-center gap-2 rounded-[0.5rem] bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)] px-8 py-4 font-bold text-white shadow-[0_20px_40px_rgba(0,104,47,0.2)] transition-transform hover:scale-[1.02] active:scale-95"
            >
              Comenzar Ahora
              <ArrowRight className="size-5" />
            </button>
            <button
              type="button"
              className="font-home-display rounded-[0.5rem] border border-[#bdcabb] px-8 py-4 font-bold text-[#191c1d] transition-colors hover:bg-[#edeeef]"
            >
              Saber más
            </button>
          </div>
        </div>
      </section>

      <section className="bg-[#f3f4f5] px-8 py-24 md:px-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-home-display mb-4 text-4xl font-bold text-[#191c1d]">
                Servicios Disponibles
              </h2>
              <div className="h-1 w-24 rounded-full bg-[#00682f]" />
            </div>
            <p className="max-w-md text-[#3e4a3e]">
              Seleccione el módulo de automatización que requiere para
              gestionar su información académica de manera eficiente.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            <article className="group flex flex-col items-center gap-8 rounded-[0.75rem] border border-[#bdcabb]/10 bg-white p-8 shadow-[0_20px_40px_rgba(0,104,47,0.06)] transition-all hover:-translate-y-1 md:col-span-2 md:flex-row">
              <div className="aspect-square w-full overflow-hidden rounded-[0.5rem] md:w-1/3">
                <img
                  src={serviceImage}
                  alt="Visualización de datos académicos en una pantalla digital."
                  className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
                />
              </div>

              <div className="flex flex-1 flex-col">
                <div className="mb-4 flex items-start justify-between">
                  <FileText className="size-10 text-[#00682f]" />
                  <span className="font-home-label rounded-[0.25rem] bg-[#2170e4]/10 px-2 py-1 text-[10px] font-bold text-[#0058be]">
                    ACTIVO
                  </span>
                </div>

                <h3 className="font-home-display mb-3 text-2xl font-bold text-[#191c1d]">
                  Automatizar Reportes para Boletín
                </h3>

                <p className="mb-8 flex-grow text-[#3e4a3e]">
                  Procese sus fuentes de datos institucionales de manera
                  automática para la generación del boletín periódico. Ahorre
                  tiempo y garantice la integridad de los datos.
                </p>

                <div className="flex items-center gap-4">
                  <Link
                    href="/automatizar-reportes"
                    className="font-home-display inline-flex items-center gap-2 rounded-[0.25rem] bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)] px-6 py-3 text-sm font-bold text-white transition-all"
                  >
                    Ir al servicio
                    <ExternalLink className="size-4" />
                  </Link>

                  <span className="font-home-label inline-flex items-center gap-1 text-xs text-[#6e7a6e]">
                    <Clock3 className="size-3.5" />
                    Actualizado hace 2h
                  </span>
                </div>
              </div>
            </article>

            <article className="group flex flex-col items-center justify-center rounded-[0.75rem] border-2 border-dashed border-[#bdcabb] bg-[#f3f4f5] p-8 text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#edeeef] text-[#6e7a6e] transition-colors group-hover:bg-[#00843d]/10 group-hover:text-[#00682f]">
                <PlusCircle className="size-8" />
              </div>
              <h3 className="font-home-display mb-2 text-xl font-bold text-[#6e7a6e]">
                Más servicios próximamente
              </h3>
              <p className="mb-6 text-sm text-[#6e7a6e]">
                Estamos trabajando para integrar nuevos módulos de análisis
                predictivo y KPIs.
              </p>
              <button
                type="button"
                disabled
                className="font-home-display cursor-not-allowed px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#00682f] opacity-50"
              >
                En Desarrollo
              </button>
            </article>

            <article className="rounded-[0.75rem] border border-[#bdcabb]/10 bg-white p-8 shadow-[0_20px_40px_rgba(0,104,47,0.06)]">
              <LineChart className="mb-4 size-6 text-[#00682f]" />
              <h4 className="font-home-display mb-2 text-lg font-bold text-[#191c1d]">
                KPIs Institucionales
              </h4>
              <p className="mb-6 text-sm leading-relaxed text-[#3e4a3e]">
                Visualización de indicadores clave de rendimiento para la toma
                de decisiones estratégicas en tiempo real.
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#edeeef]">
                <div className="h-full w-3/4 bg-[#00682f]/40" />
              </div>
              <p className="font-home-label mt-2 text-right text-[10px] text-[#6e7a6e]">
                Integración 75%
              </p>
            </article>

            <article className="rounded-[0.75rem] border border-[#bdcabb]/10 bg-white p-8 shadow-[0_20px_40px_rgba(0,104,47,0.06)]">
              <Workflow className="mb-4 size-6 text-[#00682f]" />
              <h4 className="font-home-display mb-2 text-lg font-bold text-[#191c1d]">
                Mapeo de Datos
              </h4>
              <p className="mb-6 text-sm leading-relaxed text-[#3e4a3e]">
                Normalización y limpieza de bases de datos heterogéneas para
                reportes consolidados unificados.
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#edeeef]">
                <div className="h-full w-1/2 bg-[#00682f]/40" />
              </div>
              <p className="font-home-label mt-2 text-right text-[10px] text-[#6e7a6e]">
                Integración 50%
              </p>
            </article>

            <article className="flex flex-col justify-between rounded-[0.75rem] bg-[#00682f] p-8 text-white">
              <div>
                <Headset className="mb-4 size-8" />
                <h4 className="font-home-display mb-2 text-xl font-bold">
                  Soporte Técnico
                </h4>
                <p className="mb-6 text-sm text-white/80">
                  ¿Necesita ayuda con la automatización? Nuestro equipo está
                  listo para asistirle.
                </p>
              </div>
              <a
                href="#"
                className="font-home-display rounded-[0.25rem] bg-white px-4 py-2 text-center text-sm font-bold text-[#00682f]"
              >
                Contactar Soporte
              </a>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-[#f8f9fa] px-8 py-16 md:px-24">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="text-center">
              <p className="font-home-display mb-1 text-4xl font-extrabold text-[#00682f]">
                &nbsp;
              </p>
              <p className="font-home-label text-xs uppercase tracking-widest text-[#6e7a6e]">
                &nbsp;
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto w-full border-t border-neutral-200 bg-neutral-50 py-8 text-xs">
        <div className="flex flex-col items-center justify-between gap-4 px-12 md:flex-row">
          <p className="font-home-label text-neutral-500">
            © 2024 Universidad de Cundinamarca. Institutional Intelligence
            Unit.
          </p>
          <div className="flex flex-wrap gap-6">
            <a
              href="#"
              className="font-home-label text-neutral-500 transition-opacity hover:opacity-80 hover:text-neutral-800"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              className="font-home-label text-neutral-500 transition-opacity hover:opacity-80 hover:text-neutral-800"
            >
              Terms of Service
            </a>
            <a
              href="#"
              className="font-home-label text-neutral-500 transition-opacity hover:opacity-80 hover:text-neutral-800"
            >
              Contact Support
            </a>
            <a
              href="#"
              className="font-home-label text-neutral-500 transition-opacity hover:opacity-80 hover:text-neutral-800"
            >
              Documentation
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
