import React, { useState, useEffect, useRef } from "react";
import { X, Send, Bot } from "lucide-react";
import { toast } from "sonner";
import MonaraMessageBubble from "./MonaraMessageBubble";
import { useAuth } from "@/lib/AuthProvider";

// Global broadcast channel — pages listen to this for Monara-triggered refreshes
export const monaraChannel = new BroadcastChannel("monara_updates");

const INITIAL_MSG = {
  id: "init",
  role: "assistant",
  content: "Hi! I'm **Monara**, your AI assistant. I can help you understand your leads and campaigns. *Note: Full AI features require backend integration.*",
  rich_type: "text",
};

export default function MonaraPanel({ isOpen, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([INITIAL_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");

    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: msg, rich_type: "text" }]);
    setLoading(true);

    // Simulate response for now - Monara integration can be added later
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I received your message. Full AI assistant capabilities will be available once the Monara backend is integrated.",
        rich_type: "text",
      }]);
      setLoading(false);
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ backgroundColor: "#ff5a1f" }}>
        <div className="flex items-center gap-2 text-white">
          <Bot className="w-5 h-5" />
          <span className="font-semibold">Monara AI</span>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map(m => (
          <MonaraMessageBubble key={m.id} message={m} />
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
            <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3 bg-white">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Ask Monara anything..."
            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="p-2 rounded-lg text-white disabled:opacity-50"
            style={{ backgroundColor: "#ff5a1f" }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
