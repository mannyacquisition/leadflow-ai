import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Settings, MoreVertical, Pencil, Copy, Trash2, PauseCircle, Calendar, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import ManageAddonsModal from "@/components/signalagents/ManageAddonsModal";
import HowItWorksModal from "@/components/signalagents/HowItWorksModal";
import AgentWizard from "./AgentWizard";

// ── Signal count helper ──────────────────────────────────────────────────────
function countSignals(agent) {
  let n = 0;
  if (agent.linkedin_page_url) n++;
  if (agent.linkedin_profile_url) n++;
  if (agent.track_profile_visitors) n++;
  if (agent.company_followers_url) n++;
  if (agent.track_top_profiles) n++;
  if (agent.track_funding_events) n++;
  if (agent.track_job_changes) n++;
  n += (agent.keywords || []).length;
  n += (agent.influencer_urls || []).length;
  n += (agent.competitor_urls || []).length;
  return n;
}

// ── 3-dot Actions Menu ───────────────────────────────────────────────────────
function ActionsMenu({ agent, onEdit, onRefresh }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handlePause = async () => {
    const newStatus = agent.status === "active" ? "paused" : "active";
    await base44.entities.SignalAgent.update(agent.id, { status: newStatus });
    toast.success(`Agent ${newStatus === "active" ? "resumed" : "paused"}`);
    onRefresh();
    setOpen(false);
  };

  const handleDuplicate = async () => {
    const { id, created_date, updated_date, created_by, ...rest } = agent;
    await base44.entities.SignalAgent.create({ ...rest, name: `${agent.name} (Copy)` });
    toast.success("Agent duplicated");
    onRefresh();
    setOpen(false);
  };

  const handleDelete = async () => {
    await base44.entities.SignalAgent.delete(agent.id);
    toast.success("Agent deleted");
    onRefresh();
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 w-44 bg-white border rounded-xl shadow-lg z-30 py-1 overflow-hidden">
          <button
            onClick={handlePause}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <PauseCircle className="w-4 h-4 text-gray-400" />
            {agent.status === "active" ? "Pause Agent" : "Resume Agent"}
          </button>
          <button
            onClick={handleDuplicate}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Copy className="w-4 h-4 text-gray-400" />
            Duplicate
          </button>
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete Agent
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function SignalsAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddons, setShowAddons] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [wizardMode, setWizardMode] = useState(null); // null | "create" | { agent }

  const fetchAgents = () => {
    setLoading(true);
    base44.entities.SignalAgent.list("-created_date", 50)
      .then(setAgents)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAgents(); }, []);

  const activeAgent = agents.find(a => a.status === "active");

  // Show wizard
  if (wizardMode) {
    return (
      <AgentWizard
        editingAgent={wizardMode === "create" ? null : wizardMode}
        initialForm={wizardMode === "create" ? null : {
          name: wizardMode.name,
          target_job_titles: wizardMode.target_job_titles || [],
          target_locations: wizardMode.target_locations || [],
          target_industries: wizardMode.target_industries || [],
          company_sizes: wizardMode.company_sizes || [],
          excluded_keywords: wizardMode.excluded_keywords || [],
          lead_matching_mode: wizardMode.lead_matching_mode ?? 80,
          linkedin_page_url: wizardMode.linkedin_page_url || "",
          linkedin_profile_url: wizardMode.linkedin_profile_url || "",
          track_profile_visitors: !!wizardMode.track_profile_visitors,
          track_job_changes: !!wizardMode.track_job_changes,
          track_funding_events: !!wizardMode.track_funding_events,
          track_top_profiles: !!wizardMode.track_top_profiles,
          profile_visitors_account: wizardMode.profile_visitors_account || "first",
          company_followers_url: wizardMode.company_followers_url || "",
          company_followers_account: wizardMode.company_followers_account || "first",
          keywords: wizardMode.keywords || [],
          influencer_urls: wizardMode.influencer_urls || [],
          competitor_urls: wizardMode.competitor_urls || [],
        }}
        onSaved={() => { setWizardMode(null); fetchAgents(); }}
        onCancel={() => setWizardMode(null)}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-5 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Signals Agents</h1>
            {/* Usage badge */}
            <button
              onClick={() => setShowAddons(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-white hover:bg-gray-50 text-xs font-medium"
            >
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-gray-700">{agents.length} | 2 max</span>
              <Settings className="w-3 h-3 text-gray-400" />
            </button>
            {/* How it works */}
            <button
              onClick={() => setShowHowItWorks(true)}
              className="flex items-center gap-1 px-3 py-1 border rounded-full text-xs font-medium text-orange-500 border-orange-200 hover:bg-orange-50"
            >
              ⓘ HOW IT WORKS?
            </button>
          </div>
          <button
            onClick={() => setWizardMode("create")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold"
            style={{ backgroundColor: "#ff5a1f" }}
          >
            <Plus className="w-4 h-4" />
            Launch Agent
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">Manage your automated lead generation agents & signals</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Active agent card */}
        {activeAgent && (
          <div className="border-2 rounded-xl p-5 max-w-sm" style={{ borderColor: "#e5e7eb" }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
                <span className="text-sm">🤖</span>
              </div>
              <span className="font-semibold text-sm text-gray-800">AI Agent</span>
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Active</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">Started a few seconds ago</p>
            {activeAgent.track_job_changes && (
              <p className="text-sm text-gray-700">Type: <span className="text-orange-500 font-medium">Recently changed jobs</span></p>
            )}
            {(activeAgent.keywords || []).length > 0 && (
              <p className="text-sm text-gray-700 mt-1">
                Keyword: {activeAgent.keywords.map(k => `"${k.text}"`).join(" OR ")}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
              <span className="flex gap-0.5">
                {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}
              </span>
              <span>Hunting for high-quality leads...</span>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">AGENT NAME</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">SIGNALS</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-5 py-3">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : agents.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-gray-400 text-sm">No agents yet. Launch your first one!</td>
                </tr>
              ) : (
                agents.map(agent => (
                  <tr key={agent.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-sm">🤖</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-900">{agent.name}</span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${agent.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                              {agent.status === "active" ? "Active" : "Paused"}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <Loader2 className="w-3 h-3 animate-spin" /> Collecting leads...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-3 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
                        {countSignals(agent)} signals
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                          <Calendar className="w-3.5 h-3.5" /> Next launches
                        </button>
                        <button
                          onClick={() => setWizardMode(agent)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-orange-50"
                          style={{ color: "#ff5a1f", borderColor: "#ff5a1f" }}
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <ActionsMenu agent={agent} onEdit={() => setWizardMode(agent)} onRefresh={fetchAgents} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Launch CTA row */}
          <div className="border-t bg-orange-50 py-4 flex justify-center">
            <button
              onClick={() => setWizardMode("create")}
              className="flex items-center gap-2 text-sm font-semibold text-orange-500 hover:text-orange-600"
            >
              <Plus className="w-4 h-4" /> Launch Agent
            </button>
          </div>
        </div>

        {/* See previous launches */}
        <div className="text-center">
          <button className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mx-auto">
            See previous launches ▾
          </button>
        </div>
      </div>

      {/* Modals */}
      {showAddons && <ManageAddonsModal agentCount={agents.length} onClose={() => setShowAddons(false)} />}
      {showHowItWorks && <HowItWorksModal onClose={() => setShowHowItWorks(false)} />}
    </div>
  );
}