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
} from "../../../lib/supabase.js";
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
} from "../../../lib/constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "../../../lib/permissions.js";
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
} from "../../../lib/format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "../../../lib/compare.js";
import { isVisibleAssignmentTarget } from "../../../lib/assignments.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
} from "../../../lib/photos.js";
import { sessionStore } from "../../auth/sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "../../../lib/translation.js";
import {
  buildTargetTitle,
  unitSizeLabel,
  shortenBedroom,
  partyDisplay,
  unitPartyLabel,
  bathroomNumberForBedroom,
} from "../../../lib/labels.js";
import { splitTaskName } from "../../../lib/tasks.js";
import { useAssignmentSync } from "../../../hooks/useAssignmentSync.js";
import { useIdleDetector } from "../../../hooks/useIdleDetector.js";
import { usePagePersistence } from "../../../hooks/usePagePersistence.js";
import { useItemLabelOverrides } from "../../../hooks/useItemLabelOverrides.js";
import { useTick } from "../../../hooks/useTick.js";
import { useUnreadCount } from "../../../hooks/useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "../../../hooks/useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "../../../contexts/LocaleContext.jsx";
import { PreviewContext } from "../../../contexts/PreviewContext.jsx";
import { AssignmentTypeChip } from "../../../components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "../../../components/chips/PriorityChip.jsx";
import { Splash } from "../../../components/Splash.jsx";
import { ScreenId } from "../../../components/ScreenId.jsx";
import { OwnerOnly } from "../../../components/OwnerOnly.jsx";
import { DueDateEditor } from "../../../components/DueDateEditor.jsx";
import { ProgressBar } from "../../../components/ProgressBar.jsx";
import { CleanerProgressBar } from "../../../components/CleanerProgressBar.jsx";
import { ConfirmModal } from "../../../components/ConfirmModal.jsx";
import { AddressLink } from "../../../components/AddressLink.jsx";
import { TranslatableText } from "../../../components/TranslatableText.jsx";
import { PhotoModal } from "../../../components/PhotoModal.jsx";
import { NotificationBell } from "../../../components/NotificationBell.jsx";
import { Header } from "../../../components/Header.jsx";
import { TeamClockIcon } from "../../../components/TeamClockIcon.jsx";
import { TabButton } from "../../../components/TabButton.jsx";
import { PhotoZoomViewer } from "../../../components/PhotoZoomViewer.jsx";
import { TranslateButton } from "../../../components/TranslateButton.jsx";
import { ZoomableImage } from "../../../components/ZoomableImage.jsx";
import { ItemsDropdown } from "../../../apps/internal/cleaner/ItemsDropdown.jsx";
import { LeaveWorkblockModal } from "./LeaveWorkblockModal.jsx";
import { EditItemLabelModal } from "./EditItemLabelModal.jsx";
import { RequestItemsModal } from "./RequestItemsModal.jsx";
import { resolveItemLabel } from "../../../lib/pickerLabels.js";

export function TaskCategoryPicker({
  busy,
  onStartOne,
  onStartMany,
  defaultName,
  setDefaultName,
  // NEW: bedroom context. When provided, the picker becomes
  // checklist-aware: it loads active assignment_targets at this
  // bedroom and surfaces them as quick-pick items, filters General by
  // the actual assigned variant, etc. Passing all three is required
  // for checklist mode; if any is missing the picker falls back to
  // the legacy free-form behavior.
  customerId,
  unitId,
  partyId,
  employee,
  // Handler called when one or more checklist items are picked and
  // the cleaner taps Start. Receives an array of target rows + a
  // combined display name. Parent advances those targets to
  // in_progress AND creates a linked task in one shot.
  onStartChecklistItems,
  // Handler called when the cleaner taps the X on an in-progress
  // item in the Active tab — "I bit off more than I could chew,
  // put this back". Parent flips the target from in_progress / paused
  // back to pending and clears started_at / started_by. The item
  // becomes visible in Not started so the cleaner (or a coworker)
  // can grab it again.
  onReleaseTargets,
}) {
  const [category, setCategory] = useState(null); // 'bedroom'|'bathroom'|'vanity'|'general'|null
  const [selectedSubs, setSelectedSubs] = useState(new Set()); // for 'general' only
  const [customName, setCustomName] = useState("");
  // Checklist-aware state: targets at this bedroom + the assigned
  // bathroom/general variants for the apartment (so we can hide
  // unused variant groups in the General picker).
  const [checklistTargets, setChecklistTargets] = useState([]);
  // selectedTargetIds is the cleaner's pick within a section's
  // checklist items. They tap items + Start to flip them to
  // in_progress. Reset when category changes.
  const [selectedTargetIds, setSelectedTargetIds] = useState(new Set());
  // editingLabel — drives the per-property label override editor.
  // Set to { key, current, hasOverride } when the cleaner taps the
  // pencil; cleared when the editor closes.
  const [editingLabel, setEditingLabel] = useState(null);
  // Top-level tab inside the picker. 'not_started' is the default —
  // it's the "I want to start cleaning X" flow. 'active' shows
  // what's already in progress at this bedroom so the cleaner can
  // see the work-in-flight without leaving the picker.
  const [pickerTab, setPickerTab] = useState("not_started"); // 'active' | 'not_started'
  // Request modal — opens when the cleaner taps the small "Request"
  // button on a section card. Currently a placeholder; the full
  // flow (show possible items, checkbox, submit, banner on card,
  // workblock creation) is being designed iteratively with the
  // user. Value is the section id ('bedroom'|'bathroom'|'vanity'|
  // 'general') or null when closed.
  const [requestModalSection, setRequestModalSection] = useState(null);
  // Active variant from the assigned checklist assignments at this
  // bedroom. Used to filter the General groups. Bathroom variant
  // follows the same rule but the legacy picker doesn't split
  // bathroom by variant so it's informational only here.
  const checklistMode = !!(customerId && unitId && partyId);
  const loadChecklistTargets = async () => {
    if (!checklistMode) {
      setChecklistTargets([]);
      return;
    }
    const { data } = await supabase
      .from("assignment_targets")
      .select(
        "*, assignment:assignments!inner(id, customer_id, active, source, pm_status, deleted_at, sheet_type, assignment_type, template_set_id, bathroom_variant, general_variant)",
      )
      .eq("unit_id", unitId)
      .eq("party_id", partyId)
      .not("status", "in", "(done,blocked)");
    const open = (data || []).filter(
      (t) =>
        t.assignment?.customer_id === customerId &&
        t.assignment?.active &&
        !t.assignment?.deleted_at &&
        isVisibleAssignmentTarget(t) &&
        // Only template-based checklist targets — legacy single-row
        // assignments don't have item-level granularity to pick from.
        !!t.assignment?.template_set_id,
    );
    setChecklistTargets(open);
  };
  useEffect(() => {
    loadChecklistTargets();
    /* eslint-disable-next-line */
  }, [checklistMode, customerId, unitId, partyId]);
  // Realtime sync — when a coworker grabs/releases an item at this
  // same bedroom, the picker should refresh so the cleaner sees who
  // else is on it without needing to refresh manually.
  useAssignmentSync(loadChecklistTargets, "task-picker");

  const { locale } = useLocale();
  // Per-property label overrides (cleaner-edited Spanish labels).
  // Only loaded when locale != 'en'. Saving an override mutates the
  // map locally so the UI updates immediately.
  const { overrides, saveOverride, removeOverride } = useItemLabelOverrides(
    customerId,
    locale,
    employee,
  );

  // Friendly label for a target — uses status_notes (custom request
  // text) when present, else the template_item_key in a humanized
  // form. When locale=es, prefers per-property override > static
  // dictionary > English. Keeps the picker readable without needing
  // the full template_items join (cleaners don't care about the key).
  const labelForTarget = (t) => {
    if (
      t.status_notes &&
      (t.template_item_key?.startsWith?.("requested:") ||
        t.template_item_key?.startsWith?.("custom_"))
    )
      return t.status_notes;
    const key = t.template_item_key || "";
    const englishFallback = key
      .replace(/^[a-z]+:/, "")
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase());
    return resolveItemLabel(key, locale, overrides, englishFallback);
  };

  // The assigned general_variant(s) for this bedroom — pulled from
  // any active checklist assignment. In normal usage there's exactly
  // one; if there are multiple (e.g. cleaning_check + move_out for
  // the same bedroom) we show the union.
  const assignedGeneralVariants = checklistMode
    ? Array.from(
        new Set(
          checklistTargets
            .map((t) => t.assignment?.general_variant)
            .filter(Boolean),
        ),
      ).map((v) => v.toLowerCase())
    : [];

  // Separate query for variants — fetches the assignment's
  // bathroom_variant + general_variant directly so the picker still
  // knows which variant is assigned even when all targets at this
  // bedroom are done (which empties checklistTargets above). Without
  // this, completing every item would cause the General picker to
  // fall back to showing all 4 groups since the variant info vanished
  // along with the targets.
  const [persistedVariants, setPersistedVariants] = useState({
    bathroom: null,
    general: null,
    templateSetId: null,
  });
  useEffect(() => {
    if (!checklistMode || !customerId || !unitId || !partyId) {
      setPersistedVariants({
        bathroom: null,
        general: null,
        templateSetId: null,
      });
      return;
    }
    let cancelled = false;
    (async () => {
      // Look at ANY assignment_target at this bedroom (including done)
      // so we have a stable view of the assignment's variants.
      const { data } = await supabase
        .from("assignment_targets")
        .select(
          "assignment:assignments!inner(template_set_id, bathroom_variant, general_variant, active, customer_id)",
        )
        .eq("unit_id", unitId)
        .eq("party_id", partyId)
        .limit(50); // arbitrary cap — we just need any matching row
      if (cancelled) return;
      let bv = null,
        gv = null,
        tsi = null;
      (data || []).forEach((t) => {
        const a = t.assignment;
        if (!a || a.customer_id !== customerId || !a.active) return;
        if (!bv && a.bathroom_variant) bv = a.bathroom_variant.toLowerCase();
        if (!gv && a.general_variant) gv = a.general_variant.toLowerCase();
        if (!tsi && a.template_set_id) tsi = a.template_set_id;
      });
      setPersistedVariants({ bathroom: bv, general: gv, templateSetId: tsi });
    })();
    return () => {
      cancelled = true;
    };
  }, [checklistMode, customerId, unitId, partyId]);

  // Resolved variants — prefer the live derived values (from open
  // targets), fall back to the persisted ones (queried independently)
  // so the General gating works even when everything's done.
  const resolvedGeneralVariants =
    assignedGeneralVariants.length > 0
      ? assignedGeneralVariants
      : persistedVariants.general
        ? [persistedVariants.general]
        : [];

  const reset = () => {
    setCategory(null);
    setSelectedSubs(new Set());
    setSelectedTargetIds(new Set());
    setCustomName("");
    setDefaultName && setDefaultName("");
  };

  const toggleSub = (subId) => {
    setSelectedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) next.delete(subId);
      else next.add(subId);
      return next;
    });
  };

  // Toggle a checklist item pick (one target row). Multi-select; on
  // Start we'll flip all picked targets to in_progress and create one
  // combined task.
  const toggleTarget = (tid) => {
    setSelectedTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(tid)) next.delete(tid);
      else next.add(tid);
      return next;
    });
  };

  const cat = TASK_CATEGORIES.find((c) => c.id === category);
  const isGeneral = category === "general";
  const hasSubs = isGeneral && selectedSubs.size > 0;
  const hasTargetPicks = selectedTargetIds.size > 0;
  // For non-general, name auto-fills with the category label
  // For general with subs, name comes from the subcategory itself
  // For general with no subs, just "General"
  // Cleaner can override with customName for any of those.

  const canSubmit =
    !busy &&
    // Either: a category is picked (Not-started flow with custom-name
    // or section pick), OR target picks exist (Active-tab resume
    // flow). The submit handler picks the right path based on which
    // is set.
    (!!category || hasTargetPicks);

  const submit = async () => {
    if (!canSubmit) return;
    const customTrimmed = customName.trim();

    // CHECKLIST-ITEM PATH: cleaner picked one or more existing
    // assignment_targets — possibly across multiple sections.
    // We flip them all to in_progress in one shot and create ONE
    // combined task. The task's category is the most-represented
    // section so reports & the Active tab grouping land sensibly.
    // The name lists the picked items; if the cleaner provided a
    // customName we use that instead.
    if (hasTargetPicks && onStartChecklistItems) {
      const pickedRows = checklistTargets.filter((t) =>
        selectedTargetIds.has(t.id),
      );
      // Section count to pick the "primary" section for the task.
      // Ties go to the order we iterate (which is checklistTargets
      // load order — generally deterministic).
      const sectionCounts = {};
      pickedRows.forEach((t) => {
        const s = (t.template_section || "").toLowerCase() || "other";
        sectionCounts[s] = (sectionCounts[s] || 0) + 1;
      });
      const primarySection =
        Object.entries(sectionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        category ||
        null;
      const labels = pickedRows.map(labelForTarget);
      // If picks cross sections, prefix with section name so the
      // single task name reads cleanly. Else just join the labels.
      const crossSection = Object.keys(sectionCounts).length > 1;
      const sectionLabel = {
        bedroom: "Bedroom",
        vanity: "Vanity",
        bathroom: "Bathroom",
        general: "General",
      };
      const combinedName =
        customTrimmed ||
        (crossSection
          ? Object.entries(sectionCounts)
              .map(([s, n]) => `${sectionLabel[s] || s} (${n})`)
              .join(" + ")
          : labels.join(" + "));
      await onStartChecklistItems({
        targets: pickedRows,
        name: combinedName,
        category: primarySection,
      });
      reset();
      return;
    }

    // SIMPLE single-task path: non-General OR General with 0/1 sub
    if (!isGeneral || selectedSubs.size <= 1) {
      const subId =
        isGeneral && selectedSubs.size === 1
          ? Array.from(selectedSubs)[0]
          : null;
      const sub = subId ? cat.subcategories.find((s) => s.id === subId) : null;
      const autoName = sub ? sub.label : cat.label;
      const finalName = customTrimmed || autoName;
      // BUG FIX (#7): when the cleaner picks a section (e.g., Bedroom)
      // and taps Start without picking individual items, the legacy
      // simple path created a freeform task but never advanced any
      // assignment_targets. The owner then saw the assignment stuck on
      // "Pending" even though the cleaner was actively working and
      // uploading photos. Now: if we're in checklist mode AND there are
      // open items at this bedroom matching the picked section, flip
      // them all to in_progress in the same go. The combined task name
      // still uses the section label (autoName) so the cleaner's UI
      // doesn't change.
      if (
        checklistMode &&
        onStartChecklistItems &&
        category &&
        category !== "general"
      ) {
        const sectionMatches = checklistTargets.filter(
          (t) =>
            (t.template_section || "").toLowerCase() === category &&
            (t.status === "pending" || t.status === "paused"),
        );
        if (sectionMatches.length > 0) {
          await onStartChecklistItems({
            targets: sectionMatches,
            name: finalName,
            category,
          });
          reset();
          return;
        }
      }
      await onStartOne(finalName, category, subId || null);
      reset();
      return;
    }

    // MULTI-SELECT general path — combine all picked items into ONE
    // task per main section. We sort the selected subs by their group
    // and label so the combined name reads predictably, then use the
    // FIRST sub's id for the subcategory column (so category/sub-style
    // queries still work). The task name shows every picked item so
    // PMs can see what was covered.
    const orderedSubs = cat.subcategories.filter((s) => selectedSubs.has(s.id));
    const labels = orderedSubs.map((s) => s.label);
    const combinedName = customTrimmed || labels.join(" + ");
    const primarySubId = orderedSubs[0]?.id || null;
    await onStartOne(combinedName, "general", primarySubId);
    reset();
  };

  const renderSectionItemBox = () => {
    const sectionLabels = {
      bedroom: "Bedroom",
      vanity: "Vanity",
      bathroom: "Bathroom",
      general: "General",
    };
    // Show ALL non-done/non-blocked items so the cleaner sees both
    // what they've already picked AND what's still available. The
    // pending ones are interactive (checkboxes); the in_progress
    // and paused ones are read-only and visually grayed out. This
    // gives the cleaner a holistic view of the section at a glance
    // rather than hiding what they've already started.
    const items = checklistTargets.filter(
      (t) =>
        (t.template_section || "").toLowerCase() === category &&
        (t.status === "pending" ||
          t.status === "in_progress" ||
          t.status === "paused"),
    );
    const pendingCount = items.filter((t) => t.status === "pending").length;
    if (items.length === 0) {
      // Only show "all done/started" copy when there's at least
      // one done item — otherwise legacy bedrooms with 0 in this
      // section would see a misleading note.
      const allItems = checklistTargets.filter(
        (t) => (t.template_section || "").toLowerCase() === category,
      );
      if (allItems.length === 0) return null;
      return (
        <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 p-3 text-center">
          <Check size={18} className="inline text-emerald-700 mb-1" />
          <div className="text-xs text-emerald-800 font-medium">
            Every {sectionLabels[category]} item is done.
          </div>
        </div>
      );
    }
    // Group by parent assignment so General with two variants
    // shows the variant labels. Other sections flatten.
    const showSubheaders = category === "general";
    const byAssignment = new Map();
    items.forEach((t) => {
      const aid = t.assignment?.id;
      if (!byAssignment.has(aid))
        byAssignment.set(aid, { assignment: t.assignment, items: [] });
      byAssignment.get(aid).items.push(t);
    });
    return (
      <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 p-3">
        <div className="flex items-center gap-2 mb-2">
          <FileText size={14} className="text-emerald-700 flex-shrink-0" />
          <span className="text-[11px] uppercase tracking-wider font-mono text-emerald-800 font-bold flex-1">
            {sectionLabels[category]} — pick what you'll start
          </span>
          <span className="text-[10px] font-mono text-emerald-700">
            {pendingCount} left
          </span>
        </div>
        <div className="space-y-2">
          {Array.from(byAssignment.values()).map((group) => {
            // Human-readable label for the general variant — so
            // the cleaner sees "Kitchen" or "LR / Patio / Water
            // Heater" instead of just "variant D". Previously
            // they'd see "Sink" with no idea WHICH sink (kitchen,
            // vanity, etc.). The subheader now resolves this.
            const generalVariantLabel = {
              a: "LR / Patio / Water Heater",
              b: "Fridge / Microwave / Breezeway",
              c: "Vents / Stove / Oven / Dishwasher",
              d: "Kitchen",
            };
            const variantKey = (
              group.assignment.general_variant || ""
            ).toLowerCase();
            const variantHumanLabel = generalVariantLabel[variantKey] || null;
            return (
              <div key={group.assignment.id}>
                {showSubheaders && variantHumanLabel && (
                  <div className="text-[11px] uppercase tracking-wider font-mono text-emerald-800 font-bold mb-1.5 px-1">
                    {variantHumanLabel}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  {group.items.map((t) => {
                    const checked = selectedTargetIds.has(t.id);
                    const itemKey = t.template_item_key || "";
                    // Started/paused items are read-only chrome —
                    // visible so the cleaner sees the full picture
                    // of the section, but not interactive (they're
                    // already underway).
                    const isStarted =
                      t.status === "in_progress" || t.status === "paused";
                    // Only show edit pencil for translated items in
                    // checklist mode — cleaners can fix bad Spanish
                    // labels. Requests (custom items) skipped since
                    // their label is already the cleaner's own text.
                    const canEditLabel =
                      locale === "es" &&
                      itemKey &&
                      !itemKey.startsWith("requested:");
                    return (
                      <div
                        key={t.id}
                        className={`flex items-start gap-1 rounded-xl border-2 transition-all ${
                          isStarted
                            ? "border-stone-200 bg-stone-100 opacity-60"
                            : checked
                              ? "border-amber-600 bg-amber-50"
                              : "border-stone-200 bg-white hover:border-stone-400"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => !isStarted && toggleTarget(t.id)}
                          disabled={isStarted}
                          className="flex items-start gap-2 px-3 py-2.5 text-left flex-1 min-w-0 disabled:cursor-not-allowed"
                        >
                          <div
                            className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                              isStarted
                                ? "border-stone-400 bg-stone-300"
                                : checked
                                  ? "border-amber-600 bg-amber-600"
                                  : "border-stone-300"
                            }`}
                          >
                            {(checked || isStarted) && (
                              <Check size={11} className="text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-xs ${isStarted ? "text-stone-500 line-through decoration-stone-400" : "text-stone-900"}`}
                            >
                              {labelForTarget(t)}
                            </div>
                            {isStarted && (
                              <span className="inline-block mt-0.5 text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 font-bold">
                                {t.status === "paused" ? "Paused" : "Started"}
                              </span>
                            )}
                            {t.priority && (
                              <span className="inline-block mt-0.5 text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 font-bold">
                                Priority
                              </span>
                            )}
                          </div>
                        </button>
                        {canEditLabel && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingLabel({
                                key: itemKey,
                                current: labelForTarget(t),
                                hasOverride: overrides.has(itemKey),
                              });
                            }}
                            className="p-2 text-stone-400 hover:text-amber-700 flex-shrink-0"
                            title="Editar nombre"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {/* 6: Start button sits right under the picked tasks so the
                 cleaner doesn't have to scroll past all sections. */}
          {(hasTargetPicks || (isGeneral && selectedSubs.size > 0)) && (
            <div className="mt-3">
              <button
                onClick={submit}
                disabled={!canSubmit}
                className="px-5 py-2 rounded-xl bg-stone-900 text-stone-50 font-medium text-xs disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Play size={13} />
                {hasTargetPicks
                  ? (() => {
                      const pickedRows = checklistTargets.filter((t) =>
                        selectedTargetIds.has(t.id),
                      );
                      const allPaused =
                        pickedRows.length > 0 &&
                        pickedRows.every((t) => t.status === "paused");
                      const verb = allPaused ? "Resume" : "Start job";
                      return `${verb} · ${selectedTargetIds.size} item${selectedTargetIds.size === 1 ? "" : "s"}`;
                    })()
                  : `Start 1 task (${selectedSubs.size} areas)`}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Tabs (Active / Not started) removed — user feedback was that
         they created confusion without adding value. The 4-section
         picker below already shows per-section progress and items in
         active workblocks are surfaced on the Active workblock card
         above the picker. pickerTab still defaults to 'not_started'
         so the existing conditional renders below still work. */}

      {/* ACTIVE TAB — shows one "workblock" per section that has
         in-progress / paused / blocked items. Each workblock is
         numbered for readability ("Workblock 1", "Workblock 2", …)
         and shows the items the cleaner picked up plus a small
         "anyone can help with these" row of the pending items still
         in the same section. The X on each item releases it back to
         Pending (status='pending') so the cleaner can drop items
         they took on without finishing. Coworkers see the
         in-progress items via realtime sync and can tap to help. */}
      {checklistMode &&
        checklistTargets.length > 0 &&
        pickerTab === "active" &&
        (() => {
          const activeItems = checklistTargets.filter(
            (t) =>
              t.status === "in_progress" ||
              t.status === "paused" ||
              t.status === "blocked",
          );
          if (activeItems.length === 0) {
            return (
              <div className="rounded-2xl bg-stone-50 border-2 border-dashed border-stone-200 p-6 text-center">
                <div className="text-sm text-stone-500">
                  Nothing is in progress yet.
                </div>
                <div className="text-[10px] text-stone-400 mt-1">
                  Switch to <span className="font-medium">Not started</span> to
                  begin a section.
                </div>
              </div>
            );
          }
          // Group by section so each workblock corresponds to one of
          // the 4 main sections. Within a section: in_progress first,
          // then paused, then blocked. Workblock number = order in the
          // sectionOrder array (deterministic so refreshes don't shuffle).
          const sectionOrder = ["bedroom", "vanity", "bathroom", "general"];
          const sectionLabels = {
            bedroom: "Bedroom",
            vanity: "Vanity",
            bathroom: "Bathroom",
            general: "General",
          };
          const statusRank = { in_progress: 0, paused: 1, blocked: 2 };
          const bySection = {};
          activeItems.forEach((t) => {
            const sec = (t.template_section || "").toLowerCase();
            if (!bySection[sec]) bySection[sec] = [];
            bySection[sec].push(t);
          });
          Object.keys(bySection).forEach((sec) => {
            bySection[sec].sort(
              (a, b) =>
                (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99),
            );
          });
          // Pending items for the "anyone can help" row at the bottom
          // of each workblock card.
          const pendingBySection = {
            bedroom: [],
            vanity: [],
            bathroom: [],
            general: [],
          };
          checklistTargets.forEach((t) => {
            if (t.status !== "pending") return;
            const sec = (t.template_section || "").toLowerCase();
            if (sec in pendingBySection) pendingBySection[sec].push(t);
          });
          // Number workblocks 1..N by sectionOrder
          const activeSections = sectionOrder.filter(
            (sec) => bySection[sec]?.length,
          );
          return (
            <div className="space-y-3">
              {activeSections.map((sec, idx) => {
                const items = bySection[sec];
                const remaining = pendingBySection[sec] || [];
                const workblockNum = idx + 1;
                return (
                  <div
                    key={sec}
                    className="rounded-2xl bg-amber-50 border-2 border-amber-200 p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs uppercase tracking-wider font-mono font-bold text-amber-900">
                        Workblock {workblockNum}
                      </span>
                      <span className="text-[11px] font-mono text-amber-800">
                        ·
                      </span>
                      <span className="text-xs font-mono text-amber-800">
                        {sectionLabels[sec]}
                      </span>
                      <span className="text-[10px] font-mono text-amber-700 ml-auto">
                        {items.length} item{items.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 mb-2">
                      {items.map((t) => {
                        const checked = selectedTargetIds.has(t.id);
                        const inProg = t.status === "in_progress";
                        const paused = t.status === "paused";
                        const blocked = t.status === "blocked";
                        const statusChip = inProg
                          ? {
                              label: "In progress",
                              cls: "bg-amber-100 text-amber-800 border-amber-300",
                            }
                          : paused
                            ? {
                                label: "Paused",
                                cls: "bg-blue-100 text-blue-800 border-blue-300",
                              }
                            : blocked
                              ? {
                                  label: "Blocked",
                                  cls: "bg-red-100 text-red-800 border-red-300",
                                }
                              : null;
                        return (
                          <div
                            key={t.id}
                            className={`relative flex items-start gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${checked ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white"}`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleTarget(t.id)}
                              className="flex items-start gap-2 flex-1 min-w-0 text-left"
                            >
                              <div
                                className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${checked ? "border-amber-600 bg-amber-600" : "border-stone-300"}`}
                              >
                                {checked && (
                                  <Check size={11} className="text-white" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-stone-900 mb-0.5">
                                  {labelForTarget(t)}
                                </div>
                                {statusChip && (
                                  <span
                                    className={`inline-block text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-full border ${statusChip.cls}`}
                                  >
                                    {statusChip.label}
                                  </span>
                                )}
                                {t.priority && (
                                  <span className="ml-1 inline-block text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 font-bold">
                                    Priority
                                  </span>
                                )}
                              </div>
                            </button>
                            {/* Remove (X) button — releases the item back to
                             Pending so the cleaner can drop one they
                             can't finish without leaving the others
                             stranded as 'in progress'. */}
                            {onReleaseTargets && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (
                                    !confirm(
                                      `Remove "${labelForTarget(t)}" from your workblock? It goes back to Pending so someone else can grab it.`,
                                    )
                                  )
                                    return;
                                  await onReleaseTargets([t]);
                                }}
                                title="Remove from workblock — back to Pending"
                                className="flex-shrink-0 p-1 rounded-full hover:bg-red-100 text-stone-400 hover:text-red-600"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* "Anyone can help" row — pending items in this
                     section, visible to coworkers via realtime sync.
                     Tapping one selects it; tap Start at the bottom to
                     pull it into the workblock. */}
                    {remaining.length > 0 && (
                      <div className="pt-2 border-t border-amber-200">
                        <div className="text-[10px] uppercase tracking-wider font-mono text-amber-800 mb-1">
                          Still needs help in {sectionLabels[sec]} (
                          {remaining.length})
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {remaining.map((t) => {
                            const checked = selectedTargetIds.has(t.id);
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => toggleTarget(t.id)}
                                className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border text-left transition-all ${checked ? "border-amber-600 bg-amber-100" : "border-stone-200 bg-white hover:border-stone-400"}`}
                              >
                                <div
                                  className={`mt-0.5 w-3.5 h-3.5 rounded border-2 flex-shrink-0 flex items-center justify-center ${checked ? "border-amber-600 bg-amber-600" : "border-stone-300"}`}
                                >
                                  {checked && (
                                    <Check size={10} className="text-white" />
                                  )}
                                </div>
                                <span className="text-xs text-stone-700 truncate">
                                  {labelForTarget(t)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

      {/* NOT-STARTED TAB — single-open accordion. The 4 main-section
         buttons show counts as (in_progress / total). Tapping a
         button opens THAT section's subsection list below (others
         stay closed). Picking subsections + Start task creates one
         task with the picked items.
         
         For LEGACY bedrooms with no template items, the buttons
         still work — tapping just sets the category so the custom
         input + legacy variant subgrid render normally. Nothing
         in this picker forces template behaviour on legacy work.
      */}
      {(!checklistMode ||
        checklistTargets.length === 0 ||
        pickerTab === "not_started") && (
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Pick what you'll clean
          </label>
          <div className="flex flex-col gap-1.5">
            {(() => {
              // Per-section counts. total = pending+in_progress (work
              // that exists at this bedroom for this section), busy =
              // in_progress (currently being worked). hasRequested = at
              // least one requested-by target exists in this section, so
              // the section card can show a "Requested" badge.
              const stats = {
                bedroom: { busy: 0, total: 0, hasRequested: false },
                vanity: { busy: 0, total: 0, hasRequested: false },
                bathroom: { busy: 0, total: 0, hasRequested: false },
                general: { busy: 0, total: 0, hasRequested: false },
              };
              checklistTargets.forEach((t) => {
                const sec = (t.template_section || "").toLowerCase();
                if (!(sec in stats)) return;
                if (t.requested_by) stats[sec].hasRequested = true;
                if (t.status === "done") return;
                stats[sec].total += 1;
                if (t.status === "in_progress") stats[sec].busy += 1;
              });
              return TASK_CATEGORIES.map((c) => {
                const s = stats[c.id] || {
                  busy: 0,
                  total: 0,
                  hasRequested: false,
                };
                const inChecklist =
                  checklistMode && checklistTargets.length > 0;
                const isOpen = category === c.id;
                const isEmpty = inChecklist && s.total === 0;
                return (
                  <React.Fragment key={c.id}>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          // Toggle: tapping the open section closes it; tapping
                          // a closed one opens it (closing whatever was open).
                          // The accordion is single-open by construction since
                          // category is a single value.
                          if (category === c.id) {
                            setCategory(null);
                            // Closing a section: clear picks. The cleaner is
                            // backing out, so we shouldn't keep selections from
                            // a section that's no longer visible.
                            setSelectedTargetIds(new Set());
                          } else {
                            setCategory(c.id);
                            setSelectedSubs(new Set());
                            // Opening a NEW section: clear any picks from a
                            // previously-open section first. Section selection
                            // is mutually exclusive — opening Bedroom doesn't
                            // also keep Bathroom items ticked. Without this,
                            // tapping Bedroom and then Bathroom would start
                            // BOTH sections on the next Start (the bug).
                            if (c.id !== "general" && checklistMode) {
                              // Then auto-tick every open item in THIS section.
                              // General stays manual (cleaners pick specific
                              // subsections there).
                              const inSection = checklistTargets.filter(
                                (t) =>
                                  (t.template_section || "").toLowerCase() ===
                                    c.id &&
                                  (t.status === "pending" ||
                                    t.status === "paused"),
                              );
                              setSelectedTargetIds(
                                new Set(inSection.map((t) => t.id)),
                              );
                            } else {
                              setSelectedTargetIds(new Set());
                            }
                          }
                        }}
                        className={`w-full py-3 pl-4 pr-20 rounded-xl border-2 font-medium text-sm transition-all flex items-center justify-between gap-3 ${
                          isOpen
                            ? "border-stone-900 bg-stone-900 text-stone-50"
                            : isEmpty
                              ? "border-stone-100 bg-stone-50 text-stone-400"
                              : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"
                        }`}
                      >
                        <span className="leading-tight text-left">
                          {c.label}
                        </span>
                        {/* Status chip — now inline on the right side of the row. */}
                        {inChecklist &&
                          (() => {
                            let chipText, chipColor;
                            if (s.total === 0) {
                              chipText = "Not assigned";
                              chipColor = isOpen
                                ? "bg-stone-700 text-stone-300"
                                : "bg-stone-100 text-stone-500 border border-stone-200";
                            } else if (s.busy > 0) {
                              chipText = "Started";
                              chipColor = isOpen
                                ? "bg-amber-200 text-amber-900"
                                : "bg-amber-100 text-amber-800 border border-amber-300";
                            } else {
                              chipText = "Not started";
                              chipColor = isOpen
                                ? "bg-stone-700 text-stone-200"
                                : "bg-stone-100 text-stone-600 border border-stone-200";
                            }
                            return (
                              <span
                                className={`text-[10px] uppercase tracking-wide font-mono font-bold px-2 py-0.5 rounded-full inline-flex items-center flex-shrink-0 ${chipColor}`}
                              >
                                <span>{chipText}</span>
                                {s.total > 0 && (
                                  <span className="ml-1 opacity-75">
                                    {s.busy}/{s.total}
                                  </span>
                                )}
                              </span>
                            );
                          })()}
                      </button>
                      {/* Request button — top-right corner of each section
                     card. Two visual modes:
                       - When the cleaner already has pending requests
                         in this section, render as an amber "Requested"
                         badge so they see at a glance that something
                         is in the queue.
                       - Otherwise render as the minimal "Request" link.
                     Tapping either reopens the modal. */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRequestModalSection(c.id);
                        }}
                        className={`absolute top-1/2 -translate-y-1/2 right-2 text-[9px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full transition-colors font-bold border ${
                          s.hasRequested
                            ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                            : "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
                        }`}
                      >
                        {s.hasRequested ? "Requested" : "Request"}
                      </button>
                    </div>
                    {/* 3b: the open section's item picker appears IMMEDIATELY
                   under its own row, not below all four sections. */}
                    {checklistMode &&
                      checklistTargets.length > 0 &&
                      pickerTab === "not_started" &&
                      category === c.id &&
                      renderSectionItemBox()}
                  </React.Fragment>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Request modal — opens when the cleaner taps Request on a
         section card. Lists template items for the section, filtered
         by the assigned variant (so a bedroom assigned bathroom_variant
         'tub' only sees tub-line items, not toilet items). Submit
         creates a pending request assignment for the owner to approve;
         once approved, the items become regular assignment_targets and
         the workblock auto-opens with them. Submit handler is stubbed
         pending the request-data-model wire-up. */}
      {requestModalSection && (
        <RequestItemsModal
          section={requestModalSection}
          templateSetId={
            checklistTargets[0]?.assignment?.template_set_id ||
            persistedVariants.templateSetId ||
            null
          }
          bathroomVariant={
            checklistTargets[0]?.assignment?.bathroom_variant ||
            persistedVariants.bathroom ||
            null
          }
          generalVariant={
            checklistTargets[0]?.assignment?.general_variant ||
            persistedVariants.general ||
            null
          }
          assignmentType={
            checklistTargets[0]?.assignment?.assignment_type || null
          }
          onClose={() => setRequestModalSection(null)}
          onSubmit={async (itemKeys) => {
            if (!itemKeys || itemKeys.length === 0) return;
            // Attach the requested items to an existing assignment at
            // this bedroom — picks the first checklist target's
            // assignment as the host. They're all at the same bedroom
            // so any assignment_id works for grouping; the owner sees
            // them on the same row when reviewing.
            const hostAssignmentId = checklistTargets[0]?.assignment?.id;
            if (!hostAssignmentId) {
              alert(
                "Cannot request items — no existing assignment found at this bedroom.",
              );
              return;
            }
            const section = requestModalSection;
            const nowISO = new Date().toISOString();
            const rows = itemKeys.map((key) => ({
              assignment_id: hostAssignmentId,
              unit_id: unitId,
              party_id: partyId,
              status: "pending",
              template_section: section,
              // Store the SECTION-PREFIXED key (e.g. 'bathroom:tub', not
              // 'tub') so it matches every other target in the app —
              // labels, counts, and dedup all key off this format.
              template_item_key: key.includes(":") ? key : `${section}:${key}`,
              // Flags identifying this as a cleaner request. The owner's
              // approval banner filters by requested_by; the picker shows
              // a "Requested" badge for the same reason.
              requested_by: employee?.id || null,
              requested_at: nowISO,
              // Enters the owner's approval queue. The item is still
              // immediately cleanable (status 'pending' above) — approval
              // is after-the-fact, it doesn't gate the cleaner.
              request_status: "pending",
            }));
            const { error } = await supabase
              .from("assignment_targets")
              .insert(rows);
            if (error) {
              alert("Could not submit request: " + error.message);
              return;
            }
            setRequestModalSection(null);
            // Reload right away (don't wait on realtime) so the new
            // items appear, then open that section so the cleaner sees
            // them land instead of wondering where they went.
            await loadChecklistTargets();
            setPickerTab("not_started");
            setCategory(section);
          }}
        />
      )}

      {/* Dropdown panel for the open section (checklist mode only).
         Renders only ONE section at a time — whichever the cleaner
         tapped — keeping the screen short. If no section is open or
         there are no items in the open one, nothing renders here.
         Legacy bedrooms with 0 checklist items skip this panel and
         fall through to the custom-name + variant subgrid below. */}

      {/* Legacy variant subgrid — appears ONLY when there's no
         checklist context for General (either not in checklist mode,
         or no general_variant assigned). Removed when checklist mode
         is active for this section so the cleaner sees a single
         clean list, not the emerald panel + a redundant variant
         picker below it. Also hidden in the Active tab — that tab is
         for status review, not starting new work. */}
      {(!checklistMode ||
        checklistTargets.length === 0 ||
        pickerTab === "not_started") &&
        isGeneral &&
        cat.subcategories &&
        !(
          checklistMode &&
          checklistTargets.some(
            (t) => (t.template_section || "").toLowerCase() === "general",
          )
        ) &&
        !(checklistMode && resolvedGeneralVariants.length === 0) && (
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
              Pick one or more areas{" "}
              {selectedSubs.size > 1 && (
                <span className="normal-case text-amber-700">
                  · creates 1 combined task
                </span>
              )}
            </label>
            {/* Render items grouped by their A/B/C/D group — mirrors
             the upload wizard's General variant structure so cleaners
             see the same mental model on both sides. STRICT VARIANT
             GATING: in checklist mode, only show groups whose key
             matches one of the assigned general_variants at this
             bedroom. If no variants are assigned (no checklist mode
             or no general targets), show all groups. */}
            <div className="space-y-3">
              {GENERAL_GROUP_ORDER.map((groupKey) => {
                // Variant-gating: hide groups that aren't assigned to
                // this bedroom when we're in checklist mode AND we have
                // at least one general_variant on file. If no variants
                // are loaded (legacy assignment, or no assignments at
                // all) we fall back to showing everything.
                if (
                  checklistMode &&
                  resolvedGeneralVariants.length > 0 &&
                  !resolvedGeneralVariants.includes(groupKey)
                ) {
                  return null;
                }
                const groupItems = cat.subcategories.filter(
                  (s) => s.group === groupKey,
                );
                if (groupItems.length === 0) return null;
                const groupLabel = groupItems[0].groupLabel;
                return (
                  <div key={groupKey}>
                    <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1.5 px-1">
                      {groupLabel}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {groupItems.map((s) => {
                        const checked = selectedSubs.has(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleSub(s.id)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${checked ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white hover:border-stone-400"}`}
                          >
                            <div
                              className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${checked ? "border-amber-600 bg-amber-600" : "border-stone-300"}`}
                            >
                              {checked && (
                                <Check size={11} className="text-white" />
                              )}
                            </div>
                            <span className="text-sm text-stone-900 truncate">
                              {s.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* Custom naming lives in the "Custom" mode toggle above — no need
         for a separate name field inside the Quick picker. */}

      {/* Start button only appears once the cleaner has actually picked
         something to work on — a section's items (hasTargetPicks) or, for
         General, at least one area. Before that there's nothing to start. */}
      {!checklistMode && category && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="px-5 py-2 rounded-xl bg-stone-900 text-stone-50 font-medium text-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Play size={13} />
            {hasTargetPicks
              ? (() => {
                  const pickedRows = checklistTargets.filter((t) =>
                    selectedTargetIds.has(t.id),
                  );
                  const allPaused =
                    pickedRows.length > 0 &&
                    pickedRows.every((t) => t.status === "paused");
                  const verb = allPaused ? "Resume" : "Start job";
                  return `${verb} · ${selectedTargetIds.size} item${selectedTargetIds.size === 1 ? "" : "s"}`;
                })()
              : isGeneral && selectedSubs.size > 1
                ? `Start 1 task (${selectedSubs.size} areas)`
                : "Start task"}
          </button>
        </div>
      )}
      {editingLabel && (
        <EditItemLabelModal
          itemKey={editingLabel.key}
          current={editingLabel.current}
          hasOverride={editingLabel.hasOverride}
          locale={locale}
          onSave={async (newLabel) => {
            await saveOverride(editingLabel.key, newLabel);
            setEditingLabel(null);
          }}
          onRevert={async () => {
            await removeOverride(editingLabel.key);
            setEditingLabel(null);
          }}
          onClose={() => setEditingLabel(null)}
        />
      )}
    </div>
  );
}
