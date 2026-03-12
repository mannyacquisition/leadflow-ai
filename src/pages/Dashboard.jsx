import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Zap, MessageSquare, Users, ChevronRight, Flame } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const activityData = [
  { date: "Jan 18", leads: 20, invitations: 15, messages: 10 },
  { date: "Jan 22", leads: 35, invitations: 25, messages: 18 },
  { date: "Jan 26", leads: 28, invitations: 40, messages: 22 },
  { date: "Jan 30", leads: 55, invitations: 60, messages: 35 },
  { date: "Feb 3", leads: 140, invitations: 100, messages: 65 },
  { date: "Feb 7", leads: 80, invitations: 75, messages: 50 },
  { date: "Feb 11", leads: 60, invitations: 55, messages: 40 },
  { date: "Feb 14", leads: 45, invitations: 50, messages: 35 },
  { date: "Feb 17", leads: 70, invitations: 65, messages: 45 },
];

const FireScore = ({ score }) => (
  <span className="flex gap-0.5">
    {[1, 2, 3].map(i => (
      <span key={i} className={i <= score ? "opacity-100" : "opacity-20"}>🔥</span>
    ))}
  </span>
);

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ totalLeads: 0, hotLeads: 0, contacted: 0, replies: 0 });
  const [hotLeadsList, setHotLeadsList] = useState([]);
  const [latestReplies, setLatestReplies] = useState([]);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});

    // Load real data in parallel
    Promise.all([
      base44.entities.Lead.list("-created_date", 1000),
      base44.entities.Message.filter({ direction: "inbound" }, "-created_date", 5),
    ]).then(([leads, replies]) => {
      const hot = leads.filter(l => l.is_hot || l.ai_score === 3);
      const contacted = leads.filter(l => l.status === "contacted" || l.status === "approved");
      setStats({
        totalLeads: leads.length,
        hotLeads: hot.length,
        contacted: contacted.length,
        replies: replies.length,
      });
      setHotLeadsList(hot.slice(0, 3));
      setLatestReplies(replies.slice(0, 3));
    }).catch(() => {});
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome {user?.full_name?.split(" ")[0] || "back"} 🚀
          </h1>
          <p className="text-gray-500 text-sm mt-1">Your agents have generated $26 of opportunities since launch</p>
        </div>
        <div className="flex gap-3">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-200">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            25 Active Signal(s)
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-200">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            2 LinkedIn Account(s)
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#fff3ef" }}>
              <Zap className="w-4 h-4" style={{ color: "#ff5a1f" }} />
            </div>
            <span className="text-sm font-medium text-gray-600">Total Leads</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.totalLeads}</div>
          <div className="text-xs text-gray-400 mt-1">In your CRM</div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-50">
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
            <span className="text-sm font-medium text-gray-600">Hot Opportunities</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.hotLeads}</div>
          <div className="text-xs text-gray-400 mt-1">🔥 Score 3 leads</div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50">
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-sm font-medium text-gray-600">Leads Engaged</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.contacted}</div>
          <div className="text-xs text-gray-400 mt-1">Contacted or approved</div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-50">
              <MessageSquare className="w-4 h-4 text-green-500" />
            </div>
            <span className="text-sm font-medium text-gray-600">Conversations Started</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.replies}</div>
          <div className="text-xs text-gray-400 mt-1">Inbound replies</div>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Activity Overview</h2>
            <p className="text-sm text-gray-500">Track your lead generation & outreach performance</p>
          </div>
          <select className="text-sm border rounded-lg px-3 py-1.5 text-gray-600">
            <option>Last 30 days</option>
            <option>Last 7 days</option>
            <option>Last 90 days</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={activityData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="leads" stroke="#10b981" strokeWidth={2} dot={false} name="Leads created" />
            <Line type="monotone" dataKey="invitations" stroke="#6366f1" strokeWidth={2} dot={false} name="Invitations sent" />
            <Line type="monotone" dataKey="messages" stroke="#f59e0b" strokeWidth={2} dot={false} name="Messages sent" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-2 gap-4">
        {/* Hot Leads */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-orange-500">🔥</span>
                <h3 className="font-semibold text-gray-900">Latest Hot Leads</h3>
              </div>
              <p className="text-xs text-gray-400">Your most promising prospects</p>
            </div>
            <button className="text-xs text-orange-500 font-medium flex items-center gap-1">
              View More <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {hotLeads.map((lead, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-semibold">
                    {lead.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{lead.name}</div>
                    <div className="text-xs text-gray-500">{lead.title} · {lead.company}</div>
                  </div>
                </div>
                <FireScore score={lead.score} />
              </div>
            ))}
          </div>
        </div>

        {/* Latest Replies */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold text-gray-900">Latest Replies</h3>
              </div>
              <p className="text-xs text-gray-400">Recent conversation responses</p>
            </div>
            <button className="text-xs text-orange-500 font-medium flex items-center gap-1">
              View More <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {latestReplies.map((reply, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-semibold">
                  {reply.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{reply.name}</div>
                  <div className="text-xs text-gray-500 truncate">{reply.message}</div>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{reply.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}