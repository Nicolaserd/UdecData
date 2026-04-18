"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, ChevronDown, Menu, Settings, X } from "lucide-react";

interface NavBarProps {
  activePage?: "home" | "automatizar-reportes" | "pronostico-estudiantil" | "encuentros-dialogicos" | "agentes";
}

const SERVICES = [
  { href: "/automatizar-reportes", label: "Automatizar Reportes para Boletín" },
  { href: "/pronostico-estudiantil", label: "Pronóstico de Población Estudiantil" },
  { href: "/encuentros-dialogicos", label: "Encuentros Dialógicos" },
  { href: "/agentes", label: "Agentes de IA" },
];

export function NavBar({ activePage }: NavBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  const isService =
    activePage === "automatizar-reportes" ||
    activePage === "pronostico-estudiantil" ||
    activePage === "encuentros-dialogicos" ||
    activePage === "agentes";

  return (
    <header className="fixed top-0 z-50 w-full border-b border-neutral-200/50 bg-[#f8f9fa]">
      <div className="flex h-16 w-full max-w-full items-center justify-between px-4 sm:px-8">
        {/* Logo */}
        <Link href="/" className="font-home-display text-base font-bold tracking-tight text-[#00682f] sm:text-xl">
          Academic Intelligence Portal
        </Link>

        {/* Nav desktop */}
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          <Link
            href="/"
            className={`font-home-display pb-1 transition-colors hover:text-[#00682f] ${
              activePage === "home"
                ? "border-b-2 border-[#00682f] text-[#00682f]"
                : "text-gray-600"
            }`}
          >
            Home
          </Link>

          <div className="group relative">
            <button
              type="button"
              className={`font-home-display flex items-center gap-1 pb-1 transition-colors hover:text-[#00682f] ${
                isService
                  ? "border-b-2 border-[#00682f] font-bold text-[#00682f]"
                  : "text-gray-600"
              }`}
            >
              Servicios
              <ChevronDown className="size-4" />
            </button>

            <div className="invisible absolute left-0 top-full z-50 w-64 pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <div className="overflow-hidden rounded-[0.5rem] border border-neutral-200/50 bg-white shadow-xl">
                {SERVICES.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    className={`block px-4 py-3 text-sm transition-colors hover:bg-gray-100 ${
                      activePage === s.href.slice(1)
                        ? "bg-[#00682f]/5 font-semibold text-[#00682f]"
                        : "text-gray-700"
                    }`}
                  >
                    {s.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </nav>

        {/* Acciones derecha */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Notificaciones"
            className="rounded-md p-2 text-neutral-500 transition-all hover:bg-gray-100 active:scale-95"
          >
            <Bell className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Configuración"
            className="hidden rounded-md p-2 text-neutral-500 transition-all hover:bg-gray-100 active:scale-95 sm:block"
          >
            <Settings className="size-5" />
          </button>

          {/* Hamburguesa móvil */}
          <button
            type="button"
            aria-label="Menú"
            onClick={() => setMobileOpen((v) => !v)}
            className="ml-1 rounded-md p-2 text-neutral-500 transition-all hover:bg-gray-100 active:scale-95 md:hidden"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Menú móvil desplegable */}
      {mobileOpen && (
        <div className="border-t border-neutral-200/50 bg-white px-4 pb-4 pt-2 shadow-lg md:hidden">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className={`block rounded-lg px-3 py-3 text-sm font-semibold transition-colors hover:bg-gray-100 ${
              activePage === "home" ? "text-[#00682f]" : "text-gray-700"
            }`}
          >
            Home
          </Link>

          {/* Sección Servicios */}
          <div>
            <button
              type="button"
              onClick={() => setServicesOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
            >
              Servicios
              <ChevronDown
                className={`size-4 transition-transform duration-200 ${servicesOpen ? "rotate-180" : ""}`}
              />
            </button>

            {servicesOpen && (
              <div className="ml-3 mt-1 space-y-1 border-l-2 border-[#00682f]/20 pl-3">
                {SERVICES.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-gray-100 ${
                      activePage === s.href.slice(1)
                        ? "font-semibold text-[#00682f]"
                        : "text-gray-600"
                    }`}
                  >
                    {s.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
