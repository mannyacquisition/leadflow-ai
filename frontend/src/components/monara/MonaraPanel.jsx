import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { X, Send, Bot } from "lucide-react";
import { toast } from "sonner";
import MonaraMessageBubble from "./MonaraMessageBubble";

// Global broadcast channel — pages listen to this for Monara-triggered refreshes
export const monaraChannel = new BroadcastChannel("monara_updates");

const INITIAL_MSG = {
  id: "init",
  role: "assistant",
  content: "Hi! I'm **Monara**. Ask me anything about your leads, campaigns, or performance. I can also execute actions directly.",
  rich_type: "text",
};

export default function MonaraPanel({ isOpen, onClose }) {
  const [messages, setMessages] = useState([INITIAL_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (isOpen && !conversationId) {
      base44.auth.me().then(user => {
        // Pass user identifiers; proxy will auto-resolve org_id server-side
        return base44.functions.invoke("monaraProxy", {
          action: "create_conversation",
          user_id: user?.id || user?.email,
          // org_id resolved server-side from authenticated session
        });
      }).then(res => {
        if (res.data?.id) setConversationId(res.data.id);
      }).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");

    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: msg, rich_type: "text" }]);
    setLoading(true);

    try {
      const res = await base44.functions.invoke("monaraProxy", {
        action: "send_message",
        conversation_id: conversationId,
        message: msg,
      });
      const assistant = res.data?.latest_assistant_message;
      const content = assistant?.content || "Done!";
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content,
        rich_type: "text",
      }]);
      // Broadcast to any listening pages so they re-fetch fresh data
      monaraChannel.postMessage({ type: "REFRESH_LEAD_DATA" });
    } catch (e) {
      const errMsg = e?.message || "Unknown error";
      toast.error(`Monara error: ${errMsg}`);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: "Sorry, I couldn't process that. Try again.",
        rich_type: "text",
      }]);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-96 bg-white border-l shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ backgroundColor: "#1a1f2b" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: "#ff5a1f" }}>
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm">Monara AI</div>
            <div className="text-gray-400 text-xs">Always on · Omnichannel</div>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map(msg => (
          <MonaraMessageBubble key={msg.id} message={msg} />
        ))}
        {loading && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: "#ff5a1f" }}>
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-white border rounded-2xl px-3 py-2 flex gap-1">
              {[0, 150, 300].map(d => (
                <div key={d} className="w-1.5 h-1.5 rounded-full bg-orange-300 animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t bg-white">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask Monara anything..."
            className="flex-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-50 flex-shrink-0"
            style={{ backgroundColor: "#ff5a1f" }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}