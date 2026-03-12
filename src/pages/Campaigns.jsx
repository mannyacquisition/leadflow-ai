import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Play, Pause, ChevronRight, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

const mockCampaign = {
  id: "1",
  name: "My Campaign",
  status: "active",
  sender: "Manny Artino",
  invitations_limit: 13,
  messages_limit: 14,
  contacts_count: 460,
  invitations_sent: 116,
  accepted: 49,
  steps: [
    { type: "invitation", label: "Send Invitation", step: 1, contacts: 116, accepted: 49 },
    { type: "message", label: "Send Message", step: 2, contacts: 40, answered: 13, note: "AI Icebreaker" },
    { type: "message", label: "Send Message", step: 3, contacts: 23, answered: 2, note: "MESSAGE:\nBtw [FirstName], If helpful I can share a sample output we g..." },
  ],
  completed_paths: [
    { contacts: 11, label: "11 contact(s) responded" },
    { contacts: 2, label: "2 contact(s) responded" },
  ]
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(mockCampaign);
  const [activeTab, setActiveTab] = useState("workflow");

  useEffect(() => {
    base44.entities.Campaign.list("-created_date", 50).then(setCampaigns).catch(() => setCampaigns([]));
  }, []);

  const toggleStatus = async (campaign) => {
    const newStatus = campaign.status === "active" ? "paused" : "active";
    await base44.entities.Campaign.update(campaign.id, { status: newStatus });
    toast.success(`Campaign ${newStatus}`);
  };

  const tabs = ["Workflow", "Scheduled (21)", "Contacts", "Last Launches", "Insights", "Settings"];

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Campaign Details – {selectedCampaign.name} ✏️</h1>
          <p className="text-sm text-gray-500">Manage your campaign workflow and contacts</p>
        </div>
        <button className="px-3 py-1.5 text-sm rounded-lg text-white font-medium flex items-center gap-1.5" style={{ backgroundColor: "#ff5a1f" }}>
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

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
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Campaign is active</span>
                <span className="text-gray-400">· Next launch in a day</span>
              </div>
              <button className="px-3 py-1.5 text-sm border rounded-lg text-orange-600 border-orange-200 flex items-center gap-1.5 hover:bg-orange-50">
                <Pause className="w-4 h-4" /> Pause
              </button>
            </div>
          </div>

          {/* Sender info */}
          <div className="flex items-center gap-4 mb-8 pb-4 border-b text-sm text-gray-600">
            <span>Sender:</span>
            <span className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs">M</div>
              {selectedCampaign.sender}
            </span>
            <span className="flex items-center gap-1.5 text-green-600"><span className="w-2 h-2 rounded-full bg-green-500"></span> Connected</span>
            <span className="text-gray-400">⬆ {selectedCampaign.invitations_limit}/day</span>
            <span className="text-gray-400">✉ {selectedCampaign.messages_limit}/day</span>
            <div className="ml-auto flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> 13 invitation(s)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"></span> 8 message(s) to send</span>
            </div>
          </div>

          {/* Workflow diagram */}
          <div className="flex items-start gap-4 overflow-x-auto pb-4">
            {/* Input source */}
            <div className="flex-shrink-0 w-44">
              <div className="bg-gray-700 rounded-xl p-4 text-white text-center">
                <div className="w-8 h-8 rounded-full bg-gray-500 mx-auto mb-2 flex items-center justify-center">⚙️</div>
                <div className="text-sm font-medium">Input source</div>
                <div className="text-xs text-gray-300">1 agent(s)</div>
                <div className="mt-2 text-xs bg-gray-600 rounded p-1">GrowthCodex - Agent</div>
                <div className="text-xs text-gray-400 mt-1">Running ●</div>
                <div className="text-xs text-gray-400">1 list(s) · 460 contacts</div>
              </div>
            </div>

            <div className="flex items-center mt-16"><ArrowRight className="w-5 h-5 text-blue-400" /></div>

            {/* Steps */}
            {selectedCampaign.steps.map((step, idx) => (
              <React.Fragment key={idx}>
                <div className="flex-shrink-0 w-44">
                  <div className={`rounded-xl p-4 text-white text-center ${
                    step.type === "invitation" ? "bg-purple-500" : "bg-blue-500"
                  }`}>
                    <div className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-1">
                      {step.type === "invitation" ? "🔵" : "✉️"} {step.label}
                    </div>
                    <div className="text-xs opacity-80">Step {step.step}</div>
                    {step.note && <div className="text-xs bg-white/20 rounded p-1 mt-2 text-left">{step.note.substring(0, 40)}</div>}
                    <div className="mt-3 grid grid-cols-2 gap-1 text-xs">
                      <div className="bg-white/20 rounded p-1">
                        <div className="font-semibold">{step.contacts}</div>
                        <div className="opacity-80">contacts</div>
                      </div>
                      <div className="bg-white/20 rounded p-1">
                        <div className="font-semibold">{step.accepted || step.answered}</div>
                        <div className="opacity-80">{step.accepted ? "accepted" : "answer"}</div>
                      </div>
                    </div>
                    <div className="flex gap-1 mt-2">
                      <button className="flex-1 bg-white/20 rounded text-xs py-0.5 hover:bg-white/30">View Contacts</button>
                      <button className="flex-1 bg-white/20 rounded text-xs py-0.5 hover:bg-white/30">Edit</button>
                    </div>
                  </div>
                </div>
                {idx < selectedCampaign.steps.length - 1 && (
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
                <div className="text-xs text-green-100 mt-1">23 contacts finished the workflow</div>
                <div className="mt-2 bg-white/20 rounded text-xs p-1">✓ Sequence complete</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}