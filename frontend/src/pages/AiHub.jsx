import React, { useState, useEffect, useRef } from "react";
import { api } from "@/api/client";
import { toast } from "sonner";
import {
  BrainCircuit, Upload, FileText, Trash2, Plus, Pencil, Check,
  X, Loader2, Globe, Shield, Book, Sword, Mic2, ChevronRight,
  CheckCircle2, AlertCircle,
} from "lucide-react";

// ─── Tone definitions ────────────────────────────────────────────────────────
const TONES = [
  { id: "formal_professional",   label: "Formal & Professional",       desc: "Authoritative, polished language. Best for enterprise and C-suite outreach.", color: "from-blue-500/20 to-blue-600/10 border-blue-500/30" },
  { id: "casual_friendly",       label: "Casual & Friendly",           desc: "Warm, approachable, conversational. Great for SMB and startup audiences.", color: "from-green-500/20 to-green-600/10 border-green-500/30" },
  { id: "persuasive_results",    label: "Persuasive & Results-Driven", desc: "Outcome-focused, ROI-centric. Works well for sales-led growth motions.", color: "from-orange-500/20 to-orange-600/10 border-orange-500/30" },
  { id: "consultative_insightful","label":"Consultative & Insightful", desc: "Advisory, thought-leader tone. Great for complex or long-cycle deals.", color: "from-purple-500/20 to-purple-600/10 border-purple-500/30" },
  { id: "provocative_challenger", label: "Provocative & Challenger",   desc: "Challenge the status quo. Best for disrupting incumbents.", color: "from-red-500/20 to-red-600/10 border-red-500/30" },
  { id: "empathetic_solution",   label: "Empathetic & Solution-Oriented","desc":"Lead with understanding the pain. Works for high-touch markets.", color: "from-teal-500/20 to-teal-600/10 border-teal-500/30" },
  { id: "direct_nononsense",     label: "Direct & No-Nonsense",        desc: "Short, blunt, zero fluff. For busy operators who value brevity.", color: "from-gray-500/20 to-gray-600/10 border-gray-500/30" },
  { id: "witty_engaging",        label: "Witty & Engaging",            desc: "Clever, memorable, with a touch of humor. For creative or media industries.", color: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/30" },
  { id: "enthusiastic_visionary","label":"Enthusiastic & Visionary",   desc: "Energetic, big-picture thinking. Great for early adopters and innovators.", color: "from-pink-500/20 to-pink-600/10 border-pink-500/30" },
  { id: "data_analytical",       label: "Data-Driven & Analytical",    desc: "Numbers, benchmarks, proof points. For data-centric personas.", color: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30" },
];

const TABS = [
  { id: "kb",          label: "Knowledge Base", icon: FileText },
  { id: "tone",        label: "Tone",           icon: Mic2 },
  { id: "offers",      label: "Offers",         icon: Globe },
  { id: "playbooks",   label: "Playbooks",      icon: Book },
  { id: "battlecards", label: "Battlecards",    icon: Sword },
  { id: "guardrails",  label: "Guardrails",     icon: Shield },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function TabBar({ active, onChange }) {
  return (
    <div className="flex border-b bg-white px-6">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          data-testid={`hub-tab-${id}`}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            active === id
              ? "border-orange-500 text-orange-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Knowledge Base Tab ────────────────────────────────────────────────────────
function KnowledgeTab() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);

  const load = async () => {
    setLoading(true);
    try { setFiles(await api.hub.listKbFiles()); } catch { /**/ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.hub.uploadKbFile(fd);
      toast.success("File uploaded and embedded");
      load();
    } catch (err) { toast.error(err.message); }
    setUploading(false);
    e.target.value = "";
  };

  const handleDelete = async (id) => {
    try {
      await api.hub.deleteKbFile(id);
      toast.success("File deleted");
      load();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Knowledge Base</h2>
          <p className="text-sm text-gray-500 mt-0.5">Upload PDFs and text files. Your AI agents will reference these when writing emails.</p>
        </div>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          data-testid="kb-upload-btn"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60"
          style={{ backgroundColor: "#ff5a1f" }}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Upload File
        </button>
        <input ref={fileInput} type="file" accept=".pdf,.txt,.md,.csv" className="hidden" onChange={handleUpload} />
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : files.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No files yet</p>
          <p className="text-sm mt-1">Upload a PDF or text file to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map(f => (
            <div key={f.id} className="flex items-center justify-between p-4 border rounded-xl bg-white hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{f.file_name}</p>
                  <p className="text-xs text-gray-400">{f.chunk_count} chunks · {f.file_type?.toUpperCase()}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(f.id)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tone Tab ─────────────────────────────────────────────────────────────────
function ToneTab() {
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.hub.getTone().then(r => setSelected(r.tone_id || "")).catch(() => {});
  }, []);

  const handleSelect = async (id) => {
    setSaving(true);
    setSelected(id);
    try {
      await api.hub.setTone(id);
      toast.success("Default tone saved");
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900">Tone of Voice</h2>
        <p className="text-sm text-gray-500 mt-0.5">Select your default workspace tone. This can be overridden per campaign.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-4xl">
        {TONES.map(t => {
          const isActive = selected === t.id;
          return (
            <button
              key={t.id}
              onClick={() => handleSelect(t.id)}
              data-testid={`tone-card-${t.id}`}
              className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                isActive ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              {isActive && <CheckCircle2 className="absolute top-3 right-3 w-4 h-4 text-orange-500" />}
              <p className="font-semibold text-sm text-gray-900">{t.label}</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{t.desc}</p>
            </button>
          );
        })}
      </div>
      {saving && <p className="text-xs text-gray-400 mt-3 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</p>}
    </div>
  );
}

// ── Offers Tab ───────────────────────────────────────────────────────────────
const OFFER_FIELDS = [
  { key: "industry",           label: "Industry",                   placeholder: "e.g. B2B SaaS" },
  { key: "icp",                label: "Ideal Customer Profile",     placeholder: "e.g. VP Sales at 50-500 person SaaS companies", multiline: true },
  { key: "pain_points",        label: "Pain Points",                placeholder: "What keeps them up at night?", multiline: true },
  { key: "cost_of_inaction",   label: "Cost of Inaction",           placeholder: "What happens if they don't solve this?", multiline: true },
  { key: "solution_benefits",  label: "Solution Benefits",          placeholder: "Key outcomes/results your product delivers", multiline: true },
  { key: "social_proof",       label: "Social Proof",               placeholder: "Customer quotes, case studies, metrics", multiline: true },
  { key: "offering_description","label":"Offering Description",     placeholder: "Brief product/service description", multiline: true },
  { key: "problem_solved",     label: "Problem Solved",             placeholder: "The core problem in 1-2 sentences", multiline: true },
  { key: "differentiator",     label: "Differentiator",             placeholder: "What makes you unique vs. competitors?", multiline: true },
];

function OfferForm({ offer, onSave, onCancel }) {
  const [form, setForm] = useState(offer || { internal_name: "", external_name: "", website_url: "" });
  const [scraping, setScraping] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleScrape = async () => {
    if (!form.website_url) { toast.error("Enter a website URL first"); return; }
    setScraping(true);
    try {
      const data = await api.hub.scrapeOffer(form.website_url);
      setForm(f => ({ ...f, ...data }));
      toast.success("AI filled in your offer details");
    } catch (err) { toast.error(err.message || "Scrape failed"); }
    setScraping(false);
  };

  const handleSave = async () => {
    if (!form.internal_name?.trim()) { toast.error("Internal name is required"); return; }
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <div className="border rounded-xl p-6 bg-white space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Internal Name *</label>
          <input
            value={form.internal_name || ""}
            onChange={e => setForm(f => ({ ...f, internal_name: e.target.value }))}
            placeholder="e.g. Main SaaS Offer"
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">External / Brand Name</label>
          <input
            value={form.external_name || ""}
            onChange={e => setForm(f => ({ ...f, external_name: e.target.value }))}
            placeholder="e.g. Monara AI"
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Website URL</label>
        <div className="flex gap-2">
          <input
            value={form.website_url || ""}
            onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))}
            placeholder="https://yourwebsite.com"
            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
          <button
            onClick={handleScrape}
            disabled={scraping}
            data-testid="offer-scrape-btn"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-orange-300 text-orange-600 text-sm font-medium hover:bg-orange-50 disabled:opacity-60 whitespace-nowrap"
          >
            {scraping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />}
            Auto-Generate via AI
          </button>
        </div>
      </div>
      {OFFER_FIELDS.map(({ key, label, placeholder, multiline }) => (
        <div key={key}>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
          {multiline ? (
            <textarea
              value={form[key] || ""}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-y"
            />
          ) : (
            <input
              value={form[key] || ""}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          )}
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60" style={{ backgroundColor: "#ff5a1f" }}>
          {saving ? "Saving..." : "Save Offer"}
        </button>
        <button onClick={onCancel} className="px-5 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  );
}

function OffersTab() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | offer object

  const load = async () => {
    setLoading(true);
    try { setOffers(await api.hub.listOffers()); } catch { /**/ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    if (editing === "new") {
      await api.hub.createOffer(form);
      toast.success("Offer created");
    } else {
      await api.hub.updateOffer(editing.id, form);
      toast.success("Offer updated");
    }
    setEditing(null);
    load();
  };

  const handleDelete = async (id) => {
    await api.hub.deleteOffer(id);
    toast.success("Offer deleted");
    load();
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Offers</h2>
          <p className="text-sm text-gray-500 mt-0.5">Define your products. Attach one to a campaign to inject full context into every AI-written email.</p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing("new")}
            data-testid="create-offer-btn"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold"
            style={{ backgroundColor: "#ff5a1f" }}
          >
            <Plus className="w-4 h-4" /> New Offer
          </button>
        )}
      </div>

      {editing && (
        <div className="mb-6">
          <OfferForm
            offer={editing === "new" ? null : editing}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : offers.length === 0 && !editing ? (
        <div className="border-2 border-dashed rounded-xl p-10 text-center text-gray-400">
          <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No offers yet</p>
          <p className="text-sm mt-1">Create your first offer to start personalizing AI emails</p>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map(o => (
            <div key={o.id} className="flex items-center justify-between p-4 border rounded-xl bg-white hover:bg-gray-50">
              <div>
                <p className="font-semibold text-sm text-gray-900">{o.internal_name}</p>
                <p className="text-xs text-gray-400">{o.external_name || "—"} · {o.industry || "No industry set"}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(o)} className="p-2 text-gray-400 hover:text-gray-700"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(o.id)} className="p-2 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Playbooks Tab ────────────────────────────────────────────────────────────
const PLAYBOOK_SECTIONS = [
  { key: "initial_email_template",   label: "Initial Email",    hint: "Use [First Name], [Company], [Pain Point] as variables" },
  { key: "follow_up_template",       label: "Follow Up",        hint: "Shorter, reply-style follow up" },
  { key: "connect_message_template", label: "Connect Message",  hint: "LinkedIn connection note (<300 chars)" },
  { key: "do_guidelines",            label: "Do's",             hint: "Rules the AI must follow" },
  { key: "dont_guidelines",          label: "Don'ts",           hint: "Rules the AI must never break" },
];

function PlaybookEditor({ playbook, onSave, onCancel }) {
  const [form, setForm] = useState(playbook || { name: "" });
  const [activeSection, setActiveSection] = useState("initial_email_template");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error("Playbook name is required"); return; }
    setSaving(true);
    try { await onSave(form); } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      <div className="px-5 py-3 border-b flex items-center gap-3">
        <input
          value={form.name || ""}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Playbook name (e.g. Cold Outreach V1)"
          className="flex-1 text-sm font-semibold text-gray-900 border-0 outline-none bg-transparent"
        />
        <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-60" style={{ backgroundColor: "#ff5a1f" }}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={onCancel} className="p-1.5 text-gray-300 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex">
        <div className="w-40 border-r flex-shrink-0">
          {PLAYBOOK_SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`w-full text-left px-4 py-3 text-xs font-medium border-b transition-colors ${
                activeSection === s.key ? "bg-orange-50 text-orange-600" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex-1 p-4">
          {PLAYBOOK_SECTIONS.filter(s => s.key === activeSection).map(s => (
            <div key={s.key}>
              <p className="text-xs text-gray-400 mb-2">{s.hint}</p>
              <textarea
                value={form[s.key] || ""}
                onChange={e => setForm(f => ({ ...f, [s.key]: e.target.value }))}
                placeholder={`Write your ${s.label.toLowerCase()} template here...`}
                rows={12}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-y font-mono"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlaybooksTab() {
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setPlaybooks(await api.hub.listPlaybooks()); } catch { /**/ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    if (editing === "new") {
      await api.hub.createPlaybook(form);
      toast.success("Playbook created");
    } else {
      await api.hub.updatePlaybook(editing.id, form);
      toast.success("Playbook updated");
    }
    setEditing(null);
    load();
  };

  const handleDelete = async (id) => {
    await api.hub.deletePlaybook(id);
    toast.success("Playbook deleted");
    load();
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Playbooks</h2>
          <p className="text-sm text-gray-500 mt-0.5">Define email sequences, templates and rules. Attach a playbook to a campaign.</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing("new")} data-testid="create-playbook-btn" className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: "#ff5a1f" }}>
            <Plus className="w-4 h-4" /> New Playbook
          </button>
        )}
      </div>

      {editing && (
        <div className="mb-6">
          <PlaybookEditor playbook={editing === "new" ? null : editing} onSave={handleSave} onCancel={() => setEditing(null)} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : playbooks.length === 0 && !editing ? (
        <div className="border-2 border-dashed rounded-xl p-10 text-center text-gray-400">
          <Book className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No playbooks yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {playbooks.map(p => (
            <div key={p.id} className="flex items-center justify-between p-4 border rounded-xl bg-white hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <Book className="w-5 h-5 text-orange-500" />
                <p className="font-medium text-sm text-gray-900">{p.name}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(p)} className="p-2 text-gray-400 hover:text-gray-700"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(p.id)} className="p-2 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Battlecards Tab ──────────────────────────────────────────────────────────
function BattlecardForm({ card, onSave, onCancel }) {
  const [form, setForm] = useState(card || { objection_type: "", rebuttal_strategy: "", example_response: "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.objection_type?.trim()) { toast.error("Objection type is required"); return; }
    setSaving(true);
    try { await onSave(form); } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <div className="border rounded-xl p-5 bg-white space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Objection Type *</label>
        <input value={form.objection_type || ""} onChange={e => setForm(f => ({ ...f, objection_type: e.target.value }))}
          placeholder='e.g. "Too expensive" or "We use a competitor"'
          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Rebuttal Strategy</label>
        <textarea value={form.rebuttal_strategy || ""} onChange={e => setForm(f => ({ ...f, rebuttal_strategy: e.target.value }))}
          placeholder="How should the AI pivot when it hears this objection?"
          rows={3} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-y" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Example Response</label>
        <textarea value={form.example_response || ""} onChange={e => setForm(f => ({ ...f, example_response: e.target.value }))}
          placeholder="A concrete example reply the AI can model after"
          rows={3} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-y" />
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60" style={{ backgroundColor: "#ff5a1f" }}>
          {saving ? "Saving..." : "Save Card"}
        </button>
        <button onClick={onCancel} className="px-5 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  );
}

function BattlecardsTab() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setCards(await api.hub.listBattlecards()); } catch { /**/ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    if (editing === "new") {
      await api.hub.createBattlecard(form);
      toast.success("Battlecard created");
    } else {
      await api.hub.updateBattlecard(editing.id, form);
      toast.success("Battlecard updated");
    }
    setEditing(null);
    load();
  };

  const handleDelete = async (id) => {
    await api.hub.deleteBattlecard(id);
    toast.success("Battlecard deleted");
    load();
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Battlecards</h2>
          <p className="text-sm text-gray-500 mt-0.5">Define how your AI handles objections. Attach cards to campaigns to inject rebuttal strategies.</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing("new")} data-testid="create-battlecard-btn" className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: "#ff5a1f" }}>
            <Plus className="w-4 h-4" /> New Card
          </button>
        )}
      </div>

      {editing && (
        <div className="mb-6">
          <BattlecardForm card={editing === "new" ? null : editing} onSave={handleSave} onCancel={() => setEditing(null)} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : cards.length === 0 && !editing ? (
        <div className="border-2 border-dashed rounded-xl p-10 text-center text-gray-400">
          <Sword className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No battlecards yet</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {cards.map(c => (
            <div key={c.id} className="border rounded-xl p-4 bg-white">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900 mb-1">{c.objection_type}</p>
                  {c.rebuttal_strategy && <p className="text-xs text-gray-500 line-clamp-2">{c.rebuttal_strategy}</p>}
                </div>
                <div className="flex gap-1 ml-3 flex-shrink-0">
                  <button onClick={() => setEditing(c)} className="p-2 text-gray-400 hover:text-gray-700"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(c.id)} className="p-2 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Guardrails Tab ───────────────────────────────────────────────────────────
function GuardrailsTab() {
  const [form, setForm] = useState({ blocked_keywords: [], hard_rules: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");

  useEffect(() => {
    api.hub.getGuardrails().then(g => setForm({ blocked_keywords: g.blocked_keywords || [], hard_rules: g.hard_rules || "" })).catch(() => {});
    setLoading(false);
  }, []);

  const addKeyword = () => {
    const kw = newKeyword.trim();
    if (!kw || form.blocked_keywords.includes(kw)) return;
    setForm(f => ({ ...f, blocked_keywords: [...f.blocked_keywords, kw] }));
    setNewKeyword("");
  };

  const removeKeyword = (kw) => setForm(f => ({ ...f, blocked_keywords: f.blocked_keywords.filter(k => k !== kw) }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.hub.saveGuardrails(form);
      toast.success("Guardrails saved");
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900">Guardrails</h2>
        <p className="text-sm text-gray-500 mt-0.5">Hard constraints applied globally to all AI-generated emails for your account.</p>
      </div>

      {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Blocked Words & Phrases</label>
            <p className="text-xs text-gray-400 mb-3">The AI will never use these in any generated copy.</p>
            <div className="flex gap-2 mb-3">
              <input
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addKeyword()}
                placeholder="Type a word and press Enter"
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                data-testid="guardrail-keyword-input"
              />
              <button onClick={addKeyword} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: "#ff5a1f" }}>Add</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.blocked_keywords.map(kw => (
                <span key={kw} className="flex items-center gap-1 px-3 py-1 bg-red-50 border border-red-200 text-red-700 text-xs rounded-full">
                  {kw}
                  <button onClick={() => removeKeyword(kw)} className="ml-0.5 text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                </span>
              ))}
              {form.blocked_keywords.length === 0 && <p className="text-xs text-gray-400">No blocked words yet</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Hard Rules</label>
            <p className="text-xs text-gray-400 mb-2">E.g. "Never promise exact ROI. Never mention pricing in cold emails."</p>
            <textarea
              value={form.hard_rules || ""}
              onChange={e => setForm(f => ({ ...f, hard_rules: e.target.value }))}
              placeholder="Enter your hard brand constraints, one per line..."
              rows={6}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-y"
              data-testid="guardrails-hard-rules"
            />
          </div>

          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-60" style={{ backgroundColor: "#ff5a1f" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Guardrails
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AiHub() {
  const [activeTab, setActiveTab] = useState("kb");

  return (
    <div className="h-full flex flex-col bg-gray-50" data-testid="ai-hub-page">
      {/* Header */}
      <div className="px-6 py-5 border-b bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#ff5a1f" }}>
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">AI Hub</h1>
            <p className="text-sm text-gray-500">Configure the knowledge, tone, and messaging your AI agents use</p>
          </div>
        </div>
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "kb"          && <KnowledgeTab />}
        {activeTab === "tone"        && <ToneTab />}
        {activeTab === "offers"      && <OffersTab />}
        {activeTab === "playbooks"   && <PlaybooksTab />}
        {activeTab === "battlecards" && <BattlecardsTab />}
        {activeTab === "guardrails"  && <GuardrailsTab />}
      </div>
    </div>
  );
}
