/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  ArrowRight,
  BarChart2,
  BookOpen,
  Bot,
  BrainCircuit,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileText,
  Headset,
  Heart,
  Info,
  LineChart,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { NavBar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

const heroImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDuteX-lXFPJnFu556Os3BatGQQHpBErak1KYwdDhFRc_xYE-wa-ASSxmoRgwnjo7NYrM4isBrjUtQwacOpg0ynHPXxzs4VThBXRdzOixmwcHhwOinzKieSVG_8tMgiQsFsyIM1GBtMVQfoba25mbJzvmPAUymJ_fJyIKeDrhAKGLMDbLlkfxeFqW5Z4bzBhdZdVtsUYGVPo5DiozrorZPgwOBQJmUVnRIcsMuCM5LSqmdRT0VQpcyni78d6KW6EmIABKRgxz6GJKI";

const serviceImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBfoWuDQee-V1IeHlkb-SCSEwil6Cf2t8qzOmpERiL1CdAYa9G8AB-IyuAMFFbPC5o5EK3KFLi9YdNPM1caydn6L5fCWi2xUuqYR9Xfwsa6rOQLFhASsHogednbPdO9Rdo_bo714YVxmKTmOmj3qwXdEG_-279h70m8EZSodF0R2KcaDAMWShTyhtsTIcDRnkr9pni9Xm_1kL7C8IvmxiM9qqWC_R8gTgtgLDi9SvAif_SDMHRXqAA3zJhKPvqNUwLFHpu5NGGNzV8";

function timeAgo(date: Date | null): string {
  if (!date) return "Sin datos aún";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Hace un momento";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Hace ${days}d`;
  const months = Math.floor(days / 30);
  return `Hace ${months} mes${months > 1 ? "es" : ""}`;
}

export default async function HomePage() {
  const [estudiantesRow, planesEstRow, planesDocRow, encEstRow, encDocRow, satisfaccionRow] =
    await Promise.all([
      prisma.estudiante.findFirst({ orderBy: { created_at: "desc" }, select: { created_at: true } }),
      prisma.planMejoramientoEstudiante.findFirst({ orderBy: { updated_at: "desc" }, select: { updated_at: true } }),
      prisma.planMejoramientoDocente.findFirst({ orderBy: { updated_at: "desc" }, select: { updated_at: true } }),
      prisma.encuestaEstudiante.findFirst({ orderBy: { updated_at: "desc" }, select: { updated_at: true } }),
      prisma.encuestaDocente.findFirst({ orderBy: { updated_at: "desc" }, select: { updated_at: true } }),
      prisma.encuestaSatisfaccion.findFirst({ orderBy: { updated_at: "desc" }, select: { updated_at: true } }),
    ]);

  const estudiantesDate = estudiantesRow?.created_at ?? null;

  const encuentrosDates = [
    planesEstRow?.updated_at,
    planesDocRow?.updated_at,
    encEstRow?.updated_at,
    encDocRow?.updated_at,
  ].filter(Boolean) as Date[];
  const encuentrosDate = encuentrosDates.length
    ? new Date(Math.max(...encuentrosDates.map((d) => d.getTime())))
    : null;

  const satisfaccionDate = satisfaccionRow?.updated_at ?? null;
  return (
    <main className="flex-1 bg-[#f8f9fa] font-home-body text-[#191c1d] pt-16">
      <NavBar activePage="home" />

      <section className="relative flex min-h-95 items-center overflow-hidden bg-[#f8f9fa] px-6 py-12 sm:min-h-125 sm:px-8 sm:py-0 md:px-24">
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

          <h1 className="font-home-display mb-6 text-3xl font-extrabold leading-tight tracking-[-0.05em] text-[#191c1d] sm:text-4xl md:text-6xl">
            Sistema de apoyo para <br />
            <span className="text-[#00682f]">automatización y análisis</span>{" "}
            institucional
          </h1>

          <div className="flex flex-wrap gap-4">
            <a
              href="#servicios"
              className="font-home-display inline-flex items-center gap-2 rounded-[0.5rem] bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)] px-8 py-4 font-bold text-white shadow-[0_20px_40px_rgba(0,104,47,0.2)] transition-transform hover:scale-[1.02] active:scale-95"
            >
              Comenzar Ahora
              <ArrowRight className="size-5" />
            </a>
            <a
              href="#saber-mas"
              className="font-home-display rounded-[0.5rem] border border-[#bdcabb] px-8 py-4 font-bold text-[#191c1d] transition-colors hover:bg-[#edeeef]"
            >
              Saber más
            </a>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-12 sm:px-8 sm:py-16 md:px-24 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-home-display mb-4 text-4xl font-bold text-[#191c1d]">
                Acerca de esta herramienta
              </h2>
              <div className="h-1 w-24 rounded-full bg-[#00682f]" />
            </div>
            <p className="max-w-md text-[#3e4a3e]">
              Propósito, alcance y contexto de uso de esta plataforma.
            </p>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <p className="text-base leading-relaxed text-[#3e4a3e]">
              Herramienta desarrollada como apoyo operativo para organizar, consultar y automatizar
              información utilizada en procesos internos del área.
            </p>
            <p className="text-base leading-relaxed text-[#3e4a3e]">
              Esta plataforma permite centralizar accesos, generar reportes, consultar datos de trabajo,
              apoyar tareas repetitivas y facilitar el seguimiento de actividades mediante componentes
              web, automatización e inteligencia artificial.
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-6 py-4">
            <Info className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <p className="text-sm leading-relaxed text-amber-800">
              <span className="font-semibold">Aviso: </span>
              Esta página no corresponde al sitio web oficial de la Universidad de Cundinamarca.
              Su uso es interno, experimental y de apoyo para la gestión del área.
            </p>
          </div>
        </div>
      </section>

      <section id="servicios" className="bg-[#f3f4f5] px-4 py-12 sm:px-8 sm:py-16 md:px-24 md:py-24">
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
            <article className="group flex flex-col items-center gap-8 rounded-[0.75rem] border border-[#bdcabb]/10 bg-white p-6 shadow-[0_20px_40px_rgba(0,104,47,0.06)] transition-all hover:-translate-y-1 sm:p-8 md:col-span-2 md:flex-row">
              <div className="h-48 w-full overflow-hidden rounded-[0.5rem] sm:aspect-square sm:h-auto md:w-1/3">
                <img
                  src={serviceImage}
                  alt="Visualización de datos académicos en una pantalla digital."
                  className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
                />
              </div>

              <div className="flex flex-1 flex-col">
                <div className="mb-4 flex items-start justify-between">
                  <FileText className="size-10 text-[#00682f]" />
                  <span className="font-home-label rounded bg-[#2170e4]/10 px-2 py-1 text-[10px] font-bold text-[#0058be]">
                    ACTIVO
                  </span>
                </div>

                <h3 className="font-home-display mb-3 text-2xl font-bold text-[#191c1d]">
                  Automatizar Reportes para Boletín
                </h3>

                <p className="mb-4 grow text-[#3e4a3e]">
                  Módulo de ingesta y transformación de archivos Excel maestros. Aplica reglas de validación estructural, normaliza columnas, consolida bases de datos y genera salidas estadísticas organizadas por periodo, nivel y programa para alimentar boletines institucionales.
                </p>

                <span className="mb-6 inline-flex self-start items-center gap-1.5 rounded-full bg-[#00682f]/10 px-3 py-1.5 text-xs font-semibold text-[#00682f]">
                  <ShieldCheck className="size-3.5" />
                  Información estadística anonimizada
                </span>

                <div className="flex items-center gap-4">
                  <Link
                    href="/automatizar-reportes"
                    className="font-home-display inline-flex items-center gap-2 rounded bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)] px-6 py-3 text-sm font-bold text-white transition-all"
                  >
                    Ir al servicio
                    <ExternalLink className="size-4" />
                  </Link>

                  <span className="font-home-label inline-flex items-center gap-1 text-xs text-[#6e7a6e]">
                    <Clock3 className="size-3.5" />
                    {timeAgo(estudiantesDate)}
                  </span>
                </div>
              </div>
            </article>

            {/* Info card — Automatizar Reportes */}
            <article className="flex flex-col rounded-[0.75rem] border border-[#bdcabb]/10 bg-white p-6 shadow-[0_20px_40px_rgba(0,104,47,0.06)]">
              <Zap className="mb-4 size-6 text-[#00682f]" />
              <h4 className="font-home-display mb-2 text-lg font-bold text-[#191c1d]">
                Cómo funciona
              </h4>
              <p className="mb-4 text-sm leading-relaxed text-[#3e4a3e]">
                El módulo opera en tres fases secuenciales: carga de archivos
                Excel maestros, validación automática de estructura y
                transformación de datos en salidas estadísticas organizadas
                listas para análisis o boletines.
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                {["Excel / CSV", "Validación", "Consolidación", "Reportes"].map((tag) => (
                  <span key={tag} className="rounded-full bg-[#f3f4f5] px-3 py-1 text-xs font-medium text-[#3e4a3e]">
                    {tag}
                  </span>
                ))}
              </div>
            </article>

            <article className="group flex flex-col items-center gap-8 rounded-[0.75rem] border border-[#bdcabb]/10 bg-white p-6 shadow-[0_20px_40px_rgba(0,104,47,0.06)] transition-all hover:-translate-y-1 sm:p-8 md:col-span-2 md:flex-row">
              <div className="h-48 w-full overflow-hidden rounded-[0.5rem] sm:aspect-square sm:h-auto md:w-1/3">
                <img
                  src={serviceImage}
                  alt="Gráfico de tendencias con proyecciones de población estudiantil."
                  className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
                />
              </div>

              <div className="flex flex-1 flex-col">
                <div className="mb-4 flex items-start justify-between">
                  <TrendingUp className="size-10 text-[#00682f]" />
                  <span className="font-home-label rounded bg-[#2170e4]/10 px-2 py-1 text-[10px] font-bold text-[#0058be]">
                    ACTIVO
                  </span>
                </div>

                <h3 className="font-home-display mb-3 text-2xl font-bold text-[#191c1d]">
                  Pronóstico de Población Estudiantil
                </h3>

                <p className="mb-4 grow text-[#3e4a3e]">
                  Implementa modelos de proyección por media ponderada sobre series históricas de matrícula. Genera pronósticos por periodo académico desagregados por unidad regional, programa y categoría poblacional: matriculados, inscritos, admitidos y primíparos.
                </p>

                <span className="mb-6 inline-flex self-start items-center gap-1.5 rounded-full bg-[#00682f]/10 px-3 py-1.5 text-xs font-semibold text-[#00682f]">
                  <ShieldCheck className="size-3.5" />
                  Información estadística anonimizada
                </span>

                <div className="flex items-center gap-4">
                  <Link
                    href="/pronostico-estudiantil"
                    className="font-home-display inline-flex items-center gap-2 rounded bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)] px-6 py-3 text-sm font-bold text-white transition-all"
                  >
                    Ir al servicio
                    <ExternalLink className="size-4" />
                  </Link>

                  <span className="font-home-label inline-flex items-center gap-1 text-xs text-[#6e7a6e]">
                    <Clock3 className="size-3.5" />
                    {timeAgo(estudiantesDate)}
                  </span>
                </div>
              </div>
            </article>

            {/* Info card — Pronóstico */}
            <article className="flex flex-col rounded-[0.75rem] border border-[#bdcabb]/10 bg-white p-6 shadow-[0_20px_40px_rgba(0,104,47,0.06)]">
              <BarChart2 className="mb-4 size-6 text-[#00682f]" />
              <h4 className="font-home-display mb-2 text-lg font-bold text-[#191c1d]">
                Variables analizadas
              </h4>
              <p className="mb-4 text-sm leading-relaxed text-[#3e4a3e]">
                Utiliza modelos de media ponderada sobre series históricas para
                proyectar matrícula total, inscritos, admitidos y primíparos.
                Filtra por unidad regional y programa académico.
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                {["Matrícula", "Inscritos", "Admitidos", "Primíparos"].map((tag) => (
                  <span key={tag} className="rounded-full bg-[#f3f4f5] px-3 py-1 text-xs font-medium text-[#3e4a3e]">
                    {tag}
                  </span>
                ))}
              </div>
            </article>

            <article className="group flex flex-col items-center gap-8 rounded-[0.75rem] border border-[#bdcabb]/10 bg-white p-6 shadow-[0_20px_40px_rgba(0,104,47,0.06)] transition-all hover:-translate-y-1 sm:p-8 md:col-span-2 md:flex-row">
              <div className="h-48 w-full overflow-hidden rounded-[0.5rem] sm:aspect-square sm:h-auto md:w-1/3">
                <img
                  src={serviceImage}
                  alt="Encuentros dialógicos entre personas en entornos académicos."
                  className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
                />
              </div>

              <div className="flex flex-1 flex-col">
                <div className="mb-4 flex items-start justify-between">
                  <Users className="size-10 text-[#00682f]" />
                  <span className="font-home-label rounded bg-[#2170e4]/10 px-2 py-1 text-[10px] font-bold text-[#0058be]">
                    ACTIVO
                  </span>
                </div>

                <h3 className="font-home-display mb-3 text-2xl font-bold text-[#191c1d]">
                  Encuentros Dialógicos
                </h3>

                <p className="mb-4 grow text-[#3e4a3e]">
                  Módulo de registro y consulta de encuentros dialógicos académicos. Centraliza en base de datos los participantes (estudiantes y docentes), temáticas abordadas y compromisos generados, con trazabilidad por periodo, sede y tipo de encuentro.
                </p>

                <span className="mb-6 inline-flex self-start items-center gap-1.5 rounded-full bg-[#00682f]/10 px-3 py-1.5 text-xs font-semibold text-[#00682f]">
                  <ShieldCheck className="size-3.5" />
                  Información estadística anonimizada
                </span>

                <div className="flex items-center gap-4">
                  <Link
                    href="/encuentros-dialogicos"
                    className="font-home-display inline-flex items-center gap-2 rounded bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)] px-6 py-3 text-sm font-bold text-white transition-all"
                  >
                    Ir al servicio
                    <ExternalLink className="size-4" />
                  </Link>

                  <span className="font-home-label inline-flex items-center gap-1 text-xs text-[#6e7a6e]">
                    <Clock3 className="size-3.5" />
                    {timeAgo(encuentrosDate)}
                  </span>
                </div>
              </div>
            </article>

            {/* Info card — Encuentros Dialógicos */}
            <article className="flex flex-col rounded-[0.75rem] border border-[#bdcabb]/10 bg-white p-6 shadow-[0_20px_40px_rgba(0,104,47,0.06)]">
              <BookOpen className="mb-4 size-6 text-[#00682f]" />
              <h4 className="font-home-display mb-2 text-lg font-bold text-[#191c1d]">
                ¿Qué registra?
              </h4>
              <p className="mb-4 text-sm leading-relaxed text-[#3e4a3e]">
                Consolida participantes (estudiantes y docentes), temáticas
                abordadas, compromisos generados y su estado de seguimiento
                por periodo académico, evitando información dispersa en
                archivos separados.
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                {["Estudiantes", "Docentes", "Temáticas", "Compromisos"].map((tag) => (
                  <span key={tag} className="rounded-full bg-[#f3f4f5] px-3 py-1 text-xs font-medium text-[#3e4a3e]">
                    {tag}
                  </span>
                ))}
              </div>
            </article>

            <article className="group flex flex-col items-center gap-8 rounded-[0.75rem] border border-[#bdcabb]/10 bg-white p-6 shadow-[0_20px_40px_rgba(0,104,47,0.06)] transition-all hover:-translate-y-1 sm:p-8 md:col-span-2 md:flex-row">
              <div className="h-48 w-full overflow-hidden rounded-[0.5rem] sm:aspect-square sm:h-auto md:w-1/3">
                <img
                  src={serviceImage}
                  alt="Encuesta de satisfacción institucional con resultados visualizados."
                  className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
                />
              </div>

              <div className="flex flex-1 flex-col">
                <div className="mb-4 flex items-start justify-between">
                  <Heart className="size-10 text-[#00682f]" />
                  <span className="font-home-label rounded bg-[#2170e4]/10 px-2 py-1 text-[10px] font-bold text-[#0058be]">
                    ACTIVO
                  </span>
                </div>

                <h3 className="font-home-display mb-3 text-2xl font-bold text-[#191c1d]">
                  Encuesta de Satisfacción
                </h3>

                <p className="mb-4 grow text-[#3e4a3e]">
                  Procesa archivos Excel de la Encuesta Generación Siglo XXI mediante parseo columnar y agregación estadística. Calcula indicadores de percepción segmentados por área, sede y rol para periodos IPA e IIPA, con exportación de resultados detallados.
                </p>

                <span className="mb-6 inline-flex self-start items-center gap-1.5 rounded-full bg-[#00682f]/10 px-3 py-1.5 text-xs font-semibold text-[#00682f]">
                  <ShieldCheck className="size-3.5" />
                  Información estadística anonimizada
                </span>

                <div className="flex items-center gap-4">
                  <Link
                    href="/encuesta-satisfaccion"
                    className="font-home-display inline-flex items-center gap-2 rounded bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)] px-6 py-3 text-sm font-bold text-white transition-all"
                  >
                    Ir al servicio
                    <ExternalLink className="size-4" />
                  </Link>

                  <span className="font-home-label inline-flex items-center gap-1 text-xs text-[#6e7a6e]">
                    <Clock3 className="size-3.5" />
                    {timeAgo(satisfaccionDate)}
                  </span>
                </div>
              </div>
            </article>

            {/* Info card — Encuesta de Satisfacción */}
            <article className="flex flex-col rounded-[0.75rem] border border-[#bdcabb]/10 bg-white p-6 shadow-[0_20px_40px_rgba(0,104,47,0.06)]">
              <ClipboardList className="mb-4 size-6 text-[#00682f]" />
              <h4 className="font-home-display mb-2 text-lg font-bold text-[#191c1d]">
                Encuesta Siglo XXI
              </h4>
              <p className="mb-4 text-sm leading-relaxed text-[#3e4a3e]">
                Procesa la Encuesta de Satisfacción Generación Siglo XXI.
                Genera estadísticas de percepción anonimizadas segmentadas
                por área, sede y rol. Compatible con periodos IPA e IIPA
                de cada año académico.
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                {["IPA", "IIPA", "Por área", "Por sede", "Por rol"].map((tag) => (
                  <span key={tag} className="rounded-full bg-[#f3f4f5] px-3 py-1 text-xs font-medium text-[#3e4a3e]">
                    {tag}
                  </span>
                ))}
              </div>
            </article>

            {/* Service card — Agentes de IA */}
            <article className="group flex flex-col items-center gap-8 rounded-[0.75rem] border border-[#bdcabb]/10 bg-white p-6 shadow-[0_20px_40px_rgba(0,104,47,0.06)] transition-all hover:-translate-y-1 sm:p-8 md:col-span-2 md:flex-row">
              <div className="h-48 w-full overflow-hidden rounded-[0.5rem] sm:aspect-square sm:h-auto md:w-1/3">
                <img
                  src={serviceImage}
                  alt="Agentes de inteligencia artificial para análisis institucional."
                  className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
                />
              </div>

              <div className="flex flex-1 flex-col">
                <div className="mb-4 flex items-start justify-between">
                  <Bot className="size-10 text-[#00682f]" />
                  <span className="font-home-label rounded bg-[#2170e4]/10 px-2 py-1 text-[10px] font-bold text-[#0058be]">
                    ACTIVO
                  </span>
                </div>

                <h3 className="font-home-display mb-3 text-2xl font-bold text-[#191c1d]">
                  Agentes de IA
                </h3>

                <p className="mb-4 grow text-[#3e4a3e]">
                  Interfaz conversacional basada en modelos de lenguaje (LLM) conectada al contexto institucional. Permite consultar datos procesados, interpretar indicadores, generar resúmenes estadísticos y orientar análisis mediante prompts en lenguaje natural.
                </p>

                <span className="mb-6 inline-flex self-start items-center gap-1.5 rounded-full bg-[#00682f]/10 px-3 py-1.5 text-xs font-semibold text-[#00682f]">
                  <ShieldCheck className="size-3.5" />
                  Información estadística anonimizada
                </span>

                <div className="flex items-center gap-4">
                  <Link
                    href="/agentes"
                    className="font-home-display inline-flex items-center gap-2 rounded bg-[linear-gradient(135deg,#00682f_0%,#00843d_100%)] px-6 py-3 text-sm font-bold text-white transition-all"
                  >
                    Ir al servicio
                    <ExternalLink className="size-4" />
                  </Link>
                </div>
              </div>
            </article>

            {/* Info card — Agentes de IA */}
            <article className="flex flex-col rounded-[0.75rem] border border-[#bdcabb]/10 bg-white p-6 shadow-[0_20px_40px_rgba(0,104,47,0.06)]">
              <BrainCircuit className="mb-4 size-6 text-[#00682f]" />
              <h4 className="font-home-display mb-2 text-lg font-bold text-[#191c1d]">
                Capacidades del agente
              </h4>
              <p className="mb-4 text-sm leading-relaxed text-[#3e4a3e]">
                Responde preguntas sobre datos cargados, genera resúmenes
                estadísticos, interpreta resultados de encuestas y apoya la
                lectura de indicadores institucionales mediante lenguaje
                natural sin necesidad de conocimientos técnicos.
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                {["Lenguaje natural", "Análisis", "Resúmenes", "Soporte"].map((tag) => (
                  <span key={tag} className="rounded-full bg-[#f3f4f5] px-3 py-1 text-xs font-medium text-[#3e4a3e]">
                    {tag}
                  </span>
                ))}
              </div>
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
              <Link
                href="/agentes"
                className="font-home-display rounded bg-white px-4 py-2 text-center text-sm font-bold text-[#00682f]"
              >
                Contactar Soporte
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section id="saber-mas" className="bg-white px-4 py-12 sm:px-8 sm:py-16 md:px-24 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-home-display mb-4 text-4xl font-bold text-[#191c1d]">
                Saber más
              </h2>
              <div className="h-1 w-24 rounded-full bg-[#00682f]" />
            </div>
            <p className="max-w-md text-[#3e4a3e]">
              Descripción general del proyecto, sus módulos y propósito operativo.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <p className="text-base leading-relaxed text-[#3e4a3e]">
              <span className="font-semibold text-[#191c1d]">Automatizar</span> es una plataforma web de
              apoyo operativo diseñada para facilitar la gestión, procesamiento y análisis de información
              utilizada en actividades internas del área. Su propósito principal es reducir tareas repetitivas,
              ordenar fuentes de datos, centralizar servicios de consulta y transformar archivos dispersos
              en insumos útiles para la toma de decisiones.
            </p>

            <p className="text-base leading-relaxed text-[#3e4a3e]">
              La plataforma integra distintos módulos orientados al tratamiento de información académica,
              administrativa y estadística. Entre sus funcionalidades se encuentran la carga y procesamiento
              de archivos Excel, la normalización de bases de datos, la generación de reportes, la
              visualización de indicadores, el seguimiento de información por periodos y la consulta de
              resultados mediante interfaces web organizadas.
            </p>

            <p className="text-base leading-relaxed text-[#3e4a3e]">
              Uno de los componentes principales está enfocado en la{" "}
              <span className="font-medium text-[#191c1d]">automatización de reportes periódicos</span>.
              Este módulo permite procesar fuentes de datos previamente estructuradas, aplicar reglas de
              transformación, consolidar información y generar salidas que faciliten la elaboración de
              boletines, informes o documentos de seguimiento, reduciendo el trabajo manual y mejorando
              la consistencia de los datos.
            </p>

            <p className="text-base leading-relaxed text-[#3e4a3e]">
              La plataforma también incorpora funcionalidades de{" "}
              <span className="font-medium text-[#191c1d]">análisis y proyección</span>, permitiendo revisar
              comportamientos históricos, identificar tendencias y generar estimaciones útiles para ejercicios
              de planeación. Estos componentes apoyan la lectura de información agregada por periodos,
              grupos, sedes, categorías o variables de análisis.
            </p>

            <p className="text-base leading-relaxed text-[#3e4a3e]">
              Otro eje del proyecto es el{" "}
              <span className="font-medium text-[#191c1d]">procesamiento de encuestas y mecanismos de percepción</span>.
              A través de estos módulos se puede cargar información proveniente de formularios o archivos
              estructurados, organizar respuestas, calcular resultados y generar vistas que faciliten la
              interpretación de los niveles de satisfacción, participación o percepción de los grupos evaluados.
            </p>

            <p className="text-base leading-relaxed text-[#3e4a3e]">
              Además, el sistema contempla herramientas para el{" "}
              <span className="font-medium text-[#191c1d]">seguimiento de espacios de diálogo</span>,
              compromisos, participantes, temáticas y resultados asociados, consolidando información que
              normalmente se encuentra distribuida en diferentes archivos y facilitando su consulta y
              posterior análisis.
            </p>

            <p className="text-base leading-relaxed text-[#3e4a3e]">
              Desde el punto de vista técnico, la solución está construida como una aplicación web moderna,
              con arquitectura orientada a módulos, componentes reutilizables, conexión a base de datos,
              procesamiento de archivos y visualización de información. Su diseño busca ser práctico,
              escalable y adaptable, permitiendo integrar progresivamente nuevos servicios de automatización,
              indicadores, tableros y herramientas de apoyo.
            </p>

            <p className="text-base font-medium leading-relaxed text-[#191c1d]">
              En síntesis,{" "}
              <span className="text-[#00682f]">Automatizar</span> busca convertir tareas manuales y
              repetitivas en flujos más ordenados, trazables y eficientes, usando desarrollo web, bases
              de datos, analítica e inteligencia artificial aplicada como medios para mejorar el trabajo diario.
            </p>
          </div>

          <div className="mt-8 flex items-start gap-3 rounded-xl border border-[#bdcabb]/40 bg-white px-6 py-5">
            <Info className="mt-0.5 size-5 shrink-0 text-[#6e7a6e]" />
            <p className="text-sm leading-relaxed text-[#6e7a6e]">
              El proyecto no reemplaza sistemas oficiales, canales autorizados ni repositorios formales de
              información. Su uso está orientado exclusivamente al apoyo interno, experimental y operativo
              del área, funcionando como herramienta auxiliar para mejorar tiempos de respuesta, organizar
              procesos y fortalecer la gestión basada en datos.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
