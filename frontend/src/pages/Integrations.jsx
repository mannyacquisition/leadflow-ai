import React from "react";
import { Puzzle, CheckCircle, XCircle, ExternalLink } from "lucide-react";

const integrations = [
  { name: "Trigify.io", description: "Intent signal discovery — track LinkedIn engagement, job changes, and funding events.", category: "Signal Discovery", status: "disconnected", color: "bg-blue-500" },
  { name: "Unipile", description: "Unified LinkedIn and Email outreach API for automated connection requests and messages.", category: "Outreach", status: "disconnected", color: "bg-purple-500" },
  { name: "Twilio (WhatsApp/SMS)", description: "Send and receive WhatsApp and SMS messages via Monara AI assistant.", category: "Messaging", status: "disconnected", color: "bg-red-500" },
  { name: "Slack", description: "Connect Monara AI to your Slack workspace for team notifications and commands.", category: "Messaging", status: "disconnected", color: "bg-green-500" },
  { name: "Discord", description: "Enable Monara AI commands in your Discord server via webhook integration.", category: "Messaging", status: "disconnected", color: "bg-indigo-500" },
];

export default function Integrations() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-2">
          <Puzzle className="w-5 h-5 text-gray-500" />
          <h1 className="text-xl font-bold text-gray-900">Integrations</h1>
        </div>
        <p className="text-sm text-gray-500">Connect your external tools and services</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 gap-4 max-w-4xl">
          {integrations.map((int, i) => (
            <div key={i} className="bg-white rounded-xl border p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl ${int.color} flex items-center justify-center text-white font-bold text-lg`}>
                  {int.name[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{int.name}</span>
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">{int.category}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{int.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {int.status === "connected" ? (
                  <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                    <CheckCircle className="w-4 h-4" /> Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-gray-400">
                    <XCircle className="w-4 h-4" /> Not connected
                  </span>
                )}
                <button className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
                  Configure <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}