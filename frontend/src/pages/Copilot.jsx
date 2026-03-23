import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Check, X, Linkedin, ChevronDown, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

const FireScore = ({ score }) => (
  <span className="flex gap-0.5">
    {[1, 2, 3].map(i => (
      <span key={i} className={i <= score ? "text-sm" : "text-sm opacity-20"}>🔥</span>
    ))}
  </span>
);

export default function Copilot() {
  const [drafts, setDrafts] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [editedBody, setEditedBody] = useState("");
  const [approving, setApproving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.drafts.list({ limit: 50 }).then(data => {
      setDrafts(data);
      if (data.length > 0) {
        setSelectedDraft(data[0]);
        setEditedBody(data[0].body || "");
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Listen for Monara-triggered refreshes
  useEffect(() => {
    const channel = new BroadcastChannel("monara_updates");
    channel.onmessage = (e) => {
      if (e.data?.type === "REFRESH_LEAD_DATA") {
        api.drafts.list({ limit: 50 }).then(data => setDrafts(data)).catch(() => {});
      }
    };
    return () => channel.close();
  }, []);

  const handleSelectDraft = (draft) => {
    setSelectedDraft(draft);
    setEditedBody(draft.body || "");
  };

  const handleApprove = async () => {
    if (!selectedDraft) return;
    setApproving(true);
    try {
      const updated = await api.drafts.update(selectedDraft.id, { body: editedBody, status: "approved" });
      setDrafts(prev => prev.map(d => d.id === selectedDraft.id ? { ...d, status: "approved" } : d));
      setSelectedDraft(prev => ({ ...prev, status: "approved" }));
      toast.success(`Draft approved for ${selectedDraft.lead_name || "lead"}`);
    } catch (e) {
      toast.error("Approval failed");
    }
    setApproving(false);
  };

  const handleRemove = async () => {
    if (!selectedDraft) return;
    try {
      await api.drafts.delete(selectedDraft.id);
      const remaining = drafts.filter(d => d.id !== selectedDraft.id);
      setDrafts(remaining);
      setSelectedDraft(remaining[0] || null);
      setEditedBody(remaining[0]?.body || "");
      toast.info("Draft removed");
    } catch (e) {
      toast.error("Remove failed");
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="w-6 h-6 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">Goji Copilot</h1>
            <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-600 rounded-full font-medium">Beta</span>
          </div>
          <p className="text-sm text-gray-500">Review and approve AI-generated email drafts</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {drafts.length} draft(s)
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Draft List */}
        <div className="w-72 border-r bg-white flex-shrink-0 overflow-y-auto">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">AI Drafts Queue</h3>
              <span className="px-2 py-0.5 text-xs rounded-full text-white font-medium" style={{ backgroundColor: "#ff5a1f" }}>{drafts.filter(d => d.status === 'draft').length} pending</span>
            </div>
            <div className="text-xs text-gray-500">Click a draft to review and approve</div>
          </div>

          <div className="divide-y">
            {drafts.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                No drafts yet.<br />
                <span className="text-xs">Drafts appear when your signal agents capture leads.</span>
              </div>
            ) : drafts.map(draft => (
              <div
                key={draft.id}
                onClick={() => handleSelectDraft(draft)}
                data-testid={`draft-item-${draft.id}`}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedDraft?.id === draft.id ? "bg-orange-50" : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                    style={{ backgroundColor: "#ff5a1f" }}>
                    {(draft.lead_name || "?").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 truncate">{draft.lead_name || "Unknown"}</span>
                      {draft.status === "approved" && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{draft.lead_job_title} · {draft.lead_company}</div>
                    <div className="text-xs mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        draft.status === 'approved' ? 'bg-green-100 text-green-700' :
                        draft.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{draft.status}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        {selectedDraft ? (
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {/* Lead Header */}
            <div className="bg-white rounded-xl border p-5 mb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold"
                    style={{ backgroundColor: "#ff5a1f" }}>
                    {(selectedDraft.lead_name || "?").charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-gray-900">{selectedDraft.lead_name || "Unknown Lead"}</h2>
                      {selectedDraft.lead_linkedin_url && <Linkedin className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div className="text-sm text-gray-500">{selectedDraft.lead_job_title} · {selectedDraft.lead_company}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full capitalize">{selectedDraft.agent_type?.replace(/_/g, " ") || "AI Agent"}</span>
                </div>
              </div>
              {selectedDraft.subject && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">SUBJECT</div>
                  <div className="text-sm text-gray-800 font-medium">{selectedDraft.subject}</div>
                </div>
              )}
            </div>

            {/* Email Draft */}
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">AI-Generated Email</h3>
                  <p className="text-xs text-gray-500">Edit the message before approving</p>
                </div>
              </div>

              <textarea
                className="w-full text-sm text-gray-700 border rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-orange-500 min-h-40"
                value={editedBody}
                onChange={e => setEditedBody(e.target.value)}
                data-testid="draft-body-editor"
              />

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleApprove}
                  disabled={approving || selectedDraft.status === "approved"}
                  data-testid="approve-draft-btn"
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedDraft.status === "approved"
                      ? "bg-green-100 text-green-700"
                      : "bg-green-500 hover:bg-green-600 text-white"
                  }`}
                >
                  {selectedDraft.status === "approved" ? (
                    <><Check className="w-4 h-4" /> Approved</>
                  ) : (
                    <><Check className="w-4 h-4" /> {approving ? "Approving..." : "Approve"}</>
                  )}
                </button>
                <button
                  onClick={handleRemove}
                  data-testid="remove-draft-btn"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border text-gray-600 hover:bg-gray-50"
                >
                  <X className="w-4 h-4" /> Remove
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <button className="px-3 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50">Export</button>
                  <button className="w-8 h-8 flex items-center justify-center border rounded-lg text-gray-600 hover:bg-gray-50">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">📧</div>
              <p className="font-medium">No drafts to review</p>
              <p className="text-xs text-gray-400 mt-1">Drafts will appear here when your signal agents capture leads</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}