import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Bot, Sparkles, Zap, Users, BarChart3 } from "lucide-react";
import MonaraMessageBubble from "../components/monara/MonaraMessageBubble";

const QUICK_COMMANDS = [
  { label: "Show hot leads", icon: "🔥", query: "Show me all hot leads with AI score 3" },
  { label: "Latest campaign stats", icon: "📊", query: "What are the latest campaign performance stats?" },
  { label: "Approve all pending", icon: "✅", query: "Approve all pending copilot actions" },
  { label: "New signal agent", icon: "⚡", query: "Create a new signal agent for SaaS founders" },
];

export default function CommandCenter() {
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm **Monara**, your AI command center for LeadFlow. I can help you:\n\n• 🔍 **Find & manage leads** — \"Show me hot leads from last week\"\n• 📢 **Control campaigns** — \"Pause the My Campaign\"\n• ✅ **Batch approvals** — \"Approve all pending Healthcare messages\"\n• 📊 **Analytics** — \"How many leads did we generate this week?\"\n• 🤖 **Manage agents** — \"Create a new ICP for SaaS founders\"\n\nWhat would you like to do?",
      rich_type: "text",
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    // Create a new conversation
    base44.entities.MonaraConversation.create({
      title: "Command Center Session",
      source_channel: "web",
      org_id: "default",
    }).then(conv => setConversationId(conv.id)).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput("");

    const userMsg = { id: Date.now().toString(), role: "user", content: msg, rich_type: "text" };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Monara, an AI assistant for a B2B lead generation platform called LeadFlow AI.
        
The platform has these entities: Leads (with name, company, job_title, ai_score 1-3, fit_status), Campaigns (with name, status), SignalAgents (ICP agents), Messages (inbox).

User message: "${msg}"

Respond helpfully as Monara. If the user asks about data, describe what you would show. If they want to create/update/delete something, confirm the action. Keep responses concise and actionable. Use markdown formatting.

If showing leads data, include a note that you can display it as a table.
If showing stats, include relevant numbers.`,
        response_json_schema: {
          type: "object",
          properties: {
            content: { type: "string" },
            rich_type: { type: "string", enum: ["text", "leads_table", "chart", "action_result"] },
            action_taken: { type: "string" },
            data: { type: "object" }
          },
          required: ["content", "rich_type"]
        }
      });

      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.content || "I've processed your request.",
        rich_type: response.rich_type || "text",
        rich_data: response.data,
        action_taken: response.action_taken,
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (conversationId) {
        await base44.entities.MonaraMessage.create({
          conversation_id: conversationId,
          org_id: "default",
          role: "user",
          content: msg,
          source_channel: "web",
        });
        await base44.entities.MonaraMessage.create({
          conversation_id: conversationId,
          org_id: "default",
          role: "assistant",
          content: assistantMsg.content,
          source_channel: "web",
          rich_type: assistantMsg.rich_type,
        });
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: "I'm having trouble processing that request. Please try again.",
        rich_type: "text",
      }]);
    }
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: "#ff5a1f" }}>
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">Monara</h1>
              <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-600 rounded-full font-medium">Command Center</span>
            </div>
            <p className="text-xs text-gray-500">AI-powered control — manage your entire pipeline with natural language</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Leads</span>
          <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> Agents</span>
          <span className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> Analytics</span>
        </div>
      </div>

      {/* Quick commands */}
      <div className="px-6 py-3 bg-white border-b flex items-center gap-2 overflow-x-auto">
        <span className="text-xs text-gray-400 flex-shrink-0">Quick actions:</span>
        {QUICK_COMMANDS.map((cmd, i) => (
          <button
            key={i}
            onClick={() => sendMessage(cmd.query)}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-xs font-medium text-gray-600 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-colors flex-shrink-0"
          >
            <span>{cmd.icon}</span> {cmd.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.map(msg => (
          <MonaraMessageBubble key={msg.id} message={msg} />
        ))}
        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: "#ff5a1f" }}>
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-orange-300 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-2 h-2 rounded-full bg-orange-300 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-2 h-2 rounded-full bg-orange-300 animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 bg-white border-t">
        <div className="flex gap-3 items-end max-w-4xl mx-auto">
          <div className="flex-1 border rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-orange-500 bg-white">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask Monara anything... 'Show hot leads', 'Pause My Campaign', 'How many leads this week?'"
              rows={2}
              className="w-full px-4 py-3 text-sm resize-none focus:outline-none"
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-50 flex-shrink-0"
            style={{ backgroundColor: "#ff5a1f" }}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="text-center text-xs text-gray-400 mt-2">
          Press Enter to send · Shift+Enter for new line · Available on WhatsApp, Slack & Discord
        </div>
      </div>
    </div>
  );
}