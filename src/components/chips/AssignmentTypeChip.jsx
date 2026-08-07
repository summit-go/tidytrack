import React from "react";
import { assignmentTypeMeta } from "../../lib/constants.js";

export function AssignmentTypeChip({ type, size = "sm" }) {
  if (!type) return null;
  const meta = assignmentTypeMeta(type);
  if (!meta) return null;
  const sz =
    size === "xs" ? "text-[9px] px-1.5 py-0" : "text-[10px] px-2 py-0.5";
  return (
    <span
      className={`${sz} uppercase tracking-wider font-mono rounded-full border inline-flex items-center gap-1 ${meta.color}`}
    >
      {meta.short}
    </span>
  );
}
