import React, { useState, useEffect, useRef } from "react";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthProvider";
import { Send, Search, Filter, Edit, Linkedin, Globe, Loader2, Bot, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function Unibox() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [messagesByLead, setMessagesByLead] = useState({});
  const [selectedLead, setSelectedLead] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedLead, messagesByLead]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load leads and drafts - show drafts as "conversations"
      const [allDrafts, allLeads] = await Promise.all([
        api.drafts.list({ limit: 200 }),
        api.leads.list({ limit: 200 }),
      ]);

      // Build lead map
      const leadMap = {};
      for (const l of allLeads) leadMap[l.id] = l;

      // Group drafts by lead_id as "messages"
      const byLead = {};
      for (const draft of allDrafts) {
        const key = draft.lead_id;
        if (!byLead[key]) byLead[key] = [];
        byLead[key].push({
          id: draft.id,
          lead_id: draft.lead_id,
          sender_name: "AI Agent",
          recipient_name: draft.lead_name,
          body: `Subject: ${draft.subject || "(no subject)"}\n\n${draft.body}`,
          direction: "outbound",
          created_date: draft.created_at,
          is_read: true,
          status: draft.status,
        });
      }

      // Build conversation leads list
      const leadsWithDrafts = allDrafts
        .map(d => d.lead_id)
        .filter((id, i, arr) => arr.indexOf(id) === i)
        .map(id => {
          const d = allDrafts.find(d => d.lead_id === id);
          return leadMap[id] || {
            id,
            name: d?.lead_name || "Unknown",
            job_title: d?.lead_job_title,
            company: d?.lead_company,
            linkedin_url: d?.lead_linkedin_url,
          };
        });

      setMessagesByLead(byLead);
      setLeads(leadsWithDrafts);
      if (leadsWithDrafts.length > 0 && !selectedLead) {
        setSelectedLead(leadsWithDrafts[0]);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedLead || sending) return;
    setSending(true);
    const optimisticMsg = {
      id: `opt-${Date.now()}`,
      lead_id: selectedLead.id,
      sender_name: user?.full_name || "You",
      body: newMessage.trim(),
      direction: "outbound",
      created_date: new Date().toISOString(),
      is_read: true,
    };
    setMessagesByLead(prev => ({
      ...prev,
      [selectedLead.id]: [...(prev[selectedLead.id] || []), optimisticMsg],
    }));
    setNewMessage("");
    toast.success("Message queued (send functionality coming soon)");
    setSending(false);
  };

  const filteredLeads = leads.filter(l =>
    !searchTerm ||
    l.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentMessages = selectedLead ? (messagesByLead[selectedLead.id] || []) : [];
  const latestMessage = currentMessages[currentMessages.length - 1];
  const hasUnread = currentMessages.some(m => m.direction === "inbound" && !m.is_read);

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diffH = (now - d) / 3600000;
    if (diffH < 1) return "Just now";
    if (diffH < 24) return `${Math.floor(diffH)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Unibox</h1>
          <p className="text-sm text-gray-500">Unified inbox — all real conversations</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 rounded-lg border text-gray-500 hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs">
              {user?.full_name?.charAt(0) || "U"}
            </div>
            {user?.full_name || "You"} ▾
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Conversation List */}
        <div className="w-64 border-r bg-white flex flex-col flex-shrink-0">
          <div className="p-3 border-b space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-gray-900">Conversations</span>
              <div className="flex gap-2 text-gray-400">
                <Filter className="w-4 h-4 cursor-pointer hover:text-gray-600" />
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                className="w-full pl-7 pr-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="Search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="text-xs text-gray-400">{filteredLeads.length} conversation(s)</div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-4 text-sm text-gray-400 text-center">
                No conversations yet.<br />
                <span className="text-xs">Messages will appear here when leads reply or drafts are created.</span>
              </div>
            ) : filteredLeads.map(lead => {
              const msgs = messagesByLead[lead.id] || [];
              const latest = msgs[msgs.length - 1];
              const isSelected = selectedLead?.id === lead.id;
              const unread = msgs.some(m => m.direction === "inbound" && !m.is_read);
              const isMonara = latest?.sender_name === "Monara AI";

              return (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={`p-3 flex items-start gap-2.5 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                    isSelected ? "bg-orange-50 border-l-2 border-l-orange-500" : ""
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${isMonara ? "bg-orange-500" : "bg-orange-400"}`}>
                    {isMonara ? <Bot className="w-4 h-4" /> : lead.name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate ${unread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                        {lead.name}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-1">
                        {formatTime(latest?.created_date)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                      {unread && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />}
                      {latest?.body?.substring(0, 50) || "No messages"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Middle: Chat */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {!selectedLead ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">💬</div>
                <p className="font-medium">Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 bg-white border-b flex items-center gap-2">
                <span className="font-semibold text-gray-900">{selectedLead.name}</span>
                {selectedLead.linkedin_url && <Linkedin className="w-4 h-4 text-blue-600" />}
                <span className="text-xs text-gray-400">{currentMessages.length} message(s)</span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {currentMessages.map((msg, idx) => {
                  const isMonara = msg.sender_name === "Monara AI";
                  return (
                    <div key={msg.id || idx} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-lg">
                        <div className="flex items-center gap-2 mb-1 text-xs text-gray-400">
                          {isMonara && <Bot className="w-3 h-3 text-orange-500" />}
                          <span>{formatTime(msg.created_date)}</span>
                          <span className="font-medium">{msg.sender_name}</span>
                        </div>
                        <div className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                          msg.direction === "outbound"
                            ? isMonara
                              ? "bg-orange-500 text-white"
                              : "bg-orange-50 text-gray-800 border border-orange-100"
                            : "bg-white text-gray-800 border"
                        }`}>
                          {msg.body}
                        </div>
                        {msg.id?.startsWith("opt-") && (
                          <div className="text-xs text-gray-400 mt-1 text-right">Sending...</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="bg-white border-t p-3">
                <div className="border rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-orange-500">
                  <textarea
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type a reply..."
                    rows={3}
                    className="w-full px-4 pt-3 pb-1 text-sm resize-none focus:outline-none"
                    onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleSend(); }}
                  />
                  <div className="flex items-center justify-between px-3 pb-2">
                    <div className="flex gap-2 text-gray-400 text-xs">
                      <span title="Attach">📎</span>
                      <span title="Voice">🎤</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Ctrl ↵</span>
                      <button
                        onClick={handleSend}
                        disabled={!newMessage.trim() || sending}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white disabled:opacity-50"
                        style={{ backgroundColor: "#ff5a1f" }}
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: Contact Info */}
        {selectedLead && (
          <div className="w-64 border-l bg-white overflow-y-auto flex-shrink-0">
            <div className="p-5">
              <h3 className="font-semibold text-gray-900 mb-1">Contact Information</h3>
              <p className="text-xs text-gray-400 mb-4">{selectedLead.company || "—"}</p>

              <div className="flex flex-col items-center mb-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-semibold mb-3"
                  style={{ backgroundColor: "#ff5a1f" }}>
                  {selectedLead.name?.charAt(0) || "?"}
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-900 flex items-center gap-1 justify-center">
                    {selectedLead.name}
                    {selectedLead.linkedin_url && <Linkedin className="w-3 h-3 text-blue-600" />}
                  </div>
                  <div className="text-xs text-gray-500">{selectedLead.job_title || "—"}</div>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                {selectedLead.company && (
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-semibold">COMPANY</div>
                    <div className="font-medium text-gray-800">{selectedLead.company}</div>
                    {selectedLead.company_size && <div className="text-xs text-gray-500">{selectedLead.company_size}</div>}
                  </div>
                )}
                {selectedLead.signal_source && (
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-semibold">SIGNAL</div>
                    <div className="text-xs text-blue-600">{selectedLead.signal_source}</div>
                  </div>
                )}
                {selectedLead.industry && (
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-semibold">INDUSTRY</div>
                    <div className="text-xs text-gray-700">{selectedLead.industry}</div>
                  </div>
                )}
                {selectedLead.location && (
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-semibold">LOCATION</div>
                    <div className="text-xs text-gray-700">{selectedLead.location}</div>
                  </div>
                )}
                {selectedLead.website && (
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-semibold">WEBSITE</div>
                    <a href={selectedLead.website} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-orange-500 flex items-center gap-1">
                      <Globe className="w-3 h-3" /> {selectedLead.website?.replace("https://", "")}
                    </a>
                  </div>
                )}
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-semibold">STATUS</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    selectedLead.status === "contacted" ? "bg-green-100 text-green-700" :
                    selectedLead.status === "approved" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {selectedLead.status || "pending"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}