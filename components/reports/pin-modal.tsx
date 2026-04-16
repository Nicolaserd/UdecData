"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, X } from "lucide-react";

interface PinModalProps {
  onConfirm: (pin: string) => Promise<boolean>;
  onCancel: () => void;
}

export function PinModal({ onConfirm, onCancel }: PinModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setError("");
    setLoading(true);
    try {
      const valid = await onConfirm(pin.trim());
      if (!valid) {
        setError("PIN incorrecto. Inténtalo de nuevo.");
        setPin("");
        inputRef.current?.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onKeyDown={handleKeyDown}
    >
      <div className="relative w-full max-w-sm rounded-2xl border border-[#bdcabb]/30 bg-white p-8 shadow-2xl">
        {/* Cerrar */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-full p-1.5 text-[#6e7a6e] transition-colors hover:bg-[#edeeef]"
        >
          <X className="size-4" />
        </button>

        {/* Icono + Título */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#00682f]/10">
            <KeyRound className="size-7 text-[#00682f]" />
          </div>
          <div>
            <h2 className="font-home-display text-xl font-bold text-[#191c1d]">
              Confirmar acceso
            </h2>
            <p className="mt-1 text-sm text-[#6e7a6e]">
              Ingresa el PIN para guardar en la base de datos
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className={`relative rounded-xl border transition-colors ${
              error ? "border-red-400 bg-red-50" : "border-[#bdcabb] bg-[#f8f9fa]"
            } focus-within:border-[#00682f] focus-within:ring-2 focus-within:ring-[#00682f]/20`}>
              <input
                ref={inputRef}
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError("");
                }}
                placeholder="••••••••"
                className="w-full bg-transparent py-3 pl-4 pr-12 text-center text-xl font-bold tracking-[0.4em] text-[#191c1d] outline-none placeholder:tracking-normal placeholder:text-[#bdcabb]"
                disabled={loading}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#6e7a6e] transition-colors hover:text-[#00682f]"
                aria-label={showPin ? "Ocultar PIN" : "Mostrar PIN"}
              >
                {showPin ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-center text-xs font-medium text-red-500">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!pin.trim() || loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#00682f] to-[#00843d] py-3 font-home-display font-bold text-white shadow-lg shadow-[#00682f]/15 transition-all hover:shadow-[#00682f]/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Verificando...
              </>
            ) : (
              "Confirmar"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
