"use client";

import { createPortal } from "react-dom";
import { FileWarning } from "lucide-react";

export type PendingAction = "skip" | "move" | "attach" | "replace" | "toHint";

export interface PendingFile {
  key: string;
  file: File;
  /** Nombre del archivo idéntico que ya está en esta casilla */
  sameSlot: string | null;
  /** Casilla donde ya está un archivo idéntico */
  otherSlot: string | null;
  /** Casilla que sugiere el nombre del archivo */
  hintKey: string | null;
  /** Archivos que ya tiene la casilla */
  existing: number;
}

interface Props {
  pending: PendingFile;
  labelOf: (key: string) => string;
  /** El histórico admite un solo archivo (no se puede adjuntar) */
  singleFileSlot: boolean;
  onResolve: (action: PendingAction) => void;
}

type Choice = { action: PendingAction; label: string; primary?: boolean };

/** Explica el conflicto al elegir un archivo y ofrece solo las opciones que tienen sentido. */
export function FileConflictDialog({ pending, labelOf, singleFileSlot, onResolve }: Props) {
  const here = labelOf(pending.key);
  const name = pending.file.name;
  let title: string;
  let message: string;
  let choices: Choice[];

  if (pending.sameSlot) {
    title = "Este archivo ya está cargado";
    message = `"${name}" es idéntico a "${pending.sameSlot}", que ya está en ${here}. Subirlo otra vez contaría los mismos datos dos veces.`;
    choices = [{ action: "skip", label: "Entendido, no subirlo", primary: true }];
  } else if (pending.otherSlot) {
    const there = labelOf(pending.otherSlot);
    title = "El mismo archivo está en otra casilla";
    message = `"${name}" es idéntico al archivo que ya cargaste en ${there}. Un mismo reporte en dos casillas duplica los datos (por ejemplo, Primíparos con las cifras de Inscritos).`;
    choices = [
      { action: "skip", label: "No subirlo", primary: true },
      { action: "move", label: `Moverlo a ${here} (quitarlo de ${there})` },
    ];
  } else if (pending.hintKey) {
    const hinted = labelOf(pending.hintKey);
    title = "¿Es la casilla correcta?";
    message = `Por el nombre, "${name}" parece un reporte de ${hinted}, pero lo estás cargando en ${here}.`;
    choices = [
      { action: "toHint", label: `Subirlo en ${hinted}`, primary: true },
      { action: pending.existing > 0 && !singleFileSlot ? "attach" : "replace", label: `Subirlo en ${here} de todos modos` },
      { action: "skip", label: "No subirlo" },
    ];
  } else {
    title = `${here} ya tiene ${pending.existing === 1 ? "un archivo" : `${pending.existing} archivos`}`;
    message = singleFileSlot
      ? `Esta casilla admite un solo archivo. ¿Quieres reemplazarlo por "${name}"?`
      : `¿Qué hago con "${name}"? Adjuntar suma sus datos a los que ya hay (útil si el reporte viene partido, por ejemplo por sede). Reemplazar deja solo este archivo.`;
    choices = singleFileSlot
      ? [
          { action: "replace", label: "Reemplazar", primary: true },
          { action: "skip", label: "No subirlo" },
        ]
      : [
          { action: "attach", label: "Adjuntar (sumar)", primary: true },
          { action: "replace", label: "Reemplazar" },
          { action: "skip", label: "No subirlo" },
        ];
  }

  // Solo se muestra tras una acción del usuario (siempre en el navegador)
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40 px-4 font-home-body backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-conflict-title"
      onKeyDown={(e) => { if (e.key === "Escape") onResolve("skip"); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[#bdcabb]/30 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <FileWarning className="size-5 text-amber-700" />
          </div>
          <div>
            <h2 id="file-conflict-title" className="font-home-display text-lg font-bold text-[#191c1d]">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[#3e4a3e]">{message}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {choices.map((c, i) => (
            <button
              key={c.action + c.label}
              type="button"
              autoFocus={i === 0}
              onClick={() => onResolve(c.action)}
              className={
                c.primary
                  ? "rounded-xl bg-[#00682f] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#005226] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00682f]"
                  : "rounded-xl border border-[#bdcabb] px-4 py-2.5 text-sm font-medium text-[#191c1d] transition-colors hover:bg-[#f3f4f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00682f]"
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
