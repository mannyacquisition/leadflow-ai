import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Cpu, Database, Wrench, BookOpen, Activity, Clock, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const StatCard = ({ label, value, icon: Icon, color, to }) => (
  <Link to={to || "#"} className="block">
    <div className={`rounded-xl border border-gray-800 bg-gray-900 p-5 hover:border-${color}-500/50 transition-colors`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-400">{label}</span>
        <div className={`w-8 h-8 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>
          <Icon className={`w-4 h-4 text-${color}-400`} />
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value ?? "—"}</div>
    </div>
  </Link>
);

export default function AdminOverview() {
  const [overview, setOverview] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.request("/admin/overview"),
      api.request("/admin/orchestration/threads?limit=10"),
    ]).then(([ov, threads]) => {
      setOverview(ov);
      setExecutions(threads);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const STATUS_COLORS = {
    completed: "text-green-400",
    running: "text-blue-400",
    failed: "text-red-400",
    pending_human_approval: "text-yellow-400",
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">God Mode Overview</h1>
        <p className="text-gray-400 text-sm mt-1">Multi-agent orchestration platform status</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Agent Nodes" value={overview?.agent_count} icon={Cpu} color="purple" to="/admin/studio" />
        <StatCard label="Tools Registered" value={overview?.tool_count} icon={Wrench} color="blue" to="/admin/tools" />
        <StatCard label="KB Files" value={overview?.knowledge_files} icon={BookOpen} color="green" to="/admin/knowledge" />
        <StatCard label="Total Executions" value={overview?.total_executions} icon={Activity} color="orange" to="/admin/logs" />
        <StatCard label="HITL Pending" value={overview?.pending_hitl} icon={Clock} color="yellow" to="/admin/logs" />
      </div>

      {/* Recent Executions */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          Recent Execution Threads
        </h2>
        {loading ? (
          <div className="text-gray-500 text-sm">Loading...</div>
        ) : executions.length === 0 ? (
          <div className="text-center py-8">
            <Zap className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No executions yet.</p>
            <p className="text-gray-600 text-xs mt-1">Use the Simulator in Agent Studio to test your graph.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {executions.map(ex => (
              <div key={ex.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-mono text-gray-300">{ex.id.slice(0, 16)}...</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {ex.signal_category || "manual"} • {ex.total_tokens_used || 0} tokens
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium capitalize ${STATUS_COLORS[ex.status] || "text-gray-400"}`}>
                    {ex.status?.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-gray-600">
                    {ex.created_at ? new Date(ex.created_at).toLocaleTimeString() : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
