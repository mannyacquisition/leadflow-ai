import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronDown, Plus } from "lucide-react";

export default function LeadsStep({ form, setForm }) {
  const [lists, setLists] = useState([]);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newListName, setNewListName] = useState("");

  useEffect(() => {
    // Try to load lead lists from Campaign entity (using name as list placeholder)
    base44.entities.Campaign.list("-created_date", 50)
      .then(data => setLists(data))
      .catch(() => {});
  }, []);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    const created = await base44.entities.Campaign.create({ name: newListName.trim(), org_id: "default" });
    setLists(prev => [...prev, created]);
    setForm(f => ({ ...f, lead_list_id: created.id, lead_list_name: created.name }));
    setNewListName("");
    setShowCreateInput(false);
  };

  const selectedList = lists.find(l => l.id === form.lead_list_id);

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Leads Management</h2>
      <p className="text-sm text-gray-500 mb-6">
        Configure how leads will be organized and managed when found by the AI agent.
      </p>

      <div className="border rounded-xl p-5">
        <p className="text-sm font-semibold text-gray-800 mb-1">Automatically add found leads to list</p>
        <p className="text-xs text-gray-400 mb-4">Lists help you organize contacts and launch outreach campaigns more easily.</p>

        <label className="block text-sm font-medium text-gray-700 mb-2">Select list</label>
        <div className="flex items-center gap-3">
          {/* Dropdown */}
          <div className="relative flex-1">
            <select
              value={form.lead_list_id || ""}
              onChange={e => {
                const found = lists.find(l => l.id === e.target.value);
                setForm(f => ({
                  ...f,
                  lead_list_id: e.target.value,
                  lead_list_name: found?.name || "",
                }));
              }}
              className="w-full appearance-none border rounded-lg px-3 py-2.5 pr-8 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              <option value="">Select a list...</option>
              {lists.map(list => (
                <option key={list.id} value={list.id}>
                  {list.name} {list.contacts_count ? `(${list.contacts_count} contacts)` : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Create new list button */}
          {!showCreateInput && (
            <button
              onClick={() => setShowCreateInput(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 border rounded-lg text-sm font-medium text-orange-500 border-orange-300 hover:bg-orange-50 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Create new list
            </button>
          )}
        </div>

        {/* Create new list inline form */}
        {showCreateInput && (
          <div className="flex gap-2 mt-3">
            <input
              autoFocus
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateList()}
              placeholder="New list name..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            <button
              onClick={handleCreateList}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: "#ff5a1f" }}
            >
              Create
            </button>
            <button
              onClick={() => setShowCreateInput(false)}
              className="px-3 py-2 rounded-lg text-sm text-gray-500 border hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        )}

        {form.lead_list_id && (
          <p className="text-xs text-orange-500 mt-3">
            This list is not associated with a campaign. After creating the agent, you will be redirected to the creation of an outreach campaign.
          </p>
        )}
      </div>
    </div>
  );
}