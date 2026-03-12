import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import IntentSignalsAccordion from "@/components/signalagents/IntentSignalsAccordion";

const TAG_COLORS = {
  job: "bg-orange-100 text-orange-700",
  location: "bg-blue-100 text-blue-700",
  industry: "bg-green-100 text-green-700",
  size: "bg-purple-100 text-purple-700",
  exclude: "bg-red-100 text-red-700",
};

const TagInput = ({ tags, onAdd, onRemove, placeholder, colorClass }) => {
  const [input, setInput] = useState("");
  return (
    <div className="border rounded-lg p-2 flex flex-wrap gap-1.5 min-h-12 focus-within:ring-1 focus-within:ring-orange-500">
      {tags.map((tag, i) => (
        <span key={i} className={`flex items-center gap-1 px-2 py-0.5 rounded text-sm ${colorClass}`}>
          {tag}
          <button onClick={() => onRemove(i)}><X className="w-3 h-3" /></button>
        </span>
      ))}
      <div className="flex items-center gap-1 flex-1 min-w-24">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && input.trim()) {
              onAdd(input.trim());
              setInput("");
            }
          }}
          placeholder={placeholder}
          className="flex-1 text-sm outline-none bg-transparent"
        />
        <button
          onClick={() => { if (input.trim()) { onAdd(input.trim()); setInput(""); } }}
          className="px-2 py-0.5 text-xs font-medium"
          style={{ color: "#ff5a1f" }}
        >
          Add
        </button>
      </div>
    </div>
  );
};

const steps = [
  { num: 1, label: "ICP", sub: "Ideal Customer Profile" },
  { num: 2, label: "Signals", sub: "Intent Signals" },
  { num: 3, label: "Leads", sub: "Leads Management" },
];

export default function SignalsAgents() {
  const [agents, setAgents] = useState([]);
  const [activeStep, setActiveStep] = useState(1);
  const [editingAgent, setEditingAgent] = useState(null);
  const [form, setForm] = useState({
    name: "GrowthCodex - Agent",
    target_job_titles: ["Founder", "CEO", "Head of Growth", "Cofounder", "Co-founder"],
    target_locations: ["North America", "Europe", "Canada"],
    target_industries: ["Software Development & SaaS"],
    company_sizes: ["1-10 employees", "11-50 employees"],
    excluded_keywords: ["Clay", "Lavender", "Regio.ai", "Close", "Apollo.io"],
    lead_matching_mode: 80,
    linkedin_page_url: "https://www.linkedin.com/company/growthcodex/",
    linkedin_profile_url: "https://www.linkedin.com/in/abdulla-elhardello-0855812a1/",
    track_profile_visitors: true,
    track_job_changes: true,
    track_funding_events: false,
    track_top_profiles: true,
  });

  useEffect(() => {
    base44.entities.SignalAgent.list("-created_date", 50).then(setAgents).catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      if (editingAgent) {
        await base44.entities.SignalAgent.update(editingAgent.id, form);
      } else {
        await base44.entities.SignalAgent.create({ ...form, status: "active", leads_generated: 0 });
      }
      toast.success("Agent saved!");
      await base44.functions.invoke("triggerSignalAgent", { agentId: editingAgent?.id || "new" });
    } catch (e) {
      toast.error("Save failed");
    }
  };

  const addTag = (field, value) => setForm(f => ({ ...f, [field]: [...f[field], value] }));
  const removeTag = (field, idx) => setForm(f => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }));

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Edit the AI Agent{" "}
              <span className="text-orange-500">{form.name}</span>
            </h1>
            <p className="text-sm text-gray-500">Update the agent configuration and targeting criteria</p>
          </div>
          <button className="text-xs text-orange-500 font-medium flex items-center gap-1">ⓘ HOW IT WORKS?</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Steps sidebar */}
        <div className="w-56 border-r bg-gray-50 p-4 space-y-2">
          {steps.map(step => (
            <button
              key={step.num}
              onClick={() => setActiveStep(step.num)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                activeStep === step.num ? "bg-orange-50 border border-orange-200" : "hover:bg-white"
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${
                activeStep === step.num ? "text-white" : "bg-gray-200 text-gray-600"
              }`} style={activeStep === step.num ? { backgroundColor: "#ff5a1f" } : {}}>
                {step.num}
              </div>
              <div>
                <div className={`text-sm font-medium ${activeStep === step.num ? "text-orange-600" : "text-gray-700"}`}>
                  {step.label}
                </div>
                <div className="text-xs text-gray-400">{step.sub}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Form content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {activeStep === 1 && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Define Your Ideal Customer Profile</h2>
                  <p className="text-sm text-gray-500">Configure who your AI agent should target when searching for leads.</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: "#ff5a1f" }}>
                  Generate ICP with AI ✨
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Job Titles</label>
                  <TagInput
                    tags={form.target_job_titles}
                    onAdd={v => addTag("target_job_titles", v)}
                    onRemove={i => removeTag("target_job_titles", i)}
                    placeholder="e.g., Sales Manager"
                    colorClass={TAG_COLORS.job}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Locations</label>
                  <div className="border rounded-lg p-2 flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-700">{form.target_locations.length} selected</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.target_locations.map((loc, i) => (
                      <span key={i} className={`flex items-center gap-1 px-2 py-0.5 rounded text-sm ${TAG_COLORS.location}`}>
                        {loc}<button onClick={() => removeTag("target_locations", i)}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Industries</label>
                  <div className="border rounded-lg px-3 py-2 cursor-pointer flex items-center justify-between">
                    <span className="text-sm text-gray-700">Software Development & SaaS</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.target_industries.map((ind, i) => (
                      <span key={i} className={`flex items-center gap-1 px-2 py-0.5 rounded text-sm ${TAG_COLORS.industry}`}>
                        {ind}<button onClick={() => removeTag("target_industries", i)}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Types</label>
                  <div className="border rounded-lg px-3 py-2 cursor-pointer flex items-center justify-between">
                    <span className="text-sm text-gray-700">2 selected</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-sm ${TAG_COLORS.size}`}>Startup <X className="w-3 h-3 cursor-pointer" /></span>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-sm ${TAG_COLORS.size}`}>Private Company <X className="w-3 h-3 cursor-pointer" /></span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Sizes</label>
                  <div className="border rounded-lg px-3 py-2 cursor-pointer flex items-center justify-between">
                    <span className="text-sm text-gray-700">{form.company_sizes.length} selected</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.company_sizes.map((sz, i) => (
                      <span key={i} className={`flex items-center gap-1 px-2 py-0.5 rounded text-sm ${TAG_COLORS.size}`}>
                        {sz}<button onClick={() => removeTag("company_sizes", i)}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Companies & Keywords to exclude ⓘ</label>
                  <TagInput
                    tags={form.excluded_keywords}
                    onAdd={v => addTag("excluded_keywords", v)}
                    onRemove={i => removeTag("excluded_keywords", i)}
                    placeholder="e.g., Google"
                    colorClass={TAG_COLORS.exclude}
                  />
                </div>
              </div>

              {/* Lead Matching Mode Slider */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">Lead Matching Mode ⓘ</label>
                  <span className="text-sm text-gray-500">High Precision</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 flex items-center gap-1">🔍 Discovery</span>
                  <input
                    type="range" min="0" max="100"
                    value={form.lead_matching_mode}
                    onChange={e => setForm(f => ({ ...f, lead_matching_mode: Number(e.target.value) }))}
                    className="flex-1 accent-orange-500"
                  />
                </div>
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className={form.lead_matching_mode > 50 ? "text-orange-500" : "text-gray-400"}>●</span>
                    <span>Strict ICP – Fewer, better leads — Only the strongest matches</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Configure Intent Signals</h2>
              <p className="text-sm text-gray-500 mb-6">Define what signals the AI agent should look for to identify potential leads</p>

              <div className="space-y-4">
                {/* You & Your company */}
                <div className="border-2 border-orange-500 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-4 bg-orange-50">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🍊</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">You & Your company</span>
                          <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">3</span>
                        </div>
                        <p className="text-xs text-gray-500">Detect people engaging with your company or your team</p>
                      </div>
                    </div>
                    <span className="text-gray-400">▲</span>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1 mb-2">
                        <span className="text-orange-500">↪</span> Your company LinkedIn Page ⓘ
                      </label>
                      <input
                        value={form.linkedin_page_url}
                        onChange={e => setForm(f => ({ ...f, linkedin_page_url: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        placeholder="https://www.linkedin.com/company/..."
                      />
                      <p className="text-xs text-gray-400 mt-1">URL must start with https://www.linkedin.com/company/...</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1 mb-2">
                        <span className="text-orange-500">↪</span> Your LinkedIn Profile ⓘ
                      </label>
                      <input
                        value={form.linkedin_profile_url}
                        onChange={e => setForm(f => ({ ...f, linkedin_profile_url: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        placeholder="https://www.linkedin.com/in/..."
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1 mb-2">
                        <span className="text-orange-500">↪</span> Visited Profile
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.track_profile_visitors}
                          onChange={e => setForm(f => ({ ...f, track_profile_visitors: e.target.checked }))}
                          className="accent-orange-500 w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">Track your profile visitors</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Change & Trigger Events */}
                <div className="border-2 border-orange-500 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-4 bg-orange-50">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🍊</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">Change & Trigger Events</span>
                          <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">2</span>
                        </div>
                        <p className="text-xs text-gray-500">Job changes, new hires, or funding announcements that suggest buying intent</p>
                      </div>
                    </div>
                    <span className="text-gray-400">▲</span>
                  </div>
                  <div className="p-5 space-y-3">
                    <p className="text-sm text-gray-600">Monitor organizational changes and trigger events that indicate opportunity.</p>
                    <p className="text-sm font-medium text-gray-700 flex items-center gap-1"><span className="text-orange-500">↪</span> Trigger events that suggests buying intent</p>
                    {[
                      { key: "track_top_profiles", label: "Track top 5% active profile in your ICP (Certainly high reply rate) ⓘ" },
                      { key: "track_funding_events", label: "Companies that have recently raised funds ⓘ" },
                      { key: "track_job_changes", label: "Recent job changes (< 90 days) ⓘ" },
                    ].map(item => (
                      <div key={item.key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form[item.key]}
                          onChange={e => setForm(f => ({ ...f, [item.key]: e.target.checked }))}
                          className="accent-purple-500 w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg font-medium">Leads Management</p>
              <p className="text-sm mt-2">Configure how leads are managed after discovery</p>
            </div>
          )}

          {/* Footer nav */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t">
            <button
              onClick={() => setActiveStep(Math.max(1, activeStep - 1))}
              disabled={activeStep === 1}
              className="px-4 py-2 text-sm border rounded-lg text-gray-600 disabled:opacity-40"
            >
              ← Back
            </button>
            {activeStep < 3 ? (
              <button
                onClick={() => setActiveStep(activeStep + 1)}
                className="px-6 py-2 text-sm rounded-lg text-white font-medium"
                style={{ backgroundColor: "#ff5a1f" }}
              >
                Configure {activeStep === 1 ? "Signals" : "Leads"} →
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="px-6 py-2 text-sm rounded-lg text-white font-medium"
                style={{ backgroundColor: "#ff5a1f" }}
              >
                Save Agent ✓
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}