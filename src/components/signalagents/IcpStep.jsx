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
const LOCATIONS = ["All locations","North America","Europe","Asia Pacific","Latin America","Africa","Middle East","Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cabo Verde","Cambodia","Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic","Democratic Republic of the Congo","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Ivory Coast","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"];
const INDUSTRIES = ["All industries","Accommodation Services","Advertising","Apparel & Fashion","Automotive","Banking","Biotechnology","Blockchain Services","Business Consulting","Construction","Consumer Goods","Consumer Services","Cosmetics","E-Learning Providers","Education","Energy","Environmental Services","Events Services","Farming Ranching Forestry","Finance","Food & Beverages","Gambling Facilities and Casinos","Government & Public Sector","Hardware & Electronics","Healthcare","Hospitality","Human Resources","Insurance","IT Services and IT Consulting","Legal & Compliance","Luxury Goods","Manufacturing","Marketing","Media & Entertainment","Museums Historical Sites and Zoos","Non-profit & NGOs","Pet Services","Professional Training & Coaching","Pharmaceuticals","Real Estate","Restaurants","Retail & E-commerce","Software Development & SaaS","Sporting Goods","Staffing and Recruiting","Technology","Telecommunications","Transportation & Logistics","Travel","Venture Capital and Private Equity","Wholesale","Other"];
const COMPANY_SIZES = ["All company sizes","1-10 employees","11-50 employees","51-200 employees","201-500 employees","501-1000 employees","1001-5000 employees","5001-10000 employees","10000+ employees"];
const COMPANY_TYPES = ["All company types","Private Company","Public Company","Startup","Non-profit","Government","Educational Institution","Other"];

// ── Main ICP Step ─────────────────────────────────────────────────────────────
export default function IcpStep({ form, setForm }) {
  const addToArr = (field, value) => {
    if (!value || (form[field] || []).includes(value)) return;
    setForm(f => ({ ...f, [field]: [...(f[field] || []), value] }));
  };
  const removeFromArr = (field, idx) => setForm(f => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }));
  const ALL_OPTIONS = {
    target_locations: "All locations",
    target_industries: "All industries",
    company_sizes: "All company sizes",
    company_types: "All company types",
  };

  const toggleInArr = (field, value) => {
    const arr = form[field] || [];
    const allOption = ALL_OPTIONS[field];
    // If selecting the "All" option, clear everything else and just set "All"
    if (value === allOption) {
      setForm(f => ({ ...f, [field]: arr.includes(allOption) ? [] : [allOption] }));
      return;
    }
    // If selecting a specific option, remove the "All" option if present
    const withoutAll = arr.filter(v => v !== allOption);
    setForm(f => ({
      ...f,
      [field]: withoutAll.includes(value) ? withoutAll.filter(v => v !== value) : [...withoutAll, value],
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