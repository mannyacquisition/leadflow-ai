import React, { useState, useEffect, useRef } from "react";
import { api } from "@/api/client";
import { Search, Plus, Download, Mail, Check, X, HelpCircle, ChevronLeft, ChevronRight, Linkedin } from "lucide-react";
import { toast } from "sonner";
import LeadSlideOver from "@/components/contacts/LeadSlideOver";

const LEADS_PER_PAGE = 15;

const FireScore = ({ score }) => (
  <span className="flex gap-0.5">
    {[1, 2, 3].map(i => (
      <span key={i} className={i <= score ? "text-base" : "text-base opacity-20"}>🔥</span>
    ))}
  </span>
);

const FitButtons = ({ fit, onUpdate }) => (
  <div className="flex gap-1">
    <button
      onClick={() => onUpdate("good")}
      className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors ${
        fit === "good" ? "bg-green-500 text-white" : "bg-green-100 text-green-600 hover:bg-green-200"
      }`}
    >
      <Check className="w-3 h-3" />
    </button>
    <button
      onClick={() => onUpdate("maybe")}
      className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors ${
        fit === "maybe" ? "bg-yellow-500 text-white" : "bg-yellow-100 text-yellow-600 hover:bg-yellow-200"
      }`}
    >
      <HelpCircle className="w-3 h-3" />
    </button>
    <button
      onClick={() => onUpdate("bad")}
      className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors ${
        fit === "bad" ? "bg-red-500 text-white" : "bg-red-100 text-red-600 hover:bg-red-200"
      }`}
    >
      <X className="w-3 h-3" />
    </button>
  </div>
);

export default function Contacts() {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [enrichingId, setEnrichingId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);

  const fetchLeads = async (pageNum, searchTerm) => {
    setLoading(true);
    try {
      const allLeads = await api.leads.list({ limit: 100 });
      const filtered = allLeads.filter(l =>
        !searchTerm ||
        l.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setTotal(filtered.length);
      const start = (pageNum - 1) * LEADS_PER_PAGE;
      setLeads(filtered.slice(start, start + LEADS_PER_PAGE));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads(page, search);
  }, [page, search]);

  const pageRef = useRef(page);
  const searchRef = useRef(search);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { searchRef.current = search; }, [search]);

  const handleEnrich = async (lead) => {
    toast.info("Email enrichment coming soon");
  };

  const handleFitUpdate = async (leadId, fit) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, fit_status: fit } : l));
    api.leads.update(leadId, { fit_status: fit }).catch(() => {});
  };

  const totalPages = Math.ceil(total / LEADS_PER_PAGE);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex gap-4 border-b -mb-4">
              <button className="pb-3 text-sm font-medium border-b-2 border-orange-500 text-orange-600">All contacts</button>
              <button className="pb-3 text-sm font-medium text-gray-500 hover:text-gray-700">Lists</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm border rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
              Add to list ▾
            </button>
            <button className="px-3 py-1.5 text-sm border rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
              <Download className="w-4 h-4" /> Export to...
            </button>
            <button className="px-3 py-1.5 text-sm border rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
              <Mail className="w-4 h-4" /> Enrich Email
            </button>
            <button
              className="px-3 py-1.5 text-sm rounded-lg text-white font-medium flex items-center gap-1.5"
              style={{ backgroundColor: "#ff5a1f" }}
            >
              <Plus className="w-4 h-4" /> Add leads
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 bg-white border-b flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
            placeholder="Search by name, email, compa..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <button className="text-sm text-orange-500 font-medium">Add more filters ›</button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="w-10 px-4 py-3 text-left">
                <input type="checkbox" className="rounded" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">CONTACT</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">SIGNAL</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">AI SCORE ↑</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">EMAIL</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">IMPORT DATE</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">LIST</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">FIT</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="9" className="py-12 text-center text-gray-400">Loading leads...</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan="9" className="py-12 text-center text-gray-400">No leads found</td></tr>
            ) : leads.map(lead => (
              <tr key={lead.id} className="hover:bg-orange-50/30 transition-colors">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={selectedIds.includes(lead.id)}
                    onChange={e => setSelectedIds(e.target.checked
                      ? [...selectedIds, lead.id]
                      : selectedIds.filter(id => id !== lead.id)
                    )}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                      style={{ backgroundColor: "#ff5a1f" }}>
                      {lead.name?.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-1">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                        >
                          {lead.name}
                        </button>
                        {lead.linkedin_url && (
                          <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                            <Linkedin className="w-3 h-3 text-blue-600" />
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{lead.job_title}</div>
                      <div className="text-xs text-gray-400">@ {lead.company}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <div className="text-xs text-gray-600">
                    Just engaged with a <span className="text-blue-600 cursor-pointer">LinkedIn post</span>
                  </div>
                  {lead.signal_source && (
                    <div className="text-xs text-gray-400 mt-0.5">Keyword: {lead.signal_source}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <FireScore score={lead.ai_score || 2} />
                </td>
                <td className="px-4 py-3">
                  {lead.email ? (
                    <span className="text-xs text-gray-700">{lead.email}</span>
                  ) : (
                    <button
                      onClick={() => handleEnrich(lead)}
                      disabled={enrichingId === lead.id}
                      className="px-2.5 py-1 text-xs border rounded-lg text-blue-600 border-blue-200 hover:bg-blue-50 flex items-center gap-1"
                    >
                      <Mail className="w-3 h-3" />
                      {enrichingId === lead.id ? "Enriching..." : "Enrich"}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {lead.import_date ? new Date(lead.import_date).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{lead.list_name || "—"}</td>
                <td className="px-4 py-3">
                  <FitButtons fit={lead.fit_status} onUpdate={(fit) => handleFitUpdate(lead.id, fit)} />
                </td>
                <td className="px-4 py-3">
                  <button className="text-xs font-medium" style={{ color: "#ff5a1f" }}>
                    Contact Now ›
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lead Slide-over */}
      {selectedLead && (
        <LeadSlideOver
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={(updated) => {
            setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
            setSelectedLead(updated);
          }}
          onDelete={(id) => {
            setLeads(prev => prev.filter(l => l.id !== id));
            setTotal(t => t - 1);
          }}
        />
      )}

      {/* Pagination */}
      <div className="px-6 py-3 border-t bg-white flex items-center justify-between">
        <span className="text-sm text-gray-500">
          Showing {((page - 1) * LEADS_PER_PAGE) + 1} to {Math.min(page * LEADS_PER_PAGE, total)} of {total} results
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Show:</span>
          <select className="text-sm border rounded px-2 py-1">
            <option>15</option>
            <option>50</option>
            <option>100</option>
          </select>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="w-7 h-7 rounded border flex items-center justify-center text-gray-600 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded border text-sm ${page === p ? "text-white" : "text-gray-600 hover:bg-gray-50"}`}
                style={page === p ? { backgroundColor: "#ff5a1f", borderColor: "#ff5a1f" } : {}}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="w-7 h-7 rounded border flex items-center justify-center text-gray-600 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}