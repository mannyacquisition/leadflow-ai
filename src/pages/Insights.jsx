import React, { useState } from "react";
import { BarChart3, TrendingUp, Zap } from "lucide-react";

const agents = [
  {
    name: "GrowthCodex - Agent",
    status: "Active",
    color: "#ff5a1f",
    days: {
      "Feb 17": [{ signal: '"cold email"', type: "Engagement & I...", count: 10 }, { signal: "Top 5% of ICP", type: "Engagement & I...", count: 15 }],
      "Feb 16": [{ signal: "Autopilot", type: "Recently chang...", count: 10 }, { signal: "https://www.line...", type: "Linkedin profile...", count: 43 }],
      "Feb 15": [{ signal: "https://www.line...", type: "Linkedin profile...", count: 8 }, { signal: "https://www.line...", type: "Linkedin profile...", count: 8 }],
      "Feb 14": [{ signal: "Autopilot", type: "Recently chang...", count: 10 }, { signal: "Top 5% of ICP", type: "Engagement & I...", count: 12 }],
      "Feb 13": [{ signal: '"AI SDR"', type: "Your company", count: 0 }, { signal: '"AI SDR"', type: "Engagement & I...", count: 15 }],
      "Feb 12": [{ signal: "https://www.line...", type: "Linkedin profile...", count: 27 }, { signal: '"cold email"', type: "Engagement & I...", count: 7 }],
    }
  },
  {
    name: "My Agent",
    status: "Active",
    color: "#ff5a1f",
    days: {
      "Feb 17": [{ signal: '"growth"', type: "Engagement & I...", count: 0 }, { signal: '"b2b saas content"', type: "Engagement & I...", count: 8 }],
      "Feb 16": [{ signal: '"ICP"', type: "Engagement & I...", count: 5 }, { signal: '"B2B SaaS"', type: "Engagement & I...", count: 8 }],
      "Feb 15": [{ signal: '"sales automation"', type: "Engagement & I...", count: 3 }, { signal: '"GTM"', type: "Engagement & I...", count: 2 }],
      "Feb 14": [{ signal: '"claude"', type: "Engagement & I...", count: 4 }, { signal: '"cold email"', type: "Engagement & I...", count: 7 }],
    }
  }
];

const dates = ["Feb 17", "Feb 16", "Feb 15", "Feb 14", "Feb 13", "Feb 12", "Feb 11", "Feb 10"];

const signalSummary = [
  { signal: '"cold email"', type: "Engagement & LinkedIn Post", leads: 45 },
  { signal: "Autopilot Recently changed", type: "Job Change Signal", leads: 38 },
  { signal: "https://www.linkedin... profile", type: "Profile Visitor", leads: 92 },
  { signal: "Top 5% of ICP", type: "ICP Match", leads: 27 },
  { signal: '"AI SDR"', type: "Engagement & LinkedIn Post", leads: 15 },
  { signal: '"growth"', type: "Engagement & LinkedIn Post", leads: 8 },
];

export default function Insights() {
  const [startDate, setStartDate] = useState("01/19/2026");
  const [endDate, setEndDate] = useState("02/18/2026");
  const [filterAgent, setFilterAgent] = useState("GrowthCodex - Agent");

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-500" />
            <h1 className="text-xl font-bold text-gray-900">Insights</h1>
          </div>
          <p className="text-sm text-gray-500">Analytics and performance insights for your lead generation</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <label className="text-gray-500">Start Date</label>
            <input type="text" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="border rounded px-2 py-1 text-xs" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-500">End Date</label>
            <input type="text" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="border rounded px-2 py-1 text-xs" />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
            <div className="flex-1">
              <div className="text-xs text-gray-400 mb-1">Total Leads Generated</div>
              <div className="text-4xl font-bold text-gray-900">739</div>
              <div className="text-xs text-gray-400 mt-1">in the selected period</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
            <div className="flex-1">
              <div className="text-xs text-gray-400 mb-1">Avg Leads/Day</div>
              <div className="text-4xl font-bold text-gray-900">24</div>
              <div className="text-xs text-gray-400 mt-1">daily average</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
            <div className="flex-1">
              <div className="text-xs text-gray-400 mb-1">Active Signals</div>
              <div className="text-4xl font-bold text-gray-900">13</div>
              <div className="text-xs text-gray-400 mt-1">generating leads</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Daily Performance Grid */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="font-semibold text-gray-900">Daily Performance Overview</h2>
            <p className="text-sm text-gray-500">Lead generation by agent across the selected date range</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-500 w-36">AI AGENT</th>
                  {dates.map(d => (
                    <th key={d} className="px-3 py-2.5 text-center font-semibold text-gray-500 min-w-28">
                      <div>{d.split(" ")[0]}</div>
                      <div className="font-normal text-gray-400">{d.split(" ")[1] === "17" ? "Tue" : d.split(" ")[1] === "16" ? "Mon" : d.split(" ")[1] === "15" ? "Sun" : d.split(" ")[1] === "14" ? "Sat" : d.split(" ")[1] === "13" ? "Fri" : d.split(" ")[1] === "12" ? "Thu" : d.split(" ")[1] === "11" ? "Wed" : "Tue"}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, ai) => (
                  <tr key={ai} className="border-t">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: agent.color }}>🔥</div>
                        <div>
                          <div className="font-medium text-gray-800">{agent.name}</div>
                          <div className="text-green-600">● {agent.status}</div>
                        </div>
                      </div>
                    </td>
                    {dates.map(d => (
                      <td key={d} className="px-2 py-3 align-top">
                        <div className="space-y-1">
                          {(agent.days[d] || []).map((item, ii) => (
                            <div key={ii} className="bg-orange-50 rounded p-1.5 text-xs">
                              <div className="font-medium text-gray-800 truncate max-w-24">{item.signal}</div>
                              <div className="text-gray-500 truncate">{item.type}</div>
                              <div className="text-orange-600 font-semibold">{item.count}</div>
                            </div>
                          ))}
                          {(!agent.days[d] || agent.days[d].length === 0) && (
                            <div className="text-gray-300 text-center py-2">—</div>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Signals Performance Summary */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="p-5 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Signals performance summary</h2>
              <p className="text-sm text-gray-500">Total leads generated per signal</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Filter by AI Agent</span>
              <select
                value={filterAgent}
                onChange={e => setFilterAgent(e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-sm"
              >
                <option>GrowthCodex - Agent</option>
                <option>My Agent</option>
              </select>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">SIGNAL</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">TYPE</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">LEADS GENERATED</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {signalSummary.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">{row.signal}</td>
                  <td className="px-5 py-3 text-gray-500">{row.type}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 bg-orange-200 rounded-full flex-1 max-w-24">
                        <div className="h-2 rounded-full" style={{ backgroundColor: "#ff5a1f", width: `${(row.leads / 100) * 100}%` }}></div>
                      </div>
                      <span className="font-semibold text-gray-800">{row.leads}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}