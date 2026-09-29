"use client";

import { useState, useRef, useEffect } from "react";
import { Button, Card } from "@/components/ui";
import { Send, Bot, User, Loader2, X, ChevronRight } from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  action?: {
    type: "navigate" | "open_modal" | "show_data" | "create" | "update" | "delete";
    payload: Record<string, unknown>;
  };
  timestamp: Date;
}

interface AiChatProps {
  onAction?: (action: ChatMessage["action"]) => void;
  collapsed?: boolean;
}

const SUGGESTIONS = [
  "Mostrami il food cost di oggi",
  "Aggiungi un nuovo ingrediente",
  "Apri la gestione menu",
  "Come va il margine questo mese?",
  "Registra una nuova vendita",
  "Vedi le fatture di questo mese",
];

export function AiChat({ onAction, collapsed = false }: AiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Ciao! Sono il tuo assistente RistoGest. Posso aiutarti con:\n\n• Analisi costi e ricavi\n• Gestione menu e ingredienti\n• Vendite e fatture\n• Report e statistiche\n\nScrivi quello che ti serve, oppure scegli uno dei suggerimenti qui sotto.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: data.response,
        action: data.action,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.action && onAction) {
        onAction(data.action);
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        role: "assistant",
        content: "Mi dispiace, ho avuto un problema. Riprova.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }

    setLoading(false);
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  if (isCollapsed) {
    return (
      <Button
        onClick={() => setIsCollapsed(false)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg bg-primary hover:bg-primary/90"
        size="lg"
      >
        <Bot className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-50">
      <div className="bg-primary text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <span className="font-medium">RistoGest AI</span>
        </div>
        <button onClick={() => setIsCollapsed(true)} className="hover:bg-white/20 rounded p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-96">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`flex gap-2 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === "user" ? "bg-primary text-white" : "bg-gray-100 text-gray-600"
              }`}>
                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`rounded-2xl px-4 py-2 ${
                msg.role === "user" ? "bg-primary text-white" : "bg-gray-100 text-gray-800"
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.action && (
                  <button
                    onClick={() => onAction?.(msg.action)}
                    className={`mt-2 text-xs flex items-center gap-1 ${
                      msg.role === "user" ? "text-white/80" : "text-primary"
                    }`}
                  >
                    <ChevronRight className="w-3 h-3" />
                    Esegui azione
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex gap-2">
              <div className="bg-gray-100 rounded-2xl px-4 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t">
        <div className="flex gap-2 mb-2 flex-wrap">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSuggestion(s)}
              className="text-xs bg-gray-100 hover:bg-gray-200 rounded-full px-2 py-1 text-gray-700 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Scrivi un comando..."
            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <Button onClick={handleSend} size="sm" disabled={!input.trim() || loading}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}