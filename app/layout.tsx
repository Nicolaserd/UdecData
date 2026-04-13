import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
  Manrope,
  Work_Sans,
} from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UDEC - Automatización de Reportes",
  description:
    "Plataforma de automatización de flujos de datos e informes para la Universidad de Cundinamarca",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} ${inter.variable} ${workSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f8f9fa]">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
