"use client";

import { useState } from "react";
import { X, Key, Cpu } from "lucide-react";

export const MODELS = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", desc: "Mejor para análisis complejos" },
  { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", desc: "Balance velocidad/calidad" },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", desc: "Rápido, ideal para soporte" },
];

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  currentModel: string;
  onModelChange: (model: string) => void;
  customApiKey: string;
  onApiKeyChange: (key: string) => void;
}

export default function SettingsModal({
  open,
  onClose,
  currentModel,
  onModelChange,
  customApiKey,
  onApiKeyChange,
}: SettingsModalProps) {
  const [apiKeyInput, setApiKeyInput] = useState(customApiKey);
  const [showKey, setShowKey] = useState(false);

  if (!open) return null;

  function handleSave() {
    onApiKeyChange(apiKeyInput.trim());
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 z-10">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-800 font-['Manrope']">
            Configuración de Agentes
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modelo */}
        <div className="mb-5">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3 font-['Work_Sans']">
            <Cpu size={15} className="text-emerald-600" />
            Modelo de IA
          </label>
          <div className="space-y-2">
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => onModelChange(m.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${
                  currentModel === m.id
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div>
                  <p className={`text-sm font-semibold font-['Manrope'] ${currentModel === m.id ? "text-emerald-700" : "text-slate-700"}`}>
                    {m.label}
                  </p>
                  <p className="text-xs text-slate-400 font-['Inter']">{m.desc}</p>
                </div>
                {currentModel === m.id && (
                  <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* API Key personalizada */}
        <div className="mb-6">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2 font-['Work_Sans']">
            <Key size={15} className="text-emerald-600" />
            API Key de Groq (opcional)
          </label>
          <p className="text-xs text-slate-400 mb-2 font-['Inter']">
            Usa esto si alcanzaste el límite gratuito. Se guarda solo en esta sesión.
          </p>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="gsk_..."
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-['Inter'] focus:outline-none focus:ring-2 focus:ring-emerald-400 pr-16"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-['Work_Sans']"
            >
              {showKey ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {apiKeyInput && (
            <button
              onClick={() => setApiKeyInput("")}
              className="mt-1 text-xs text-red-400 hover:text-red-600 font-['Inter']"
            >
              Limpiar key personalizada (usar la del servidor)
            </button>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 font-semibold hover:bg-slate-50 transition-colors font-['Work_Sans']"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors font-['Work_Sans']"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
