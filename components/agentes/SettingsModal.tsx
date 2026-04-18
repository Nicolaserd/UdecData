"use client";

import { useState } from "react";
import { X, Key, Cpu, Shuffle } from "lucide-react";
import { AI_MODELS, PROVIDER_LABELS, findAiModel } from "@/lib/ai/model-options";

export const MODELS = AI_MODELS;

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  currentModel: string;
  onModelChange: (model: string) => void;
  customApiKey: string;
  onApiKeyChange: (key: string) => void;
  autoSwitch: boolean;
  onAutoSwitchChange: (v: boolean) => void;
}

export default function SettingsModal({
  open,
  onClose,
  currentModel,
  onModelChange,
  customApiKey,
  onApiKeyChange,
  autoSwitch,
  onAutoSwitchChange,
}: SettingsModalProps) {
  const [apiKeyInput, setApiKeyInput] = useState(customApiKey);
  const [showKey, setShowKey] = useState(false);
  const currentModelOption = findAiModel(currentModel);
  const providerLabel = currentModelOption ? PROVIDER_LABELS[currentModelOption.provider] : "Groq/Cerebras";
  const keyPlaceholder = currentModelOption?.provider === "cerebras" ? "csk-..." : "gsk_...";

  if (!open) return null;

  function handleSave() {
    onApiKeyChange(apiKeyInput.trim());
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between px-6 pb-4 pt-6">
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

        <div className="flex-1 overflow-y-auto px-6 pb-4 pr-5">
          {/* Cambio automático de modelo */}
          <div className="mb-5">
            <div className="flex items-center justify-between px-4 py-3 rounded-xl border-2 border-slate-200 bg-white">
              <div className="flex items-center gap-2 min-w-0">
                <Shuffle size={15} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-700 font-['Work_Sans']">Cambio automático de modelo</p>
                  <p className="text-xs text-slate-400 font-['Inter']">
                    {autoSwitch ? "Si un modelo falla, cambia al siguiente automáticamente" : "Solo usa el modelo seleccionado abajo"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onAutoSwitchChange(!autoSwitch)}
                className={`relative flex-shrink-0 ml-3 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${autoSwitch ? "bg-emerald-500" : "bg-slate-300"}`}
                aria-pressed={autoSwitch}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${autoSwitch ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>
          </div>

          {/* Modelo */}
          <div className="mb-5">
            <label className={`flex items-center gap-2 text-sm font-semibold mb-3 font-['Work_Sans'] ${autoSwitch ? "text-slate-400" : "text-slate-700"}`}>
              <Cpu size={15} className={autoSwitch ? "text-slate-300" : "text-emerald-600"} />
              {autoSwitch ? "Modelo preferido (referencia)" : "Modelo de IA"}
            </label>
            {autoSwitch && (
              <p className="text-xs text-slate-400 font-['Inter'] mb-2">
                El sistema elige y cambia de modelo automáticamente. El modelo seleccionado se usará como preferido.
              </p>
            )}
            <div className={`space-y-2 ${autoSwitch ? "opacity-50 pointer-events-none" : ""}`}>
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onModelChange(m.id)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border-2 transition-all text-left ${
                    currentModel === m.id
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="min-w-0 pr-3">
                    <p className={`text-sm font-semibold font-['Manrope'] ${currentModel === m.id ? "text-emerald-700" : "text-slate-700"}`}>
                      {m.label}
                    </p>
                    <p className="text-xs text-slate-400 font-['Inter']">
                      {PROVIDER_LABELS[m.provider]} · {m.desc}
                    </p>
                  </div>
                  {currentModel === m.id && (
                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* API Key personalizada */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2 font-['Work_Sans']">
              <Key size={15} className="text-emerald-600" />
              API Key personalizada (opcional)
            </label>
            <p className="text-xs text-slate-400 mb-2 font-['Inter']">
              Modelo seleccionado: {providerLabel}. Usa gsk_ para Groq o csk- para Cerebras; se guarda solo en esta sesion.
            </p>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={keyPlaceholder}
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
        </div>

        <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-white px-6 py-4">
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
