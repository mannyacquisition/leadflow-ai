import React, { useState, useRef, useEffect } from "react";
import { Search, X, Check, ChevronDown, ChevronUp } from "lucide-react";

const ALL_INDUSTRIES = [
  "Accounting", "Accessible Architecture and Design", "Accessible Hardware Manufacturing",
  "Accommodation and Food Services", "Digital Accessibility Services",
  "Fashion Accessories Manufacturing", "Golf Courses and Country Clubs",
  "Tobacco", "Tobacco Manufacturing", "Real Estate", "Retail", "Executive Offices",
  "Transportation, Logistics, Supply Chain and Storage", "Food and Beverage Services",
  "Environmental Services", "Financial Services", "Oil and Gas", "Software Development",
  "AI / ML", "HR Tech", "Sales Tech", "FinTech", "EdTech", "PropTech",
  "Computer Software", "Automation", "Non-Profit", "Healthcare", "SaaS",
  "Marketing Services", "Consulting", "E-commerce",
];

export default function IndustryDropdown({ selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = ALL_INDUSTRIES.filter(i =>
    i.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (industry) => {
    if (selected.includes(industry)) {
      onChange(selected.filter(i => i !== industry));
    } else {
      onChange([...selected, industry]);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => setOpen(!open)}
        className="w-full border rounded-lg px-3 py-2 text-sm cursor-pointer flex items-center justify-between bg-white hover:border-gray-400 min-h-[38px]"
      >
        <div className="flex flex-wrap gap-1 flex-1">
          {selected.length === 0 ? (
            <span className="text-gray-400">Select industries...</span>
          ) : (
            selected.map(ind => (
              <span key={ind} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: "#ff5a1f" }}>
                {ind}
                <button onClick={e => { e.stopPropagation(); toggle(ind); }}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl z-50 max-h-64 flex flex-col">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search industries..."
                className="w-full pl-7 pr-3 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map(ind => {
              const isSelected = selected.includes(ind);
              return (
                <div
                  key={ind}
                  onClick={() => toggle(ind)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-orange-50 ${isSelected ? "bg-orange-50" : ""}`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "border-orange-500 bg-orange-500" : "border-gray-300"}`}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className={isSelected ? "font-medium text-orange-700" : "text-gray-700"}>{ind}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}