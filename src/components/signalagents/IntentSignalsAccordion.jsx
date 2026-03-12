import React, { useState } from "react";
import { ChevronUp, ChevronDown, X, Info } from "lucide-react";

// ─── Accordion Section Wrapper ───────────────────────────────────────────────
function AccordionSection({ id, openId, onToggle, icon, title, description, badge, children }) {
  const isOpen = openId === id;
  return (
    <div
      className="rounded-xl border-2 overflow-hidden transition-colors"
      style={{ borderColor: isOpen ? "#ff5a1f" : "#e5e7eb" }}
    >
      <button
        className="w-full flex items-center justify-between p-4 text-left"
        style={{ backgroundColor: isOpen ? "#fff7f4" : "#fff" }}
        onClick={() => onToggle(id)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm">{title}</span>
              {badge > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-600">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>
      {isOpen && <div className="px-5 pb-5 pt-3 border-t border-gray-100">{children}</div>}
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <p className="text-sm font-medium text-gray-700 flex items-center gap-1 mb-3">
    <span style={{ color: "#ff5a1f" }}>↪</span> {children}
  </p>
);

const HintText = ({ children }) => (
  <p className="text-xs text-gray-400 mt-1">{children}</p>
);

const AccountSelect = ({ value, onChange }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
  >
    <option value="first">First account</option>
    <option value="second">Second account</option>
    <option value="third">Third account</option>
  </select>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function IntentSignalsAccordion({ form, setForm }) {
  const [openId, setOpenId] = useState(null);
  const [keywordInput, setKeywordInput] = useState("");
  const [influencerInput, setInfluencerInput] = useState("");
  const [competitorInput, setCompetitorInput] = useState("");

  const toggle = (id) => setOpenId(prev => prev === id ? null : id);

  // ── Badge counts ──
  const youBadge = [
    form.linkedin_page_url,
    form.linkedin_profile_url,
    form.track_profile_visitors,
  ].filter(Boolean).length;

  const triggerBadge = [
    form.track_top_profiles,
    form.track_funding_events,
    form.track_job_changes,
  ].filter(Boolean).length;

  const keywordsBadge = (form.keywords || []).length;
  const influencersBadge = (form.influencer_urls || []).length;
  const competitorsBadge = (form.competitor_urls || []).length;

  // ── Keyword helpers ──
  const addKeyword = () => {
    const text = keywordInput.trim();
    if (!text) return;
    setForm(f => ({ ...f, keywords: [...(f.keywords || []), { text, track_mode: "All" }] }));
    setKeywordInput("");
  };

  const removeKeyword = (idx) =>
    setForm(f => ({ ...f, keywords: f.keywords.filter((_, i) => i !== idx) }));

  const setKeywordMode = (idx, mode) =>
    setForm(f => ({
      ...f,
      keywords: f.keywords.map((k, i) => i === idx ? { ...k, track_mode: mode } : k),
    }));

  // ── Influencer helpers ──
  const addInfluencer = () => {
    const url = influencerInput.trim();
    if (!url) return;
    setForm(f => ({ ...f, influencer_urls: [...(f.influencer_urls || []), url] }));
    setInfluencerInput("");
  };

  const removeInfluencer = (idx) =>
    setForm(f => ({ ...f, influencer_urls: f.influencer_urls.filter((_, i) => i !== idx) }));

  // ── Competitor helpers ──
  const addCompetitor = () => {
    const url = competitorInput.trim();
    if (!url) return;
    setForm(f => ({ ...f, competitor_urls: [...(f.competitor_urls || []), url] }));
    setCompetitorInput("");
  };

  const removeCompetitor = (idx) =>
    setForm(f => ({ ...f, competitor_urls: f.competitor_urls.filter((_, i) => i !== idx) }));

  const totalSignals = youBadge + triggerBadge + keywordsBadge + influencersBadge + competitorsBadge;
  const maxSignals = 15;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-lg font-bold text-gray-900">Configure Intent Signals</h2>
        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">
          {totalSignals} / {maxSignals} signals
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-5">Define what signals the AI agent should look for to identify potential leads</p>

      <div className="space-y-3">
        {/* ── 1. You & Your Company ── */}
        <AccordionSection
          id="you"
          openId={openId}
          onToggle={toggle}
          icon="🧑‍💼"
          title="You & Your company"
          description="Detect people engaging with your company or your team"
          badge={youBadge}
        >
          <p className="text-sm text-gray-600 mb-4">Configure signals related to your company.</p>

          <div className="space-y-4">
            {/* Company LinkedIn Page */}
            <div>
              <SectionLabel>Your company LinkedIn Page <Info className="w-3 h-3 inline text-gray-400" /></SectionLabel>
              <input
                value={form.linkedin_page_url || ""}
                onChange={e => setForm(f => ({ ...f, linkedin_page_url: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                placeholder="https://www.linkedin.com/company/growthcodex/"
              />
              <HintText>URL must start with https://www.linkedin.com/company/... - This is useful only if your company page has published posts.</HintText>
            </div>

            {/* LinkedIn Profile */}
            <div>
              <SectionLabel>Your LinkedIn Profile <Info className="w-3 h-3 inline text-gray-400" /></SectionLabel>
              <input
                value={form.linkedin_profile_url || ""}
                onChange={e => setForm(f => ({ ...f, linkedin_profile_url: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                placeholder="https://www.linkedin.com/in/..."
              />
              <HintText>URL must start with https://www.linkedin.com/in/... - This is useful only if you have published posts on LinkedIn.</HintText>
            </div>

            {/* Visited Profile */}
            <div>
              <SectionLabel>Visited Profile</SectionLabel>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="track_visitors"
                  checked={!!form.track_profile_visitors}
                  onChange={e => setForm(f => ({ ...f, track_profile_visitors: e.target.checked }))}
                  className="w-4 h-4 accent-purple-600"
                />
                <label htmlFor="track_visitors" className="text-sm text-gray-700 cursor-pointer">Track your profile visitors</label>
              </div>
              {form.track_profile_visitors && (
                <AccountSelect
                  value={form.profile_visitors_account || "first"}
                  onChange={v => setForm(f => ({ ...f, profile_visitors_account: v }))}
                />
              )}
              <HintText>
                This signal requires Linkedin Premium or Sales Navigator – You must have connected{" "}
                <a href="#" className="text-orange-500 underline">your LinkedIn account to Gojiberry</a>
              </HintText>
            </div>

            {/* Company Followers */}
            <div>
              <SectionLabel>Your company Followers</SectionLabel>
              <div className="flex gap-2">
                <input
                  value={form.company_followers_url || ""}
                  onChange={e => setForm(f => ({ ...f, company_followers_url: e.target.value }))}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                  placeholder="https://www.linkedin.com/company/107433042"
                />
                <AccountSelect
                  value={form.company_followers_account || "second"}
                  onChange={v => setForm(f => ({ ...f, company_followers_account: v }))}
                />
              </div>
              <HintText>
                This signal requires selecting an account with administrator access to the LinkedIn company page – You must have connected{" "}
                <a href="#" className="text-orange-500 underline">your LinkedIn account to Gojiberry</a>
              </HintText>
            </div>
          </div>
        </AccordionSection>

        {/* ── 2. Change & Trigger Events ── */}
        <AccordionSection
          id="triggers"
          openId={openId}
          onToggle={toggle}
          icon="🤵"
          title="Change & Trigger Events"
          description="Job changes, new hires, or funding announcements that suggest buying intent"
          badge={triggerBadge}
        >
          <p className="text-sm text-gray-600 mb-4">Monitor organizational changes and trigger events that indicate opportunity.</p>
          <SectionLabel>Trigger events that suggests buying intent</SectionLabel>
          <div className="space-y-3">
            {[
              { key: "track_top_profiles", label: "Track top 5% active profile in your ICP (Certainly high reply rate)" },
              { key: "track_funding_events", label: "Companies that have recently raised funds" },
              { key: "track_job_changes", label: "Recent job changes (< 90 days)" },
            ].map(item => (
              <div key={item.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={item.key}
                  checked={!!form[item.key]}
                  onChange={e => setForm(f => ({ ...f, [item.key]: e.target.checked }))}
                  className="w-4 h-4 accent-purple-600"
                />
                <label htmlFor={item.key} className="text-sm text-gray-700 cursor-pointer">
                  {item.label}
                </label>
                <Info className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        </AccordionSection>

        {/* ── 3. Engagement & Interest (Keywords) ── */}
        <AccordionSection
          id="keywords"
          openId={openId}
          onToggle={toggle}
          icon="🍅"
          title="Engagement & Interest"
          description="Find people who recently engaged with relevant content on LinkedIn"
          badge={keywordsBadge}
        >
          <p className="text-sm text-gray-600 mb-4">
            Track content mentioning keywords in your niche. Examples: "Cold email", "ISO27001", "Hubspot CRM", etc.
          </p>
          <SectionLabel>Keywords research <Info className="w-3 h-3 inline text-gray-400" /></SectionLabel>

          {/* Input row */}
          <div className="flex gap-2 mb-4">
            <input
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addKeyword()}
              placeholder="Enter a keyword..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            <button
              onClick={addKeyword}
              className="px-4 py-2 text-sm font-medium rounded-lg border"
              style={{ color: "#ff5a1f", borderColor: "#ff5a1f" }}
            >
              Add
            </button>
          </div>

          {/* Keyword list */}
          <div className="space-y-2">
            {(form.keywords || []).map((kw, idx) => (
              <div key={idx} className="flex items-center justify-between border rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                  <span className="text-sm text-gray-800 font-medium min-w-24">"{kw.text}"</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">Track:</span>
                  {["Posts", "Likes", "Comments", "All"].map(mode => (
                    <label key={mode} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`kw-${idx}`}
                        value={mode}
                        checked={kw.track_mode === mode}
                        onChange={() => setKeywordMode(idx, mode)}
                        className="accent-purple-600 w-3.5 h-3.5"
                      />
                      <span className="text-sm text-gray-700">{mode}</span>
                    </label>
                  ))}
                  <Info className="w-3.5 h-3.5 text-gray-400" />
                </div>
                <button onClick={() => removeKeyword(idx)} className="text-gray-400 hover:text-gray-600 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </AccordionSection>

        {/* ── 4. LinkedIn Profiles (Influencers) ── */}
        <AccordionSection
          id="influencers"
          openId={openId}
          onToggle={toggle}
          icon="🤖"
          title="LinkedIn Profiles"
          description="Spot people engaging with relevant LinkedIn profiles in your niche — in real time"
          badge={influencersBadge}
        >
          <p className="text-sm text-gray-600 mb-4">Track influencers, creators or any other LinkedIn profiles in your niche.</p>
          <SectionLabel>Profiles / Experts / Influencers <Info className="w-3 h-3 inline text-gray-400" /></SectionLabel>

          <div className="flex gap-2 mb-1">
            <input
              value={influencerInput}
              onChange={e => setInfluencerInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addInfluencer()}
              placeholder="https://linkedin.com/in/expert-profile"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            <button
              onClick={addInfluencer}
              className="px-4 py-2 text-sm font-medium rounded-lg border"
              style={{ color: "#ff5a1f", borderColor: "#ff5a1f" }}
            >
              Add
            </button>
          </div>
          <HintText>URL must start with https://www.linkedin.com/in/...</HintText>

          <div className="space-y-2 mt-3">
            {(form.influencer_urls || []).map((url, idx) => (
              <div key={idx} className="flex items-center justify-between border rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{url}</span>
                </div>
                <button onClick={() => removeInfluencer(idx)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </AccordionSection>

        {/* ── 5. Companies & Competitors Engagement ── */}
        <AccordionSection
          id="competitors"
          openId={openId}
          onToggle={toggle}
          icon="🏢"
          title="Companies & Competitors Engagement"
          description="Track Leads following or interacting with competitors or other companies"
          badge={competitorsBadge}
        >
          <p className="text-sm text-gray-600 mb-4">See who is engaging with other LinkedIn companies pages.</p>
          <SectionLabel>Add a LinkedIn URL <Info className="w-3 h-3 inline text-gray-400" /></SectionLabel>

          <div className="flex gap-2 mb-1">
            <input
              value={competitorInput}
              onChange={e => setCompetitorInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCompetitor()}
              placeholder="https://linkedin.com/company/competitor-name"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            <button
              onClick={addCompetitor}
              className="px-4 py-2 text-sm font-medium rounded-lg border"
              style={{ color: "#ff5a1f", borderColor: "#ff5a1f" }}
            >
              Add
            </button>
          </div>
          <HintText>URL must start with https://www.linkedin.com/company/***</HintText>

          <div className="space-y-2 mt-3">
            {(form.competitor_urls || []).map((url, idx) => (
              <div key={idx} className="flex items-center justify-between border rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{url}</span>
                </div>
                <button onClick={() => removeCompetitor(idx)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </AccordionSection>
      </div>
    </div>
  );
}