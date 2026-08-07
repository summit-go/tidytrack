import React from "react";
import { Lock } from "lucide-react";
import { isOwner } from "../lib/permissions.js";

export function OwnerOnly({
  employee,
  children,
  label = "Owners only",
  badge = true,
}) {
  if (!isOwner(employee)) return null;
  return (
    <span className="relative inline-flex items-center" title={label}>
      {children}
      {badge && (
        <span className="ml-1 inline-flex items-center gap-0.5 text-[8px] font-mono uppercase tracking-wider px-1 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 select-none">
          <Lock size={7} /> owner
        </span>
      )}
    </span>
  );
}
