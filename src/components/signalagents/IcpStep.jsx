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
      <div className="mt-6">
        <label className="text-sm font-semibold text-gray-800 flex items-center gap-1 mb-3">
          Lead Matching Mode
          <Info className="w-3.5 h-3.5 text-gray-400" />
        </label>
        <div className="flex items-center gap-4">
          {/* Discovery side */}
          <button
            onClick={() => setForm(f => ({ ...f, lead_matching_mode: 20 }))}
            className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${!highPrecision ? "text-blue-600" : "text-gray-400"}`}
          >
            🔍 Discovery
          </button>
          {/* Toggle pill */}
          <button
            onClick={() => setForm(f => ({ ...f, lead_matching_mode: highPrecision ? 20 : 80 }))}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${highPrecision ? "bg-orange-500" : "bg-gray-300"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${highPrecision ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
          {/* High Precision side */}
          <button
            onClick={() => setForm(f => ({ ...f, lead_matching_mode: 80 }))}
            className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${highPrecision ? "text-orange-500" : "text-gray-400"}`}
          >
            High Precision 🎯
          </button>
        </div>

        {/* Info box */}
        {!highPrecision ? (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 mt-3 max-w-sm">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-blue-700">Broader ICP – More leads</p>
              <p className="text-xs text-blue-500">Finds opportunities you wouldn't normally target</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mt-3 max-w-sm">
            <Info className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-700">Strict ICP – Fewer, better leads</p>
              <p className="text-xs text-red-500">Only the strongest matches</p>
            </div>
          </div>
        )}
      </div>

      {/* Advanced filters toggle */}
      <div className="mt-5 text-center">
        <button
          onClick={() => setAdvancedOpen(o => !o)}
          className="text-sm font-medium hover:opacity-80 transition-opacity"
          style={{ color: "#e53935" }}
        >
          Advanced filters {advancedOpen ? "^" : "▾"}
        </button>
      </div>

      {/* Advanced filters panel */}
      {advancedOpen && (
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5 border-t pt-5">
          {/* LEFT: Additional Criteria + Mandatory keywords */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5 flex items-center gap-1">
                Additional Criteria (Optional) <Info className="w-3.5 h-3.5 text-gray-400" />
              </label>
              <textarea
                value={form.additional_criteria || ""}
                onChange={e => {
                  if (e.target.value.length <= 200)
                    setForm(f => ({ ...f, additional_criteria: e.target.value }));
                }}
                rows={5}
                placeholder="Any additional criteria or specific requirements for your ideal customer. This will be sent to our AI Scoring system and used as a prompt to evaluate leads. e.g. specific sub-industries, cities to target, or exclusions to avoid"
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-orange-400 text-gray-700"
              />
              <div className="text-right text-xs text-gray-400 mt-1">
                {(form.additional_criteria || "").length}/200
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5 flex items-center gap-1">
                Mandatory keywords <Info className="w-3.5 h-3.5 text-gray-400" />
              </label>
              <TextAddInput
                placeholder="e.g., AI, Machine Learning, etc."
                onAdd={v => addToArr("mandatory_keywords", v)}
              />
              <PillList
                items={form.mandatory_keywords || []}
                onRemove={i => removeFromArr("mandatory_keywords", i)}
              />
            </div>
          </div>

          {/* RIGHT: Checkboxes */}
          <div className="space-y-5">
            {[
              {
                field: "exclude_service_providers",
                label: "Exclude service providers, freelancers, and consultants",
                sub: "Filter out agencies, consultants, and B2B service companies from your results",
              },
              {
                field: "skip_icp_filtering",
                label: "Skip ICP Filtering & Scoring",
                sub: "If checked, ICP filtering and scoring will be skipped for this agent, and all found leads will be added.",
              },
              {
                field: "include_open_to_work",
                label: "Include Open to Work Profiles",
                sub: "If not checked, profiles with \"Open to Work\" status will be excluded from the results.",
              },
            ].map(({ field, label, sub }) => (
              <label key={field} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={!!form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.checked }))}
                  className="w-4 h-4 mt-0.5 flex-shrink-0 accent-orange-500 rounded"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800 group-hover:text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}