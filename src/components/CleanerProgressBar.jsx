import React, { useState } from "react";
import { LeaveWorkblockModal } from "../apps/staff/cleaner/LeaveWorkblockModal.jsx";

export function CleanerProgressBar({
  segments,
  inActiveWork = false,
  onLeaveDecision,
}) {
  const [pendingNavigation, setPendingNavigation] = useState(null);

  if (!segments || segments.length === 0) return null;

  const handleClick = (segment) => {
    if (!segment.onClick) return;
    // If they're inside an active work block AND the segment they
    // tapped isn't the "working" segment they're currently on,
    // intercept with the warning modal first.
    if (inActiveWork && !segment.isCurrent) {
      setPendingNavigation(() => segment.onClick);
      return;
    }
    segment.onClick();
  };

  return (
    <>
      <div
        className="bg-stone-50 border-b border-stone-200 px-3 py-2.5"
        data-no-translate-children="false"
      >
        <div className="flex items-center gap-1">
          {segments.map((segment, i) => {
            const isLast = i === segments.length - 1;
            const isComplete = !!segments[i + 1]?.filled || segment.complete;
            // Color logic:
            // - complete (later segment filled too) → emerald
            // - filled current → amber
            // - filled but not current → tan
            // - empty → gray
            let fillClass;
            if (segment.complete) fillClass = "bg-emerald-500";
            else if (segment.isCurrent && segment.filled)
              fillClass = "bg-amber-500";
            else if (segment.filled) fillClass = "bg-amber-400";
            else fillClass = "bg-stone-200";

            return (
              <button
                key={i}
                onClick={() => handleClick(segment)}
                disabled={!segment.onClick}
                className={`flex-1 group ${segment.onClick ? "cursor-pointer" : "cursor-default"}`}
              >
                <div
                  className={`h-1.5 rounded-full transition-colors ${fillClass} ${segment.onClick ? "group-hover:opacity-80" : ""}`}
                />
                <div
                  className={`text-[8px] sm:text-[9px] uppercase tracking-wider font-mono mt-1 text-center truncate ${
                    segment.complete
                      ? "text-emerald-700 font-bold"
                      : segment.isCurrent
                        ? "text-stone-900 font-bold"
                        : segment.filled
                          ? "text-stone-700 font-medium"
                          : "text-stone-400"
                  }`}
                >
                  {segment.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {pendingNavigation && (
        <LeaveWorkblockModal
          onChoose={(decision) => {
            const nav = pendingNavigation;
            setPendingNavigation(null);
            if (decision === "stay") return;
            // 'done' or 'pause' — bubble up the decision so the parent
            // can finish/pause the work block, THEN run the navigation.
            if (onLeaveDecision) {
              Promise.resolve(onLeaveDecision(decision)).then(() => nav());
            } else {
              nav();
            }
          }}
          onClose={() => setPendingNavigation(null)}
        />
      )}
    </>
  );
}
