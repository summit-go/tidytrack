import React, { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
  Search,
  Clock,
  Camera,
  LogOut,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Plus,
  Pause,
  Play,
  Check,
  ArrowLeft,
  Users,
  Image as ImageIcon,
  Download,
  X,
  MapPin,
  Briefcase,
  Delete,
  AlertCircle,
  UserPlus,
  Building2,
  Trash2,
  Eye,
  EyeOff,
  LayoutDashboard,
  FileText,
  DollarSign,
  Home,
  Layers,
  User,
  Edit2,
  Copy,
  Printer,
  Calendar,
  HelpCircle,
  MessageCircle,
  MessageSquare,
  Settings,
  Languages,
  Menu,
  Square,
  Share2,
  ClipboardList,
  Lock,
  Circle,
  MoreVertical,
  RotateCcw,
  Undo2,
  Bell,
} from "lucide-react";
import {
  supabase,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  secureEmployeeSignIn,
  securePortalSignIn,
  secureSetCredential,
  PHOTO_BUCKET,
  ASSIGNMENT_BUCKET,
  PM_UPLOAD_BUCKET,
  MESSAGE_BUCKET,
  saveAssignees,
  fetchLivePresence,
  createNotification,
  clearAssignmentBroadcast,
  clearPmAssignmentNotification,
  uploadAssignmentFile,
  uploadPmFile,
  deletePmFile,
  uploadMessagePhoto,
  deleteMessagePhoto,
} from "../../lib/supabase.js";
import {
  ASSIGNMENT_TYPES,
  assignmentTypeLabel,
  assignmentTypeMeta,
  KIND_CANNOT,
  PHOTO_KIND_LABELS,
  photoKindLabel,
  FLAG_KINDS,
  ASSIGNMENT_MAX_SIZE_MB,
  CAPABILITIES,
  TASK_CATEGORIES,
  GENERAL_GROUP_ORDER,
  taskCategoryLabel,
  taskCategoryShortLabel,
  ASSIGNMENT_STATUSES,
  INVOICE_DESCR,
  SUMMIT_LOGO_URL,
  SUMMIT_COMPANY,
  INVOICE_TYPE_LABEL,
  INVOICE_STATUS_STYLE,
  STALE_IDLE_MIN,
  STALE_FORCE_MIN,
  MAX_BLOCK_HOURS,
} from "../../lib/constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "../../lib/permissions.js";
import {
  fmtTime,
  fmtTimeShort,
  fmtMoney,
  fmtDate,
  fmtDateLong,
  fmtDateWithDay,
  fmtDueDate,
  localTodayKey,
  assignmentDueKind,
  assignmentDueRank,
  fmtClock,
  greetingForTime,
  shiftBillableMs,
  shiftBillableHours,
  localDayKey,
  fmtInvoiceDate,
  toDateKey,
} from "../../lib/format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "../../lib/compare.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
} from "../../lib/photos.js";
import { sessionStore } from "../../lib/sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "../../lib/translation.js";
import {
  buildTargetTitle,
  unitSizeLabel,
  shortenBedroom,
  partyDisplay,
  unitPartyLabel,
  bathroomNumberForBedroom,
} from "../../lib/labels.js";
import { splitTaskName } from "../../lib/tasks.js";
import { useAssignmentSync } from "../../hooks/useAssignmentSync.js";
import { useIdleDetector } from "../../hooks/useIdleDetector.js";
import { usePagePersistence } from "../../hooks/usePagePersistence.js";
import { useItemLabelOverrides } from "../../hooks/useItemLabelOverrides.js";
import { useTick } from "../../hooks/useTick.js";
import { useUnreadCount } from "../../hooks/useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "../../hooks/useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "../../contexts/LocaleContext.jsx";
import { PreviewContext } from "../../contexts/PreviewContext.jsx";
import { AssignmentTypeChip } from "../../components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "../../components/chips/PriorityChip.jsx";
import { Splash } from "../../components/Splash.jsx";
import { ScreenId } from "../../components/ScreenId.jsx";
import { OwnerOnly } from "../../components/OwnerOnly.jsx";
import { DueDateEditor } from "../../components/DueDateEditor.jsx";
import { ProgressBar } from "../../components/ProgressBar.jsx";
import { CleanerProgressBar } from "../../components/CleanerProgressBar.jsx";
import { ConfirmModal } from "../../components/ConfirmModal.jsx";
import { AddressLink } from "../../components/AddressLink.jsx";
import { TranslatableText } from "../../components/TranslatableText.jsx";
import { PhotoModal } from "../../components/PhotoModal.jsx";
import { NotificationBell } from "../../components/NotificationBell.jsx";
import { Header } from "../../components/Header.jsx";
import { TeamClockIcon } from "../../components/TeamClockIcon.jsx";
import { TabButton } from "../../components/TabButton.jsx";
import { PhotoZoomViewer } from "../../components/PhotoZoomViewer.jsx";
import { TranslateButton } from "../../components/TranslateButton.jsx";
import { ZoomableImage } from "../../components/ZoomableImage.jsx";
import { ReviewLine } from "./ReviewLine.jsx";
import { SheetQuickViewModal } from "./SheetQuickViewModal.jsx";

export function ChecklistAssignmentWizard({
  property,
  employee,
  actorKind = null,
  portalUser = null,
  onCancel,
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

  // === Render ======================================================
  if (templateLoading) return <Splash text="Loading templates…" />;
  if (templateError) {
    return (
      <div className="min-h-screen bg-stone-50 px-5 py-6">
        <button onClick={onCancel} className="text-sm text-stone-600 mb-3">
          ← Back
        </button>
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Couldn't load templates</div>
              <div className="text-xs mt-1">{templateError}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------
  // Step 0 — Sheet uploads (optional, multiple allowed). The uploader
  // can attach one sheet per bedroom — cleaners will see all attached
  // sheets inside their assignment.
  // -----------------------------------------------------------------
  const renderSheetUpload = () => {
    return (
      <div>
        <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-1">
          Step 1 · Attach paper sheets (optional)
        </div>
        <div className="text-sm text-stone-600 mb-4">
          Take photos or attach PDFs of the inspection sheets. You can attach
          more than one — for example, one sheet per bedroom. Cleaners will see
          all sheets inside the assignment. Skip if you don't have them.
        </div>

        {/* Already-attached files */}
        {sheetFiles.length > 0 && (
          <div className="space-y-2 mb-3">
            {sheetFiles.map((f, idx) => {
              // Build a blob URL for both images and PDFs so quick-view
              // works for either kind. Reuse the image preview URL when
              // it already exists.
              const viewUrl =
                sheetPreviews[f.name] ||
                (f.type ? URL.createObjectURL(f) : null);
              const isImage = f.type && f.type.startsWith("image/");
              const isRenaming = renamingIdx === idx;
              const suggestion = suggestedSheetName();
              return (
                <div
                  key={`${f.name}-${idx}`}
                  className="p-3 rounded-xl border border-emerald-300 bg-emerald-50"
                >
                  <div className="flex items-center gap-3">
                    {isImage ? (
                      <img
                        src={sheetPreviews[f.name]}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-stone-200 flex items-center justify-center flex-shrink-0">
                        <FileText size={20} className="text-stone-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
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
                            if (e.key === "Escape") {
                              setRenamingIdx(null);
                            }
                          }}
                          className="w-full px-2 py-1 rounded-md border border-emerald-400 bg-white text-sm text-stone-900"
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setRenamingIdx(idx);
                            setRenamingValue(f.name.replace(/\.[^.]+$/, ""));
                          }}
                          className="text-sm font-medium text-emerald-900 truncate text-left w-full hover:underline"
                          title="Tap to rename"
                        >
                          {f.name}
                        </button>
                      )}
                      <div className="text-[10px] font-mono text-emerald-700 flex items-center gap-1 mt-0.5">
                        <span>
                          {(f.size / 1024).toFixed(0)} KB ·{" "}
                          {f.type === "application/pdf" ? "PDF" : "Image"}
                        </span>
                        {/* Suggested name button — appears when bedrooms
                           are selected and the current name doesn't
                           already match the suggestion. One tap renames
                           the file. */}
                        {suggestion && !f.name.startsWith(suggestion) && (
                          <button
                            onClick={() => renameSheetFile(idx, suggestion)}
                            className="ml-1 px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 hover:bg-emerald-300"
                            title="Rename using selected apartment/bedroom"
                          >
                            Use: {suggestion}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Rename pencil — alternate way to enter edit mode */}
                    <button
                      onClick={() => {
                        setRenamingIdx(idx);
                        setRenamingValue(f.name.replace(/\.[^.]+$/, ""));
                      }}
                      className="p-2 rounded-lg hover:bg-emerald-100 text-emerald-700 flex-shrink-0"
                      title="Rename"
                    >
                      <Edit2 size={16} />
                    </button>
                    {/* Quick view: opens an overlay preview so the
                       uploader can confirm which sheet is which. Tap
                       the backdrop to close. */}
                    {viewUrl && (
                      <button
                        onClick={() => setQuickView({ file: f, url: viewUrl })}
                        className="p-2 rounded-lg hover:bg-emerald-100 text-emerald-700 flex-shrink-0"
                        title="Quick view"
                      >
                        <Eye size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => removeSheetFile(idx)}
                      className="p-2 rounded-lg hover:bg-red-100 text-red-600 flex-shrink-0"
                      title="Remove"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Dropzone — always shown, lets uploader add more */}
        <label className="block">
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            multiple
            onChange={(e) => {
              // Snapshot files into a plain array FIRST. Setting
              // e.target.value below wipes e.target.files, so any
              // async (React state) read of it would get nothing.
              const snapshot = Array.from(e.target.files || []);
              e.target.value = ""; // allow re-picking the same file later
              addSheetFiles(snapshot);
            }}
          />
          <div className="px-4 py-6 rounded-2xl border-2 border-dashed border-stone-300 text-center text-stone-600 hover:border-stone-500 cursor-pointer">
            <Camera size={24} className="mx-auto mb-2 text-stone-400" />
            <div className="font-medium text-sm">
              {sheetFiles.length === 0
                ? "Tap to attach sheet photos or PDFs"
                : "Add another sheet"}
            </div>
            <div className="text-xs mt-1 text-stone-500">
              {sheetFiles.length === 0
                ? "Or skip this step"
                : "You can attach as many as you need"}
            </div>
          </div>
        </label>
      </div>
    );
  };

  // -----------------------------------------------------------------
  // Step 1 — Apartment + bedrooms
  //
  // Mode toggle FIRST. The apartment tree stays hidden until the
  // uploader picks Single or Multi mode. Once mode is picked, every
  // apartment in the property renders with its bedrooms inline as
  // checkbox cards (legacy style). Single mode: tapping a bedroom
  // replaces any previously checked bedroom across the whole tree.
  // Multi mode: tap freely, including across different apartments.
  // -----------------------------------------------------------------
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

  const renderSheetTypePicker = () => {
    return (
      <div>
        <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-3">
          Step 3 · Which sheet type?
        </div>
        <div className="space-y-3">
          <button
            onClick={() => setSheetType("cleaning_check")}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-colors ${sheetType === "cleaning_check" ? "bg-amber-50 border-amber-500" : "bg-white border-stone-200 hover:border-stone-400"}`}
          >
            <div className="font-serif text-lg text-stone-900 font-bold">
              Cleaning check
            </div>
          </button>
          <button
            onClick={() => setSheetType("move_out_clean")}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-colors ${sheetType === "move_out_clean" ? "bg-amber-50 border-amber-500" : "bg-white border-stone-200 hover:border-stone-400"}`}
          >
            <div className="font-serif text-lg text-stone-900 font-bold">
              Move-out clean
            </div>
          </button>
        </div>
      </div>
    );
  };

  // -- Step 5: Configure ------------------------------------------------
  // Bedroom tabs across the top (sorted by bedroom number).
  // Inside each bedroom: Pass/Fail Entire toggle row + section tabs
  // (Bedroom / Vanity / Bathroom / General) with the active section's
  // content below. Section tabs reduce vertical scroll by collapsing
  // everything that isn't the active section.
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

  // -- Main render ------------------------------------------------------
  // pb-[136px] = action bar (~68px) + manager tab bar (~64px) so nothing
  // is hidden when the wizard renders inside ManagerShell, which has its
  // own bottom tab bar.
  return (
    <>
      <div className="min-h-screen bg-stone-50 pb-[176px]">
        <div className="px-5 py-4 border-b border-stone-200 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => {
                if (step > 0) setStep(step - 1);
                else onCancel();
              }}
              className="p-2 -ml-2 rounded-full hover:bg-stone-100"
              title="Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider font-mono text-stone-500">
                {property.name}
              </div>
              <div className="font-serif text-lg text-stone-900 font-bold">
                New checklist assignment
              </div>
            </div>
          </div>
          <ProgressBar
            steps={stepLabels}
            currentStep={step}
            complete={submitted}
            onStepClick={(targetStep) => {
              if (!submitted) setStep(targetStep);
            }}
          />
        </div>

        {/* Step content. The wizard root has pb-[136px] so the fixed
         action bar AND the manager tab bar below it don't hide any
         content. */}
        <div className="px-5 py-5">
          {step === 0 && renderSheetUpload()}
          {step === 1 && renderUnitPicker()}
          {step === 2 && renderSheetTypePicker()}
          {step === 3 && renderConfigure()}
          {step === 4 && (
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
          )}
        </div>

        {/* Bottom action bar. Must clear the manager tab bar below it. The
         OWNER nav is two rows (mode toggle + tabs) at ~104px, taller than
         the ~64px single-row nav — so offset by 104px or the Next button
         hides behind the nav (exactly what happened in Business mode). */}
        <div className="fixed bottom-[104px] left-0 right-0 bg-white border-t border-stone-200 px-5 py-3 flex gap-2 z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <button
            onClick={() => {
              if (step > 0) setStep(step - 1);
              else onCancel();
            }}
            className="px-4 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium flex items-center gap-1.5 active:scale-95"
          >
            <ArrowLeft size={14} /> Back
          </button>
          {step < 4 && (
            <button
              onClick={() => {
                if (canAdvanceFromStep()) {
                  setNextAttempted(false);
                  setStep(step + 1);
                } else if (step === 3) {
                  // On the configure step we let the button stay tappable
                  // so the user gets visible feedback (red dots on the
                  // section tabs). For other steps the disabled state is
                  // still meaningful.
                  setNextAttempted(true);
                }
              }}
              disabled={step !== 3 && !canAdvanceFromStep()}
              className={`flex-1 py-3 rounded-xl text-sm font-medium ${
                !canAdvanceFromStep() && step === 3
                  ? "bg-stone-400 text-stone-50"
                  : "bg-stone-900 text-stone-50 disabled:opacity-50"
              }`}
            >
              {step === 0 && sheetFiles.length === 0
                ? "Skip & continue"
                : step === 3 && !canAdvanceFromStep()
                  ? "Finish each section first"
                  : "Next"}
            </button>
          )}
          {step === 4 && !submitted && (
            <button
              onClick={submit}
              disabled={busy}
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create assignments"}
            </button>
          )}
        </div>
      </div>
      {/* Sheet quick-view overlay — opened from the eye icon on any
       sheet card. Closes when the user taps outside the image. */}
      {quickView && (
        <SheetQuickViewModal
          file={quickView.file}
          url={quickView.url}
          onClose={() => setQuickView(null)}
        />
      )}
    </>
  );
}
