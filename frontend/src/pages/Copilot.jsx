import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Check, X, Flame, Linkedin, ChevronDown, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

const mockLeads = [
  { id: "1", name: "Hans Guntren", title: "Co-Founder, CEO", company: "Deliberately Incorporated", score: 3, signal: "Recently changed jobs", approved: false },
  { id: "2", name: "Mike Cocco", title: "Commercial Growth Director", company: "Decision Flow, LLC", score: 3, approved: false },
  { id: "3", name: "Sergio Gonzalez Gaspar", title: "Co-founder & CEO", company: "Remuner", score: 2, approved: false },
  { id: "4", name: "Stephan Neuberger", title: "Founder", company: "Stoain · Startup", score: 2, approved: false },
  { id: "5", name: "Ahmad Awais", title: "Founder & CEO", company: "CommandCode.ai", score: 3, approved: true },
  { id: "6", name: "Sebastian Mandal", title: "Co-Founder & CEO", company: "Tandermore", score: 2, approved: false },
  { id: "7", name: "Jarrett Dargusch", title: "Co-founder", company: "OneChar.dev", score: 2, approved: false },
  { id: "8", name: "Steven Bennett", title: "Owner", company: "Bright and Early", score: 3, approved: true },
  { id: "9", name: "Dmitry Pavlotsky", title: "Co-founder | CMO", company: "GameoAnalyze B.V.", score: 2, approved: false },
  { id: "10", name: "Ajay Juneja", title: "Co-founder", company: "Speak With Me, Inc.", score: 2, approved: false },
  { id: "11", name: "Gal Orian Harel", title: "Co-Founder & CEO", company: "Rix", score: 3, approved: true },
];

const defaultMessage = `Hans, congrats on Deliberately.ai!

Quick q - how many times have you re-explained your product and ICP to GPT / Claude this week?

Recently built Monara, AI consultant that generates your strategy and builds your assets in one click. (email outreach, post sign up flows etc.)

Different how? It's built on private benchmark data that YC uses, and $100M SaaS playbooks`;

const FireScore = ({ score }) => (
  <span className="flex gap-0.5">
    {[1, 2, 3].map(i => (
      <span key={i} className={i <= score ? "text-sm" : "text-sm opacity-20"}>🔥</span>
    ))}
  </span>
);

export default function Copilot() {
  const [leads, setLeads] = useState(mockLeads);
  const [selectedLead, setSelectedLead] = useState(mockLeads[0]);
  const [messagesByLead, setMessagesByLead] = useState({});
  const [approving, setApproving] = useState(false);

  // Listen for Monara-triggered refreshes
  useEffect(() => {
    const channel = new BroadcastChannel("monara_updates");
    channel.onmessage = (e) => {
      if (e.data?.type === "REFRESH_LEAD_DATA") {
        // Re-mark leads as approved if Monara approved them
        setLeads(prev => prev.map(l => ({ ...l })));
      }
    };
    return () => channel.close();
  }, []);

  const messageText = messagesByLead[selectedLead?.id] ?? `${selectedLead?.name?.split(" ")[0] || "Hi"}, congrats on ${selectedLead?.company || "your venture"}!\n\nQuick q - how many times have you re-explained your product and ICP to GPT / Claude this week?\n\nRecently built Monara, AI consultant that generates your strategy and builds your assets in one click.\n\nDifferent how? It's built on private benchmark data that YC uses, and $100M SaaS playbooks`;
  const setMessageText = (val) => setMessagesByLead(prev => ({ ...prev, [selectedLead.id]: val }));

  const handleApprove = async () => {
    setApproving(true);
    try {
      await base44.functions.invoke("approveCopilotAction", {
        leadId: selectedLead.id,
        messageBody: messageText,
      });
      setLeads(leads.map(l => l.id === selectedLead.id ? { ...l, approved: true } : l));
      toast.success(`Action approved for ${selectedLead.name}`);
    } catch (e) {
      toast.error("Approval failed");
    }
    setApproving(false);
  };

  const handleRemove = () => {
    setLeads(leads.filter(l => l.id !== selectedLead.id));
    setSelectedLead(leads.find(l => l.id !== selectedLead.id));
    toast.info("Lead removed from queue");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">Goji Copilot</h1>
            <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-600 rounded-full font-medium">Beta</span>
          </div>
          <p className="text-sm text-gray-500">Review and act on AI-recommended leads</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          Manny Artino ▾
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Scheduled Actions */}
        <div className="w-72 border-r bg-white flex-shrink-0 overflow-y-auto">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-gray-900">Scheduled actions</h3>
              <span className="px-2 py-0.5 text-xs rounded-full text-white font-medium" style={{ backgroundColor: "#ff5a1f" }}>Autopilot</span>
              <button className="px-2 py-0.5 text-xs border rounded-full text-gray-600 hover:bg-gray-50">Review</button>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-orange-400"></span>
              Launching in → 16 hours (7 contacts)
            </div>
          </div>

          <div className="divide-y">
            {leads.map(lead => (
              <div
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedLead?.id === lead.id ? "bg-orange-50" : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                    style={{ backgroundColor: "#ff5a1f" }}>
                    {lead.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 truncate">{lead.name}</span>
                      {lead.approved && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{lead.title} · {lead.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        {selectedLead && (
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {/* Lead Header */}
            <div className="bg-white rounded-xl border p-5 mb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold"
                    style={{ backgroundColor: "#ff5a1f" }}>
                    {selectedLead.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-gray-900">{selectedLead.name}</h2>
                      <Linkedin className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-sm text-gray-500">{selectedLead.title} · {selectedLead.company}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FireScore score={selectedLead.score} />
                  <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full">Hot lead</span>
                </div>
              </div>

              {/* Company info */}
              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">COMPANY</div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">{selectedLead.company}</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">11 - 50 employees</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Software Development</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Menlo Park, California, United States</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Deliberately.ai automates intake, organizes facts, and drafts documents — so you can focus on strate...{" "}
                  <button className="text-orange-500">See more</button>
                </p>
              </div>

              {/* Signal */}
              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">SIGNAL DETAILS</div>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-orange-50 text-orange-700 text-xs rounded border border-orange-200">Recently changed jobs</span>
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">Strategic Window: Just hired (&lt;90d)</span>
                </div>
              </div>
            </div>

            {/* Campaign Sequence */}
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">Campaign Sequence</h3>
                  <p className="text-xs text-gray-500">This campaign is scheduled, but you can still edit the messages before they are sent by the AI agent</p>
                </div>
                <button className="text-xs text-orange-500 font-medium">My Campaign ›</button>
              </div>

              {/* Step 1 - Completed */}
              <div className="mb-3 border rounded-lg p-3 bg-green-50 border-green-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">Connection Request</span>
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Completed</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    Executed a day ago
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Step 2 - Message */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-semibold">2</span>
                  <span className="text-sm font-medium text-gray-900">Message</span>
                  <span className="text-xs">✨</span>
                  <span className="ml-auto text-xs text-gray-500">+1 day(s) ▲</span>
                </div>
                <textarea
                  className="w-full text-sm text-gray-700 border rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-orange-500 min-h-32"
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                />

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleApprove}
                    disabled={approving || selectedLead.approved}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedLead.approved
                        ? "bg-green-100 text-green-700"
                        : "bg-green-500 hover:bg-green-600 text-white"
                    }`}
                  >
                    {selectedLead.approved ? (
                      <><Check className="w-4 h-4" /> Approved</>
                    ) : (
                      <><Check className="w-4 h-4" /> {approving ? "Approving..." : "Approve"}</>
                    )}
                  </button>
                  <button onClick={handleRemove} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border text-gray-600 hover:bg-gray-50">
                    <X className="w-4 h-4" /> Remove
                  </button>
                  <div className="ml-auto flex items-center gap-2">
                    <button className="px-3 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50">Export ▾</button>
                    <button className="w-8 h-8 flex items-center justify-center border rounded-lg text-gray-600 hover:bg-gray-50">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}