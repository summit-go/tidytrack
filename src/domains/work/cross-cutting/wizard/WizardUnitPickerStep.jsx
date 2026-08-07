import React from "react";
import { Check } from "lucide-react";
import { bathroomNumberForBedroom } from "../../../../lib/labels.js";

export function WizardUnitPickerStep({
  units,
  unitSearch,
  setUnitSearch,
  uploadMode,
  setUploadMode,
  parties,
  selectedParties,
  setSelectedParties,
  setConfig,
  setActivePartyId,
  togglePartySelection,
  ensureConfigShell,
}) {
  const renderUnitPicker = () => {
    // Filter apartments by the search text — applied to the LABEL
    const q = unitSearch.trim().toLowerCase();
    const visibleUnits = units.filter(
      (u) => !q || (u.label || "").toLowerCase().includes(q),
    );
    // Map of unitId → its bedrooms (sorted by trailing number)
    const partiesByUnit = {};
    parties.forEach((p) => {
      if (!partiesByUnit[p.unit_id]) partiesByUnit[p.unit_id] = [];
      partiesByUnit[p.unit_id].push(p);
    });
    Object.keys(partiesByUnit).forEach((k) => {
      partiesByUnit[k].sort((a, b) => {
        const an = parseInt((a.label || "").match(/(\d+)/)?.[1] || "0", 10);
        const bn = parseInt((b.label || "").match(/(\d+)/)?.[1] || "0", 10);
        return an - bn;
      });
    });
  
    // "Select all bedrooms in this apartment" (multi mode only)
    const toggleAllInUnit = (unit) => {
      if (uploadMode !== "multi") return;
      const ps = partiesByUnit[unit.id] || [];
      const allSelected =
        ps.length > 0 && ps.every((p) => selectedParties[p.id]);
      setSelectedParties((prev) => {
        const next = { ...prev };
        if (allSelected) {
          ps.forEach((p) => {
            delete next[p.id];
          });
        } else {
          ps.forEach((p) => {
            next[p.id] = true;
          });
        }
        return next;
      });
      // Also seed config defaults for any newly selected bedrooms
      if (!allSelected) ps.forEach((p) => ensureConfigShell(p.id));
    };
  
    return (
      <div>
        <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-1">
          Step 2 · Send to
        </div>
        <div className="text-sm text-stone-600 mb-2">
          Are you uploading for one bedroom or multiple bedrooms?
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => {
              // Switching modes clears selections + per-bedroom config.
              // In particular, 4 bedrooms checked in multi mode can't
              // survive a switch to single mode (which permits only 1).
              if (uploadMode !== "single") {
                setSelectedParties({});
                setConfig({});
                setActivePartyId(null);
              }
              setUploadMode("single");
            }}
            className={`px-4 py-3 rounded-xl border-2 transition-colors ${uploadMode === "single" ? "bg-amber-50 border-amber-500 text-amber-900" : "bg-white border-stone-200 text-stone-700"}`}
          >
            <div className="font-bold">Single bedroom</div>
            <div className="text-[10px] font-mono text-stone-500 mt-1">
              One person's checkout / spot check
            </div>
          </button>
          <button
            onClick={() => {
              if (uploadMode !== "multi") {
                setSelectedParties({});
                setConfig({});
                setActivePartyId(null);
              }
              setUploadMode("multi");
            }}
            className={`px-4 py-3 rounded-xl border-2 transition-colors ${uploadMode === "multi" ? "bg-amber-50 border-amber-500 text-amber-900" : "bg-white border-stone-200 text-stone-700"}`}
          >
            <div className="font-bold">Multiple bedrooms</div>
            <div className="text-[10px] font-mono text-stone-500 mt-1">
              Up to 4 roommates / full apartment
            </div>
          </button>
        </div>
  
        {/* Apartment tree — hidden until a mode is picked. Once visible
           it lives in a single scrollable region so nothing hides
           behind the action bar. */}
        {uploadMode && (
          <div className="border-t-2 border-stone-200 pt-4">
            <input
              value={unitSearch}
              onChange={(e) => setUnitSearch(e.target.value)}
              placeholder="Filter apartments…"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-sm mb-3"
            />
            <div className="space-y-2">
              {visibleUnits.length === 0 && (
                <div className="text-center py-8 text-stone-400 text-sm">
                  {units.length === 0
                    ? "No apartments set up for this property."
                    : "No apartments match."}
                </div>
              )}
              {visibleUnits.map((u) => {
                const ps = partiesByUnit[u.id] || [];
                const someSelected = ps.some((p) => selectedParties[p.id]);
                const allSelected =
                  ps.length > 0 && ps.every((p) => selectedParties[p.id]);
                return (
                  <div
                    key={u.id}
                    className={`bg-white rounded-xl border-2 p-3 ${someSelected ? "border-amber-300" : "border-stone-200"}`}
                  >
                    {/* Apartment header — clickable in multi mode to
                       select/deselect all bedrooms in this apartment */}
                    <div className="flex items-center gap-2 mb-2">
                      {uploadMode === "multi" ? (
                        <button
                          onClick={() => toggleAllInUnit(u)}
                          className="flex items-center gap-2 flex-1 text-left"
                        >
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              allSelected
                                ? "bg-amber-600 border-amber-600 text-white"
                                : someSelected
                                  ? "bg-amber-100 border-amber-600"
                                  : "border-stone-300"
                            }`}
                          >
                            {allSelected && <Check size={12} />}
                            {!allSelected && someSelected && (
                              <div className="w-2 h-2 bg-amber-600 rounded-sm" />
                            )}
                          </div>
                          <span className="text-sm font-bold text-stone-900">
                            {u.label}
                          </span>
                        </button>
                      ) : (
                        <span className="text-sm font-bold text-stone-900 flex-1">
                          {u.label}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-stone-500">
                        {ps.length} bedroom{ps.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {/* Bedrooms — 2-column grid like the legacy form.
                       Each checkbox is independently tappable so the
                       uploader can pick just the rooms that need work. */}
                    {ps.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {ps.map((p) => {
                          const checked = !!selectedParties[p.id];
                          const bathroomNum = bathroomNumberForBedroom(p.label);
                          return (
                            <button
                              key={p.id}
                              onClick={() => togglePartySelection(p.id)}
                              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border-2 text-left transition-colors ${
                                checked
                                  ? "border-amber-600 bg-amber-50"
                                  : "border-stone-200 bg-white hover:border-stone-400"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked ? "border-amber-600 bg-amber-600 text-white" : "border-stone-300"}`}
                              >
                                {checked && <Check size={10} />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-stone-900 truncate">
                                  {p.label}
                                </div>
                                {bathroomNum && (
                                  <div className="text-[9px] font-mono text-stone-500 truncate">
                                    Bath {bathroomNum}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Summary line at the bottom — shows what's selected so
               the uploader can scan before tapping Next. */}
            {Object.keys(selectedParties).filter((k) => selectedParties[k])
              .length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-[10px] uppercase tracking-wider font-mono text-amber-700 mb-1">
                  Creating{" "}
                  {
                    Object.keys(selectedParties).filter(
                      (k) => selectedParties[k],
                    ).length
                  }{" "}
                  assignment
                  {Object.keys(selectedParties).filter(
                    (k) => selectedParties[k],
                  ).length === 1
                    ? ""
                    : "s"}
                  :
                </div>
                <div className="text-xs text-amber-900">
                  {Object.keys(selectedParties)
                    .filter((k) => selectedParties[k])
                    .map((id) => {
                      const p = parties.find((x) => x.id === id);
                      const u = units.find((uu) => uu.id === p?.unit_id);
                      return `${u?.label || ""} · ${p?.label || ""}`;
                    })
                    .join(", ")}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return renderUnitPicker();
}
