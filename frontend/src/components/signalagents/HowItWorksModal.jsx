import React from "react";
import { X, Bot, Filter, Target, List } from "lucide-react";

const steps = [
  { num: 1, title: "Define Your ICP", desc: "Set criteria for your ideal customer: job titles, company size, industry, location." },
  { num: 2, title: "Choose Signals", desc: "Pick the LinkedIn activities that indicate buying intent for your product." },
  { num: 3, title: "Get Qualified Leads", desc: "Leads flow automatically into your inbox, ready for outreach or export." },
];

const CheckItem = ({ children }) => (
  <div className="flex items-start gap-2 text-sm text-gray-700 mt-2">
    <span className="text-green-500 font-bold mt-0.5">✓</span>
    <span>{children}</span>
  </div>
);

const BulletItem = ({ title, sub }) => (
  <div className="mt-3">
    <div className="text-sm font-semibold text-gray-800">• {title}</div>
    {sub && <div className="text-xs text-gray-500 ml-3 mt-0.5">{sub}</div>}
  </div>
);

export default function HowItWorksModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 relative">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-2">
          <div>
            <h2 className="text-xl font-bold text-gray-900">How AI Agents Work</h2>
            <p className="text-sm text-gray-500 mt-0.5">Your complete guide to using Gojiberry effectively</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-6">
          {/* Intro */}
          <p className="text-sm text-gray-600 text-center leading-relaxed">
            Gojiberry helps you find and engage with high-intent prospects on LinkedIn by automating signal detection and lead qualification.
          </p>

          {/* Flow Steps */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-bold text-gray-400 tracking-widest">THE FLOW</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              {steps.map(s => (
                <div key={s.num}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-2" style={{ backgroundColor: "#ffe4d9", color: "#ff5a1f" }}>
                    {s.num}
                  </div>
                  <div className="font-semibold text-sm text-gray-900">{s.title}</div>
                  <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* AI Agents */}
            <div className="border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-5 h-5 text-gray-500" />
                <div>
                  <div className="font-semibold text-sm text-gray-900">AI Agents</div>
                  <div className="text-xs text-gray-500">Automated lead collection that runs for you</div>
                </div>
              </div>
              <BulletItem title="Runs 2–3 times daily" sub="Each agent checks up to 4 of your selected signals every day" />
              <BulletItem title="Automatic collection" sub="New leads matching your criteria are added directly to your inbox" />
              <BulletItem title="Always fresh" sub="Only the latest activity, so you reach people at the right moment" />
            </div>

            {/* ICP Filters */}
            <div className="border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="w-5 h-5 text-gray-500" />
                <div>
                  <div className="font-semibold text-sm text-gray-900">ICP Filters</div>
                  <div className="text-xs text-gray-500">Focus on the right prospects only</div>
                </div>
              </div>
              <BulletItem title="Define your ICP" sub="Job titles, company size, industry, location, and more" />
              <BulletItem title="Automatic filtering" sub="Only leads matching your ICP criteria make it through" />
              <BulletItem title="Smart exclusions" sub="Remove unwanted profiles like students or competitors" />
            </div>
          </div>

          {/* Intent Signals */}
          <div className="border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-gray-500" />
              <div>
                <div className="font-semibold text-sm text-gray-900">Intent Signals</div>
                <div className="text-xs text-gray-500">Track the LinkedIn activities that indicate buying intent</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8">
              <div>
                <CheckItem><strong>Your Company</strong> — People engaging with your team or page</CheckItem>
                <CheckItem><strong>Experts & Creators</strong> — Following thought leaders in your niche</CheckItem>
                <CheckItem><strong>Community & Events</strong> — Members of key groups or event attendees</CheckItem>
              </div>
              <div>
                <CheckItem><strong>Engagement & Interest</strong> — Interacting with industry content</CheckItem>
                <CheckItem><strong>Change & Trigger Events</strong> — Job changes, new hires, or funding</CheckItem>
                <CheckItem><strong>Competitor Engagement</strong> — Engaging with your competitors</CheckItem>
              </div>
            </div>
            <p className="text-xs mt-3 flex items-center gap-1" style={{ color: "#ff5a1f" }}>
              ⓘ Pro Tip: Choose the mix of signals that fits your Ideal Customer Profile. Maximum of 15 signals per agent.
            </p>
          </div>

          {/* Lists & Exports */}
          <div className="border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <List className="w-5 h-5 text-gray-500" />
              <div>
                <div className="font-semibold text-sm text-gray-900">Lists & Exports</div>
                <div className="text-xs text-gray-500">Turn signals into actionable pipeline</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <BulletItem title="Organize by lists" sub="Group leads by campaign, ICP, or priority" />
              <BulletItem title="Export anywhere" sub="Send to your CRM, your outreach campaign, or download as CSV" />
              <BulletItem title="Smart enrichment" sub="Add verified emails to maximize reach" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}