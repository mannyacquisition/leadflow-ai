import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/api/client";
import {
  Search, Database, Filter, Download, FolderOpen,
  Linkedin, Link2, ChevronLeft, ChevronRight, BookmarkPlus, Check
} from "lucide-react";
import { toast } from "sonner";
import TagInput from "../components/leaddb/TagInput";
import IndustryDropdown from "../components/leaddb/IndustryDropdown";

const ITEMS_PER_PAGE = 25;

const SkeletonRow = () => (
  <tr className="border-b animate-pulse">
    {[...Array(5)].map((_, i) => (
      <td key={i} className="px-4 py-4">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        {i === 0 && <div className="h-3 bg-gray-100 rounded w-1/2 mt-1.5"></div>}
      </td>
    ))}
    <td className="px-4 py-4"><div className="h-8 w-24 bg-gray-200 rounded-lg"></div></td>
  </tr>
);

const avatarColors = ["#ff5a1f","#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899"];
const getColor = (name) => avatarColors[(name?.charCodeAt(0) || 0) % avatarColors.length];

export default function LeadDatabase() {
  const [filters, setFilters] = useState({ name: "", job_titles: [], locations: [], keywords: [], industries: [] });
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [creditsTotal, setCreditsTotal] = useState(25000);
  const [savedIds, setSavedIds] = useState(new Set());
  const [savingId, setSavingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    api.user.getApiKeysStatus().then(status => {
      // Credits are shown as a static display - real credits would come from Netrows API
    }).catch(() => {});
  }, []);

  const doSearch = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setHasSearched(true);
    // Netrows search requires a configured Netrows API key
    // Show placeholder data with a note
    try {
      // Simulate a search with demo data
      await new Promise(r => setTimeout(r, 600));
      toast.info("Connect your Netrows API key in Settings → API to enable live B2B search");
      setResults([]);
      setTotal(0);
      setPage(pageNum);
    } catch (e) {
      toast.error("Search failed: " + e.message);
    }
    setLoading(false);
  }, [filters]);

  const handleSearch = () => doSearch(1);
  const handlePageChange = (p) => doSearch(p);

  const saveLead = async (lead) => {
    setSavingId(lead.id);
    try {
      await api.leads.create({
        name: lead.name,
        job_title: lead.job_title,
        company: lead.company,
        linkedin_url: lead.linkedin_url,
        location: lead.location,
        signal_category: "manual",
        ai_score: 2,
      });
      setSavedIds(prev => new Set([...prev, lead.id]));
      toast.success(`${lead.name} saved to CRM`);
    } catch (e) {
      toast.error("Save failed");
    }
    setSavingId(null);
  };

  const saveSelected = async () => {
    const toSave = results.filter(r => selectedIds.has(r.id) && !savedIds.has(r.id));
    for (const lead of toSave) await saveLead(lead);
    setSelectedIds(new Set());
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const creditsLeft = creditsTotal - creditsUsed;
  const creditsPercent = Math.round((creditsUsed / creditsTotal) * 100);

  const activeFilterCount = [
    filters.job_titles.length > 0,
    filters.locations.length > 0,
    filters.keywords.length > 0,
    filters.industries.length > 0,
  ].filter(Boolean).length;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-6 py-3 bg-white border-b flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="font-medium text-gray-700">Lead Database</span>
          <span>/</span>
          <span>Search</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
            <FolderOpen className="w-4 h-4" /> My Files
          </button>
          <button
            onClick={saveSelected}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: "#ff5a1f" }}
          >
            <Download className="w-4 h-4" /> Export Leads
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Filter Panel */}
        {showFilters && (
          <div className="w-64 flex-shrink-0 bg-white border-r flex flex-col overflow-y-auto">
            {/* Credits */}
            <div className="px-4 py-4 border-b">
              <div className="flex items-center gap-1.5 mb-1">
                <Database className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-semibold text-gray-600">Monthly Credits</span>
              </div>
              <div className="flex items-baseline gap-1 mb-1.5">
                <span className="text-xl font-bold text-gray-900">{creditsUsed.toLocaleString()}</span>
                <span className="text-sm text-gray-400">/ {creditsTotal.toLocaleString()}</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${creditsPercent}%`, backgroundColor: creditsPercent > 80 ? "#ef4444" : "#ff5a1f" }} />
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-400">
                <span>{creditsLeft.toLocaleString()} credits left</span>
                <span>{creditsPercent}% used</span>
              </div>
            </div>

            {/* Search name */}
            <div className="px-4 pt-4 pb-3 space-y-4">
              <div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    value={filters.name}
                    onChange={e => setFilters(f => ({ ...f, name: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                    placeholder="Search People by Name..."
                    className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  className="w-full py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
                  style={{ backgroundColor: "#1a1f2b" }}
                >
                  <Search className="w-4 h-4" /> Search
                </button>
              </div>

              {activeFilterCount > 0 && (
                <div className="text-xs text-orange-600 font-medium">{activeFilterCount} active filter{activeFilterCount > 1 ? "s" : ""}</div>
              )}

              {/* Job Title */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Job Title</label>
                <TagInput
                  placeholder="e.g. CEO, Founder..."
                  tags={filters.job_titles}
                  onChange={v => setFilters(f => ({ ...f, job_titles: v }))}
                />
              </div>

              {/* Location */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Contact Location</label>
                <TagInput
                  placeholder="e.g. United States..."
                  tags={filters.locations}
                  onChange={v => setFilters(f => ({ ...f, locations: v }))}
                  color="#6366f1"
                />
              </div>

              {/* Keywords */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Keywords</label>
                <TagInput
                  placeholder="e.g. SaaS, AI..."
                  tags={filters.keywords}
                  onChange={v => setFilters(f => ({ ...f, keywords: v }))}
                  color="#10b981"
                />
              </div>

              {/* Industries */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Industries</label>
                <IndustryDropdown
                  selected={filters.industries}
                  onChange={v => setFilters(f => ({ ...f, industries: v }))}
                />
              </div>
            </div>
          </div>
        )}

        {/* Right: Results Table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Table toolbar */}
          <div className="px-5 py-3 bg-white border-b flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-lg px-3 py-1.5"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? "Hide Filters" : "Show Filters"}
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={saveSelected}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-white"
                style={{ backgroundColor: "#ff5a1f" }}
              >
                <BookmarkPlus className="w-4 h-4" /> Save {selectedIds.size} to CRM
              </button>
            )}
            {hasSearched && (
              <span className="text-sm text-gray-500 ml-auto">
                {total.toLocaleString()} leads found {total === 500 && "(demo data)"}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox"
                      checked={selectedIds.size === results.length && results.length > 0}
                      onChange={e => setSelectedIds(e.target.checked ? new Set(results.map(r => r.id)) : new Set())}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">NAME</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">CONTACT LOCATION</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">COMPANY</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">INDUSTRIES</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">KEYWORDS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">ACTION</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  [...Array(10)].map((_, i) => <SkeletonRow key={i} />)
                ) : !hasSearched ? (
                  <tr>
                    <td colSpan={7} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
                          <Database className="w-7 h-7 text-orange-400" />
                        </div>
                        <div className="font-semibold text-gray-700">250M+ B2B Contacts</div>
                        <div className="text-sm text-gray-400 max-w-xs">Use the filters on the left and click <strong>Search</strong> to discover prospects from the Netrows database.</div>
                      </div>
                    </td>
                  </tr>
                ) : results.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-gray-400">No results found. Try different filters.</td>
                  </tr>
                ) : results.map(lead => {
                  const isSaved = savedIds.has(lead.id);
                  const isSelected = selectedIds.has(lead.id);
                  return (
                    <tr key={lead.id} className={`hover:bg-orange-50/30 transition-colors ${isSelected ? "bg-orange-50/50" : ""}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" className="rounded"
                          checked={isSelected}
                          onChange={e => {
                            const next = new Set(selectedIds);
                            e.target.checked ? next.add(lead.id) : next.delete(lead.id);
                            setSelectedIds(next);
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                            style={{ backgroundColor: getColor(lead.name) }}>
                            {lead.name?.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 flex items-center gap-1.5">
                              {lead.name}
                              {lead.linkedin_url && (
                                <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer">
                                  <Linkedin className="w-3 h-3 text-blue-600" />
                                </a>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">{lead.job_title}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[160px]">
                        <div className="truncate">{lead.location}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                            {lead.company?.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-800">{lead.company}</div>
                            <div className="flex gap-1 mt-0.5">
                              <Link2 className="w-3 h-3 text-gray-400" />
                              <Linkedin className="w-3 h-3 text-blue-500" />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          {(lead.industries || []).slice(0, 1).map((ind, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded font-medium">{ind}</span>
                          ))}
                          {(lead.industries || []).length > 1 && (
                            <span className="text-xs text-gray-400">+{lead.industries.length - 1} more</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {(lead.keywords || []).slice(0, 2).map((kw, i) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{kw}</span>
                          ))}
                          {(lead.keywords || []).length > 2 && (
                            <span className="text-xs text-gray-400">+{lead.keywords.length - 2} more</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => !isSaved && saveLead(lead)}
                          disabled={isSaved || savingId === lead.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            isSaved
                              ? "bg-green-100 text-green-700 cursor-default"
                              : "text-white hover:opacity-90"
                          }`}
                          style={!isSaved ? { backgroundColor: "#ff5a1f" } : {}}
                        >
                          {isSaved ? <><Check className="w-3 h-3" /> Saved</> : savingId === lead.id ? "Saving..." : <><BookmarkPlus className="w-3 h-3" /> Save to CRM</>}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {hasSearched && !loading && total > 0 && (
            <div className="px-5 py-3 bg-white border-t flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {((page - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(page * ITEMS_PER_PAGE, total)} of {total.toLocaleString()} leads on this page, {total.toLocaleString()} total
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Previous</span>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`w-7 h-7 rounded text-sm font-medium border ${page === p ? "text-white border-orange-500" : "text-gray-600 hover:bg-gray-50"}`}
                    style={page === p ? { backgroundColor: "#ff5a1f", borderColor: "#ff5a1f" } : {}}
                  >
                    {p}
                  </button>
                ))}
                {totalPages > 5 && <span className="text-gray-400 text-sm">...</span>}
                <button
                  onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="text-sm text-gray-500 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}