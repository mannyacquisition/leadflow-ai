import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Play, Pause, ChevronRight, ArrowRight, Check, LayoutList } from "lucide-react";
import { toast } from "sonner";

// Default workflow steps for campaigns that don't have them stored
const defaultSteps = [
  { type: "invitation", label: "Send Invitation", step: 1, contacts: 116, accepted: 49 },
  { type: "message", label: "Send Message", step: 2, contacts: 40, answered: 13, note: "AI Icebreaker" },
  { type: "message", label: "Send Message", step: 3, contacts: 23, answered: 2, note: "Follow-up message" },
];

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [activeTab, setActiveTab] = useState("workflow");
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(true);

  useEffect(() => {
    base44.entities.Campaign.list("-created_date", 50).then(data => {
      setCampaigns(data);
      if (data.length > 0) setSelectedCampaign(data[0]);
      setLoading(false);
    }).catch(() => { setCampaigns([]); setLoading(false); });
  }, []);

  const toggleStatus = async (campaign) => {
    const newStatus = campaign.status === "active" ? "paused" : "active";
    await base44.entities.Campaign.update(campaign.id, { status: newStatus });
    const updated = campaigns.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c);
    setCampaigns(updated);
    if (selectedCampaign?.id === campaign.id) setSelectedCampaign(prev => ({ ...prev, status: newStatus }));
    toast.success(`Campaign ${newStatus}`);
  };

  const tabs = ["Workflow", "Scheduled (21)", "Contacts", "Last Launches", "Insights", "Settings"];

  const steps = selectedCampaign?.workflow_steps?.length > 0 ? selectedCampaign.workflow_steps : defaultSteps;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="w-6 h-6 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {selectedCampaign ? `Campaign – ${selectedCampaign.name} ✏️` : "Campaigns"}
          </h1>
          <p className="text-sm text-gray-500">Manage your campaign workflow and contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowList(!showList)}
            className={`px-3 py-1.5 text-sm rounded-lg border flex items-center gap-1.5 transition-colors ${showList ? "bg-gray-100 text-gray-700" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <LayoutList className="w-4 h-4" /> All Campaigns
          </button>
          <button className="px-3 py-1.5 text-sm rounded-lg text-white font-medium flex items-center gap-1.5" style={{ backgroundColor: "#ff5a1f" }}>
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Campaign List */}
        {showList && (
          <div className="w-60 border-r bg-white flex-shrink-0 flex flex-col">
            <div className="p-3 border-b">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaigns ({campaigns.length})</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {campaigns.length === 0 ? (
                <div className="p-4 text-sm text-gray-400 text-center">No campaigns yet</div>
              ) : campaigns.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedCampaign(c)}
                  className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedCampaign?.id === c.id ? "bg-orange-50 border-l-2 border-l-orange-500" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate">{c.name}</span>
                    <span className={`ml-1 flex-shrink-0 w-2 h-2 rounded-full ${c.status === "active" ? "bg-green-500" : c.status === "paused" ? "bg-yellow-400" : "bg-gray-300"}`} />
                  </div>
                  <div className="text-xs text-gray-500 capitalize">{c.status || "draft"}</div>
                  {c.contacts_count && <div className="text-xs text-gray-400">{c.contacts_count} contacts</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Right: Campaign Detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedCampaign ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">📣</div>
                <p className="font-medium">Select a campaign to view details</p>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="px-6 bg-white border-b">
                <div className="flex gap-1">
                  {tabs.map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab.toLowerCase().replace(/\s+/g, ""))}
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.toLowerCase().replace(/\s+/g, "")
                          ? "border-orange-500 text-orange-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {tab.includes("Workflow") && "🔄 "}{tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-auto p-6 bg-gray-50">
                <div className="bg-white rounded-xl border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="font-semibold text-gray-900">Campaign Workflow</h2>
                      <p className="text-sm text-gray-500">Design and manage your campaign automation steps</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${selectedCampaign.status === "active" ? "bg-green-500" : "bg-yellow-400"}`}></span>
                          Campaign is {selectedCampaign.status || "draft"}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleStatus(selectedCampaign)}
                        className="px-3 py-1.5 text-sm border rounded-lg flex items-center gap-1.5 hover:bg-orange-50 text-orange-600 border-orange-200"
                      >
                        {selectedCampaign.status === "active"
                          ? <><Pause className="w-4 h-4" /> Pause</>
                          : <><Play className="w-4 h-4" /> Resume</>}
                      </button>
                    </div>
                  </div>

                  {/* Sender info */}
                  <div className="flex items-center gap-4 mb-8 pb-4 border-b text-sm text-gray-600">
                    <span>Sender:</span>
                    <span className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs">
                        {(selectedCampaign.sender_name || "M").charAt(0)}
                      </div>
                      {selectedCampaign.sender_name || "—"}
                    </span>
                    <span className="flex items-center gap-1.5 text-green-600"><span className="w-2 h-2 rounded-full bg-green-500"></span> Connected</span>
                    <div className="ml-auto flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        {selectedCampaign.invitations_sent || 0} invitation(s)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                        {selectedCampaign.messages_sent || 0} message(s)
                      </span>
                    </div>
                  </div>

                  {/* Workflow diagram */}
                  <div className="flex items-start gap-4 overflow-x-auto pb-4">
                    {/* Input source */}
                    <div className="flex-shrink-0 w-44">
                      <div className="bg-gray-700 rounded-xl p-4 text-white text-center">
                        <div className="w-8 h-8 rounded-full bg-gray-500 mx-auto mb-2 flex items-center justify-center">⚙️</div>
                        <div className="text-sm font-medium">Input source</div>
                        <div className="mt-2 text-xs bg-gray-600 rounded p-1">{selectedCampaign.agent_id ? "Signal Agent" : "Manual List"}</div>
                        <div className="text-xs text-gray-400 mt-1">Running ●</div>
                        <div className="text-xs text-gray-400">{selectedCampaign.contacts_count || 0} contacts</div>
                      </div>
                    </div>

                    <div className="flex items-center mt-16"><ArrowRight className="w-5 h-5 text-blue-400" /></div>

                    {/* Steps */}
                    {steps.map((step, idx) => (
                      <React.Fragment key={idx}>
                        <div className="flex-shrink-0 w-44">
                          <div className={`rounded-xl p-4 text-white text-center ${step.type === "invitation" ? "bg-purple-500" : "bg-blue-500"}`}>
                            <div className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-1">
                              {step.type === "invitation" ? "🔵" : "✉️"} {step.label}
                            </div>
                            <div className="text-xs opacity-80">Step {step.step}</div>
                            {step.note && <div className="text-xs bg-white/20 rounded p-1 mt-2 text-left">{String(step.note).substring(0, 40)}</div>}
                            <div className="mt-3 grid grid-cols-2 gap-1 text-xs">
                              <div className="bg-white/20 rounded p-1">
                                <div className="font-semibold">{step.contacts || 0}</div>
                                <div className="opacity-80">contacts</div>
                              </div>
                              <div className="bg-white/20 rounded p-1">
                                <div className="font-semibold">{step.accepted || step.answered || 0}</div>
                                <div className="opacity-80">{step.accepted !== undefined ? "accepted" : "answer"}</div>
                              </div>
                            </div>
                            <div className="flex gap-1 mt-2">
                              <button className="flex-1 bg-white/20 rounded text-xs py-0.5 hover:bg-white/30">View</button>
                              <button className="flex-1 bg-white/20 rounded text-xs py-0.5 hover:bg-white/30">Edit</button>
                            </div>
                          </div>
                        </div>
                        {idx < steps.length - 1 && (
                          <div className="flex flex-col items-center mt-10 gap-1">
                            <div className="text-xs text-gray-400">+1 days</div>
                            <ArrowRight className="w-5 h-5 text-blue-400" />
                          </div>
                        )}
                      </React.Fragment>
                    ))}

                    <div className="flex flex-col items-center mt-10 gap-1">
                      <div className="text-xs text-gray-400">+2 days</div>
                      <ArrowRight className="w-5 h-5 text-blue-400" />
                    </div>

                    {/* Completed */}
                    <div className="flex-shrink-0 w-44">
                      <div className="bg-green-500 rounded-xl p-4 text-white text-center">
                        <div className="w-8 h-8 rounded-full bg-green-400 mx-auto mb-2 flex items-center justify-center">
                          <Check className="w-4 h-4" />
                        </div>
                        <div className="text-sm font-medium">Workflow Completed</div>
                        <div className="text-xs text-green-100 mt-1">{selectedCampaign.replies_count || 0} contacts finished</div>
                        <div className="mt-2 bg-white/20 rounded text-xs p-1">✓ Sequence complete</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}