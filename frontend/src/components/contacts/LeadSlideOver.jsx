import React, { useState } from "react";
import { api } from "@/api/client";
import { X, Mail, Copy, ChevronDown, ChevronUp, Check, HelpCircle, Trash2, Download, Linkedin, Clock } from "lucide-react";
import { toast } from "sonner";

const Section = ({ icon, title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          {icon}
          {title}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
};

const InfoRow = ({ label, value, isLink }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-sm text-gray-500">{label}</span>
    {isLink ? (
      <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 flex items-center gap-1 max-w-[200px] truncate">
        {value}
        <Copy className="w-3 h-3 flex-shrink-0" />
      </a>
    ) : (
      <span className="text-sm text-gray-800">{value || "—"}</span>
    )}
  </div>
);

export default function LeadSlideOver({ lead, onClose, onUpdate, onDelete }) {
  const [notes, setNotes] = useState(lead.internal_notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingFit, setUpdatingFit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    // TODO: Implement notes API
    toast.success("Notes saved");
    onUpdate({ ...lead, internal_notes: notes });
    setSavingNotes(false);
  };

  const handleFitUpdate = async (fit) => {
    setUpdatingFit(true);
    // TODO: Implement fit update API
    onUpdate({ ...lead, fit_status: fit });
    setUpdatingFit(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${lead.name}? This cannot be undone.`)) return;
    setDeleting(true);
    // TODO: Implement delete API
    toast.success("Lead deleted");
    onDelete(lead.id);
    onClose();
  };

  const signal = lead.intent_signal_data || {};
  const campaignHistory = lead.campaign_history || [];
  const activityLog = lead.activity_log || [];

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[420px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden bg-orange-100 flex items-center justify-center">
                {lead.avatar_url
                  ? <img src={lead.avatar_url} alt={lead.name} className="w-full h-full object-cover" />
                  : <span className="text-lg font-semibold text-orange-600">{lead.name?.charAt(0)}</span>
                }
              </div>
              <div>
                <div className="font-bold text-gray-900 flex items-center gap-1.5">
                  {lead.name}
                  {lead.is_hot && <span>🔥</span>}
                  {lead.linkedin_url && (
                    <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer">
                      <Linkedin className="w-4 h-4 text-blue-600" />
                    </a>
                  )}
                </div>
                <div className="text-sm text-gray-500">{lead.job_title} @ {lead.company}</div>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5">
              <X className="w-5 h-5" />
            </button>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100">
            <Mail className="w-3 h-3" /> Find email
          </button>
        </div>

        {/* Signal tags */}
        {(signal.category || signal.keyword) && (
          <div className="px-5 py-3 flex items-center gap-2 flex-wrap border-b bg-gray-50">
            {signal.category && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">{signal.category}</span>
            )}
            {signal.keyword && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">🎯 "{signal.keyword}"</span>
            )}
            {signal.signal_type && (
              <span className="text-xs text-gray-500">
                Just engaged with a{" "}
                {signal.source_url
                  ? <a href={signal.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{signal.signal_type}</a>
                  : <span className="text-blue-600">{signal.signal_type}</span>
                }
              </span>
            )}
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Campaign Sequence */}
          {campaignHistory.length > 0 && (
            <div className="border-b px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <span>≡</span> Campaign Sequence
                </div>
                <span className="text-xs text-orange-500 font-medium cursor-pointer">{campaignHistory[0]?.campaign_name} »</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {(campaignHistory[0]?.steps || [{ type: "Invitation" }, { type: "Message" }, { type: "Message" }]).map((step, i, arr) => (
                  <React.Fragment key={i}>
                    <div className="flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs text-gray-600 bg-gray-50 cursor-pointer hover:bg-gray-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      {step.type || step.name || "Step"}
                    </div>
                    {i < arr.length - 1 && <span className="text-gray-400 text-xs">›</span>}
                  </React.Fragment>
                ))}
              </div>
              <div className="text-xs text-gray-400 mt-2">Click a step to see message details</div>
            </div>
          )}

          {/* Basic Info */}
          <Section icon={<span className="text-gray-500">👤</span>} title="Basic Information" defaultOpen={true}>
            <InfoRow label="Industry" value={lead.industry} />
            <InfoRow label="Company Size" value={lead.company_size} />
            <InfoRow label="Company URL" value={lead.company_url || lead.website} isLink={!!(lead.company_url || lead.website)} />
            <InfoRow label="Location" value={lead.location ? `🏳️ ${lead.location}` : null} />
          </Section>

          {/* Other Info */}
          <Section icon={<span className="text-gray-500">📋</span>} title="Other information">
            <div className="space-y-2">
              <div className="text-xs text-gray-500 font-medium">Profile Baseline</div>
              <p className="text-sm text-gray-700 leading-relaxed">{lead.profile_baseline || "No profile baseline available."}</p>
            </div>
          </Section>

          {/* Internal Notes */}
          <Section icon={<span className="text-gray-500">✏️</span>} title="Internal Notes">
            <div className="space-y-2">
              <div className="text-xs text-gray-500 font-medium">Your Notes</div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add your personal notes about this contact..."
                className="w-full text-sm border rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-orange-400 text-gray-700"
                rows={4}
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: "#ff5a1f" }}
                >
                  {savingNotes ? "Saving..." : <><span>💾</span> Save</>}
                </button>
              </div>
            </div>
          </Section>

          {/* Activity Logs */}
          <Section icon={<Clock className="w-4 h-4 text-gray-500" />} title="Activity Logs">
            {activityLog.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No activity logs yet</p>
            ) : (
              <div className="space-y-3">
                {activityLog.map((log, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-700">{log.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{log.timestamp ? new Date(log.timestamp).toLocaleString() : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFitUpdate("good")}
              disabled={updatingFit}
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${lead.fit_status === "good" ? "bg-green-500 border-green-500 text-white" : "border-green-400 text-green-600 hover:bg-green-50"}`}
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleFitUpdate("maybe")}
              disabled={updatingFit}
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${lead.fit_status === "maybe" ? "bg-yellow-500 border-yellow-500 text-white" : "border-yellow-400 text-yellow-600 hover:bg-yellow-50"}`}
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleFitUpdate("bad")}
              disabled={updatingFit}
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${lead.fit_status === "bad" ? "bg-red-500 border-red-500 text-white" : "border-red-400 text-red-600 hover:bg-red-50"}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Export <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}