import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export function ItemsDropdown({ items }) {
  const [open, setOpen] = useState(false);
  const list = (items || []).filter(Boolean);
  if (list.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        style={{ touchAction: "manipulation" }}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white border border-stone-300 text-[11px] uppercase tracking-wider font-mono text-stone-600 active:scale-[0.99] transition"
      >
        <span>
          {open
            ? "Hide items"
            : `${list.length} item${list.length === 1 ? "" : "s"}`}
        </span>
        <ChevronDown
          size={15}
          className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          className="mt-1.5 rounded-lg border border-stone-300 bg-white overflow-y-auto"
          style={{ maxHeight: "160px" }}
        >
          {list.map((it, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-2 text-sm text-stone-800 ${i < list.length - 1 ? "border-b border-stone-100" : ""}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
              <span className="break-words">{it}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
