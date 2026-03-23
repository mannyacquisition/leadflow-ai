import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  Handle, Position, Panel
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "@/api/client";
import {
  Cpu, User, GitBranch, AlertCircle, Plus, Save, Play,
  X, ChevronRight, Loader2, Sliders, Wrench, BookOpen, Info,
  CheckCircle, AlertTriangle, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

// ─── Node Role Colors ───────────────────────────────────────────────────────
const ROLE_STYLES = {
  god: { bg: "bg-purple-600", border: "border-purple-500", label: "GOD" },
  manager: { bg: "bg-blue-600", border: "border-blue-500", label: "MGR" },
  worker: { bg: "bg-gray-700", border: "border-gray-600", label: "WKR" },
  evaluator: { bg: "bg-yellow-600", border: "border-yellow-500", label: "HITL" },
};

const PROVIDER_COLORS = {
  anthropic: "text-orange-400",
  openai: "text-green-400",
  gemini: "text-blue-400",
};

// ─── Custom Agent Node ──────────────────────────────────────────────────────
function AgentNode({ data }) {
  const style = ROLE_STYLES[data.agent_role] || ROLE_STYLES.worker;
  return (
    <div
      onClick={() => data.onSelect?.(data)}
      className={`min-w-40 rounded-xl border-2 ${style.border} bg-gray-900 cursor-pointer hover:shadow-lg hover:shadow-purple-900/30 transition-all`}
    >
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !border-purple-400" />
      <div className={`${style.bg} rounded-t-lg px-3 py-1.5 flex items-center justify-between`}>
        <span className="text-xs font-bold text-white tracking-wider">{style.label}</span>
        <span className={`text-xs font-mono ${PROVIDER_COLORS[data.provider] || "text-gray-400"}`}>
          {data.provider?.toUpperCase() || "ANT"}
        </span>
      </div>
      <div className="px-3 py-2">
        <div className="text-sm font-semibold text-white truncate max-w-36">{data.name}</div>
        <div className="text-xs text-gray-500 truncate">{data.model_name}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !border-blue-400" />
    </div>
  );
}

// ─── HITL Gate Node ─────────────────────────────────────────────────────────
function HITLNode({ data }) {
  return (
    <div
      onClick={() => data.onSelect?.(data)}
      className="w-36 rounded-xl border-2 border-yellow-500 bg-gray-900 cursor-pointer hover:shadow-yellow-900/30 hover:shadow-lg transition-all"
    >
      <Handle type="target" position={Position.Top} className="!bg-yellow-500" />
      <div className="bg-yellow-600 rounded-t-lg px-3 py-1.5 flex items-center gap-1">
        <User className="w-3 h-3 text-white" />
        <span className="text-xs font-bold text-white">HITL GATE</span>
      </div>
      <div className="px-3 py-2 text-center">
        <div className="text-sm font-semibold text-white">{data.name}</div>
        <div className="text-xs text-yellow-400 mt-0.5">Awaits approval</div>
      </div>
      <Handle type="source" id="approved" position={Position.Bottom} style={{ left: "30%" }} className="!bg-green-500" />
      <Handle type="source" id="rejected" position={Position.Bottom} style={{ left: "70%" }} className="!bg-red-500" />
    </div>
  );
}

const NODE_TYPES = { agent: AgentNode, hitl: HITLNode };

// ─── Edge Label Colors ───────────────────────────────────────────────────────
const EDGE_COLORS = {
  on_success: "#22c55e",
  on_failure: "#ef4444",
  on_webhook: "#a855f7",
  if_approved: "#22c55e",
  if_rejected: "#ef4444",
  on_tool_failure: "#f97316",
};

// ─── Side Panel: Agent Config Editor ────────────────────────────────────────
function AgentPanel({ agent, tools, kbFiles, onSave, onClose }) {
  const [form, setForm] = useState({ ...agent });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-700 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="font-semibold text-white text-sm">Edit Agent Node</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Name */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Name</label>
          <input value={form.name || ""} onChange={e => setForm({...form, name: e.target.value})}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500" />
        </div>

        {/* Role */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Agent Role</label>
          <select value={form.agent_role || "worker"} onChange={e => setForm({...form, agent_role: e.target.value})}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500">
            <option value="god">God (Entry Point)</option>
            <option value="manager">Manager</option>
            <option value="worker">Worker</option>
            <option value="evaluator">Evaluator (HITL Gate)</option>
          </select>
        </div>

        {/* Provider + Model */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Provider</label>
            <select value={form.provider || "anthropic"} onChange={e => setForm({...form, provider: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500">
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Model</label>
            <input value={form.model_name || ""} onChange={e => setForm({...form, model_name: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono" />
          </div>
        </div>

        {/* Fallback */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Fallback Provider</label>
            <select value={form.fallback_provider || ""} onChange={e => setForm({...form, fallback_provider: e.target.value || null})}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500">
              <option value="">None</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Fallback Model</label>
            <input value={form.fallback_model || ""} onChange={e => setForm({...form, fallback_model: e.target.value || null})}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              placeholder="claude-haiku-..." />
          </div>
        </div>

        {/* Temperature */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Temperature: {(form.temperature ?? 0.7).toFixed(1)}</label>
          <input type="range" min="0" max="1" step="0.1" value={form.temperature ?? 0.7}
            onChange={e => setForm({...form, temperature: parseFloat(e.target.value)})}
            className="w-full accent-purple-500" />
        </div>

        {/* RAG Weights */}
        <div>
          <label className="text-xs text-gray-400 mb-2 block flex items-center gap-1">
            <Sliders className="w-3 h-3" />
            RAG Context Weights
          </label>
          {["global", "user", "product"].map(key => (
            <div key={key} className="mb-2">
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-gray-500 capitalize">{key} KB</span>
                <span className="text-purple-400">{((form.rag_weights?.[key] ?? 0) * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min="0" max="1" step="0.1"
                value={form.rag_weights?.[key] ?? (key === "global" ? 0.3 : key === "user" ? 0.5 : 0.2)}
                onChange={e => setForm({...form, rag_weights: { ...(form.rag_weights || {}), [key]: parseFloat(e.target.value) }})}
                className="w-full accent-purple-500" />
            </div>
          ))}
        </div>

        {/* System Prompt */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">System Prompt</label>
          <textarea value={form.system_prompt || ""} onChange={e => setForm({...form, system_prompt: e.target.value})}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-purple-500 resize-none h-28"
            placeholder="You are a specialist agent that..." />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Description</label>
          <input value={form.description || ""} onChange={e => setForm({...form, description: e.target.value})}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500" />
        </div>
      </div>

      <div className="p-4 border-t border-gray-700">
        <button onClick={handleSave} disabled={saving}
          className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {saving ? "Saving..." : "Save Agent"}
        </button>
      </div>
    </div>
  );
}

// ─── Simulator Panel ─────────────────────────────────────────────────────────
function SimulatorPanel({ onClose }) {
  const [payload, setPayload] = useState(JSON.stringify({
    name: "John Doe",
    company: "TechCorp",
    job_title: "VP of Engineering",
    linkedin_url: "https://linkedin.com/in/johndoe",
    signal: "Commented on your post about AI agents"
  }, null, 2));
  const [category, setCategory] = useState("warm_inbound");
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState([]);
  const [result, setResult] = useState(null);
  const wsRef = useRef(null);

  const run = async () => {
    setRunning(true);
    setEvents([]);
    setResult(null);
    let parsed;
    try { parsed = JSON.parse(payload); }
    catch { toast.error("Invalid JSON payload"); setRunning(false); return; }

    try {
      const res = await api.request("/admin/orchestration/threads/simulate", {
        method: "POST",
        body: JSON.stringify({ payload: parsed, signal_category: category }),
      });
      setEvents(res.events || []);
      setResult(res);
    } catch (e) {
      toast.error("Simulation failed: " + e.message);
    }
    setRunning(false);
  };

  const EVENT_ICONS = {
    agent_start: <Cpu className="w-3.5 h-3.5 text-purple-400" />,
    agent_complete: <CheckCircle className="w-3.5 h-3.5 text-green-400" />,
    agent_error: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
    tool_call: <Wrench className="w-3.5 h-3.5 text-blue-400" />,
    hitl_gate: <User className="w-3.5 h-3.5 text-yellow-400" />,
    thread_start: <Play className="w-3.5 h-3.5 text-gray-400" />,
    thread_complete: <CheckCircle className="w-3.5 h-3.5 text-green-500" />,
    thread_failed: <AlertTriangle className="w-3.5 h-3.5 text-red-400" />,
  };

  return (
    <div className="w-96 bg-gray-900 border-l border-gray-700 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="font-semibold text-white text-sm flex items-center gap-2">
          <Play className="w-4 h-4 text-green-400" />
          Simulator Playground
        </h2>
        <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Signal Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-green-500">
            {["warm_inbound", "topic_authority", "network_sniper", "trigger_event", "competitor_intercept"].map(c => (
              <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Mock Lead Payload (JSON)</label>
          <textarea value={payload} onChange={e => setPayload(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-green-400 font-mono focus:outline-none focus:border-green-500 resize-none h-36" />
        </div>

        <button onClick={run} disabled={running}
          data-testid="run-simulator-btn"
          className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium flex items-center justify-center gap-2">
          {running ? <><Loader2 className="w-4 h-4 animate-spin" />Running...</> : <><Play className="w-4 h-4" />Run Simulation</>}
        </button>

        {/* Events Log */}
        {events.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Execution Trace</div>
            <div className="space-y-1.5">
              {events.map((ev, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="flex-shrink-0 mt-0.5">{EVENT_ICONS[ev.event] || <Info className="w-3.5 h-3.5 text-gray-500" />}</span>
                  <div className="flex-1">
                    <span className="text-gray-400 font-mono">{ev.event}</span>
                    {ev.agent_name && <span className="text-purple-300 ml-1">— {ev.agent_name}</span>}
                    {ev.output_preview && <div className="text-gray-500 mt-0.5 line-clamp-2">{ev.output_preview}</div>}
                    {ev.error && <div className="text-red-400 mt-0.5">{ev.error}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Final Output */}
        {result?.final_output && (
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs font-semibold text-green-400 mb-1">Final Output</div>
            <p className="text-xs text-gray-300 whitespace-pre-wrap">{result.final_output}</p>
            <div className="mt-2 text-xs text-gray-600">
              Status: <span className={result.status === "completed" ? "text-green-400" : "text-red-400"}>{result.status}</span>
              {" | "}{result.total_tokens_used || 0} tokens
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Agent Studio ───────────────────────────────────────────────────────
export default function AgentStudio() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [agents, setAgents] = useState([]);
  const [tools, setTools] = useState([]);
  const [kbFiles, setKbFiles] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newAgentModal, setNewAgentModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");

  const load = useCallback(async () => {
    try {
      const [agentsData, edgesData, toolsData, kbData] = await Promise.all([
        api.request("/admin/agents"),
        api.request("/admin/edges"),
        api.request("/admin/tools"),
        api.request("/admin/knowledge/files"),
      ]);
      setAgents(agentsData);
      setTools(toolsData);
      setKbFiles(kbData);

      // Build React Flow nodes
      const rfNodes = agentsData.map(a => ({
        id: a.id,
        type: a.agent_role === "evaluator" ? "hitl" : "agent",
        position: { x: a.position_x || 0, y: a.position_y || 0 },
        data: {
          ...a,
          onSelect: (data) => setSelectedAgent(data),
        },
      }));

      // Build React Flow edges
      const rfEdges = edgesData.map(e => ({
        id: e.id,
        source: e.source_node_id,
        target: e.target_node_id,
        label: e.condition_type,
        style: { stroke: EDGE_COLORS[e.condition_type] || "#6b7280" },
        labelStyle: { fill: EDGE_COLORS[e.condition_type] || "#9ca3af", fontSize: 10 },
        animated: e.condition_type === "on_success",
      }));

      setNodes(rfNodes);
      setEdges(rfEdges);
    } catch (e) {
      toast.error("Failed to load studio data");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onConnect = useCallback(async (params) => {
    const condition = "on_success"; // default — user can change later
    try {
      await api.request("/admin/edges", {
        method: "POST",
        body: JSON.stringify({
          source_node_id: params.source,
          target_node_id: params.target,
          condition_type: condition,
        }),
      });
      setEdges(eds => addEdge({
        ...params,
        label: condition,
        style: { stroke: EDGE_COLORS[condition] },
        animated: true,
      }, eds));
      toast.success("Edge connected (on_success)");
    } catch (e) {
      toast.error("Failed to create edge");
    }
  }, []);

  const onNodeDragStop = useCallback(async (_event, node) => {
    await api.request(`/admin/agents/${node.id}`, {
      method: "PATCH",
      body: JSON.stringify({ position_x: node.position.x, position_y: node.position.y }),
    }).catch(() => {});
  }, []);

  const handleSaveAgent = async (form) => {
    await api.request(`/admin/agents/${form.id}`, {
      method: "PATCH",
      body: JSON.stringify(form),
    });
    toast.success("Agent saved");
    setSelectedAgent(null);
    load();
  };

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;
    await api.request("/admin/agents", {
      method: "POST",
      body: JSON.stringify({
        name: newAgentName,
        agent_role: "worker",
        provider: "anthropic",
        model_name: "claude-sonnet-4-5-20250929",
        position_x: Math.random() * 400 + 50,
        position_y: Math.random() * 200 + 50,
      }),
    });
    toast.success("Agent created");
    setNewAgentName("");
    setNewAgentModal(false);
    load();
  };

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800">
        <div>
          <h1 className="text-sm font-bold text-white">Agent Studio</h1>
          <p className="text-xs text-gray-500">Visual multi-agent workflow editor</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setNewAgentModal(true)} data-testid="add-agent-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg font-medium">
            <Plus className="w-3.5 h-3.5" />
            Add Node
          </button>
          <button onClick={() => setShowSimulator(!showSimulator)} data-testid="toggle-simulator-btn"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium ${showSimulator ? "bg-green-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}`}>
            <Play className="w-3.5 h-3.5" />
            {showSimulator ? "Hide Simulator" : "Simulator"}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-1.5 bg-gray-900 border-b border-gray-800 flex items-center gap-4 text-xs text-gray-500">
        {Object.entries(EDGE_COLORS).slice(0, 5).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="w-3 h-0.5 rounded" style={{ backgroundColor: c }}></span>
            {k.replace(/_/g, " ")}
          </span>
        ))}
        <span className="ml-auto text-gray-600">Drag to connect nodes • Click to edit</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* React Flow Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={NODE_TYPES}
            fitView
            className="bg-gray-950"
          >
            <Background color="#374151" gap={20} />
            <Controls className="[&>button]:bg-gray-800 [&>button]:border-gray-700 [&>button]:text-white" />
            <MiniMap className="bg-gray-900 border border-gray-700" nodeColor="#7c3aed" />
            <Panel position="top-left">
              {agents.length === 0 && (
                <div className="bg-gray-800/90 backdrop-blur-sm text-gray-300 text-xs px-3 py-2 rounded-lg border border-gray-700">
                  Click "Add Node" to create your first agent
                </div>
              )}
            </Panel>
          </ReactFlow>
        </div>

        {/* Side Panel */}
        {selectedAgent && (
          <AgentPanel
            agent={selectedAgent}
            tools={tools}
            kbFiles={kbFiles}
            onSave={handleSaveAgent}
            onClose={() => setSelectedAgent(null)}
          />
        )}

        {/* Simulator */}
        {showSimulator && !selectedAgent && (
          <SimulatorPanel onClose={() => setShowSimulator(false)} />
        )}
      </div>

      {/* New Agent Modal */}
      {newAgentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-5 w-80">
            <h3 className="font-semibold text-white mb-3">Create Agent Node</h3>
            <input
              autoFocus
              value={newAgentName}
              onChange={e => setNewAgentName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateAgent()}
              placeholder="Agent name (e.g. Lead Scorer)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 mb-3"
            />
            <div className="flex gap-2">
              <button onClick={handleCreateAgent} disabled={!newAgentName.trim()}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg">
                Create
              </button>
              <button onClick={() => setNewAgentModal(false)} className="px-4 py-2 bg-gray-800 text-gray-300 text-sm rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
