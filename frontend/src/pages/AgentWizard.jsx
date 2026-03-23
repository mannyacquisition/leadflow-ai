import React, { useState } from "react";
import { api } from "@/api/client";
import { X, Check } from "lucide-react";
import { toast } from "sonner";
import IntentSignalsAccordion from "@/components/signalagents/IntentSignalsAccordion";
import IcpStep from "@/components/signalagents/IcpStep";
import LeadsStep from "@/components/signalagents/LeadsStep";
import HowItWorksModal from "@/components/signalagents/HowItWorksModal";

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
  company_types: [],
  excluded_keywords: [],
  mandatory_keywords: [],
  additional_criteria: "",
  lead_matching_mode: 80,
  exclude_service_providers: false,
  skip_icp_filtering: false,
  include_open_to_work: false,
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
  lead_list_id: "",
  lead_list_name: "",
};

// ── Step indicator in sidebar ─────────────────────────────────────────────────
function StepItem({ step, activeStep, onClick }) {
  const isActive = activeStep === step.num;
  const isCompleted = activeStep > step.num;

  let circleStyle = {};
  let circleBg = "bg-gray-200";
  let circleText = "text-gray-600";
  let rowBg = "";
  let labelColor = "text-gray-700";

  if (isActive) {
    circleStyle = { backgroundColor: "#ff5a1f" };
    circleBg = "";
    circleText = "text-white";
    rowBg = "bg-orange-50 border border-orange-200";
    labelColor = "text-orange-600";
  } else if (isCompleted) {
    circleBg = "bg-green-500";
    circleText = "text-white";
    rowBg = "bg-green-50 border border-green-200";
    labelColor = "text-green-700";
  }

  return (
    <button
      onClick={() => onClick(step.num)}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${rowBg || "hover:bg-white"}`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${circleBg} ${circleText}`}
        style={isActive ? circleStyle : {}}
      >
        {isCompleted ? <Check className="w-4 h-4" /> : step.num}
      </div>
      <div>
        <div className={`text-sm font-semibold ${labelColor}`}>{step.label}</div>
        <div className="text-xs text-gray-400">{step.sub}</div>
      </div>
    </button>
  );
}

// ── Inline editable name ──────────────────────────────────────────────────────
function InlineAgentName({ name, onChange }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);

  const startEdit = () => { 
    setVal(name); 
    setEditing(true); 
  };

  const save = async () => {
    setEditing(false);
    if (!val.trim() || val === name) return;
    onChange(val.trim());
  };

  if (editing) {
    return (
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className="text-orange-500 font-bold text-xl underline decoration-orange-400 underline-offset-2 border-b-2 border-orange-400 outline-none bg-transparent min-w-0 w-48"
        autoFocus
      />
    );
  }

  return (
    <button onClick={startEdit} className="text-orange-500 underline decoration-orange-400 underline-offset-2 hover:opacity-80 transition-opacity font-bold text-xl">
      {name}
    </button>
  );
}

// ── Main Wizard ───────────────────────────────────────────────────────────────
export default function AgentWizard({ editingAgent, initialForm, onSaved, onCancel }) {
  const [activeStep, setActiveStep] = useState(1);
  const [form, setForm] = useState(initialForm || defaultForm);
  const [saving, setSaving] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        status: 'active',
        target_job_titles: form.target_job_titles,
        target_locations: form.target_locations,
        target_industries: form.target_industries,
        company_sizes: form.company_sizes,
        excluded_keywords: form.excluded_keywords,
        lead_matching_mode: form.lead_matching_mode,
        linkedin_page_url: form.linkedin_page_url || null,
        linkedin_profile_url: form.linkedin_profile_url || null,
        track_profile_visitors: form.track_profile_visitors,
        company_followers_url: form.company_followers_url || null,
        keywords: form.keywords,
        influencer_urls: form.influencer_urls,
        track_top_profiles: form.track_top_profiles,
        track_funding_events: form.track_funding_events,
        track_job_changes: form.track_job_changes,
        competitor_urls: form.competitor_urls,
      };

      if (editingAgent?.id) {
        await api.signals.update(editingAgent.id, payload);
        toast.success("Agent updated!");
      } else {
        await api.signals.create(payload);
        toast.success("Agent created!");
      }
      onSaved?.();
    } catch (err) {
      toast.error(err.message || "Save failed");
    }
    setSaving(false);
  };

  const nextLabel = activeStep === 1 ? "Configure Signals ›" : activeStep === 2 ? "Configure Leads ›" : "Save ›";

  const handleNext = () => {
    if (activeStep < 3) setActiveStep(s => s + 1);
    else handleSave();
  };

  return (
    <div className="h-full flex flex-col bg-gray-50" data-testid="agent-wizard">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">
            {editingAgent ? "Edit the AI Agent" : "Launch New Agent"}{" "}
            <InlineAgentName
              name={form.name}
              onChange={newName => setForm(f => ({ ...f, name: newName }))}
            />
          </h1>
          <button
            onClick={() => setShowHowItWorks(true)}
            className="flex items-center gap-1 px-3 py-1 border rounded-full text-xs font-medium text-orange-500 border-orange-200 hover:bg-orange-50"
          >
            ⓘ HOW IT WORKS?
          </button>
        </div>
        <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="px-6 py-1.5 text-sm text-gray-500 bg-white border-b">
        Update the agent configuration and targeting criteria
      </p>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 p-5 space-y-2 bg-white border-r">
          {steps.map(step => (
            <StepItem key={step.num} step={step} activeStep={activeStep} onClick={setActiveStep} />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pb-24">
          <div className="bg-white rounded-xl border p-6 min-h-full">
            {activeStep === 1 && <IcpStep form={form} setForm={setForm} />}
            {activeStep === 2 && <IntentSignalsAccordion form={form} setForm={setForm} />}
            {activeStep === 3 && <LeadsStep form={form} setForm={setForm} />}
          </div>
        </div>
      </div>

      {showHowItWorks && <HowItWorksModal onClose={() => setShowHowItWorks(false)} />}

      {/* Fixed Footer */}
      <div className="flex-shrink-0 border-t bg-white px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => setActiveStep(s => Math.max(1, s - 1))}
          disabled={activeStep === 1}
          className="px-5 py-2.5 rounded-lg border text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={handleNext}
          disabled={saving}
          data-testid="wizard-next-btn"
          className="px-6 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-60"
          style={{ backgroundColor: "#ff5a1f" }}
        >
          {saving ? "Saving..." : nextLabel}
        </button>
      </div>
    </div>
  );
}
