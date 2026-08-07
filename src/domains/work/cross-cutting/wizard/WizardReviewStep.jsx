import React from "react";
import { AlertCircle, Check } from "lucide-react";
import { ReviewLine } from "../ReviewLine.jsx";

export function WizardReviewStep({
  sheetFiles,
  selectedParties,
  parties,
  units,
  uploadMode,
  sheetType,
  config,
  error,
  submitted,
}) {
  return (
    <div>
              <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-2">
                Step 5 · Review
              </div>
              <div className="space-y-2 mb-4">
                {sheetFiles.length > 0 && (
                  <ReviewLine
                    label="Sheets attached"
                    value={
                      sheetFiles.length === 1
                        ? sheetFiles[0].name
                        : `${sheetFiles.length} files`
                    }
                  />
                )}
                <ReviewLine
                  label="Apartments"
                  value={
                    Array.from(
                      new Set(
                        Object.keys(selectedParties)
                          .filter((k) => selectedParties[k])
                          .map((k) => {
                            const p = parties.find((x) => x.id === k);
                            const u = units.find((uu) => uu.id === p?.unit_id);
                            return u?.label;
                          })
                          .filter(Boolean),
                      ),
                    ).join(", ") || "—"
                  }
                />
                <ReviewLine
                  label="Mode"
                  value={
                    uploadMode === "single"
                      ? "Single bedroom"
                      : "Multiple bedrooms"
                  }
                />
                <ReviewLine
                  label="Sheet type"
                  value={
                    sheetType === "cleaning_check"
                      ? "Cleaning check"
                      : "Move-out clean"
                  }
                />
                <ReviewLine
                  label="Bedrooms"
                  value={Object.keys(selectedParties)
                    .filter((k) => selectedParties[k])
                    .map((k) => {
                      const p = parties.find((x) => x.id === k);
                      const u = units.find((uu) => uu.id === p?.unit_id);
                      const c = config[k];
                      const prefix = `${u?.label || ""} · ${p?.label || ""}`;
                      if (c?.mode === "pass") return `${prefix} (Pass)`;
                      if (c?.mode === "fail_entire")
                        return `${prefix} (Fail all)`;
                      const n = c?.checked ? Object.keys(c.checked).length : 0;
                      const passedSecs = Object.keys(
                        c?.passedSections || {},
                      ).length;
                      const parts = [];
                      if (n > 0) parts.push(`${n} items`);
                      if (passedSecs > 0)
                        parts.push(`${passedSecs} sec. passed`);
                      return `${prefix} (${parts.join(", ") || "no items"})`;
                    })
                    .join(", ")}
                />
              </div>
              {error && (
                <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {submitted &&
                (() => {
                  const assignmentCount = Object.keys(selectedParties).filter(
                    (k) =>
                      selectedParties[k] &&
                      config[k] &&
                      config[k].mode !== "pass",
                  ).length;
                  const itemCount = Object.keys(selectedParties)
                    .filter(
                      (k) =>
                        selectedParties[k] &&
                        config[k] &&
                        config[k].mode !== "pass",
                    )
                    .reduce(
                      (sum, k) =>
                        sum + Object.keys(config[k].checked || {}).length,
                      0,
                    );
                  return (
                    <div className="mb-3 p-3 rounded-xl bg-emerald-50 border-2 border-emerald-300 text-emerald-800 text-sm font-medium flex items-center gap-2">
                      <Check size={16} />
                      <span>
                        Created {assignmentCount} assignment
                        {assignmentCount === 1 ? "" : "s"} with {itemCount}{" "}
                        checklist item{itemCount === 1 ? "" : "s"}. Returning to
                        your list…
                      </span>
                    </div>
                  );
                })()}
    </div>
  );
}
