import React from "react";
import { AlertCircle } from "lucide-react";

export function PriorityChip({ on, size = "sm" }) {
  if (!on) return null;
  const sz =
    size === "xs" ? "text-[9px] px-1.5 py-0" : "text-[10px] px-2 py-0.5";
  return (
    <span
      className={`${sz} uppercase tracking-wider font-mono font-bold rounded-full border inline-flex items-center gap-0.5 bg-red-100 text-red-800 border-red-300`}
    >
      <AlertCircle size={size === "xs" ? 8 : 10} /> Priority
    </span>
  );
}
