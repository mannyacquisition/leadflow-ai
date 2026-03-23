import React, { useState } from "react";
import { X } from "lucide-react";

export default function TagInput({ placeholder, tags, onChange, color = "#ff5a1f" }) {
  const [input, setInput] = useState("");

  const addTag = (val) => {
    const trimmed = val.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="w-full border rounded-lg px-2 py-1.5 flex flex-wrap gap-1 min-h-[38px] bg-white focus-within:ring-1 focus-within:ring-orange-500 cursor-text"
      onClick={e => e.currentTarget.querySelector("input")?.focus()}>
      {tags.map(tag => (
        <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white flex-shrink-0"
          style={{ backgroundColor: color }}>
          {tag}
          <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))}>
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => input && addTag(input)}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-20 text-sm outline-none bg-transparent placeholder-gray-400"
      />
    </div>
  );
}