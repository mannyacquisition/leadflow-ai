import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { X, Check, Zap, Bot } from "lucide-react";
import { toast } from "sonner";
import IntentSignalsAccordion from "@/components/signalagents/IntentSignalsAccordion";
import IcpStep from "@/components/signalagents/IcpStep";
import LeadsStep from "@/components/signalagents/LeadsStep";
import HowItWorksModal from "@/components/signalagents/HowItWorksModal";

const steps = [
  { num: 1, label: "ICP",        sub: "Ideal Customer Profile" },
  { num: 2, label: "Signals",    sub: "Intent Signals" },
  { num: 3, label: "Leads",      sub: "Leads Management" },
  { num: 4, label: "AI Config",  sub: "Hub Configuration" },
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
  // AI Hub config
  offer_id: null,
  playbook_id: null,
  tone_id: "",
  kb_file_ids: [],
  battlecard_ids: [],
  is_autopilot: false,
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

// ── Step 4: AI Configuration ──────────────────────────────────────────────────
const TONES_WIZARD = [
  { id: "formal_professional",    label: "Formal & Professional" },
  { id: "casual_friendly",        label: "Casual & Friendly" },
  { id: "persuasive_results",     label: "Persuasive & Results-Driven" },
  { id: "consultative_insightful",label: "Consultative & Insightful" },
  { id: "provocative_challenger", label: "Provocative & Challenger" },
  { id: "empathetic_solution",    label: "Empathetic & Solution-Oriented" },
  { id: "direct_nononsense",      label: "Direct & No-Nonsense" },
  { id: "witty_engaging",         label: "Witty & Engaging" },
  { id: "enthusiastic_visionary", label: "Enthusiastic & Visionary" },
  { id: "data_analytical",        label: "Data-Driven & Analytical" },
];

function AiConfigStep({ form, setForm, hubData }) {
  const { offers, playbooks, battlecards, kbFiles } = hubData;

  const toggleMulti = (field, id) => {
    const curr = form[field] || [];
    setForm(f => ({
      ...f,
      [field]: curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id],
    }));
  };

  return (
    <div className="space-y-7" data-testid="ai-config-step">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">AI Configuration</h3>
        <p className="text-sm text-gray-500">Attach your AI Hub resources to this campaign. When a lead comes in, these settings will be injected into the AI's context.</p>
      </div>

      {/* Offer */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Offer</label>
        <select
          value={form.offer_id || ""}
          onChange={e => setForm(f => ({ ...f, offer_id: e.target.value || null }))}
          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          data-testid="campaign-offer-select"
        >
          <option value="">— No offer attached —</option>
          {offers.map(o => <option key={o.id} value={o.id}>{o.internal_name}</option>)}
        </select>
        {offers.length === 0 && <p className="text-xs text-gray-400 mt-1">Create offers in AI Hub → Offers</p>}
      </div>

      {/* Playbook */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Playbook</label>
        <select
          value={form.playbook_id || ""}
          onChange={e => setForm(f => ({ ...f, playbook_id: e.target.value || null }))}
          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          data-testid="campaign-playbook-select"
        >
          <option value="">— No playbook attached —</option>
          {playbooks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {playbooks.length === 0 && <p className="text-xs text-gray-400 mt-1">Create playbooks in AI Hub → Playbooks</p>}
      </div>

      {/* Tone */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tone of Voice</label>
        <select
          value={form.tone_id || ""}
          onChange={e => setForm(f => ({ ...f, tone_id: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          data-testid="campaign-tone-select"
        >
          <option value="">— Inherit workspace default —</option>
          {TONES_WIZARD.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>

      {/* KB Files */}
      {kbFiles.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Knowledge Base Files</label>
          <p className="text-xs text-gray-400 mb-2">Select which uploaded files the AI can reference</p>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {kbFiles.map(f => (
              <label key={f.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={(form.kb_file_ids || []).includes(f.id)}
                  onChange={() => toggleMulti("kb_file_ids", f.id)}
                  className="rounded accent-orange-500"
                />
                <span className="text-gray-700">{f.file_name}</span>
                <span className="text-xs text-gray-400">({f.chunk_count} chunks)</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Battlecards */}
      {battlecards.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Battlecards</label>
          <p className="text-xs text-gray-400 mb-2">Select objection handling strategies to attach</p>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {battlecards.map(b => (
              <label key={b.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={(form.battlecard_ids || []).includes(b.id)}
                  onChange={() => toggleMulti("battlecard_ids", b.id)}
                  className="rounded accent-orange-500"
                />
                <span className="text-gray-700">{b.objection_type}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Autopilot / Copilot toggle */}
      <div className="border rounded-xl p-4 bg-gray-50">
        <p className="text-sm font-semibold text-gray-800 mb-3">Execution Mode</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, is_autopilot: false }))}
            data-testid="mode-copilot-btn"
            className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
              !form.is_autopilot ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            <Bot className="w-4 h-4" />
            <div className="text-left">
              <div className="font-semibold">Copilot</div>
              <div className="text-xs font-normal opacity-75">AI saves drafts for your approval</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, is_autopilot: true }))}
            data-testid="mode-autopilot-btn"
            className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
              form.is_autopilot ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            <Zap className="w-4 h-4" />
            <div className="text-left">
              <div className="font-semibold">Autopilot</div>
              <div className="text-xs font-normal opacity-75">AI sends emails automatically</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Wizard ───────────────────────────────────────────────────────────────
export default function AgentWizard({ editingAgent, initialForm, onSaved, onCancel }) {
  const [activeStep, setActiveStep] = useState(1);
  const [form, setForm] = useState(initialForm || defaultForm);
  const [saving, setSaving] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [hubData, setHubData] = useState({ offers: [], playbooks: [], battlecards: [], kbFiles: [] });

  // Load hub data when reaching step 4
  useEffect(() => {
    if (activeStep === 4) {
      Promise.all([
        api.hub.listOffers(),
        api.hub.listPlaybooks(),
        api.hub.listBattlecards(),
        api.hub.listKbFiles(),
      ]).then(([offers, playbooks, battlecards, kbFiles]) => {
        setHubData({ offers, playbooks, battlecards, kbFiles });
      }).catch(() => {});
    }
  }, [activeStep]);

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
        offer_id: form.offer_id || null,
        playbook_id: form.playbook_id || null,
        tone_id: form.tone_id || null,
        kb_file_ids: form.kb_file_ids || [],
        battlecard_ids: form.battlecard_ids || [],
        is_autopilot: form.is_autopilot || false,
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

  const nextLabel =
    activeStep === 1 ? "Configure Signals ›" :
    activeStep === 2 ? "Configure Leads ›" :
    activeStep === 3 ? "AI Configuration ›" :
    "Save ›";

  const handleNext = () => {
    if (activeStep < 4) setActiveStep(s => s + 1);
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
            {activeStep === 4 && <AiConfigStep form={form} setForm={setForm} hubData={hubData} />}
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
