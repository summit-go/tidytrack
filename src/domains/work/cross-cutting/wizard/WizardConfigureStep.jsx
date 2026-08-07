import React from "react";
import {
  AlertCircle,
  Camera,
  Check,
  Edit2,
  Eye,
  FileText,
  Plus,
  X,
} from "lucide-react";
import { ASSIGNMENT_TYPES } from "../../../../lib/constants.js";
import { naturalCompare } from "../../../../lib/compare.js";
import { bathroomNumberForBedroom } from "../../../../lib/labels.js";

export function WizardConfigureStep({
  units,
  parties,
  selectedParties,
  config,
  setConfig,
  activePartyId,
  setActivePartyId,
  sheetFiles,
  setSheetFiles,
  sheetPreviews,
  sheetType,
  templateSet,
  items,
  templateLoading,
  renamingIdx,
  setRenamingIdx,
  renamingValue,
  setRenamingValue,
  renameSheetFile,
  setSheetForBedroom,
  setQuickView,
  sectionsForBedroomComplete,
  nextAttempted,
  setMode,
  setCleaningType,
  setBathroomVariantWithAutofill,
  setGeneralVariant,
  toggleSectionPass,
  toggleSectionFail,
  toggleItem,
  addCustomItem,
  removeCustomItem,
  customText,
  setCustomText,
  variantsBySection,
  variantBySectionKey,
  itemsForVariant,
}) {
  const renderConfigure = () => {
    const selectedIds = Object.keys(selectedParties).filter(
      (k) => selectedParties[k],
    );
    // Sort by apartment label first, then by bedroom number within
    // that apartment — so multi-apartment selections read naturally.
    const sortBedrooms = (a, b) => {
      const pa = parties.find((p) => p.id === a);
      const pb = parties.find((p) => p.id === b);
      const ua = units.find((u) => u.id === pa?.unit_id);
      const ub = units.find((u) => u.id === pb?.unit_id);
      const cmpUnit = naturalCompare(ua?.label || "", ub?.label || "");
      if (cmpUnit !== 0) return cmpUnit;
      const an = parseInt((pa?.label || "").match(/(\d+)/)?.[1] || "0", 10);
      const bn = parseInt((pb?.label || "").match(/(\d+)/)?.[1] || "0", 10);
      return an - bn;
    };
    const sortedIds = [...selectedIds].sort(sortBedrooms);
    // Show apartment label on tabs only if multiple apartments are selected
    const uniqueUnitIds = new Set(
      selectedIds.map((id) => parties.find((p) => p.id === id)?.unit_id),
    );
    const showAptLabel = uniqueUnitIds.size > 1;
  
    return (
      <div>
        <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-1">
          Step 4 · Configure each bedroom
        </div>
        <div className="text-sm text-stone-600 mb-3">
          Tap a bedroom tab, then mark sections as passed or check the items
          that need cleaning.
        </div>
  
        {/* Which template is loaded — confirms move-out vs cleaning-check. */}
        <div
          className={`mb-3 px-3 py-2 rounded-lg text-[11px] font-mono flex items-center gap-2 ${templateSet?.sheet_type === "move_out_clean" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-stone-100 text-stone-600"}`}
        >
          Template:{" "}
          {templateSet?.sheet_type === "move_out_clean"
            ? "Move-out (granular)"
            : templateSet?.name || "Cleaning-check / default"}{" "}
          · {items.length} items{templateLoading ? " · loading…" : ""}
        </div>
  
        {/* Sheet strip — only shows when one or more sheets were
           uploaded in step 0. Lets the uploader quick-view each sheet
           and tap one to attach it to the currently active bedroom.
           Replaces the dropdown approach for assigning sheets. The
           dropdown still lives inside the bedroom config below for
           accessibility, but this strip is the faster path. */}
        {sheetFiles.length > 0 && (
          <div className="mb-3 p-2 bg-stone-100 rounded-xl">
            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1.5 px-1">
              Sheets — tap card to assign to{" "}
              {parties.find((p) => p.id === activePartyId)?.label ||
                "active bedroom"}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sheetFiles.map((f, idx) => {
                const isImage = f.type && f.type.startsWith("image/");
                const previewUrl = sheetPreviews[f.name];
                const assignedToActive =
                  activePartyId &&
                  config[activePartyId]?.sheetFileName === f.name;
                const isRenaming = renamingIdx === idx;
                return (
                  <div
                    key={`${f.name}-${idx}`}
                    className={`flex-shrink-0 w-32 rounded-lg border-2 overflow-hidden bg-white transition-colors ${
                      assignedToActive ? "border-amber-500" : "border-stone-200"
                    }`}
                  >
                    <button
                      onClick={() => {
                        // Tapping the body of the card toggles the
                        // assignment for the currently active bedroom.
                        if (!activePartyId) return;
                        const current = config[activePartyId]?.sheetFileName;
                        setSheetForBedroom(
                          activePartyId,
                          current === f.name ? null : f.name,
                        );
                      }}
                      className="w-full text-left"
                    >
                      <div className="aspect-[4/3] bg-stone-100 flex items-center justify-center">
                        {isImage && previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={f.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileText size={28} className="text-stone-400" />
                        )}
                      </div>
                    </button>
                    {/* Inline rename input OR truncated filename label */}
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renamingValue}
                        onChange={(e) => setRenamingValue(e.target.value)}
                        onBlur={() => {
                          renameSheetFile(idx, renamingValue);
                          setRenamingIdx(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            renameSheetFile(idx, renamingValue);
                            setRenamingIdx(null);
                          }
                          if (e.key === "Escape") setRenamingIdx(null);
                        }}
                        className="w-full px-1.5 py-1 text-[10px] font-mono border-y border-stone-300 bg-white text-stone-900"
                      />
                    ) : (
                      <div className="px-1.5 py-1 text-[10px] font-mono truncate text-stone-700">
                        {f.name}
                      </div>
                    )}
                    {/* Action row: quick view + rename + replace.
                       Replace opens a hidden file input so the user
                       can swap the image without re-doing the whole
                       upload step. The new file inherits the assigned
                       bedroom selection. */}
                    <div className="flex items-stretch border-t border-stone-200">
                      <button
                        onClick={() =>
                          setQuickView({
                            file: f,
                            url:
                              previewUrl ||
                              (f.type ? URL.createObjectURL(f) : null),
                          })
                        }
                        className="flex-1 py-1.5 hover:bg-stone-50 flex items-center justify-center"
                        title="Quick view"
                      >
                        <Eye size={12} className="text-stone-600" />
                      </button>
                      <div className="w-px bg-stone-200" />
                      <button
                        onClick={() => {
                          setRenamingIdx(idx);
                          setRenamingValue(f.name.replace(/\.[^.]+$/, ""));
                        }}
                        className="flex-1 py-1.5 hover:bg-stone-50 flex items-center justify-center"
                        title="Rename"
                      >
                        <Edit2 size={12} className="text-stone-600" />
                      </button>
                      <div className="w-px bg-stone-200" />
                      <label
                        className="flex-1 py-1.5 hover:bg-stone-50 flex items-center justify-center cursor-pointer"
                        title="Replace"
                      >
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const replacement = e.target.files?.[0];
                            e.target.value = "";
                            if (!replacement) return;
                            // Preserve the original NAME so any bedroom
                            // sheet assignments still point at the
                            // right entry. Wrap the new file with the
                            // existing name + extension.
                            const origName = f.name;
                            const wrapped = new File([replacement], origName, {
                              type: replacement.type,
                              lastModified: replacement.lastModified,
                            });
                            setSheetFiles((prev) => {
                              const next = [...prev];
                              next[idx] = wrapped;
                              return next;
                            });
                          }}
                        />
                        <Camera size={12} className="text-stone-600" />
                      </label>
                    </div>
                    <div className="px-1.5 py-1 text-[9px] font-mono text-center bg-stone-50 border-t border-stone-200">
                      {assignedToActive ? (
                        <span className="text-amber-700">✓ assigned</span>
                      ) : (
                        <span className="text-stone-400">tap card</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
  
        {/* Bedroom tabs */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {sortedIds.map((id) => {
            const p = parties.find((x) => x.id === id);
            const u = units.find((uu) => uu.id === p?.unit_id);
            const c = config[id];
            const isActive = activePartyId === id;
            const isPass = c?.mode === "pass";
            const isFailAll = c?.mode === "fail_entire";
            const checkCount = c?.checked ? Object.keys(c.checked).length : 0;
            const passedSecs = Object.keys(c?.passedSections || {}).length;
            // Bedroom is incomplete if any of its 4 sections isn't done.
            // We surface the red dot on the tab itself so the uploader
            // can see WHICH bedrooms still need work without having to
            // click into each one. Mirrors the per-section dot logic
            // and is gated by nextAttempted for the same reason.
            const bedroomIncomplete =
              !sectionsForBedroomComplete(id).every(Boolean);
            const showBedroomError = nextAttempted && bedroomIncomplete;
            const labelExtra = isPass
              ? "· Pass"
              : isFailAll
                ? "· Fail all"
                : checkCount > 0
                  ? `· ${checkCount} items`
                  : passedSecs > 0
                    ? `· ${passedSecs} passed`
                    : "";
            return (
              <button
                key={id}
                onClick={() => setActivePartyId(id)}
                className={`relative px-3 py-2 rounded-xl border-2 text-sm whitespace-nowrap flex-shrink-0 transition-colors ${
                  isActive
                    ? "bg-amber-50 border-amber-500"
                    : isPass
                      ? "bg-emerald-50 border-emerald-300"
                      : isFailAll
                        ? "bg-red-50 border-red-300"
                        : "bg-white border-stone-200"
                }`}
              >
                {showBedroomError && (
                  <span
                    className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500"
                    title="Needs attention"
                  />
                )}
                {showAptLabel && (
                  <div className="text-[9px] font-mono text-stone-500 uppercase tracking-wider">
                    {u?.label}
                  </div>
                )}
                <div className="font-mono font-bold text-stone-900">
                  {p?.label}
                </div>
                <div className="text-[10px] font-mono text-stone-500">
                  {labelExtra || " "}
                </div>
              </button>
            );
          })}
        </div>
        {activePartyId && renderBedroomConfig(activePartyId)}
      </div>
    );
  };
  
  const renderBedroomConfig = (partyId) => {
    const c = config[partyId] || {
      mode: "configure",
      checked: {},
      passedSections: {},
    };
    const party = parties.find((x) => x.id === partyId);
    const bathroomNum = bathroomNumberForBedroom(party?.label);
    const activeSection = c.activeSection || "bedroom";
  
    // Helper to set the active section for THIS bedroom (stored on config)
    const setActiveSection = (key) => {
      setConfig((prev) => ({
        ...prev,
        [partyId]: {
          ...(prev[partyId] || { mode: "configure", checked: {} }),
          activeSection: key,
        },
      }));
    };
  
    if (c.mode === "pass") {
      return (
        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-500">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
              <Check size={14} />
            </div>
            <div className="font-serif text-lg text-emerald-900 font-bold">
              Passed — no assignment
            </div>
          </div>
          <div className="text-sm text-emerald-800 mb-3">
            This bedroom doesn't need any cleaning. No assignment will be
            created for it.
          </div>
          <button
            onClick={() => setMode(partyId, "pass")}
            className="px-3 py-2 rounded-lg bg-white border border-emerald-400 text-emerald-800 text-sm font-medium"
          >
            Un-pass and configure instead
          </button>
        </div>
      );
    }
  
    // Section tabs definition. Bedroom and vanity have no variant; bathroom and
    // general use the variant set on the config.
    const sections = [
      { key: "bedroom", label: "Bedroom", variantKey: "default" },
      { key: "vanity", label: "Vanity", variantKey: "default" },
      { key: "bathroom", label: "Bathroom", variantKey: c.bathroomVariant },
      { key: "general", label: "General", variantKey: c.generalVariant },
    ];
  
    const passedSecs = c.passedSections || {};
    const failedSecs = c.failedSections || {};
    const checked = c.checked || {};
  
    // Count for tabs: items checked in this section
    const sectionCount = (key) =>
      Object.keys(checked).filter((k) => k.startsWith(`${key}:`)).length;
  
    const isPassMode = c.mode === "pass"; // can't actually hit here but defensive
    const isFailMode = c.mode === "fail_entire";
  
    return (
      <div className="space-y-3">
        {/* Cleaning type + sheet assignment row. Cleaning type defaults
           from the sheet type chosen at step 3 (cleaning_check →
           cleaning_check; move_out_clean → move_out_check) but the
           uploader can override per bedroom — useful when one bedroom
           needs a deep clean and another only needs a recheck. The
           dropdown is the existing ASSIGNMENT_TYPES list. */}
        <div
          className={`grid ${sheetFiles.length > 1 ? "sm:grid-cols-2" : ""} gap-2`}
        >
          <div>
            <label className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1 block">
              Cleaning type
            </label>
            <select
              value={
                c.cleaningType ||
                (sheetType === "cleaning_check"
                  ? "cleaning_check"
                  : "move_out_check")
              }
              onChange={(e) => setCleaningType(partyId, e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm"
            >
              {ASSIGNMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {/* Per-bedroom sheet assignment — only shown when there's
             more than one sheet uploaded. With a single sheet it's
             auto-attached to every bedroom; with multiple, the
             uploader picks which one goes to which bedroom. */}
          {sheetFiles.length > 1 && (
            <div>
              <label className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1 block">
                Sheet for this bedroom
              </label>
              <select
                value={c.sheetFileName || ""}
                onChange={(e) =>
                  setSheetForBedroom(partyId, e.target.value || null)
                }
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm"
              >
                <option value="">No sheet</option>
                {sheetFiles.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
  
        {/* Pass / Fail-Entire toggle row. Both buttons are clearly
           clickable and show pressed state when active. Clicking the
           active one again toggles it back off. */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode(partyId, "pass")}
            className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${
              isPassMode
                ? "bg-emerald-600 border-emerald-700 text-white shadow-inner"
                : "border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800"
            }`}
          >
            <Check size={14} /> Pass — no work
          </button>
          <button
            onClick={() => setMode(partyId, "fail_entire")}
            className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${
              isFailMode
                ? "bg-red-600 border-red-700 text-white shadow-inner"
                : "border-red-300 bg-red-50 hover:bg-red-100 text-red-800"
            }`}
          >
            <AlertCircle size={14} /> Fail entire bedroom
          </button>
        </div>
        {isFailMode && (
          <div className="text-[11px] font-mono text-red-700 -mt-1 px-1">
            All items in every section are checked. Tap again to clear.
          </div>
        )}
  
        {/* Section tabs (Bedroom / Vanity / Bathroom / General). A
           red dot appears on any section that isn't done yet — but
           only AFTER the uploader has tried to advance, so we don't
           scream at them on first arrival. */}
        <div className="flex gap-1 bg-stone-100 p-1 rounded-xl overflow-x-auto">
          {sections.map((s, idx) => {
            const cnt = sectionCount(s.key);
            const isPassed = !!passedSecs[s.key];
            const isFailed = !!(failedSecs || {})[s.key];
            const isActive = activeSection === s.key;
            const sectionDoneFlags = sectionsForBedroomComplete(partyId);
            const isIncomplete = !sectionDoneFlags[idx];
            const showError = nextAttempted && isIncomplete;
            return (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`relative flex-1 min-w-fit py-2 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? isPassed
                      ? "bg-emerald-100 text-emerald-900 font-bold shadow-sm"
                      : isFailed
                        ? "bg-red-100 text-red-900 font-bold shadow-sm"
                        : "bg-white text-stone-900 font-bold shadow-sm"
                    : isPassed
                      ? "text-emerald-700"
                      : isFailed
                        ? "text-red-700"
                        : "text-stone-600"
                }`}
              >
                {showError && (
                  <span
                    className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"
                    title="Needs an action"
                  />
                )}
                <div>{s.label}</div>
                <div className="text-[9px] font-mono opacity-70">
                  {isPassed
                    ? "passed"
                    : isFailed
                      ? "failed all"
                      : cnt > 0
                        ? `${cnt} items`
                        : showError
                          ? "needs action"
                          : " "}
                </div>
              </button>
            );
          })}
        </div>
  
        {/* Active section content */}
        {renderSectionContent(partyId, activeSection, sections, bathroomNum)}
      </div>
    );
  };
  
  // Render the content for whichever section tab is active inside a
  // bedroom. For Bathroom and General, the variant picker shows above
  // the checklist; for Bedroom and Vanity, the checklist is universal.
  const renderSectionContent = (partyId, sectionKey, sections, bathroomNum) => {
    const c = config[partyId] || {
      checked: {},
      passedSections: {},
      failedSections: {},
    };
    const checked = c.checked || {};
    const passed = !!(c.passedSections || {})[sectionKey];
    const failed = !!(c.failedSections || {})[sectionKey];
    const section = sections.find((s) => s.key === sectionKey);
  
    // Pick variant — bathroom and general need one before items render.
    const variantKey =
      sectionKey === "bathroom"
        ? c.bathroomVariant
        : sectionKey === "general"
          ? c.generalVariant
          : "default";
    // 'all' = the whole bathroom: pull items from EVERY bathroom variant,
    // deduped by item_key so a shared item (e.g. floor) isn't listed twice.
    let items;
    let hasVariant;
    if (sectionKey === "bathroom" && variantKey === "all") {
      const seen = new Set();
      items = variantsBySection("bathroom")
        .flatMap((v) => itemsForVariant(v.id))
        .filter((it) => {
          if (seen.has(it.item_key)) return false;
          seen.add(it.item_key);
          return true;
        });
      hasVariant = true; // "Entire bathroom" is a valid selection
    } else {
      const variant = variantKey
        ? variantBySectionKey(sectionKey, variantKey)
        : null;
      items = variant ? itemsForVariant(variant.id) : [];
      hasVariant = !!variant;
    }
  
    return (
      <div className="space-y-3">
        {/* Per-section Pass All / Fail All toggle row — mirrors the
           bedroom-level Pass/Fail row but scoped to this section. The
           cleaner can mark a section fully passed (no work) or fully
           failed (every item checked). Both are mutually exclusive.
           Tapping the active one again clears it. */}
        <div className="flex gap-2">
          <button
            onClick={() => toggleSectionPass(partyId, sectionKey)}
            className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${
              passed
                ? "bg-emerald-600 border-emerald-700 text-white shadow-inner"
                : "border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800"
            }`}
          >
            <Check size={14} />{" "}
            {passed
              ? `Passed all ${section?.label || ""}`
              : `Pass all ${section?.label || ""}`}
          </button>
          <button
            onClick={() => toggleSectionFail(partyId, sectionKey)}
            className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${
              failed
                ? "bg-red-600 border-red-700 text-white shadow-inner"
                : "border-red-300 bg-red-50 hover:bg-red-100 text-red-800"
            }`}
          >
            <AlertCircle size={14} />{" "}
            {failed
              ? `Failed all ${section?.label || ""}`
              : `Fail all ${section?.label || ""}`}
          </button>
        </div>
        {passed && (
          <div className="text-[11px] font-mono text-emerald-700 -mt-1 px-1">
            Nothing to clean in {section?.label?.toLowerCase()} — tap again to
            clear.
          </div>
        )}
        {failed && (
          <div className="text-[11px] font-mono text-red-700 -mt-1 px-1">
            Every {section?.label?.toLowerCase()} item is checked. Tap again to
            clear.
          </div>
        )}
  
        {/* Variant picker for bathroom and general sections.
           IMPORTANT: still shown even when the section is passed or
           failed — the cleaner's responsibility for which general
           area (Kitchen, LR, Fridge, Vents) was theirs is metadata
           that matters separately from whether there was work. The
           Request modal later needs this variant to know what items
           the cleaner *could* request, even if nothing was assigned. */}
        {sectionKey === "bathroom" && (
          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
            <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-2">
              Bathroom responsibility
              {bathroomNum ? ` (this is Bathroom ${bathroomNum})` : ""}
              {!c.bathroomVariant && (
                <span className="ml-2 normal-case text-red-700 font-bold">
                  · pick one
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {/* Whole bathroom — one cleaner does everything. Skips the
                 tub/toilet split, which is the norm for move-outs. */}
              <button
                onClick={() => setBathroomVariantWithAutofill(partyId, "all")}
                className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${c.bathroomVariant === "all" ? "bg-amber-50 border-amber-500 text-amber-900" : "bg-white border-stone-200 text-stone-700"}`}
              >
                Entire bathroom
              </button>
              {variantsBySection("bathroom").map((v) => (
                <button
                  key={v.id}
                  onClick={() =>
                    setBathroomVariantWithAutofill(partyId, v.variant_key)
                  }
                  className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${c.bathroomVariant === v.variant_key ? "bg-amber-50 border-amber-500 text-amber-900" : "bg-white border-stone-200 text-stone-700"}`}
                >
                  {v.label.replace(/ side$/i, " responsibility")}
                </button>
              ))}
            </div>
          </div>
        )}
        {sectionKey === "general" &&
          (() => {
            // Variants already taken by OTHER bedrooms in the same
            // apartment. Each bedroom gets a UNIQUE General variant
            // (LR=A, Fridge=B, Vents=C, Kitchen=D) so we surface the
            // conflicts directly on the picker. Picking a taken
            // variant is allowed (UX is not blocking — submit
            // validation will catch it) but the button shows red so
            // the uploader can fix it before submitting.
            const thisParty = parties.find((p) => p.id === partyId);
            const thisUnitId = thisParty?.unit_id;
            const takenByOthers = new Map(); // variantKey -> bedroomLabel
            if (thisUnitId) {
              Object.entries(config).forEach(([otherPid, oc]) => {
                if (otherPid === partyId) return;
                if (!oc?.generalVariant) return;
                if (oc?.mode === "pass") return;
                const otherParty = parties.find((p) => p.id === otherPid);
                if (!otherParty || otherParty.unit_id !== thisUnitId) return;
                if (!selectedParties[otherPid]) return;
                takenByOthers.set(
                  oc.generalVariant,
                  otherParty.label || otherPid,
                );
              });
            }
            return (
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-2">
                  General area
                  {!c.generalVariant && (
                    <span className="ml-2 normal-case text-red-700 font-bold">
                      · pick one
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {variantsBySection("general").map((v) => {
                    const taken = takenByOthers.get(v.variant_key);
                    const isThis = c.generalVariant === v.variant_key;
                    const isConflict = taken && isThis;
                    return (
                      <button
                        key={v.id}
                        onClick={() =>
                          setGeneralVariant(partyId, v.variant_key)
                        }
                        className={`text-left px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                          isConflict
                            ? "bg-red-50 border-red-400 text-red-900"
                            : isThis
                              ? "bg-amber-50 border-amber-500 text-amber-900"
                              : taken
                                ? "bg-stone-100 border-stone-300 text-stone-500"
                                : "bg-white border-stone-200 text-stone-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>{v.label}</span>
                          {taken && (
                            <span className="text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-full bg-stone-200 text-stone-600 whitespace-nowrap">
                              {isThis ? "CONFLICT" : taken}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {!c.generalVariant && (
                  <div className="mt-2 text-[11px] font-mono text-red-700">
                    Each bedroom in this apartment gets a unique General area.
                  </div>
                )}
              </div>
            );
          })()}
  
        {/* Items checklist — only shown when section isn't passed AND
           variant is picked (for bathroom/general). */}
        {!passed &&
          (hasVariant ? (
            <div className="rounded-xl bg-white border-2 border-stone-200">
              <div className="px-3 py-2 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
                <div className="font-serif text-sm text-stone-900 font-bold">
                  {section.label} items
                </div>
                <div className="text-[10px] font-mono text-stone-500">
                  {
                    items.filter((i) => checked[`${sectionKey}:${i.item_key}`])
                      .length
                  }
                  /{items.length}
                </div>
              </div>
              <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-[50vh] overflow-y-auto">
                {items.map((item) => {
                  const key = `${sectionKey}:${item.item_key}`;
                  const isChecked = !!checked[key];
                  return (
                    <button
                      key={item.id}
                      onClick={() =>
                        toggleItem(partyId, sectionKey, item.item_key)
                      }
                      className={`w-full text-left px-2 py-2 rounded-lg flex items-center gap-2 transition-colors ${isChecked ? "bg-amber-50" : "hover:bg-stone-50"}`}
                    >
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isChecked ? "bg-amber-600 border-amber-600 text-white" : "border-stone-300"}`}
                      >
                        {isChecked && <Check size={10} />}
                      </div>
                      <div className="text-xs text-stone-800 leading-snug">
                        {item.label}
                      </div>
                    </button>
                  );
                })}
                {/* Custom (uploader-added) items for this section */}
                {Object.keys(c.customLabels || {})
                  .filter((k) => k.startsWith(`${sectionKey}:`))
                  .map((k) => {
                    const isChecked = !!checked[k];
                    const itemKey = k.slice(sectionKey.length + 1);
                    return (
                      <div
                        key={k}
                        className={`w-full px-2 py-2 rounded-lg flex items-center gap-2 ${isChecked ? "bg-amber-50" : "bg-stone-50"}`}
                      >
                        <button
                          onClick={() =>
                            toggleItem(partyId, sectionKey, itemKey)
                          }
                          className="flex items-center gap-2 flex-1 text-left min-w-0"
                        >
                          <div
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isChecked ? "bg-amber-600 border-amber-600 text-white" : "border-stone-300"}`}
                          >
                            {isChecked && <Check size={10} />}
                          </div>
                          <div className="text-xs text-stone-800 leading-snug truncate">
                            {c.customLabels[k]}
                          </div>
                        </button>
                        <button
                          onClick={() => removeCustomItem(partyId, k)}
                          className="p-0.5 rounded text-stone-400 hover:text-red-600 flex-shrink-0"
                          title="Remove"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
              </div>
              {/* Add a custom item not on the template — for this assignment only */}
              <div className="px-2 pb-2 pt-2 border-t border-stone-100 flex gap-2">
                <input
                  value={customText[`${partyId}:${sectionKey}`] || ""}
                  onChange={(e) =>
                    setCustomText((prev) => ({
                      ...prev,
                      [`${partyId}:${sectionKey}`]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addCustomItem(
                        partyId,
                        sectionKey,
                        customText[`${partyId}:${sectionKey}`],
                      );
                      setCustomText((prev) => ({
                        ...prev,
                        [`${partyId}:${sectionKey}`]: "",
                      }));
                    }
                  }}
                  placeholder="Add an item not on the list…"
                  className="flex-1 px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                />
                <button
                  onClick={() => {
                    addCustomItem(
                      partyId,
                      sectionKey,
                      customText[`${partyId}:${sectionKey}`],
                    );
                    setCustomText((prev) => ({
                      ...prev,
                      [`${partyId}:${sectionKey}`]: "",
                    }));
                  }}
                  className="px-3 py-2 rounded-lg bg-stone-900 text-white text-xs font-medium flex items-center gap-1 flex-shrink-0"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
              Pick{" "}
              {sectionKey === "bathroom"
                ? "a bathroom responsibility"
                : "a general area"}{" "}
              above to see its items.
            </div>
          ))}
      </div>
    );
  };

  return renderConfigure();
}
