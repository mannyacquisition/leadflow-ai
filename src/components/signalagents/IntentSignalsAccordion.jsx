import React, { useState } from "react";
import { ChevronUp, ChevronDown, X, Info, Lightbulb, Eye } from "lucide-react";

// ─── Mascot icons (emoji-based, mapped per section) ──────────────────────────
const MASCOTS = {
  you:         "🧑‍💻", // laptop
  keywords:    "🔗", // linkedin-ish
  influencers: "🔍", // magnifying glass
  triggers:    "💼", // briefcase
  competitors: "🏢", // company/heart
};

// ─── Best Practices Widget ────────────────────────────────────────────────────
function BestPracticesWidget() {
  return (
    <div className="flex items-center gap-3 bg-white border rounded-xl px-4 py-3 shadow-sm min-w-[220px]">
      <div className="w-9 h-9 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
        <Lightbulb className="w-5 h-5 text-yellow-500" />
      </div>
      <div>
        <div className="text-sm font-semibold text-gray-900">Best Practices</div>
        <div className="text-xs text-gray-400">Improve your agent results</div>
      </div>
      <button className="ml-2 text-gray-300 hover:text-gray-500">
        <Eye className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Accordion Section Wrapper ───────────────────────────────────────────────
function AccordionSection({ id, openId, onToggle, mascot, title, description, badge, children }) {
  const isOpen = openId === id;
  return (
    <div
      className="rounded-xl border overflow-hidden transition-all"
      style={{ borderColor: isOpen ? "#ff5a1f" : "#e5e7eb", borderWidth: isOpen ? 2 : 1 }}
    >
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ backgroundColor: isOpen ? "#fff7f4" : "#fff" }}
        onClick={() => onToggle(id)}
      >
        <div className="flex items-center gap-3">
          {/* Mascot circle */}
          <div className="w-11 h-11 rounded-full bg-orange-50 flex items-center justify-center text-xl flex-shrink-0 border border-orange-100">
            {mascot}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-[15px]">{title}</span>
              {badge > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-bold rounded-full bg-orange-100 text-orange-600 min-w-[20px] text-center">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>
      {isOpen && <div className="px-5 pb-5 pt-4 border-t border-gray-100">{children}</div>}
    </div>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
function Tooltip({ text, children }) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </span>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <p className="text-sm font-medium text-gray-700 flex items-center gap-1 mb-2">
    <span style={{ color: "#ff5a1f" }}>↪</span> {children}
  </p>
);

const HintText = ({ children }) => (
  <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{children}</p>
);

// Account selector with "Connected" badge
const AccountSelect = ({ value, onChange }) => (
  <div className="flex items-center gap-2">
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 pr-8 appearance-none bg-white"
      >
        <option value="first">First account</option>
        <option value="second">Second account</option>
        <option value="third">Third account</option>
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
    <span className="text-xs font-semibold text-green-600">Connected</span>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function IntentSignalsAccordion({ form, setForm }) {
  const [openId, setOpenId] = useState(null);
  const [keywordInput, setKeywordInput] = useState("");
  const [influencerInput, setInfluencerInput] = useState("");
  const [competitorInput, setCompetitorInput] = useState("");

  // Mutual exclusivity: only one open at a time
  const toggle = (id) => setOpenId(prev => prev === id ? null : id);

  // ── Badge counts ──
  const youBadge = [
    form.linkedin_page_url,
    form.linkedin_profile_url,
    form.track_profile_visitors,
    form.company_followers_url,
  ].filter(Boolean).length;

  const triggerBadge = [
    form.track_top_profiles,
    form.track_funding_events,
    form.track_job_changes,
  ].filter(Boolean).length;

  const keywordsBadge = (form.keywords || []).length;
  const influencersBadge = (form.influencer_urls || []).length;
  const competitorsBadge = (form.competitor_urls || []).length;

  const totalSignals = youBadge + triggerBadge + keywordsBadge + influencersBadge + competitorsBadge;

  // ── Keyword helpers ──
  const addKeyword = () => {
    const text = keywordInput.trim();
    if (!text) return;
    setForm(f => ({ ...f, keywords: [...(f.keywords || []), { text, track_mode: "All" }] }));
    setKeywordInput("");
  };
  const removeKeyword = (idx) => setForm(f => ({ ...f, keywords: f.keywords.filter((_, i) => i !== idx) }));
  const setKeywordMode = (idx, mode) =>
    setForm(f => ({ ...f, keywords: f.keywords.map((k, i) => i === idx ? { ...k, track_mode: mode } : k) }));

  // ── Influencer helpers ──
  const addInfluencer = () => {
    const url = influencerInput.trim();
    if (!url) return;
    setForm(f => ({ ...f, influencer_urls: [...(f.influencer_urls || []), url] }));
    setInfluencerInput("");
  };
  const removeInfluencer = (idx) => setForm(f => ({ ...f, influencer_urls: f.influencer_urls.filter((_, i) => i !== idx) }));

  // ── Competitor helpers ──
  const addCompetitor = () => {
    const url = competitorInput.trim();
    if (!url) return;
    setForm(f => ({ ...f, competitor_urls: [...(f.competitor_urls || []), url] }));
    setCompetitorInput("");
  };
  const removeCompetitor = (idx) => setForm(f => ({ ...f, competitor_urls: f.competitor_urls.filter((_, i) => i !== idx) }));

  return (
    <div>
      {/* Header row with Best Practices widget */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">Configure Intent Signals</h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">
              {totalSignals} / 15 signals
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">Define what signals the AI agent should look for to identify potential leads</p>
        </div>
        <BestPracticesWidget />
      </div>

      <div className="space-y-3 mt-5">

        {/* ── 1. You & Your Company ── */}
        <AccordionSection
          id="you" openId={openId} onToggle={toggle}
          mascot={MASCOTS.you}
          title="You & Your company"
          description="Detect people engaging with your company or your team"
          badge={youBadge}
        >
          <p className="text-sm text-gray-500 mb-4">Configure signals related to your company.</p>
          <div className="space-y-5">

            {/* Company LinkedIn Page */}
            <div>
              <SectionLabel>Your company LinkedIn Page <Tooltip text="Add your company's LinkedIn page to detect people who interact with your brand. This includes likes, comments, or mentions on your company page."><Info className="w-3 h-3 inline text-gray-400 cursor-pointer" /></Tooltip></SectionLabel>
              <input
                value={form.linkedin_page_url || ""}
                onChange={e => setForm(f => ({ ...f, linkedin_page_url: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                placeholder="https://www.linkedin.com/company/growthcodex/"
              />
              <HintText>URL must start with https://www.linkedin.com/company/... - This is useful only if your company page has published posts.</HintText>
            </div>

            {/* Your LinkedIn Profile */}
            <div>
              <SectionLabel>Your LinkedIn Profile <Tooltip text="Add your personal LinkedIn profile to detect people who interact with your posts. This includes likes, comments, or shares on your profile posts."><Info className="w-3 h-3 inline text-gray-400 cursor-pointer" /></Tooltip></SectionLabel>
              <input
                value={form.linkedin_profile_url || ""}
                onChange={e => setForm(f => ({ ...f, linkedin_profile_url: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                placeholder="https://www.linkedin.com/in/your-profile"
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
              <AccountSelect
                value={form.profile_visitors_account || "first"}
                onChange={v => setForm(f => ({ ...f, profile_visitors_account: v }))}
              />
              <HintText>
                This signal requires Linkedin Premium or Sales Navigator – You must have connected{" "}
                <a href="#" className="text-blue-500 underline">your LinkedIn account to Gojiberry</a>
              </HintText>
            </div>

            {/* Company Followers */}
            <div>
              <SectionLabel>Your company Followers</SectionLabel>
              <div className="flex items-center gap-2">
                <input
                  value={form.company_followers_url || ""}
                  onChange={e => setForm(f => ({ ...f, company_followers_url: e.target.value }))}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                  placeholder="https://www.linkedin.com/company/107433042"
                />
                <AccountSelect
                  value={form.company_followers_account || "first"}
                  onChange={v => setForm(f => ({ ...f, company_followers_account: v }))}
                />
              </div>
              <HintText>
                This signal requires selecting an account with administrator access to the LinkedIn company page – You must have connected{" "}
                <a href="#" className="text-blue-500 underline">your LinkedIn account to Gojiberry</a>
              </HintText>
            </div>
          </div>
        </AccordionSection>

        {/* ── 2. Engagement & Interest (Keywords) ── */}
        <AccordionSection
          id="keywords" openId={openId} onToggle={toggle}
          mascot={MASCOTS.keywords}
          title="Engagement & Interest"
          description="Find people who recently engaged with relevant content on LinkedIn"
          badge={keywordsBadge}
        >
          <p className="text-sm text-gray-500 mb-4">
            Track content mentioning keywords in your niche. Examples: "Cold email", "ISO27001", "Hubspot CRM", etc.
          </p>
          <div className="flex items-center gap-3 mb-3">
            <SectionLabel>Keywords research <Info className="w-3 h-3 inline text-gray-400" /></SectionLabel>
            <button className="flex items-center gap-1 text-xs text-orange-500 font-medium hover:opacity-80">
              ✨ Generate with AI
            </button>
          </div>

          {/* Input */}
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
            >Add</button>
          </div>

          {/* Keyword rows */}
          <div className="space-y-2">
            {(form.keywords || []).map((kw, idx) => (
              <div key={idx} className="flex items-center justify-between border rounded-lg px-3 py-2.5 gap-2">
                <div className="flex items-center gap-2 min-w-[100px]">
                  <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                  <span className="text-sm text-gray-800 font-medium">"{kw.text}"</span>
                </div>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <span className="text-xs text-gray-400">Track:</span>
                  {["Posts", "Likes", "Comments", "All"].map(mode => (
                    <label key={mode} className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                      <input
                        type="radio"
                        name={`kw-${idx}`}
                        value={mode}
                        checked={kw.track_mode === mode}
                        onChange={() => setKeywordMode(idx, mode)}
                        className="w-3.5 h-3.5 accent-purple-600"
                      />
                      <span className="text-xs text-gray-700">{mode}</span>
                    </label>
                  ))}
                  <Info className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                </div>
                <button onClick={() => removeKeyword(idx)} className="text-gray-300 hover:text-gray-500 ml-1 flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </AccordionSection>

        {/* ── 3. LinkedIn Profiles (Influencers) ── */}
        <AccordionSection
          id="influencers" openId={openId} onToggle={toggle}
          mascot={MASCOTS.influencers}
          title="LinkedIn Profiles"
          description="Spot people engaging with relevant LinkedIn profiles in your niche — in real time"
          badge={influencersBadge}
        >
          <p className="text-sm text-gray-500 mb-4">Track influencers, creators or any other LinkedIn profiles in your niche.</p>
          <SectionLabel>Profiles / Experts / Influencers <Info className="w-3 h-3 inline text-gray-400" /></SectionLabel>

          <div className="flex gap-2 mb-1">
            <input
              value={influencerInput}
              onChange={e => setInfluencerInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addInfluencer()}
              placeholder="https://linkedin.com/in/expert-profile"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            <button onClick={addInfluencer} className="px-4 py-2 text-sm font-medium rounded-lg border" style={{ color: "#ff5a1f", borderColor: "#ff5a1f" }}>Add</button>
          </div>
          <HintText>URL must start with https://www.linkedin.com/in/...</HintText>

          <div className="space-y-2 mt-3">
            {(form.influencer_urls || []).map((url, idx) => (
              <div key={idx} className="flex items-center justify-between border rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{url}</span>
                </div>
                <button onClick={() => removeInfluencer(idx)} className="text-gray-300 hover:text-gray-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </AccordionSection>

        {/* ── 4. Change & Trigger Events ── */}
        <AccordionSection
          id="triggers" openId={openId} onToggle={toggle}
          mascot={MASCOTS.triggers}
          title="Change & Trigger Events"
          description="Job changes, new hires, or funding announcements that suggest buying intent"
          badge={triggerBadge}
        >
          <p className="text-sm text-gray-500 mb-4">Monitor organizational changes and trigger events that indicate opportunity.</p>
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
                <label htmlFor={item.key} className="text-sm text-gray-700 cursor-pointer">{item.label}</label>
                <Info className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
              </div>
            ))}
          </div>
        </AccordionSection>

        {/* ── 5. Companies & Competitors Engagement ── */}
        <AccordionSection
          id="competitors" openId={openId} onToggle={toggle}
          mascot={MASCOTS.competitors}
          title="Companies & Competitors Engagement"
          description="Track Leads following or interacting with competitors or other companies"
          badge={competitorsBadge}
        >
          <p className="text-sm text-gray-500 mb-4">See who is engaging with other LinkedIn companies pages.</p>
          <SectionLabel>Add a LinkedIn URL <Info className="w-3 h-3 inline text-gray-400" /></SectionLabel>

          <div className="flex gap-2 mb-1">
            <input
              value={competitorInput}
              onChange={e => setCompetitorInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCompetitor()}
              placeholder="https://linkedin.com/company/competitor-name"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            <button onClick={addCompetitor} className="px-4 py-2 text-sm font-medium rounded-lg border" style={{ color: "#ff5a1f", borderColor: "#ff5a1f" }}>Add</button>
          </div>
          <HintText>URL must start with https://www.linkedin.com/company/***</HintText>

          <div className="space-y-2 mt-3">
            {(form.competitor_urls || []).map((url, idx) => (
              <div key={idx} className="flex items-center justify-between border rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{url}</span>
                </div>
                <button onClick={() => removeCompetitor(idx)} className="text-gray-300 hover:text-gray-500">
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