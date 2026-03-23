import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Plus, Trash2, Pencil, Globe, Code, Zap, RefreshCw, ChevronRight, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TYPE_COLORS = {
  rest: "bg-blue-900/40 text-blue-300",
  graphql: "bg-pink-900/40 text-pink-300",
  browser: "bg-orange-900/40 text-orange-300",
  smtp: "bg-green-900/40 text-green-300",
  oauth2: "bg-purple-900/40 text-purple-300",
  webhook: "bg-yellow-900/40 text-yellow-300",
  mcp: "bg-cyan-900/40 text-cyan-300",
  direct_sql: "bg-red-900/40 text-red-300",
};

const TYPES = ["rest", "graphql", "webhook", "oauth2", "browser", "smtp", "mcp", "direct_sql"];

const EMPTY_FORM = {
  name: "", description: "", integration_type: "rest",
  endpoint_url: "", auth_headers: {}, openapi_schema: {},
  oauth_config: {},
};

export default function ToolRegistry() {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTool, setEditTool] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [authJson, setAuthJson] = useState("{}");
  const [schemaJson, setSchemaJson] = useState("{}");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.request("/admin/tools").then(setTools).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditTool(null);
    setForm(EMPTY_FORM);
    setAuthJson("{}");
    setSchemaJson("{}");
    setShowForm(true);
  };

  const openEdit = (t) => {
    setEditTool(t);
    setForm({ name: t.name, description: t.description || "", integration_type: t.integration_type, endpoint_url: t.endpoint_url || "", auth_headers: {}, openapi_schema: t.openapi_schema || {} });
    setSchemaJson(JSON.stringify(t.openapi_schema || {}, null, 2));
    setAuthJson("{}");
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let auth = {};
      let schema = {};
      try { auth = JSON.parse(authJson); } catch { toast.error("Invalid auth JSON"); setSaving(false); return; }
      try { schema = JSON.parse(schemaJson); } catch { toast.error("Invalid schema JSON"); setSaving(false); return; }

      const payload = { ...form, auth_headers: auth, openapi_schema: schema };
      if (editTool) {
        await api.request(`/admin/tools/${editTool.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Tool updated");
      } else {
        await api.request("/admin/tools", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Tool registered");
      }
      load();
      setShowForm(false);
    } catch (e) {
      toast.error("Save failed: " + e.message);
    }
    setSaving(false);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete tool "${name}"?`)) return;
    await api.request(`/admin/tools/${id}`, { method: "DELETE" });
    toast.success("Tool deleted");
    setTools(t => t.filter(x => x.id !== id));
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Universal Tool Registry</h1>
          <p className="text-gray-400 text-sm mt-1">Register REST, GraphQL, OAuth2, Browser, SMTP integrations</p>
        </div>
        <button onClick={openCreate} data-testid="add-tool-btn"
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg font-medium">
          <Plus className="w-4 h-4" />
          Register Tool
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-500 mx-auto" /></div>
      ) : tools.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Zap className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p className="font-medium">No tools registered yet</p>
          <p className="text-sm mt-1">Add REST APIs, webhooks, GraphQL endpoints, or browser actions</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tools.map(t => (
            <div key={t.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[t.integration_type] || "bg-gray-800 text-gray-400"}`}>
                      {t.integration_type}
                    </span>
                    {!t.is_active && <span className="px-2 py-0.5 rounded text-xs bg-red-900/30 text-red-400">Disabled</span>}
                  </div>
                  <h3 className="font-semibold text-white text-sm">{t.name}</h3>
                  {t.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{t.description}</p>}
                </div>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => openEdit(t)} className="p-1.5 text-gray-500 hover:text-white rounded transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(t.id, t.name)} className="p-1.5 text-gray-500 hover:text-red-400 rounded transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {t.endpoint_url && (
                <div className="mt-2 text-xs font-mono text-gray-600 truncate bg-gray-800/50 rounded px-2 py-1">
                  {t.endpoint_url}
                </div>
              )}
              <div className="mt-2 flex gap-2 text-xs text-gray-600">
                {t.has_auth && <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>Auth set</span>}
                {t.openapi_schema && Object.keys(t.openapi_schema).length > 0 && <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Schema set</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="font-semibold text-white">{editTool ? "Edit Tool" : "Register New Tool"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Tool Name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  placeholder="e.g. Apify Google News Scraper" />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 resize-none h-16"
                  placeholder="What does this tool do?" />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Integration Type *</label>
                <select value={form.integration_type} onChange={e => setForm({...form, integration_type: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                  {TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Endpoint URL</label>
                <input value={form.endpoint_url} onChange={e => setForm({...form, endpoint_url: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                  placeholder="https://api.example.com/v1/..." />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Auth Headers <span className="text-gray-600">(JSON — existing value hidden for security)</span>
                </label>
                <textarea value={authJson} onChange={e => setAuthJson(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-green-400 font-mono focus:outline-none focus:border-purple-500 h-20 resize-none"
                  placeholder={'{"Authorization": "Bearer sk-...", "x-api-key": "..."}'} />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">OpenAPI Schema / Input Schema (JSON)</label>
                <textarea value={schemaJson} onChange={e => setSchemaJson(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-blue-300 font-mono focus:outline-none focus:border-purple-500 h-28 resize-none"
                  placeholder={'{"method": "POST", "input_schema": {"type": "object", "properties": {...}}}'} />
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-gray-700">
              <button onClick={handleSave} disabled={saving || !form.name}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? "Saving..." : editTool ? "Update Tool" : "Register Tool"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-800 text-gray-300 text-sm rounded-lg hover:bg-gray-700">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
