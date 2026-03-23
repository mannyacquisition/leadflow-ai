import React, { useState } from "react";
import { X, CheckCircle2 } from "lucide-react";

export default function ManageAddonsModal({ onClose, agentCount = 1 }) {
  const [addons, setAddons] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Manage AI Agent Add-ons</h2>
            <p className="text-sm text-gray-500 mt-0.5">Add or remove agent subscriptions</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-4 space-y-3">
          {/* Base agents */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              <div>
                <div className="font-semibold text-gray-900">Base agents</div>
                <div className="text-sm text-gray-500">Included with your Gojiberry subscription</div>
              </div>
            </div>
            <span className="text-2xl font-bold text-gray-900">2</span>
          </div>

          {/* Add-on agents */}
          <div className="flex items-center justify-between p-4 rounded-xl border-2" style={{ backgroundColor: "#fff7f4", borderColor: "#ff5a1f33" }}>
            <button
              onClick={() => setAddons(a => Math.max(0, a - 1))}
              className="w-8 h-8 rounded-full border flex items-center justify-center text-orange-400 border-orange-300 hover:bg-orange-50 text-lg font-bold"
            >
              −
            </button>
            <div className="text-center">
              <div className="font-semibold text-gray-900">Add-on agents</div>
              <div className="text-sm text-gray-500">$49/month each</div>
            </div>
            <span className="text-2xl font-bold" style={{ color: "#ff5a1f" }}>{addons}</span>
            <button
              onClick={() => setAddons(a => a + 1)}
              className="w-8 h-8 rounded-full border flex items-center justify-center border-orange-400 hover:bg-orange-50 text-lg font-bold"
              style={{ color: "#ff5a1f" }}
            >
              +
            </button>
          </div>

          {addons === 0 && (
            <p className="text-center text-sm text-gray-500 py-2">You don't have any add-on agents yet.</p>
          )}

          {/* CTA */}
          <button
            className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
            style={{ backgroundColor: "#dc2626" }}
          >
            + Add Your First Agent
          </button>
        </div>

        <div className="flex justify-end px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="px-5 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}