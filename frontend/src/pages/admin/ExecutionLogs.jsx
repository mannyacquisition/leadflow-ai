import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Activity, RefreshCw, CheckCircle, AlertCircle, Loader2, Clock, ChevronRight, User } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS = {
  completed: { text: "text-green-400", bg: "bg-green-900/30", icon: <CheckCircle className="w-4 h-4 text-green-400" /> },
  running: { text: "text-blue-400", bg: "bg-blue-900/30", icon: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> },
  failed: { text: "text-red-400", bg: "bg-red-900/30", icon: <AlertCircle className="w-4 h-4 text-red-400" /> },
  pending_human_approval: { text: "text-yellow-400", bg: "bg-yellow-900/30", icon: <User className="w-4 h-4 text-yellow-400" /> },
};

export default function ExecutionLogs() {
  const [threads, setThreads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [approving, setApproving] = useState(false);

  const load = () => {
    setLoading(true);
    const params = statusFilter !== "all" ? `?status=${statusFilter}&limit=50` : "?limit=50";
    api.request(`/admin/orchestration/threads${params}`).then(setThreads).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const loadDetail = async (id) => {
    setSelected(id);
    const data = await api.request(`/admin/executions/${id}`).catch(() => null);
    setDetail(data);
  };

  const handleHITL = async (threadId, decision) => {
    setApproving(true);
    try {
      await api.request(`/admin/orchestration/threads/${threadId}/approve`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      toast.success(`Thread ${decision}`);
      load();
      if (selected === threadId) {
        loadDetail(threadId);
      }
    } catch (e) {
      toast.error("Failed: " + e.message);
    }
    setApproving(false);
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Execution Logs</h1>
          <p className="text-gray-400 text-sm mt-1">Multi-agent thread audit trail and HITL management</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg">
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-1 mb-4">
        {["all", "running", "completed", "failed", "pending_human_approval"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors capitalize ${statusFilter === s ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Thread List */}
        <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-600 mx-auto" /></div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Activity className="w-8 h-8 mx-auto mb-2 text-gray-700" />
              <p className="text-sm">No execution threads yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {threads.map(t => {
                const sc = STATUS_COLORS[t.status] || STATUS_COLORS.running;
                return (
                  <div key={t.id} onClick={() => loadDetail(t.id)}
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-800/50 transition-colors ${selected === t.id ? "bg-gray-800" : ""}`}>
                    <div className="flex items-center gap-3">
                      {sc.icon}
                      <div>
                        <div className="text-xs font-mono text-gray-300">{t.id.slice(0, 20)}...</div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {t.signal_category || "manual"} • {t.total_tokens_used || 0} tokens
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.status === "pending_human_approval" && (
                        <span className="px-2 py-0.5 bg-yellow-900/50 text-yellow-400 text-xs rounded-full font-medium">HITL</span>
                      )}
                      <span className={`text-xs capitalize ${sc.text}`}>{t.status?.replace(/_/g, " ")}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {detail && (
          <div className="w-96 bg-gray-900 rounded-xl border border-gray-800 p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white text-sm">Thread Detail</h3>
              <button onClick={() => { setDetail(null); setSelected(null); }} className="text-gray-600 hover:text-white">
                <AlertCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">Status</div>
                <span className={`text-xs font-medium capitalize ${(STATUS_COLORS[detail.status] || {}).text || "text-gray-400"}`}>
                  {detail.status?.replace(/_/g, " ")}
                </span>
              </div>

              {detail.status === "pending_human_approval" && (
                <div className="bg-yellow-900/20 rounded-lg p-3 border border-yellow-800">
                  <p className="text-xs text-yellow-300 mb-2">Human approval required at HITL gate.</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleHITL(detail.id, "approved")} disabled={approving}
                      className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-medium">
                      Approve
                    </button>
                    <button onClick={() => handleHITL(detail.id, "rejected")} disabled={approving}
                      className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg font-medium">
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {detail.final_output && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Final Output</div>
                  <div className="bg-gray-800 rounded p-2 text-xs text-gray-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {detail.final_output}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs text-gray-500 mb-1">Message History ({detail.message_history?.length || 0} steps)</div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {(detail.message_history || []).map((m, i) => (
                    <div key={i} className={`text-xs rounded p-2 ${m.role === "user" ? "bg-gray-800 text-gray-300" : "bg-purple-900/20 text-purple-200"}`}>
                      <span className="font-semibold capitalize">{m.role}: </span>
                      <span className="text-gray-400 line-clamp-3">{String(m.content || "").slice(0, 200)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-xs text-gray-600">
                Tokens: {detail.total_tokens_used || 0} • {detail.created_at ? new Date(detail.created_at).toLocaleString() : ""}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
