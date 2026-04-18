"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Mic, Plus, BarChart2, Bot,
  Paperclip, AlertCircle, Settings, Trash2, MessageSquare,
} from "lucide-react";
import SettingsModal from "@/components/agentes/SettingsModal";
import { NavBar } from "@/components/layout/navbar";

// ── Tipos ──────────────────────────────────────────────────────────────────────
type AgentType = "analista" | "soporte";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  error?: boolean;
}

interface SavedChat {
  id: number;
  agent_type: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const AGENTS = {
  analista: {
    id: "analista" as AgentType,
    name: "Analista de Datos Académicos",
    icon: <BarChart2 size={22} />,
    placeholder: "Pregunta sobre tendencias, estadísticas o comparativas...",
    greeting: `¡Hola! Soy el Analista de Datos Académicos. Tengo acceso de solo lectura a la base de datos del portal.\n\nPuedo ayudarte con:\n- 📊 Estadísticas de encuestas de estudiantes y docentes\n- 📈 Tendencias de matrícula por sede y programa\n- 🏆 Análisis de planes de mejoramiento\n- 🔍 Comparativas entre encuentros y años`,
  },
  soporte: {
    id: "soporte" as AgentType,
    name: "Agente de Soporte",
    icon: <Bot size={22} />,
    placeholder: "¿En qué te puedo ayudar con el portal?",
    greeting: `¡Hola! Soy el Agente de Soporte del Portal de Inteligencia Académica.\n\nPuedo orientarte sobre:\n- 📋 Cómo usar el Dashboard de Estudiantes\n- 📤 Automatización de Reportes\n- 🎓 Módulo de Encuentros Dialógicos\n- 📌 Planes de Mejoramiento\n- 🤖 Uso de los Agentes de IA`,
  },
};

const STEP_LABELS: Record<string, { label: string; icon: string }> = {
  generating_sql: { label: "Generando consulta SQL...",      icon: "🔍" },
  validating:     { label: "Validando seguridad...",         icon: "🔒" },
  executing:      { label: "Ejecutando en base de datos...", icon: "⚡" },
  analyzing:      { label: "Analizando resultados...",       icon: "📊" },
  responding:     { label: "Preparando respuesta...",        icon: "✍️" },
};

function genId() { return Math.random().toString(36).slice(2); }

function formatChatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return d.toLocaleDateString("es-CO", { weekday: "short" });
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

function formatMsgTime(date: Date) {
  return date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

// ── Renderiza markdown básico (bloques de código) ──────────────────────────────
function renderContent(content: string, isError: boolean) {
  const parts = content.split(/(```(?:sql|)\s*[\s\S]*?```)/gi);
  return parts.map((part, i) => {
    const codeMatch = part.match(/```(?:sql|)\s*([\s\S]*?)```/i);
    if (codeMatch) {
      return (
        <pre key={i} className="bg-slate-800 text-emerald-300 rounded-lg px-4 py-3 my-2 text-xs font-mono overflow-x-auto border border-slate-700 leading-relaxed">
          <code>{codeMatch[1].trim()}</code>
        </pre>
      );
    }
    return (
      <span key={i} className={`whitespace-pre-wrap text-sm leading-relaxed font-['Inter'] ${isError ? "text-red-700" : "text-slate-800"}`}>
        {part}
      </span>
    );
  });
}

// ── Burbuja de mensaje ─────────────────────────────────────────────────────────
function ChatBubble({ msg, agentType }: { msg: Message; agentType: AgentType }) {
  const agent = AGENTS[agentType];
  if (msg.role === "user") {
    return (
      <div className="flex items-start gap-3 justify-end max-w-4xl ml-auto">
        <div className="bg-[#00843d] text-white px-5 py-4 rounded-2xl rounded-tr-none shadow-md max-w-xl">
          <p className="leading-relaxed text-sm font-['Inter'] whitespace-pre-wrap">{msg.content}</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-emerald-100 shrink-0 flex items-center justify-center border-2 border-white shadow mt-1">
          <span className="text-emerald-700 text-xs font-bold font-['Manrope']">Tú</span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 max-w-4xl">
      <div className="w-9 h-9 rounded-full bg-[#2170e4]/10 shrink-0 flex items-center justify-center text-[#2170e4] mt-1">
        {agent.icon}
      </div>
      <div className={`px-5 py-4 rounded-2xl rounded-tl-none shadow-sm border max-w-2xl ${msg.error ? "bg-red-50 border-red-200" : "bg-white border-[#bdcabb]/20"}`}>
        {msg.error && (
          <div className="flex items-center gap-2 text-red-600 text-xs mb-2">
            <AlertCircle size={13} />
            <span className="font-semibold font-['Work_Sans']">Error</span>
          </div>
        )}
        <div>{renderContent(msg.content, !!msg.error)}</div>
        <span className="text-[10px] text-slate-400 mt-2 block font-['Work_Sans']">{formatMsgTime(msg.timestamp)}</span>
      </div>
    </div>
  );
}

// ── Indicador de escritura ─────────────────────────────────────────────────────
function TypingIndicator({ agentType, step }: { agentType: AgentType; step: string | null }) {
  const agent = AGENTS[agentType];
  const stepInfo = step ? STEP_LABELS[step] : null;
  return (
    <div className="flex items-start gap-3 max-w-4xl">
      <div className="w-9 h-9 rounded-full bg-[#2170e4]/10 shrink-0 flex items-center justify-center text-[#2170e4] mt-1">
        {agent.icon}
      </div>
      <div className="bg-white px-5 py-4 rounded-2xl rounded-tl-none shadow-sm border border-[#bdcabb]/20 min-w-45">
        <div className="flex gap-1.5 items-center">
          <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        {stepInfo && (
          <p className="text-xs text-slate-400 mt-2 font-['Work_Sans'] flex items-center gap-1.5">
            <span>{stepInfo.icon}</span>
            <span>{stepInfo.label}</span>
          </p>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function AgentesPage() {
  const [activeAgent, setActiveAgent] = useState<AgentType>("analista");
  const [conversations, setConversations] = useState<Record<AgentType, Message[]>>({
    analista: [{ id: genId(), role: "assistant", content: AGENTS.analista.greeting, timestamp: new Date() }],
    soporte:  [{ id: genId(), role: "assistant", content: AGENTS.soporte.greeting,  timestamp: new Date() }],
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("llama-3.3-70b-versatile");
  const [customApiKey, setCustomApiKey] = useState("");
  const [summaries, setSummaries] = useState<Record<AgentType, string>>({ analista: "", soporte: "" });

  // ── Estado del historial guardado ──────────────────────────────────────────
  const [savedChats, setSavedChats] = useState<Record<AgentType, SavedChat[]>>({ analista: [], soporte: [] });
  const [activeChatIds, setActiveChatIds] = useState<Record<AgentType, number | null>>({ analista: null, soporte: null });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<number | null>(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const activeChatId = activeChatIds[activeAgent];
  const setActiveChatId = (id: number | null) =>
    setActiveChatIds((prev) => ({ ...prev, [activeAgent]: id }));

  const chatEndRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messages = conversations[activeAgent];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, currentStep]);

  // Cargar historial de chats al montar y al cambiar de agente
  useEffect(() => {
    setLoadingChats(true);
    fetch(`/api/agentes/chats?agent=${activeAgent}`)
      .then((r) => r.json())
      .then((data: SavedChat[]) => setSavedChats((prev) => ({ ...prev, [activeAgent]: data })))
      .catch(() => {})
      .finally(() => setLoadingChats(false));
  }, [activeAgent]);

  // ── Guardar mensaje en BD — espera confirmación antes de continuar ──────────
  async function persistMessage(chatId: number, role: "user" | "assistant", content: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/agentes/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Crear chat en BD al enviar el primer mensaje ───────────────────────────
  async function createChat(title: string): Promise<number | null> {
    try {
      const res = await fetch("/api/agentes/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: activeAgent, title }),
      });
      const chat: SavedChat = await res.json();
      setSavedChats((prev) => ({
        ...prev,
        [activeAgent]: [chat, ...prev[activeAgent]].slice(0, 20),
      }));
      return chat.id;
    } catch {
      return null;
    }
  }

  // ── Cargar conversación guardada — espera respuesta BD antes de mostrar ─────
  async function loadChat(chat: SavedChat) {
    if (activeChatId === chat.id) return;
    setActiveChatId(chat.id);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/agentes/chats/${chat.id}/messages`);
      if (!res.ok) return;
      const dbMsgs: { id: number; role: string; content: string; created_at: string }[] = await res.json();
      const msgs: Message[] = dbMsgs.map((m) => ({
        id: String(m.id),
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: new Date(m.created_at),
      }));
      setConversations((prev) => ({ ...prev, [activeAgent]: msgs.length ? msgs : prev[activeAgent] }));
      setSummaries((prev) => ({ ...prev, [activeAgent]: "" }));
    } catch { /* ignorar */ }
    finally { setLoadingMessages(false); }
  }

  // ── Eliminar chat — espera confirmación BD antes de actualizar la UI ────────
  async function deleteChat(chatId: number) {
    setDeletingChatId(chatId);
    try {
      const res = await fetch(`/api/agentes/chats/${chatId}`, { method: "DELETE" });
      if (!res.ok) return; // si falla, no actualizar UI
      setSavedChats((prev) => ({
        ...prev,
        [activeAgent]: prev[activeAgent].filter((c) => c.id !== chatId),
      }));
      if (activeChatId === chatId) {
        setActiveChatId(null);
        setConversations((prev) => ({
          ...prev,
          [activeAgent]: [{ id: genId(), role: "assistant", content: AGENTS[activeAgent].greeting, timestamp: new Date() }],
        }));
      }
      setDeleteConfirmId(null);
    } finally {
      setDeletingChatId(null);
    }
  }

  // ── Nuevo chat ─────────────────────────────────────────────────────────────
  function handleNewChat() {
    setActiveChatId(null);
    setConversations((prev) => ({
      ...prev,
      [activeAgent]: [{ id: genId(), role: "assistant", content: AGENTS[activeAgent].greeting, timestamp: new Date() }],
    }));
    setSummaries((prev) => ({ ...prev, [activeAgent]: "" }));
  }

  // ── Auto-resumen cada 10 mensajes ──────────────────────────────────────────
  async function autoSummarize(agent: AgentType, msgs: Message[]) {
    const history = msgs.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    try {
      const res = await fetch("/api/agentes/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "", agent, history, summarize: true, ...(customApiKey ? { apiKey: customApiKey } : {}) }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.summary) {
        setSummaries((prev) => ({ ...prev, [agent]: data.summary }));
        setConversations((prev) => ({ ...prev, [agent]: prev[agent].slice(-4) }));
      }
    } catch { /* ignorar */ }
  }

  // ── Enviar mensaje ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: genId(), role: "user", content: text, timestamp: new Date() };
    setConversations((prev) => ({ ...prev, [activeAgent]: [...prev[activeAgent], userMsg] }));
    setInput("");
    setLoading(true);
    setCurrentStep(null);

    const currentMsgs = [...conversations[activeAgent], userMsg];
    const userCount = currentMsgs.filter((m) => m.role === "user").length;
    if (userCount > 0 && userCount % 10 === 0) autoSummarize(activeAgent, currentMsgs);

    // Crear chat en BD si es el primer mensaje
    let chatId = activeChatId;
    if (!chatId) {
      chatId = await createChat(text.slice(0, 60));
      if (chatId) setActiveChatId(chatId);
    }
    if (chatId) await persistMessage(chatId, "user", text);

    const history = conversations[activeAgent]
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/agentes/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          agent: activeAgent,
          history,
          summary: summaries[activeAgent] || undefined,
          model: selectedModel,
          ...(customApiKey ? { apiKey: customApiKey } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setConversations((prev) => ({
          ...prev,
          [activeAgent]: [...prev[activeAgent], { id: genId(), role: "assistant", content: data.error ?? "Error desconocido", timestamp: new Date(), error: true }],
        }));
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.step) {
              setCurrentStep(event.step);
            } else if (event.done) {
              setCurrentStep(null);
              const assistantMsg: Message = { id: genId(), role: "assistant", content: event.reply, timestamp: new Date() };
              // Esperar a que BD confirme antes de actualizar sidebar
              if (chatId) await persistMessage(chatId, "assistant", event.reply);
              setConversations((prev) => ({ ...prev, [activeAgent]: [...prev[activeAgent], assistantMsg] }));
              setSavedChats((prev) => ({
                ...prev,
                [activeAgent]: prev[activeAgent].map((c) =>
                  c.id === chatId ? { ...c, updated_at: new Date().toISOString() } : c
                ),
              }));
            } else if (event.error) {
              setCurrentStep(null);
              setConversations((prev) => ({
                ...prev,
                [activeAgent]: [...prev[activeAgent], { id: genId(), role: "assistant", content: event.error, timestamp: new Date(), error: true }],
              }));
            }
          } catch { /* línea malformada */ }
        }
      }
    } catch {
      setConversations((prev) => ({
        ...prev,
        [activeAgent]: [...prev[activeAgent], { id: genId(), role: "assistant", content: "Error de conexión. Verifica tu red e intenta de nuevo.", timestamp: new Date(), error: true }],
      }));
    } finally {
      setCurrentStep(null);
      setLoading(false);
    }
  }, [input, loading, activeAgent, conversations, selectedModel, customApiKey, summaries, activeChatId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const agent = AGENTS[activeAgent];
  const agentChats = savedChats[activeAgent];

  return (
    <div className="bg-[#f8f9fa] font-['Inter'] text-slate-800 min-h-screen flex flex-col overflow-hidden">
      <NavBar activePage="agentes" />

      <div className="flex flex-1 relative">
        {/* ── Sidebar ── */}
        <aside className="bg-slate-50 w-72 border-r border-slate-200/60 flex flex-col h-[calc(100vh-64px)] fixed left-0 top-16 font-['Manrope'] overflow-hidden">

          {/* Header */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-10 h-10 rounded-xl bg-[#00843d] flex items-center justify-center text-white shrink-0">
                <span className="text-lg">🎓</span>
              </div>
              <div>
                <h2 className="text-emerald-900 font-bold text-sm leading-tight">Agentes Disponibles</h2>
                <p className="text-slate-400 text-xs">Expertos Digitales</p>
              </div>
            </div>

            {/* Selector de agente */}
            <div className="flex gap-1 mt-2 bg-slate-200/60 rounded-xl p-1">
              {(Object.values(AGENTS) as typeof AGENTS[AgentType][]).map((ag) => (
                <button
                  key={ag.id}
                  onClick={() => { setActiveAgent(ag.id); setDeleteConfirmId(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeAgent === ag.id
                      ? "bg-white text-[#00843d] shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className={activeAgent === ag.id ? "text-[#00843d]" : "text-slate-400"}>
                    {ag.id === "analista" ? <BarChart2 size={14} /> : <Bot size={14} />}
                  </span>
                  {ag.id === "analista" ? "Analista" : "Soporte"}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de chats guardados */}
          <div className="flex-1 overflow-y-auto px-4 pb-2">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Historial ({agentChats.length}/20)
              </span>
            </div>

            {loadingChats ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-slate-200/50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : agentChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                <MessageSquare size={28} />
                <p className="text-xs mt-2 font-['Work_Sans']">Sin conversaciones aún</p>
              </div>
            ) : (
              <div className="space-y-1">
                {agentChats.map((chat) => (
                  <div key={chat.id} className="group relative">
                    {deleteConfirmId === chat.id ? (
                      /* Confirmación de borrado */
                      <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                        <p className="text-xs text-red-700 font-semibold mb-2">¿Eliminar esta conversación?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => deleteChat(chat.id)}
                            disabled={deletingChatId === chat.id}
                            className="flex-1 bg-red-500 text-white text-xs py-1.5 rounded-lg font-semibold hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-1"
                          >
                            {deletingChatId === chat.id ? (
                              <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Eliminando...</>
                            ) : "Sí, eliminar"}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="flex-1 bg-white text-slate-600 text-xs py-1.5 rounded-lg font-semibold border border-slate-200 hover:bg-slate-50 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => loadChat(chat)}
                        onKeyDown={(e) => e.key === "Enter" && loadChat(chat)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                          activeChatId === chat.id
                            ? "bg-white shadow-sm border border-emerald-100"
                            : "hover:bg-white hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className={`text-xs font-semibold leading-snug line-clamp-2 flex-1 ${
                            activeChatId === chat.id ? "text-emerald-800" : "text-slate-700"
                          }`}>
                            {activeChatId === chat.id && (
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 mb-0.5" />
                            )}
                            {chat.title}
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(chat.id); }}
                            className="shrink-0 p-1 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-['Work_Sans']">
                          {formatChatTime(chat.updated_at)}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Acciones inferiores */}
          <div className="px-4 pb-4 pt-2 border-t border-slate-200/60 space-y-1">
            <button
              onClick={handleNewChat}
              className="w-full bg-[#00682f] text-white py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-[#00843d] transition-all active:scale-95 text-sm"
            >
              <Plus size={16} />
              Nuevo Chat
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-slate-500 hover:text-[#00682f] hover:bg-emerald-50 transition-all font-['Work_Sans'] font-semibold"
            >
              <Settings size={16} />
              Configuración
            </button>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 ml-72 flex flex-col h-[calc(100vh-64px)] bg-[#f8f9fa]">
          {/* Header del agente */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-[#bdcabb]/30 bg-white/60 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-[#2170e4]/10 flex items-center justify-center text-[#2170e4]">
                {agent.icon}
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800 font-['Manrope']">{agent.name}</h1>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-slate-500 font-['Work_Sans']">En línea ahora</span>
                  <span className="text-xs text-slate-400 font-['Work_Sans']">· {selectedModel}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto px-8 py-8 space-y-6 scrollbar-thin scrollbar-thumb-[#bdcabb]/50">
            {loadingMessages ? (
              <div className="flex flex-col gap-4 w-full">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`flex gap-3 ${i % 2 === 0 ? "justify-end" : ""}`}>
                    {i % 2 !== 0 && <div className="w-9 h-9 rounded-full bg-slate-200 animate-pulse shrink-0" />}
                    <div className={`h-16 rounded-2xl animate-pulse bg-slate-200 ${i % 2 === 0 ? "w-64" : "w-80"}`} />
                    {i % 2 === 0 && <div className="w-9 h-9 rounded-full bg-slate-200 animate-pulse shrink-0" />}
                  </div>
                ))}
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatBubble key={msg.id} msg={msg} agentType={activeAgent} />
                ))}
                {loading && <TypingIndicator agentType={activeAgent} step={currentStep} />}
              </>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="px-6 py-4 bg-white/80 border-t border-[#bdcabb]/30">
            <div className="max-w-4xl mx-auto flex items-end gap-3 bg-[#edeeef] px-2 py-2 rounded-2xl shadow-inner border border-[#bdcabb]/20">
              <button className="p-2.5 text-slate-400 hover:text-[#00682f] transition-colors active:scale-90 shrink-0">
                <Paperclip size={18} />
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={agent.placeholder}
                rows={1}
                disabled={loading}
                className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-slate-800 py-2.5 px-1 resize-none max-h-32 min-h-10 text-sm font-['Inter'] placeholder:text-slate-400 disabled:opacity-50"
              />
              <button className="p-2.5 text-slate-400 hover:text-[#00682f] transition-colors active:scale-90 shrink-0">
                <Mic size={18} />
              </button>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="bg-[#00843d] text-white p-2.5 rounded-xl shadow hover:bg-[#00682f] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Send size={18} />
              </button>
            </div>
            <p className="max-w-4xl mx-auto mt-2 px-2 text-[10px] text-slate-400 font-['Work_Sans'] flex items-center gap-1">
              <AlertCircle size={11} />
              La IA puede cometer errores. Verifica la información clave. · Enter para enviar, Shift+Enter para nueva línea.
            </p>
          </div>
        </main>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentModel={selectedModel}
        onModelChange={setSelectedModel}
        customApiKey={customApiKey}
        onApiKeyChange={setCustomApiKey}
      />
    </div>
  );
}
