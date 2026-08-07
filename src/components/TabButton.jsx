import React from "react";

export function TabButton({ active, onClick, icon, label, badge, tone = "ops" }) {
  // Every tab carries its mode's color: filled when active, outlined when
  // not. Operations = dark, Business = amber — so all four tabs read as
  // belonging to the mode above them, not just the selected one.
  const activeCls =
    tone === "business"
      ? "bg-amber-700 text-white border-2 border-amber-700"
      : "bg-stone-900 text-stone-50 border-2 border-stone-900";
  const idleCls =
    tone === "business"
      ? "border-2 border-amber-300 text-amber-800 hover:border-amber-700"
      : "border-2 border-stone-300 text-stone-600 hover:border-stone-900";
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-xl transition-colors ${active ? activeCls : idleCls}`}
    >
      {icon}
      <span className="text-[9px] font-mono uppercase tracking-wider">
        {label}
      </span>
      {badge > 0 && (
        <span className="absolute top-0 right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-600 text-white text-[9px] font-mono font-bold flex items-center justify-center">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}
