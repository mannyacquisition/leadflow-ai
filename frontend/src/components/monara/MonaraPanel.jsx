import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Send, Bot, Loader2, CheckCircle, AlertTriangle, ChevronDown, Plus } from "lucide-react";
import { api } from "@/api/client";

const API_BASE = import.meta.env.VITE_API_URL || "";

// ─── SSE fetch helper ────────────────────────────────────────────────────────
async function* streamChat(sessionId, message) {
  const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") || "";
  const res = await fetch(`${API_BASE}/api/monara/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ session_id: sessionId, message }),
  });

  if (!res.ok) {
    yield { type: "error", message: `HTTP ${res.status}` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop();
    for (const part of parts) {
      if (part.startsWith("data: ")) {
        try { yield JSON.parse(part.slice(6)); } catch { /**/ }
      }
    }
  }
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isUser = msg.role === "user";
  if (msg.type === "tool_status") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 italic">
        <Loader2 className="w-3 h-3 animate-spin text-orange-400" />
        {msg.content}
      </div>
    );
  }
  if (msg.type === "confirmation_required") {
    return (
      <div className="mx-3 my-2 border border-orange-200 bg-orange-50 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800">Confirm Action</p>
            <p className="text-xs text-orange-600 mt-0.5">{msg.label}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={msg.onConfirm}
            className="flex-1 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600"
          >
            Yes, do it
          </button>
          <button
            onClick={msg.onCancel}
            className="flex-1 py-1.5 rounded-lg border text-xs text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} px-3 py-1`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "text-white rounded-br-sm"
            : "bg-gray-100 text-gray-800 rounded-bl-sm"
        }`}
        style={isUser ? { backgroundColor: "#ff5a1f" } : {}}
      >
        {msg.content}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function MonaraPanel({ isOpen, onClose }) {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Load or create session on open
  useEffect(() => {
    if (!isOpen) return;
    api.request("/monara/session").then((s) => {
      setSessionId(s.id);
      setMessages(
        (s.messages || []).map((m) => ({
          role: m.role,
          content: m.content,
          type: "text",
        }))
      );
      if (s.messages?.length === 0) {
        setMessages([{
          role: "assistant",
          content: "Hi! I'm Monara. I can answer questions about your leads and campaigns — and take actions on your behalf. What can I help you with?",
          type: "text",
        }]);
      }
    }).catch(() => {});
  }, [isOpen]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Focus input when open
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const appendMsg = (msg) => setMessages((prev) => [...prev, msg]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    appendMsg({ role: "user", content: text, type: "text" });
    setStreaming(true);
    setStreamingText("");

    let currentSessionId = sessionId;
    let accText = "";
    let pendingConfirmation = null;

    try {
      for await (const event of streamChat(currentSessionId, text)) {
        if (event.type === "token") {
          accText += event.content;
          setStreamingText(accText);
        } else if (event.type === "tool_status") {
          appendMsg({ role: "assistant", content: event.message, type: "tool_status" });
        } else if (event.type === "confirmation_required") {
          pendingConfirmation = event;
          if (!currentSessionId && event.session_id) {
            currentSessionId = event.session_id;
            setSessionId(event.session_id);
          }
        } else if (event.type === "mutation") {
          // Handled by useMonaraSync in the background
        } else if (event.type === "error") {
          appendMsg({ role: "assistant", content: `Error: ${event.message}`, type: "text" });
        } else if (event.type === "done") {
          if (!currentSessionId && event.session_id) {
            currentSessionId = event.session_id;
            setSessionId(event.session_id);
          }
        }
      }
    } catch (err) {
      appendMsg({ role: "assistant", content: "Connection error. Please try again.", type: "text" });
    }

    // Flush streamed text as a proper bubble
    if (accText) {
      appendMsg({ role: "assistant", content: accText, type: "text" });
      setStreamingText("");
    }

    // Render confirmation gate if needed
    if (pendingConfirmation) {
      const sid = currentSessionId;
      appendMsg({
        role: "system",
        type: "confirmation_required",
        label: pendingConfirmation.label,
        content: pendingConfirmation.label,
        onConfirm: async () => {
          setMessages((prev) => prev.filter((m) => m.type !== "confirmation_required"));
          try {
            const result = await api.request(`/monara/confirm/${sid}`, { method: "POST" });
            appendMsg({ role: "assistant", content: result.message, type: "text" });
          } catch {
            appendMsg({ role: "assistant", content: "Action failed.", type: "text" });
          }
        },
        onCancel: async () => {
          setMessages((prev) => prev.filter((m) => m.type !== "confirmation_required"));
          try {
            const result = await api.request(`/monara/cancel/${sid}`, { method: "POST" });
            appendMsg({ role: "assistant", content: result.message, type: "text" });
          } catch {}
        },
      });
    }

    setStreaming(false);
  }, [input, streaming, sessionId]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleShortcut = useCallback(async (text) => {
    if (streaming) return;
    appendMsg({ role: "user", content: text, type: "text" });
    setStreaming(true);
    setStreamingText("");

    let currentSessionId = sessionId;
    let accText = "";
    let pendingConfirmation = null;

    try {
      for await (const event of streamChat(currentSessionId, text)) {
        if (event.type === "token") {
          accText += event.content;
          setStreamingText(accText);
        } else if (event.type === "tool_status") {
          appendMsg({ role: "assistant", content: event.message, type: "tool_status" });
        } else if (event.type === "confirmation_required") {
          pendingConfirmation = event;
          if (!currentSessionId && event.session_id) {
            currentSessionId = event.session_id;
            setSessionId(event.session_id);
          }
        } else if (event.type === "done") {
          if (!currentSessionId && event.session_id) {
            currentSessionId = event.session_id;
            setSessionId(event.session_id);
          }
        } else if (event.type === "error") {
          appendMsg({ role: "assistant", content: `Error: ${event.message}`, type: "text" });
        }
      }
    } catch {
      appendMsg({ role: "assistant", content: "Connection error. Please try again.", type: "text" });
    }

    if (accText) {
      appendMsg({ role: "assistant", content: accText, type: "text" });
      setStreamingText("");
    }

    if (pendingConfirmation) {
      const sid = currentSessionId;
      appendMsg({
        role: "system",
        type: "confirmation_required",
        label: pendingConfirmation.label,
        content: pendingConfirmation.label,
        onConfirm: async () => {
          setMessages((prev) => prev.filter((m) => m.type !== "confirmation_required"));
          try {
            const result = await api.request(`/monara/confirm/${sid}`, { method: "POST" });
            appendMsg({ role: "assistant", content: result.message, type: "text" });
          } catch {
            appendMsg({ role: "assistant", content: "Action failed.", type: "text" });
          }
        },
        onCancel: async () => {
          setMessages((prev) => prev.filter((m) => m.type !== "confirmation_required"));
          try {
            await api.request(`/monara/cancel/${sid}`, { method: "POST" });
          } catch {}
        },
      });
    }

    setStreaming(false);
  }, [streaming, sessionId]);

  const handleNewChat = async () => {
    try {
      const s = await api.request("/monara/session", { method: "POST", body: JSON.stringify({}) });
      setSessionId(s.id);
      setMessages([{
        role: "assistant",
        content: "New conversation started. What can I help you with?",
        type: "text",
      }]);
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-gray-200 bg-white"
      style={{ width: 380, height: 560 }}
      data-testid="monara-panel"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #ff5a1f 0%, #e84d0e 100%)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-none">Monara</p>
            <p className="text-white/70 text-xs mt-0.5">AI Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewChat}
            title="New conversation"
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3 space-y-1 bg-white">
        {messages.map((msg, i) => (
          <Bubble key={i} msg={msg} />
        ))}
        {streamingText && (
          <div className="flex justify-start px-3 py-1">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm leading-relaxed bg-gray-100 text-gray-800 whitespace-pre-wrap">
              {streamingText}
              <span className="inline-block w-1 h-3.5 bg-gray-400 ml-0.5 animate-pulse align-text-bottom" />
            </div>
          </div>
        )}
        {streaming && !streamingText && (
          <div className="flex justify-start px-3 py-1">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t bg-white px-3 py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Monara anything…"
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300 max-h-24 overflow-y-auto disabled:opacity-50"
            style={{ lineHeight: "1.4" }}
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            data-testid="monara-send-btn"
            className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: "#ff5a1f" }}
          >
            {streaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        {/* Shortcut chip */}
        <div className="mt-1.5">
          <button
            onClick={() => handleShortcut("What can you do?")}
            disabled={streaming}
            data-testid="monara-what-can-you-do-btn"
            className="text-xs px-3 py-1 rounded-full border border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100 disabled:opacity-40 transition-colors"
          >
            What can you do?
          </button>
        </div>
      </div>
    </div>
  );
}
