import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import IntentSignalsAccordion from "@/components/signalagents/IntentSignalsAccordion";
import { Link } from "react-router-dom";

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
          onKeyDown={e => { if (e.key === "Enter" && input.trim()) { onAdd(input.trim()); setInput(""); } }}
          placeholder={placeholder}
          className="flex-1 text-sm outline-none bg-transparent"
        />
        <button
          onClick={() => { if (input.trim()) { onAdd(input.trim()); setInput(""); } }}
          className="px-2 py-0.5 text-xs font-medium"
          style={{ color: "#ff5a1f" }}
        >Add</button>
      </div>
    </div>
  );
};

const steps = [
  { num: 1, label: "ICP", sub: "Ideal Customer Profile" },
  { num: 2, label: "Signals", sub: "Intent Signals" },
  { num: 3, label: "Leads", sub: "Leads Management" },
];

const defaultForm = {
  name: "New Agent",
  target_job_titles: [],
  target_locations: [],
  target_industries: [],
  company_sizes: [],
  excluded_keywords: [],
  lead_matching_mode: 80,
  linkedin_page_url: "",
  linkedin_profile_url: "",
  track_profile_visitors: false,
  track_job_changes: false,
  track_funding_events: false,
  track_top_profiles: false,
  profile_visitors_account: "first",
  company_followers_url: "",
  company_followers_account: "first",
  keywords: [],
  influencer_urls: [],
  competitor_urls: [],
};

export default function AgentWizard({ editingAgent, initialForm, onSaved, onCancel }) {
  const [activeStep, setActiveStep] = useState(1);
  const [form, setForm] = useState(initialForm || defaultForm);

  const handleSave = async () => {
    try {
      if (editingAgent) {
        await base44.entities.SignalAgent.update(editingAgent.id, form);
      } else {
        await base44.entities.SignalAgent.create({ ...form, status: "active", leads_generated: 0 });
      }
      toast.success("Agent saved!");
      onSaved?.();
    } catch (e) {
      toast.error("Save failed");
    }
  };

  const addTag = (field, value) => setForm(f => ({ ...f, [field]: [...(f[field] || []), value] }));
  const removeTag = (field, idx) => setForm(f => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }));

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {editingAgent ? "Edit Agent" : "Launch New Agent"}{" "}
            <span className="text-orange-500">{form.name}</span>
          </h1>
          <p className="text-sm text-gray-500">Configure the agent's targeting criteria and intent signals</p>
        </div>
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <X className="w-4 h-4" /> Cancel
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Steps sidebar */}
        <div className="w-56 border-r bg-gray-50 p-4 space-y-2">
          {steps.map(step => (
            <button
              key={step.num}
              onClick={() => setActiveStep(step.num)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${activeStep === step.num ? "bg-orange-50 border border-orange-200" : "hover:bg-white"}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${activeStep === step.num ? "text-white" : "bg-gray-200 text-gray-600"}`}
                style={activeStep === step.num ? { backgroundColor: "#ff5a1f" } : {}}
              >
                {step.num}
              </div>
              <div>
                <div className={`text-sm font-medium ${activeStep === step.num ? "text-orange-600" : "text-gray-700"}`}>{step.label}</div>
                <div className="text-xs text-gray-400">{step.sub}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {activeStep === 1 && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Define Your Ideal Customer Profile</h2>
                  <p className="text-sm text-gray-500">Configure who your AI agent should target.</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: "#ff5a1f" }}>
                  Generate ICP with AI ✨
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Job Titles</label>
                  <TagInput tags={form.target_job_titles} onAdd={v => addTag("target_job_titles", v)} onRemove={i => removeTag("target_job_titles", i)} placeholder="e.g., Sales Manager" colorClass={TAG_COLORS.job} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Locations</label>
                  <TagInput tags={form.target_locations} onAdd={v => addTag("target_locations", v)} onRemove={i => removeTag("target_locations", i)} placeholder="e.g., North America" colorClass={TAG_COLORS.location} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Industries</label>
                  <TagInput tags={form.target_industries} onAdd={v => addTag("target_industries", v)} onRemove={i => removeTag("target_industries", i)} placeholder="e.g., SaaS" colorClass={TAG_COLORS.industry} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Sizes</label>
                  <TagInput tags={form.company_sizes} onAdd={v => addTag("company_sizes", v)} onRemove={i => removeTag("company_sizes", i)} placeholder="e.g., 1-10 employees" colorClass={TAG_COLORS.size} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Companies & Keywords to Exclude</label>
                  <TagInput tags={form.excluded_keywords} onAdd={v => addTag("excluded_keywords", v)} onRemove={i => removeTag("excluded_keywords", i)} placeholder="e.g., Google" colorClass={TAG_COLORS.exclude} />
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Lead Matching Mode</label>
                  <span className="text-sm text-gray-500">High Precision</span>
                </div>
                <input type="range" min="0" max="100" value={form.lead_matching_mode} onChange={e => setForm(f => ({ ...f, lead_matching_mode: Number(e.target.value) }))} className="w-full accent-orange-500" />
              </div>
            </div>
          )}

          {activeStep === 2 && <IntentSignalsAccordion form={form} setForm={setForm} />}

          {activeStep === 3 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg font-medium">Leads Management</p>
              <p className="text-sm mt-2">Configure how leads are managed after discovery</p>
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-4 border-t">
            <button onClick={() => setActiveStep(Math.max(1, activeStep - 1))} disabled={activeStep === 1} className="px-4 py-2 text-sm border rounded-lg text-gray-600 disabled:opacity-40">← Back</button>
            {activeStep < 3 ? (
              <button onClick={() => setActiveStep(activeStep + 1)} className="px-6 py-2 text-sm rounded-lg text-white font-medium" style={{ backgroundColor: "#ff5a1f" }}>
                Configure {activeStep === 1 ? "Signals" : "Leads"} →
              </button>
            ) : (
              <button onClick={handleSave} className="px-6 py-2 text-sm rounded-lg text-white font-medium" style={{ backgroundColor: "#ff5a1f" }}>
                Save Agent ✓
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}