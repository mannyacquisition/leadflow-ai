import React, { useState, useRef, useEffect } from "react";
import { X, ChevronDown, Info } from "lucide-react";

const PILL_CLASS = "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200";

// ── Pill tag list ─────────────────────────────────────────────────────────────
const PillList = ({ items, onRemove }) => (
  <div className="flex flex-wrap gap-1.5 mt-2">
    {items.map((item, i) => (
      <span key={i} className={PILL_CLASS}>
        {item}
        <button onClick={() => onRemove(i)} className="ml-0.5 hover:text-red-800">
          <X className="w-3 h-3" />
        </button>
      </span>
    ))}
  </div>
);

// ── Text input with embedded Add button ───────────────────────────────────────
const TextAddInput = ({ placeholder, onAdd }) => {
  const [val, setVal] = useState("");
  const submit = () => { if (val.trim()) { onAdd(val.trim()); setVal(""); } };
  return (
    <div className="flex items-center border rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-orange-400">
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submit()}
        placeholder={placeholder}
        className="flex-1 px-3 py-2 text-sm outline-none bg-white"
      />
      <button
        onClick={submit}
        className="px-3 py-2 text-sm font-medium text-orange-500 hover:text-orange-600 border-l bg-white"
      >
        Add
      </button>
    </div>
  );
};

// ── Multi-select dropdown ─────────────────────────────────────────────────────
const MultiSelectDropdown = ({ options, selected, onToggle, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const label = selected.length === 0 ? placeholder : `${selected.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-orange-400"
      >
        <span className={selected.length === 0 ? "text-gray-400" : "text-gray-700"}>{label}</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => onToggle(opt)}
                className="w-4 h-4 accent-orange-500 rounded"
              />
              <span className="text-gray-700">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Options ───────────────────────────────────────────────────────────────────
const LOCATIONS = ["All locations", "United States", "Canada", "United Kingdom", "Germany", "France", "Australia", "India", "Brazil", "Europe", "North America", "APAC", "LATAM"];
const INDUSTRIES = ["Software Development & SaaS", "Marketing", "IT Services and IT Consulting", "Financial Services", "Healthcare", "E-commerce", "Real Estate", "Education", "Manufacturing", "Consulting"];
const COMPANY_SIZES = ["1-10 employees", "11-50 employees", "51-200 employees", "201-500 employees", "501-1000 employees", "1001-5000 employees", "5000+ employees"];
const COMPANY_TYPES = ["Private Company", "Startup", "Public Company", "Non-profit", "Government", "Partnership", "Self-employed"];

// ── Main ICP Step ─────────────────────────────────────────────────────────────
export default function IcpStep({ form, setForm }) {
  const addToArr = (field, value) => {
    if (!value || (form[field] || []).includes(value)) return;
    setForm(f => ({ ...f, [field]: [...(f[field] || []), value] }));
  };
  const removeFromArr = (field, idx) => setForm(f => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }));
  const toggleInArr = (field, value) => {
    const arr = form[field] || [];
    setForm(f => ({
      ...f,
      [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
    }));
  };

  const highPrecision = (form.lead_matching_mode || 0) > 50;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Define Your Ideal Customer Profile</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure who your AI <span className="text-orange-500">agent</span> should target when searching for leads.
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-semibold whitespace-nowrap"
          style={{ backgroundColor: "#e53935" }}
        >
          Generate ICP with AI 🪄
        </button>
      </div>

      {/* 2-column grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-5 mt-5">
        {/* LEFT COL */}
        {/* Target Job Titles */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5">Target Job Titles</label>
          <TextAddInput placeholder="e.g., Sales Manager" onAdd={v => addToArr("target_job_titles", v)} />
          <PillList items={form.target_job_titles || []} onRemove={i => removeFromArr("target_job_titles", i)} />
        </div>

        {/* RIGHT COL */}
        {/* Target Locations */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5">Target Locations</label>
          <MultiSelectDropdown
            options={LOCATIONS}
            selected={form.target_locations || []}
            onToggle={v => toggleInArr("target_locations", v)}
            placeholder="All locations"
          />
          <PillList items={form.target_locations || []} onRemove={i => removeFromArr("target_locations", i)} />
        </div>

        {/* Target Industries */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5">Target Industries</label>
          <MultiSelectDropdown
            options={INDUSTRIES}
            selected={form.target_industries || []}
            onToggle={v => toggleInArr("target_industries", v)}
            placeholder="Select industries"
          />
          <PillList items={form.target_industries || []} onRemove={i => removeFromArr("target_industries", i)} />
        </div>

        {/* Company Types */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5">Company Types</label>
          <MultiSelectDropdown
            options={COMPANY_TYPES}
            selected={form.company_types || []}
            onToggle={v => toggleInArr("company_types", v)}
            placeholder="Select types"
          />
          <PillList items={form.company_types || []} onRemove={i => removeFromArr("company_types", i)} />
        </div>

        {/* Company Sizes */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5">Company Sizes</label>
          <MultiSelectDropdown
            options={COMPANY_SIZES}
            selected={form.company_sizes || []}
            onToggle={v => toggleInArr("company_sizes", v)}
            placeholder="Select sizes"
          />
          <PillList items={form.company_sizes || []} onRemove={i => removeFromArr("company_sizes", i)} />
        </div>

        {/* Companies & Keywords to exclude */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5 flex items-center gap-1">
            Companies &amp; Keywords to exclude
            <Info className="w-3.5 h-3.5 text-gray-400" />
          </label>
          <TextAddInput placeholder="e.g., Google" onAdd={v => addToArr("excluded_keywords", v)} />
          <PillList items={form.excluded_keywords || []} onRemove={i => removeFromArr("excluded_keywords", i)} />
        </div>
      </div>

      {/* Lead Matching Mode */}
      <div className="mt-6 flex items-start justify-end gap-4">
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-gray-800 flex items-center gap-1">
              Lead Matching Mode
              <Info className="w-3.5 h-3.5 text-gray-400" />
            </label>
          </div>
          {/* Toggle switch */}
          <div className="flex items-center gap-3 bg-gray-100 rounded-full p-1">
            <button
              onClick={() => setForm(f => ({ ...f, lead_matching_mode: 20 }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${!highPrecision ? "bg-white shadow text-gray-800" : "text-gray-500"}`}
            >
              🔍 Discovery
            </button>
            <button
              onClick={() => setForm(f => ({ ...f, lead_matching_mode: 80 }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${highPrecision ? "text-white shadow" : "text-gray-500"}`}
              style={highPrecision ? { backgroundColor: "#ff5a1f" } : {}}
            >
              High Precision 🎯
            </button>
          </div>
          {highPrecision && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-xs">
              <span className="text-red-500 mt-0.5 text-sm">🎯</span>
              <div>
                <p className="text-xs font-semibold text-red-700">Strict ICP – Fewer, better leads</p>
                <p className="text-xs text-red-500">Only the strongest matches</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Advanced filters */}
      <div className="mt-4 text-center">
        <button className="text-xs text-orange-500 hover:text-orange-600">Advanced filters ▾</button>
      </div>
    </div>
  );
}