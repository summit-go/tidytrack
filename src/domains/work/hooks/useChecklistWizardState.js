import { useState, useEffect, useRef } from "react";
import { supabase } from "../../../lib/supabase.js";
import { bathroomNumberForBedroom } from "../../../lib/labels.js";

export function useChecklistWizardState({
  property,
  employee,
  actorKind = null,
  portalUser = null,
  onSaved,
}) {
  // 6 steps total. The wizard is short enough that an accidental
  // refresh just starts over — no state persistence here.
  const [step, setStep] = useState(0);
  // When invoked from the PM portal, every created assignment is
  // marked source='pm' + pm_status='pending' so it flows through the
  // owner-approval queue. When invoked from staff (no actorKind),
  // assignments take effect immediately.
  const isPmActor = actorKind === "pm" || actorKind === "pm_staff";
  
  // === Step 1: pick the apartment(s) + upload mode ===
  // We no longer keep a single "selectedUnit" — the new tree shows
  // all apartments at once and the uploader can pick bedrooms across
  // multiple apartments. The apartment for any given assignment is
  // looked up via party.unit_id at submit time.
  const [units, setUnits] = useState([]);
  const [unitSearch, setUnitSearch] = useState("");
  // 'single' = one bedroom only · 'multi' = up to 4 bedrooms at once
  const [uploadMode, setUploadMode] = useState(null);
  
  // === Step 3: pick the bedrooms (parties) ===
  const [parties, setParties] = useState([]);
  // Map of partyId → true if selected for this upload
  const [selectedParties, setSelectedParties] = useState({});
  
  // === Step 2: sheet type ===
  const [sheetType, setSheetType] = useState(null); // 'cleaning_check' | 'move_out_clean'
  
  // === Step 4: per-bedroom configuration ===
  // { [partyId]: { mode: 'configure' | 'pass' | 'fail_entire',
  //                bathroomVariant: 'a' | 'b',
  //                generalVariant: 'a' | 'b' | 'c' | 'd',
  //                checked: { '<section>:<itemKey>': true } } }
  const [config, setConfig] = useState({});
  // Which party we're currently editing inside step 4
  const [activePartyId, setActivePartyId] = useState(null);
  
  // === Step 0: sheet image attachments (optional, multiple allowed) ===
  // Uploaders often have ONE sheet per bedroom and want to attach them
  // all so cleaners can pick the right one. We accept any number of
  // image/PDF files and upload each one on submit.
  const [sheetFiles, setSheetFiles] = useState([]);
  // Map of fileName → object URL for image previews. Built lazily as
  // files are added so we don't leak object URLs.
  const [sheetPreviews, setSheetPreviews] = useState({});
  
  // Template data
  const [templateSet, setTemplateSet] = useState(null);
  const [variants, setVariants] = useState([]); // all variants under the set
  const [items, setItems] = useState([]); // all items under those variants
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateError, setTemplateError] = useState(null);
  // Draft text for the "add a custom item" inputs, keyed by partyId:section
  const [customText, setCustomText] = useState({});
  
  // Submission
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  // Synchronous lock against double-submit. setBusy is async (React
  // batches state) so two rapid taps can both pass the `if (busy)`
  // check before busy=true takes effect. A ref flips synchronously
  // and is the reliable guard. The old setBusy-based check stays as
  // the visual disabled state for the button.
  const submittingRef = useRef(false);
  // True once the uploader has tapped "Next" on the configure step
  // with an incomplete bedroom — used to gate the red error dots so
  // we don't show them before they've even tried.
  const [nextAttempted, setNextAttempted] = useState(false);
  // Sheet preview overlay — set to { file, url } when the user taps
  // the eye/quick-view button on a sheet card. Tapping the backdrop
  // clears this and closes the overlay.
  const [quickView, setQuickView] = useState(null);
  
  // -----------------------------------------------------------------
  // Load units (apartments) for this property
  // -----------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("units")
        .select("*")
        .eq("customer_id", property.id)
        .eq("active", true)
        .order("sort_order")
        .order("label");
      setUnits(data || []);
    })();
  }, [property.id]);
  
  // -----------------------------------------------------------------
  // Load template set. Move-out cleans use their own granular set
  // (sheet_type='move_out_clean'); cleaning checks use the property's
  // set or the global default. Re-runs when the sheet type changes.
  // -----------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTemplateLoading(true);
      setTemplateError(null);
      try {
        let chosen = null;
        if (sheetType === "move_out_clean") {
          // Property-specific move-out set, else the global move-out set.
          const { data: ownMO } = await supabase
            .from("section_template_sets")
            .select("*")
            .eq("customer_id", property.id)
            .eq("sheet_type", "move_out_clean")
            .limit(1);
          chosen = (ownMO && ownMO[0]) || null;
          if (!chosen) {
            const { data: globalMO } = await supabase
              .from("section_template_sets")
              .select("*")
              .eq("sheet_type", "move_out_clean")
              .is("customer_id", null)
              .limit(1);
            chosen = (globalMO && globalMO[0]) || null;
          }
        }
        if (!chosen) {
          // Cleaning checks (and fallback if the move-out set isn't there yet):
          // property-specific, then global default.
          const { data: ownSet } = await supabase
            .from("section_template_sets")
            .select("*")
            .eq("customer_id", property.id)
            .limit(1);
          chosen = (ownSet && ownSet[0]) || null;
          if (!chosen) {
            const { data: defaultSet } = await supabase
              .from("section_template_sets")
              .select("*")
              .eq("is_default", true)
              .is("customer_id", null)
              .limit(1);
            chosen = (defaultSet && defaultSet[0]) || null;
          }
        }
        if (cancelled) return;
        if (!chosen) {
          setTemplateError(
            "No checklist template found for this property. Run the v27 migration first.",
          );
          setTemplateLoading(false);
          return;
        }
        setTemplateSet(chosen);
        // Load variants + items in one go
        const { data: vData } = await supabase
          .from("section_template_variants")
          .select("*")
          .eq("set_id", chosen.id)
          .order("sort_order");
        if (cancelled) return;
        setVariants(vData || []);
        const variantIds = (vData || []).map((v) => v.id);
        if (variantIds.length > 0) {
          const { data: iData } = await supabase
            .from("section_template_items")
            .select("*")
            .in("variant_id", variantIds)
            .order("sort_order");
          if (cancelled) return;
          setItems(iData || []);
        } else {
          setItems([]);
        }
      } catch (e) {
        if (!cancelled)
          setTemplateError(e.message || "Could not load checklist templates.");
      }
      if (!cancelled) setTemplateLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [property.id, sheetType]);
  
  // -----------------------------------------------------------------
  // Load ALL parties for ALL units of this property up-front. The
  // legacy-style tree shows every apartment with its bedrooms inline
  // so the uploader can check any combination, even across apartments.
  // -----------------------------------------------------------------
  useEffect(() => {
    if (units.length === 0) {
      setParties([]);
      return;
    }
    (async () => {
      const unitIds = units.map((u) => u.id);
      const { data } = await supabase
        .from("parties")
        .select("*")
        .in("unit_id", unitIds)
        .eq("active", true)
        .order("sort_order")
        .order("label");
      setParties(data || []);
    })();
  }, [units]);
  
  // -----------------------------------------------------------------
  // Sheet image previews — build object URLs for any image files in
  // sheetFiles, revoke them on cleanup so the browser doesn't leak.
  // -----------------------------------------------------------------
  useEffect(() => {
    const urls = {};
    sheetFiles.forEach((f) => {
      if (f.type && f.type.startsWith("image/")) {
        urls[f.name] = URL.createObjectURL(f);
      }
    });
    setSheetPreviews(urls);
    return () => {
      Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [sheetFiles]);
  
  // Append new sheet files to the list. Filters out files already
  // present by name+size so re-picking the input doesn't duplicate.
  // Accepts a plain array — callers must snapshot the FileList from
  // the input element BEFORE this runs because clearing input.value
  // (which we do to allow re-picking the same file) also wipes
  // input.files, and React state updates are async so the FileList
  // would be empty by the time the setter reads from it.
  const addSheetFiles = (files) => {
    if (!files || files.length === 0) return;
    setSheetFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const additions = files.filter(
        (f) => !existing.has(`${f.name}-${f.size}`),
      );
      return [...prev, ...additions];
    });
  };
  
  const removeSheetFile = (idx) => {
    setSheetFiles((prev) => prev.filter((_, i) => i !== idx));
  };
  
  // Renames a sheet file at the given index. We can't mutate the File
  // object's name directly (it's read-only) so we wrap the file with a
  // new File that has the new name but the same content and type. We
  // also need to update any per-bedroom sheetFileName references that
  // pointed at the old name so the assignment still works at submit.
  const renameSheetFile = (idx, newName) => {
    setSheetFiles((prev) => {
      if (idx < 0 || idx >= prev.length) return prev;
      const orig = prev[idx];
      // Preserve the original extension if user dropped it
      const origExt = (orig.name.match(/\.[^.]+$/) || [""])[0];
      const cleaned = newName.trim() || orig.name;
      const finalName = /\.[^.]+$/.test(cleaned)
        ? cleaned
        : `${cleaned}${origExt}`;
      if (finalName === orig.name) return prev;
      const wrapped = new File([orig], finalName, {
        type: orig.type,
        lastModified: orig.lastModified,
      });
      const next = [...prev];
      next[idx] = wrapped;
      // Update any per-bedroom assignment that pointed at the old name
      setConfig((cfg) => {
        const out = { ...cfg };
        Object.keys(out).forEach((pid) => {
          if (out[pid]?.sheetFileName === orig.name) {
            out[pid] = { ...out[pid], sheetFileName: finalName };
          }
        });
        return out;
      });
      return next;
    });
  };
  
  // Build a sensible suggested filename from the currently selected
  // bedrooms. Examples:
  //   1 bedroom, 1 apartment:   "B1-101 Bedroom 1"
  //   2 bedrooms, 1 apartment:  "B1-101 Bedrooms 1 + 2"
  //   bedrooms across apts:     "Multi-apartment"
  // Falls back to "" when nothing's picked yet — that disables the
  // suggestion button on the sheet card.
  const suggestedSheetName = () => {
    const ids = Object.keys(selectedParties).filter((k) => selectedParties[k]);
    if (ids.length === 0) return "";
    const grouped = {};
    ids.forEach((id) => {
      const p = parties.find((x) => x.id === id);
      if (!p) return;
      if (!grouped[p.unit_id]) grouped[p.unit_id] = [];
      grouped[p.unit_id].push(p);
    });
    const unitIds = Object.keys(grouped);
    if (unitIds.length > 1) return "Multi-apartment";
    const uid = unitIds[0];
    const u = units.find((uu) => uu.id === uid);
    const aptLabel = u?.label || "";
    const ps = grouped[uid].sort((a, b) => {
      const an = parseInt((a.label || "").match(/(\d+)/)?.[1] || "0", 10);
      const bn = parseInt((b.label || "").match(/(\d+)/)?.[1] || "0", 10);
      return an - bn;
    });
    if (ps.length === 1) return `${aptLabel} ${ps[0].label}`;
    const nums = ps
      .map((p) => (p.label || "").match(/(\d+)/)?.[1])
      .filter(Boolean);
    return `${aptLabel} Bedrooms ${nums.join(" + ")}`;
  };
  
  // Track which sheet card is currently being edited (idx) + its
  // in-progress new name. null when nothing's being edited.
  const [renamingIdx, setRenamingIdx] = useState(null);
  const [renamingValue, setRenamingValue] = useState("");
  
  // Helper lookups against template data
  const variantsBySection = (sectionKey) =>
    variants.filter((v) => v.section_key === sectionKey);
  const variantById = (id) => variants.find((v) => v.id === id);
  const itemsForVariant = (variantId) =>
    items.filter((i) => i.variant_id === variantId);
  const variantBySectionKey = (sectionKey, variantKey) =>
    variants.find(
      (v) => v.section_key === sectionKey && v.variant_key === variantKey,
    );
  
  // For configure step: pick the active party, default to first selected
  useEffect(() => {
    if (step !== 3) return;
    const ids = Object.keys(selectedParties).filter((k) => selectedParties[k]);
    if (ids.length === 0) return;
    if (!activePartyId || !selectedParties[activePartyId]) {
      setActivePartyId(ids[0]);
    }
  }, [step, selectedParties, activePartyId]);
  
  // -----------------------------------------------------------------
  // Make sure a config shell exists for a bedroom. Called when the
  // bedroom is first selected (either via individual toggle or via
  // "Select all bedrooms in this apartment" in multi mode).
  // -----------------------------------------------------------------
  const ensureConfigShell = (partyId) => {
    setConfig((prev) => {
      if (prev[partyId]) return prev;
      const party = parties.find((p) => p.id === partyId);
      // Default bathroom variant uses bedroom-number PARITY so partners
      // start opposite by default:
      //   1, 3 (odd)  → 'a' (tub responsibility)
      //   2, 4 (even) → 'b' (toilet responsibility)
      // This matches the convention where the lower-numbered bedroom
      // owns the tub side and the higher one owns the toilet side.
      const num = parseInt((party?.label || "").match(/(\d+)/)?.[1] || "0", 10);
      const bathroomVariant = num > 0 ? (num % 2 === 1 ? "a" : "b") : null;
      return {
        ...prev,
        [partyId]: {
          mode: "configure",
          bathroomVariant,
          generalVariant: null,
          checked: {},
          passedSections: {},
        },
      };
    });
  };
  
  // -----------------------------------------------------------------
  // Toggle a bedroom on/off. In single mode the uploader can only have
  // ONE bedroom selected at a time — picking a new bedroom replaces
  // the previous one (even if it's in a different apartment). Multi
  // mode allows free selection across apartments.
  // -----------------------------------------------------------------
  const togglePartySelection = (partyId) => {
    setSelectedParties((prev) => {
      const next = uploadMode === "single" ? {} : { ...prev };
      if (prev[partyId] && uploadMode !== "single") {
        delete next[partyId];
      } else {
        next[partyId] = true;
      }
      return next;
    });
    ensureConfigShell(partyId);
  };
  
  // -----------------------------------------------------------------
  // Shared-bathroom autofill: if uploader changes bathroom variant for
  // one bedroom, suggest the OPPOSITE for the other bedroom in the
  // same bathroom group. Only suggests — uploader can override.
  // -----------------------------------------------------------------
  const setBathroomVariantWithAutofill = (partyId, variant) => {
    setConfig((prev) => {
      const next = { ...prev };
      const current = next[partyId] || { mode: "configure", checked: {} };
      next[partyId] = { ...current, bathroomVariant: variant };
      // Whole-bathroom means this bedroom's cleaner does everything —
      // there's no split to mirror, so leave the partner alone.
      if (variant === "all") return next;
      // Find the partner bedroom (same bathroom group, different bedroom number)
      const party = parties.find((p) => p.id === partyId);
      const myNum = parseInt(
        (party?.label || "").match(/(\d+)/)?.[1] || "0",
        10,
      );
      const myBathroom = bathroomNumberForBedroom(party?.label);
      if (myBathroom) {
        const partnerNum =
          myBathroom === 1 ? (myNum === 1 ? 2 : 1) : myNum === 3 ? 4 : 3;
        // CRITICAL: scope partner search to the SAME apartment. Without
        // this guard, multi-apartment selections would match the first
        // bedroom with the right number anywhere — likely the wrong
        // apartment's partner.
        const partnerParty = parties.find((p) => {
          const n = parseInt((p.label || "").match(/(\d+)/)?.[1] || "0", 10);
          return n === partnerNum && p.unit_id === party?.unit_id;
        });
        if (partnerParty && selectedParties[partnerParty.id]) {
          // Roommates SPLIT the bathroom — one has tub responsibility,
          // the other has toilet responsibility. So the partner's
          // variant is FORCED to the opposite of this one whenever this
          // bedroom's variant changes. The uploader can still go to the
          // partner's tab and override manually if they really need to.
          const opposite = variant === "a" ? "b" : "a";
          const partnerCurrent = next[partnerParty.id] || {
            mode: "configure",
            checked: {},
            passedSections: {},
          };
          next[partnerParty.id] = {
            ...partnerCurrent,
            bathroomVariant: opposite,
          };
        }
      }
      return next;
    });
  };
  
  const setGeneralVariant = (partyId, variant) => {
    setConfig((prev) => {
      const current = prev[partyId] || { mode: "configure", checked: {} };
      // If the bedroom is in Fail-Entire mode and didn't have a
      // variant before (or had a different one), we need to:
      //  1) Drop any general:* checks tied to the OLD variant
      //  2) Add general:* checks for every item in the NEW variant
      // This keeps Fail-Entire semantically honest: "fail everything
      // in the assigned General area" — once the variant is known.
      if (current.mode === "fail_entire") {
        const newChecked = { ...(current.checked || {}) };
        // Strip every existing general:* check so the variant swap is clean.
        Object.keys(newChecked).forEach((k) => {
          if (k.startsWith("general:")) delete newChecked[k];
        });
        const gv = variantBySectionKey("general", variant);
        if (gv)
          itemsForVariant(gv.id).forEach((i) => {
            newChecked[`general:${i.item_key}`] = true;
          });
        return {
          ...prev,
          [partyId]: {
            ...current,
            generalVariant: variant,
            checked: newChecked,
          },
        };
      }
      return { ...prev, [partyId]: { ...current, generalVariant: variant } };
    });
  };
  
  // Per-bedroom cleaning type. Lives on the assignment row as the
  // existing `assignment_type` column at submit time so downstream
  // filtering/coloring still works.
  const setCleaningType = (partyId, value) => {
    setConfig((prev) => ({
      ...prev,
      [partyId]: {
        ...(prev[partyId] || { mode: "configure", checked: {} }),
        cleaningType: value,
      },
    }));
  };
  
  // Per-bedroom sheet file assignment. Stores the file NAME so we can
  // look up the actual File object at submit time. Null = no sheet
  // attached to this bedroom.
  const setSheetForBedroom = (partyId, fileName) => {
    setConfig((prev) => ({
      ...prev,
      [partyId]: {
        ...(prev[partyId] || { mode: "configure", checked: {} }),
        sheetFileName: fileName,
      },
    }));
  };
  
  const toggleItem = (partyId, sectionKey, itemKey) => {
    const key = `${sectionKey}:${itemKey}`;
    setConfig((prev) => {
      const current = prev[partyId] || { mode: "configure", checked: {} };
      const checked = { ...current.checked };
      if (checked[key]) delete checked[key];
      else checked[key] = true;
      return { ...prev, [partyId]: { ...current, checked, mode: "configure" } };
    });
  };
  
  // Add a custom item to a section for THIS assignment only (not the
  // template). Stored with a "custom_" key + the label; on submit it
  // becomes a target with the label in status_notes (same idea as a
  // cleaner's requested item).
  const addCustomItem = (partyId, sectionKey, label) => {
    const trimmed = (label || "").trim();
    if (!trimmed) return;
    const itemKey = `custom_${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const key = `${sectionKey}:${itemKey}`;
    setConfig((prev) => {
      const current = prev[partyId] || {
        mode: "configure",
        checked: {},
        customLabels: {},
      };
      return {
        ...prev,
        [partyId]: {
          ...current,
          mode: "configure",
          checked: { ...(current.checked || {}), [key]: true },
          customLabels: { ...(current.customLabels || {}), [key]: trimmed },
          // adding work means the section isn't "passed"
          passedSections: {
            ...(current.passedSections || {}),
            [sectionKey]: false,
          },
        },
      };
    });
  };
  const removeCustomItem = (partyId, key) => {
    setConfig((prev) => {
      const current = prev[partyId];
      if (!current) return prev;
      const checked = { ...(current.checked || {}) };
      delete checked[key];
      const customLabels = { ...(current.customLabels || {}) };
      delete customLabels[key];
      return { ...prev, [partyId]: { ...current, checked, customLabels } };
    });
  };
  
  // Pass/Fail Entire is now a toggle: clicking the same mode again
  // flips back to 'configure' (so neither button is active). Fail
  // Entire auto-fills missing variants with defaults ('a' for both)
  // so the cleaner has SOMETHING checked even if the uploader didn't
  // pick variants first — they can still fix variants on the next
  // pass.
  const setMode = (partyId, mode) => {
    setConfig((prev) => {
      const current = prev[partyId] || {
        bathroomVariant: null,
        generalVariant: null,
        checked: {},
        passedSections: {},
      };
      // Toggle off: clicking the same mode again clears it back to configure
      if (current.mode === mode) {
        return { ...prev, [partyId]: { ...current, mode: "configure" } };
      }
      if (mode === "fail_entire") {
        // Bathroom variant follows the bedroom-parity rule (odd→tub,
        // even→toilet) so we can auto-default safely — bedrooms in the
        // same apartment naturally get different bathroom variants
        // because of the parity split. General has NO such natural
        // mapping, so we leave it UNSET and force the uploader to
        // pick one per bedroom. This prevents the bug where two
        // bedrooms in the same apartment both end up with the same
        // General assignment (e.g. both getting "Living Room").
        const bathroomVariant = current.bathroomVariant || "a";
        const checked = {};
        const bedroomV = variantBySectionKey("bedroom", "default");
        if (bedroomV)
          itemsForVariant(bedroomV.id).forEach((i) => {
            checked[`bedroom:${i.item_key}`] = true;
          });
        const vanityV = variantBySectionKey("vanity", "default");
        if (vanityV)
          itemsForVariant(vanityV.id).forEach((i) => {
            checked[`vanity:${i.item_key}`] = true;
          });
        const bv = variantBySectionKey("bathroom", bathroomVariant);
        if (bv)
          itemsForVariant(bv.id).forEach((i) => {
            checked[`bathroom:${i.item_key}`] = true;
          });
        // Only check General items if a variant has actually been
        // picked. Otherwise leave General empty so the uploader sees
        // a clear "pick a variant" prompt before they can submit.
        if (current.generalVariant) {
          const gv = variantBySectionKey("general", current.generalVariant);
          if (gv)
            itemsForVariant(gv.id).forEach((i) => {
              checked[`general:${i.item_key}`] = true;
            });
        }
        return {
          ...prev,
          [partyId]: {
            ...current,
            mode,
            bathroomVariant,
            // Explicitly preserve (or leave null) generalVariant — no auto-default.
            generalVariant: current.generalVariant || null,
            checked,
            passedSections: {}, // un-pass any sections that were marked
          },
        };
      }
      if (mode === "pass") {
        return {
          ...prev,
          [partyId]: { ...current, mode, checked: {}, passedSections: {} },
        };
      }
      return { ...prev, [partyId]: { ...current, mode } };
    });
  };
  
  // Section-level pass toggle. When marked, the section's items are
  // visually grayed and won't be submitted. The cleaner can un-pass to
  // bring items back. Section pass is independent of whole-bedroom pass.
  const toggleSectionPass = (partyId, sectionKey) => {
    setConfig((prev) => {
      const current = prev[partyId] || {
        mode: "configure",
        checked: {},
        passedSections: {},
        failedSections: {},
      };
      const passedSections = { ...(current.passedSections || {}) };
      const failedSections = { ...(current.failedSections || {}) };
      const willPass = !passedSections[sectionKey];
      if (willPass) {
        passedSections[sectionKey] = true;
        delete failedSections[sectionKey]; // mutually exclusive with fail-all
        // Also un-check all items in that section so a passed section
        // never contributes targets at submit time.
        const cleared = { ...(current.checked || {}) };
        Object.keys(cleared).forEach((k) => {
          if (k.startsWith(`${sectionKey}:`)) delete cleared[k];
        });
        return {
          ...prev,
          [partyId]: {
            ...current,
            passedSections,
            failedSections,
            checked: cleared,
          },
        };
      } else {
        delete passedSections[sectionKey];
        return { ...prev, [partyId]: { ...current, passedSections } };
      }
    });
  };
  
  // Section-level FAIL ALL — the mirror of toggleSectionPass.
  // The cleaner failed every item in this section, so we auto-check
  // them all. Like Pass, this is mutually exclusive with Pass and
  // also with the whole-bedroom Pass mode (since fail-all sets up
  // work that contradicts "no work").
  const toggleSectionFail = (partyId, sectionKey) => {
    setConfig((prev) => {
      const current = prev[partyId] || {
        mode: "configure",
        checked: {},
        passedSections: {},
        failedSections: {},
      };
      const failedSections = { ...(current.failedSections || {}) };
      const passedSections = { ...(current.passedSections || {}) };
      const willFail = !failedSections[sectionKey];
      if (willFail) {
        failedSections[sectionKey] = true;
        delete passedSections[sectionKey]; // mutually exclusive with pass-all
        // Auto-check every item in this section for the currently
        // selected variant. If no variant is picked yet for the
        // section, no items get checked (the uploader needs to pick
        // a variant first — the section tab will continue to flag).
        const variantKey =
          sectionKey === "bathroom"
            ? current.bathroomVariant
            : sectionKey === "general"
              ? current.generalVariant
              : "default";
        // 'all' = whole bathroom → check every bathroom item across all
        // variants (deduped by item_key). Without this branch, Fail-all
        // found no matching variant and checked nothing.
        let variantItems;
        if (sectionKey === "bathroom" && variantKey === "all") {
          const seen = new Set();
          variantItems = variantsBySection("bathroom")
            .flatMap((v) => itemsForVariant(v.id))
            .filter((it) => {
              if (seen.has(it.item_key)) return false;
              seen.add(it.item_key);
              return true;
            });
        } else {
          const variant = variantKey
            ? variantBySectionKey(sectionKey, variantKey)
            : null;
          variantItems = variant ? itemsForVariant(variant.id) : [];
        }
        const checked = { ...(current.checked || {}) };
        variantItems.forEach((it) => {
          checked[`${sectionKey}:${it.item_key}`] = true;
        });
        return {
          ...prev,
          [partyId]: { ...current, passedSections, failedSections, checked },
        };
      } else {
        delete failedSections[sectionKey];
        // Un-check the items that fail-all auto-checked. We can't
        // distinguish auto-checked from manually-checked, so we clear
        // everything in this section — the uploader can re-check
        // anything they wanted manually.
        const checked = { ...(current.checked || {}) };
        Object.keys(checked).forEach((k) => {
          if (k.startsWith(`${sectionKey}:`)) delete checked[k];
        });
        return { ...prev, [partyId]: { ...current, failedSections, checked } };
      }
    });
  };
  
  // -----------------------------------------------------------------
  // Validation per step
  //   0 = sheet upload (optional, always passes)
  //   1 = apartment + mode picked
  //   2 = sheet type picked
  //   3 = at least one bedroom selected
  //   4 = every selected bedroom configured (Pass OR variants+items)
  //   5 = review (no advance, only submit)
  // -----------------------------------------------------------------
  const canAdvanceFromStep = () => {
    if (step === 0) return true; // sheet upload is optional
    if (step === 1) {
      // Apartment + mode + bedrooms all on one step now. Need a mode
      // chosen and at least one bedroom checked. In single mode the
      // selection is capped at 1 (enforced by togglePartySelection).
      if (!uploadMode) return false;
      const ids = Object.keys(selectedParties).filter(
        (k) => selectedParties[k],
      );
      if (ids.length === 0) return false;
      if (uploadMode === "single" && ids.length > 1) return false;
      return true;
    }
    if (step === 2) return !!sheetType;
    if (step === 3) {
      // Configure step. Every selected bedroom must have EVERY section
      // accounted for. A section is "done" when it's either passed
      // (passedSections[s] === true) or has at least one item checked.
      // Bathroom/General with items checked also need their variant
      // picked so we know which template to use.
      //
      // Whole-bedroom Pass (mode === 'pass') short-circuits all of this.
      const ids = Object.keys(selectedParties).filter(
        (k) => selectedParties[k],
      );
      return ids.every((id) => sectionsForBedroomComplete(id).every(Boolean));
    }
    return true;
  };
  
  // Returns an array [bedroom, vanity, bathroom, general] of booleans
  // indicating whether each section is "done". Used by the validation
  // gate and by the section-tab error indicators so the uploader sees
  // exactly which sections still need attention.
  const sectionsForBedroomComplete = (partyId) => {
    const c = config[partyId];
    if (!c) return [false, false, false, false];
    if (c.mode === "pass") return [true, true, true, true];
    const checked = c.checked || {};
    const passed = c.passedSections || {};
    const failed = c.failedSections || {};
    const sectionDone = (key, variantNeeded, variantValue) => {
      // Variant REQUIRED for bathroom and general even when passed
      // or failed — the cleaner's responsibility for which general
      // area (Kitchen, LR, Fridge, Vents) needs to be captured so
      // the cleaner can request items from that variant later.
      if (variantNeeded && !variantValue) return false;
      if (passed[key]) return true;
      if (failed[key]) return true;
      const hasItems = Object.keys(checked).some((k) =>
        k.startsWith(`${key}:`),
      );
      if (!hasItems) return false;
      return true;
    };
    return [
      sectionDone("bedroom", false, null),
      sectionDone("vanity", false, null),
      sectionDone("bathroom", true, c.bathroomVariant),
      sectionDone("general", true, c.generalVariant),
    ];
  };
  
  // -----------------------------------------------------------------
  // Submit: create one assignment per non-pass bedroom with its targets.
  // Multiple sheet uploads: all files are uploaded to storage. The
  // first becomes the assignment's primary `file_url`; the rest are
  // listed in the title/notes for now (a future migration can add a
  // proper `sheet_files JSONB` column).
  // -----------------------------------------------------------------
  const submit = async () => {
    // Ref-based lock: flips synchronously so a second rapid tap never
    // gets through. setBusy is async and can be raced.
    if (submittingRef.current || busy) return;
    // Pre-count what we're about to create so the user can sanity-
    // check before we hit the database. This guards against the
    // "I clicked once and now there are 57 cards" surprise that comes
    // from Fail-Entire mode quietly checking ~28 items per bedroom.
    const selectedPartyIds = Object.keys(selectedParties).filter(
      (k) => selectedParties[k],
    );
    const previewCounts = selectedPartyIds.reduce(
      (acc, pid) => {
        const cc = config[pid];
        if (!cc || cc.mode === "pass") return acc;
        acc.assignments += 1;
        acc.items += Object.keys(cc.checked || {}).length;
        return acc;
      },
      { assignments: 0, items: 0 },
    );
    if (previewCounts.assignments === 0) {
      setError("Nothing to create — every bedroom is set to Pass.");
      return;
    }
    // Unique-variant validation across an apartment. Each bedroom in
    // a 4-bedroom unit should get a DIFFERENT General variant — only
    // one bedroom is "the kitchen bedroom", only one is "the LR
    // bedroom", etc. If two bedrooms in the same unit ended up with
    // the same variant, that's a data-entry mistake we want to catch
    // before writing to the DB. Same rule applies whether the bedroom
    // is in configure or fail_entire mode (both produce General items).
    const variantConflicts = []; // [{ unitLabel, variant, bedroomLabels }]
    const missingVariants = []; // [{ bedroomLabel }]
    {
      const byUnit = {}; // unitId -> { variant -> [bedroomLabel] }
      selectedPartyIds.forEach((pid) => {
        const cc = config[pid];
        if (!cc || cc.mode === "pass") return;
        const party = parties.find((p) => p.id === pid);
        if (!party) return;
        // ALWAYS require a generalVariant when the bedroom isn't being
        // skipped entirely. Even if no general items are checked, the
        // variant tells the cleaner which general area this bedroom is
        // responsible for — which matters for the Request flow later
        // (cleaner notices something not on the sheet, taps Request,
        // modal filters items by this variant). Without the variant,
        // the cleaner has no way to know what they could request.
        if (!cc.generalVariant) {
          missingVariants.push({ bedroomLabel: party.label || pid });
          return;
        }
        const uid = party.unit_id;
        if (!byUnit[uid]) byUnit[uid] = {};
        if (!byUnit[uid][cc.generalVariant])
          byUnit[uid][cc.generalVariant] = [];
        byUnit[uid][cc.generalVariant].push(party.label || pid);
      });
      Object.entries(byUnit).forEach(([uid, variants]) => {
        const unit = units.find((u) => u.id === uid);
        const unitLabel = unit?.label || uid;
        Object.entries(variants).forEach(([variant, labels]) => {
          if (labels.length > 1) {
            variantConflicts.push({
              unitLabel,
              variant: variant.toUpperCase(),
              bedroomLabels: labels,
            });
          }
        });
      });
    }
    if (missingVariants.length > 0) {
      setError(
        `Pick a General variant (LR / Fridge / Vents / Kitchen) for: ` +
          missingVariants.map((m) => m.bedroomLabel).join(", ") +
          `. Each bedroom in an apartment gets its own General area.`,
      );
      return;
    }
    if (variantConflicts.length > 0) {
      const msgs = variantConflicts.map(
        (c) =>
          `${c.unitLabel}: variant ${c.variant} is assigned to ${c.bedroomLabels.join(" AND ")}`,
      );
      setError(
        `Each bedroom in the same apartment needs a UNIQUE General variant — ` +
          `there's a 1:1 mapping (LR=A, Fridge=B, Vents=C, Kitchen=D).\n\n` +
          msgs.join("\n"),
      );
      return;
    }
    // Confirmation only fires above a reasonable threshold to avoid
    // nagging on small uploads. 25 items is enough to span 1 bedroom
    // in Fail-Entire mode; anything more and we ask.
    if (previewCounts.items >= 25) {
      const ok = confirm(
        `About to create ${previewCounts.assignments} assignment${previewCounts.assignments === 1 ? "" : "s"} ` +
          `with ${previewCounts.items} checklist item${previewCounts.items === 1 ? "" : "s"} total.\n\n` +
          `Continue?`,
      );
      if (!ok) return;
    }
    submittingRef.current = true;
    setBusy(true);
    setError("");
    try {
      // Upload all sheet files first; collect URL + storage path by
      // file NAME so we can look up both for each bedroom's chosen
      // sheet. file_path is also stored on the assignment so the
      // delete-assignment flow can clean up the storage object.
      const uploadedByName = {};
      for (const sf of sheetFiles) {
        const safe = sf.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `assignments/${property.id}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("assignments")
          .upload(path, sf);
        if (upErr) throw new Error("Sheet upload failed: " + upErr.message);
        const { data: urlData } = supabase.storage
          .from("assignments")
          .getPublicUrl(path);
        uploadedByName[sf.name] = {
          url: urlData?.publicUrl || null,
          path,
          kind: sf.type === "application/pdf" ? "pdf" : "image",
          name: sf.name,
        };
      }
  
      // Determine the friendly assignment title from sheet type
      const titleBase =
        sheetType === "cleaning_check" ? "Cleaning check" : "Move-out clean";
  
      // selectedPartyIds is computed at the top of submit (used by
      // the pre-create confirm). Reuse it here.
      const created = [];
      for (const partyId of selectedPartyIds) {
        const c = config[partyId];
        if (!c || c.mode === "pass") continue;
        const party = parties.find((p) => p.id === partyId);
        // Each bedroom's assignment lives at its own apartment. The
        // wizard supports cross-apartment selections so we look the
        // unit up from the party itself, not from a single state var.
        const partyUnit = units.find((u) => u.id === party?.unit_id);
        if (!partyUnit) {
          throw new Error(
            `Couldn't find the apartment for ${party?.label || partyId}.`,
          );
        }
        // Sheet for this bedroom. If the uploader picked a specific
        // sheet via the dropdown use that. Otherwise default to the
        // single uploaded sheet (if any). With zero sheets, no file
        // is attached.
        let bedroomSheet = null;
        if (c.sheetFileName && uploadedByName[c.sheetFileName]) {
          bedroomSheet = uploadedByName[c.sheetFileName];
        } else if (Object.keys(uploadedByName).length === 1) {
          bedroomSheet = uploadedByName[Object.keys(uploadedByName)[0]];
        }
        // Per-bedroom cleaning type. Defaults from sheet type.
        const cleaningType =
          c.cleaningType ||
          (sheetType === "cleaning_check"
            ? "cleaning_check"
            : "move_out_check");
        // Build the insert payload as a FRESH object literal so there's
        // zero possibility of a stale field sneaking in. Only the
        // schema's actual assignments columns are listed here, so any
        // accidental reference to unit_id / party_id / source from a
        // future refactor would not survive this rebuild. We also use
        // an explicit .select() column list below — never .select()
        // unqualified — to keep PostgREST's column resolution from
        // touching anything outside this list.
        const SAFE_COLS = {
          customer_id: property.id,
          title:
            `${titleBase} · ${partyUnit?.label || ""}${party?.label ? " · " + party.label : ""}`.trim(),
          notes: null,
          file_url: bedroomSheet?.url || null,
          file_path: bedroomSheet?.path || null,
          file_kind: bedroomSheet?.kind || null,
          assignment_type: cleaningType,
          active: true,
          uploaded_by: employee?.id || null,
          sheet_type: sheetType,
          template_set_id: templateSet?.id || null,
          bathroom_variant: c.bathroomVariant || null,
          general_variant: c.generalVariant || null,
          // PM-sourced assignments need owner approval before they
          // become visible to cleaners. Staff-sourced (no actorKind)
          // skip this step and take effect immediately.
          ...(isPmActor
            ? {
                source: "pm",
                pm_status: "pending",
                actor_kind: actorKind,
              }
            : {}),
        };
        const assignmentInsert = JSON.parse(JSON.stringify(SAFE_COLS));
        if (typeof console !== "undefined") {
          console.log(
            "[wizard] assignments insert FULL payload:",
            assignmentInsert,
          );
        }
        const { data: created_assignment, error: aErr } = await supabase
          .from("assignments")
          .insert(assignmentInsert)
          // Explicit column list — never bare .select() — so PostgREST
          // doesn't try to resolve columns that aren't in our payload.
          .select(
            "id, customer_id, title, file_url, file_kind, file_path, assignment_type, active, sheet_type, template_set_id, bathroom_variant, general_variant, uploaded_by, source, pm_status, actor_kind, created_at",
          )
          .single();
        if (aErr) {
          if (typeof console !== "undefined") {
            console.error("[wizard] assignment insert error RAW:", aErr);
          }
          throw new Error("Assignment insert failed: " + aErr.message);
        }
  
        // Build the target rows — one per checked item
        const targetRows = [];
        Object.keys(c.checked).forEach((k) => {
          const [sectionKey, itemKey] = k.split(":", 2);
          const row = {
            assignment_id: created_assignment.id,
            unit_id: partyUnit?.id || null,
            party_id: partyId,
            status: "pending",
            template_section: sectionKey,
            template_item_key: itemKey,
          };
          // Custom (uploader-added) items carry their label in status_notes.
          if (
            itemKey &&
            itemKey.startsWith("custom_") &&
            c.customLabels &&
            c.customLabels[k]
          ) {
            row.status_notes = c.customLabels[k];
          }
          targetRows.push(row);
        });
        if (targetRows.length > 0) {
          const { error: tErr } = await supabase
            .from("assignment_targets")
            .insert(targetRows);
          if (tErr) throw new Error("Target insert failed: " + tErr.message);
        }
        created.push(created_assignment);
      }
  
      setSubmitted(true);
      // Brief pause so the cleaner sees the green progress bar before redirect
      setTimeout(() => onSaved(created), 800);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  };
  
  // Steps for the progress bar. Apartment + bedrooms are now ONE
  // combined step — after the uploader picks an apartment, the
  // bedrooms appear inline below the apartment list.
  //   0. Sheet upload (optional)
  //   1. Apartment + mode + bedrooms (multi: pick many, single: pick one)
  //   2. Sheet type (cleaning check / move-out clean)
  //   3. Configure each bedroom (sections + items)
  //   4. Review + submit
  const stepLabels = ["Sheet", "Apartment", "Type", "Configure", "Done"];

  return {
    step,
    setStep,
    isPmActor,
    units,
    unitSearch,
    setUnitSearch,
    uploadMode,
    setUploadMode,
    parties,
    selectedParties,
    setSelectedParties,
    sheetType,
    setSheetType,
    config,
    setConfig,
    activePartyId,
    setActivePartyId,
    sheetFiles,
    setSheetFiles,
    sheetPreviews,
    templateSet,
    variants,
    items,
    templateLoading,
    templateError,
    customText,
    setCustomText,
    busy,
    error,
    setError,
    submitted,
    nextAttempted,
    setNextAttempted,
    quickView,
    setQuickView,
    renamingIdx,
    setRenamingIdx,
    renamingValue,
    setRenamingValue,
    addSheetFiles,
    removeSheetFile,
    renameSheetFile,
    suggestedSheetName,
    variantsBySection,
    variantById,
    itemsForVariant,
    variantBySectionKey,
    ensureConfigShell,
    togglePartySelection,
    setBathroomVariantWithAutofill,
    setGeneralVariant,
    setCleaningType,
    setSheetForBedroom,
    toggleItem,
    addCustomItem,
    removeCustomItem,
    setMode,
    toggleSectionPass,
    toggleSectionFail,
    canAdvanceFromStep,
    sectionsForBedroomComplete,
    submit,
    stepLabels,
  };
}
