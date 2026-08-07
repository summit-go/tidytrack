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
import { AttachmentModal } from "./AttachmentModal.jsx";
import { RequestNewItemModal } from "./RequestNewItemModal.jsx";

export function ChecklistAssignmentView({
  assignment,
  employee,
  onClose,
  onOpenSheet,
  onOpenSibling,
  quickGlance = false,
}) {
  const [targets, setTargets] = useState([]);
  const [templateInfo, setTemplateInfo] = useState({ variants: [], items: [] });
  const [otherAssignments, setOtherAssignments] = useState([]);
  // Work blocks at this exact bedroom — used by the Working on now
  // and Done tabs which now show block-level history instead of
  // per-item status.
  const [workBlocks, setWorkBlocks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [tab, setTab] = useState("not_started"); // 'not_started' | 'in_progress' | 'done'
  // Sub-tab inside "Not started" — lets the cleaner view items
  // by main section (Bedroom / Vanity / Bathroom / General) as a
  // read-style filter. Default 'all' keeps the original behaviour
  // for cleaners who don't tap a section pill.
  const [sectionFilter, setSectionFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  // Bulk-action busy + "request new item" modal — these surface the
  // owner-requested missing controls (pause whole assignment, request
  // an additional item the inspection sheet didn't cover, etc.)
  const [bulkBusy, setBulkBusy] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  // -----------------------------------------------------------------
  // Load targets (the actual checklist items) + template metadata so
  // we can display human-friendly item labels.
  // -----------------------------------------------------------------
  const load = async () => {
    const { data: tData } = await supabase
      .from("assignment_targets")
      .select("*, unit:units(label), party:parties(label)")
      .eq("assignment_id", assignment.id);
    setTargets(tData || []);

    // Template metadata — only fetch if the assignment uses a template
    if (assignment.template_set_id) {
      const { data: vData } = await supabase
        .from("section_template_variants")
        .select("*")
        .eq("set_id", assignment.template_set_id);
      const variantIds = (vData || []).map((v) => v.id);
      let iData = [];
      if (variantIds.length > 0) {
        const { data } = await supabase
          .from("section_template_items")
          .select("*")
          .in("variant_id", variantIds);
        iData = data || [];
      }
      setTemplateInfo({ variants: vData || [], items: iData });
    }

    // Other open assignments at the same bedroom — for the "Not started"
    // tab footer so the cleaner can hop to a sibling without going home.
    const firstTarget = (tData || [])[0];
    if (firstTarget?.unit_id && firstTarget?.party_id) {
      const { data: others } = await supabase
        .from("assignments")
        .select(
          "id, title, notes, file_url, file_kind, assignment_type, sheet_type, template_set_id, bathroom_variant, general_variant, source, pm_status, active, customer_id, targets:assignment_targets!inner(id, status, unit_id, party_id)",
        )
        .neq("id", assignment.id)
        .eq("targets.unit_id", firstTarget.unit_id)
        .eq("targets.party_id", firstTarget.party_id)
        .eq("active", true);
      // Filter to assignments with non-done targets at this bedroom
      const filtered = (others || []).filter((a) => {
        if (a.source === "pm" && a.pm_status !== "approved") return false;
        return (a.targets || []).some((t) => t.status !== "done");
      });
      setOtherAssignments(filtered);
    }

    // Load work_blocks at this bedroom for the Working on now / Done
    // tabs. The user wants those tabs to show work_blocks scoped to
    // THIS bedroom (open ones in Working on now, closed ones in
    // Done), not assignment_target rows. Items inside a block can
    // be tapped to navigate into the block for detail.
    if (firstTarget?.unit_id && firstTarget?.party_id) {
      // unit_id + party_id already scopes to this exact bedroom which
      // belongs to exactly one property; the customer_id JOIN check we
      // had earlier was redundant AND was filtering everything out
      // whenever the embed didn't resolve. Drop it and trust the
      // bedroom-level scope. Also drop the is_preview filter — preview
      // blocks at this bedroom should also show so the owner testing
      // the app can see what they've started.
      const { data: blocks, error: blocksErr } = await supabase
        .from("work_blocks")
        .select(
          "id, start_time, end_time, work_notes, is_preview, shift:shifts(employee:employees(id, name)), tasks(id, name, category, end_time)",
        )
        .eq("unit_id", firstTarget.unit_id)
        .eq("party_id", firstTarget.party_id)
        .order("start_time", { ascending: false });
      if (blocksErr) {
        console.warn(
          "[ChecklistAssignmentView] work_blocks load error:",
          blocksErr,
        );
      }
      setWorkBlocks(blocks || []);
    }

    setLoaded(true);
  };

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [assignment.id]);
  useAssignmentSync(load, "checklist-view");

  // -----------------------------------------------------------------
  // Helper: friendly item label from template + section/key on a target
  // -----------------------------------------------------------------
  const labelForTarget = (target) => {
    if (!target.template_section || !target.template_item_key) return null;
    // For Bedroom/Vanity, variant key is 'default'. For Bathroom and
    // General, variant key is on the assignment.
    let variantKey = "default";
    if (target.template_section === "bathroom")
      variantKey = assignment.bathroom_variant;
    if (target.template_section === "general")
      variantKey = assignment.general_variant;
    const variant = templateInfo.variants.find(
      (v) =>
        v.section_key === target.template_section &&
        v.variant_key === variantKey,
    );
    if (!variant) return null;
    const item = templateInfo.items.find(
      (i) =>
        i.variant_id === variant.id && i.item_key === target.template_item_key,
    );
    return item?.label || null;
  };

  // -----------------------------------------------------------------
  // Advance / toggle a target's status. Optimistic UI for snappiness.
  // -----------------------------------------------------------------
  const setStatus = async (target, newStatus) => {
    if (busyId) return;
    setBusyId(target.id);
    const patch = { status: newStatus };
    if (newStatus === "in_progress") {
      if (!target.started_at) patch.started_at = new Date().toISOString();
      patch.started_by = employee?.id || null;
    }
    if (newStatus === "done") {
      patch.completed_at = new Date().toISOString();
      patch.completed_by = employee?.id || null;
    } else if (target.status === "done") {
      patch.completed_at = null;
      patch.completed_by = null;
    }
    if (newStatus === "pending") {
      patch.started_at = null;
      patch.started_by = null;
    }
    // Optimistic update
    setTargets((prev) =>
      prev.map((t) => (t.id === target.id ? { ...t, ...patch } : t)),
    );
    const { error } = await supabase
      .from("assignment_targets")
      .update(patch)
      .eq("id", target.id);
    setBusyId(null);
    if (error) {
      alert("Could not update: " + error.message);
      load(); // re-fetch authoritative
    }
  };

  // -----------------------------------------------------------------
  // Group filtered targets by template_section so the cleaner sees
  // logical chunks (Bedroom items together, Bathroom items together).
  // -----------------------------------------------------------------
  const sectionOrder = ["bedroom", "vanity", "bathroom", "general"];
  const sectionLabel = {
    bedroom: "Bedroom",
    vanity: "Vanity",
    bathroom: "Bathroom",
    general: "General",
  };

  const counts = {
    not_started: targets.filter((t) => t.status === "pending").length,
    in_progress: targets.filter((t) => t.status === "in_progress").length,
    done: targets.filter((t) => t.status === "done").length,
    blocked: targets.filter((t) => t.status === "blocked").length,
    // Block-level counts for the new Working on now / Done tab semantics.
    open_blocks: workBlocks.filter((b) => !b.end_time).length,
    closed_blocks: workBlocks.filter((b) => !!b.end_time).length,
  };
  const filterStatus = tab === "not_started" ? "pending" : tab;
  const visibleTargets = targets.filter((t) => t.status === filterStatus);

  const grouped = {};
  sectionOrder.forEach((s) => {
    grouped[s] = [];
  });
  visibleTargets.forEach((t) => {
    const s = t.template_section || "bedroom";
    if (!grouped[s]) grouped[s] = [];
    grouped[s].push(t);
  });

  // Progress: % of items done over total
  const total = targets.length;
  const doneCount = counts.done;
  const isAllDone = total > 0 && doneCount === total;

  // Bedroom label for header
  const bedroomLabel = targets[0]?.party?.label;
  const unitLabel = targets[0]?.unit?.label;
  // Bathroom helper for clarity
  const bathroomNum = bathroomNumberForBedroom(bedroomLabel);

  // -----------------------------------------------------------------
  // Render an item row — READ-ONLY in this view. The View-doc destination
  // is now a quick reference: cleaner sees what needs cleaning by
  // section but cannot advance status. Status changes happen via the
  // bedroom-level bulk card or the work-block picker — that's the
  // single source of truth for who started what.
  // -----------------------------------------------------------------
  const renderItemRow = (t) => {
    const label =
      labelForTarget(t) || `Item ${t.template_item_key || t.id.slice(0, 6)}`;
    const isDone = t.status === "done";
    const isInProgress = t.status === "in_progress";
    const colorClass = isDone
      ? "bg-emerald-50 border-emerald-200"
      : isInProgress
        ? "bg-amber-50 border-amber-300"
        : "bg-white border-stone-200";
    return (
      <div
        key={t.id}
        className={`w-full text-left p-3 rounded-xl border-2 ${colorClass}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isDone ? "bg-emerald-600 border-emerald-600 text-white" : isInProgress ? "bg-amber-500 border-amber-500 text-white" : "border-stone-300"}`}
          >
            {isDone ? (
              <Check size={12} />
            ) : isInProgress ? (
              <Play size={10} />
            ) : null}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className={`text-sm ${isDone ? "text-emerald-900 line-through" : "text-stone-900"}`}
            >
              {label}
            </div>
            {t.status_notes && (
              <div className="text-xs text-red-700 italic mt-0.5">
                "{t.status_notes}"
              </div>
            )}
          </div>
          {t.priority && !isDone && (
            <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 font-bold flex items-center gap-1">
              <AlertCircle size={10} /> Priority
            </span>
          )}
        </div>
      </div>
    );
  };

  if (!loaded) {
    return (
      <div className="fixed inset-0 bg-stone-50 z-50 flex items-center justify-center text-stone-400 text-sm">
        Loading checklist…
      </div>
    );
  }

  // Quick glance body — read-only summary of items grouped by main
  // section (Bedroom / Vanity / Bathroom / General). Each item gets
  // a status dot (done / in_progress / pending) so the owner can scan
  // completion at a glance without all the cleaner-side controls.
  // Rendered when the quickGlance prop is true.
  const quickGlanceBody = (() => {
    const labelForT = (t) => {
      if (
        t.status_notes &&
        (t.template_item_key?.startsWith?.("requested:") ||
          t.template_item_key?.startsWith?.("custom_"))
      )
        return t.status_notes;
      const k = t.template_item_key || "";
      return (
        k
          .replace(/^[a-z_]+:/, "")
          .replace(/_/g, " ")
          .replace(/^./, (c) => c.toUpperCase()) || "Item"
      );
    };
    const dotFor = (t) => {
      if (t.recheck_passed_at)
        return { color: "bg-purple-500", label: "recheck-passed" };
      if (t.status === "done")
        return { color: "bg-emerald-500", label: "done" };
      if (t.status === "in_progress")
        return { color: "bg-amber-500", label: "in progress" };
      if (t.status === "paused")
        return { color: "bg-amber-300", label: "paused" };
      if (t.status === "blocked")
        return { color: "bg-red-500", label: "blocked" };
      return { color: "bg-stone-300", label: "pending" };
    };
    // Owner / manager can take action straight from the quick glance.
    // Cleaners just read. The setStatus handler is the same one the
    // checklist already uses for per-item status changes.
    const canActOnItems =
      employee?.role === "owner" || employee?.role === "manager";
    const sections = {
      bedroom: [],
      vanity: [],
      bathroom: [],
      general: [],
      other: [],
    };
    targets.forEach((t) => {
      const sec = (t.template_section || "other").toLowerCase();
      (sections[sec] || sections.other).push(t);
    });
    const order = ["bedroom", "vanity", "bathroom", "general", "other"];
    const labels = {
      bedroom: "Bedroom",
      vanity: "Vanity",
      bathroom: "Bathroom",
      general: "General",
      other: "Other",
    };
    return (
      <div className="p-4 space-y-3">
        {order.map((secKey) => {
          const items = sections[secKey];
          if (!items || items.length === 0) return null;
          const doneCount = items.filter((i) => i.status === "done").length;
          const blockedCount = items.filter(
            (i) => i.status === "blocked",
          ).length;
          return (
            <div
              key={secKey}
              className="rounded-2xl bg-white border border-stone-200 p-3"
            >
              <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-2">
                {labels[secKey]}{" "}
                <span className="text-stone-400">
                  ({doneCount}/{items.length} done
                </span>
                {blockedCount > 0 && (
                  <span className="text-red-700">
                    {" "}
                    · {blockedCount} blocked
                  </span>
                )}
                <span className="text-stone-400">)</span>
              </div>
              <div className="space-y-1.5">
                {items.map((t) => {
                  const d = dotFor(t);
                  const isBlocked = t.status === "blocked";
                  const isDone = t.status === "done";
                  // Blocked items get a red highlight strip on the left
                  // and the cleaner's reason shown inline so the owner
                  // doesn't have to navigate elsewhere to see "why".
                  return (
                    <div
                      key={t.id}
                      className={`text-sm rounded-lg ${isBlocked ? "bg-red-50 border border-red-200 p-2" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${d.color} flex-shrink-0`}
                          title={d.label}
                        />
                        <span
                          className={`flex-1 min-w-0 ${isDone ? "text-stone-500 line-through" : "text-stone-900"}`}
                        >
                          {labelForT(t)}
                        </span>
                        {isBlocked && (
                          <span className="text-[9px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded-full bg-red-200 text-red-800 flex-shrink-0">
                            Blocked
                          </span>
                        )}
                      </div>
                      {/* Show the cleaner's reason when blocked. Italic + indented
                         so it reads as commentary on the row above. */}
                      {isBlocked && t.status_notes && (
                        <div className="text-xs text-red-700 italic mt-1 pl-4">
                          "{t.status_notes}"
                        </div>
                      )}
                      {/* Owner / manager-only inline actions. Reopen routes
                         the target back to pending; Mark done forces it to
                         done (e.g. owner accepts a blocked item as actually
                         resolved or wants to override a stuck pending). */}
                      {canActOnItems &&
                        (isBlocked ||
                          isDone ||
                          t.status === "paused" ||
                          t.status === "in_progress") && (
                          <div className="flex items-center gap-1.5 mt-1.5 pl-4">
                            {(isBlocked || isDone || t.status === "paused") && (
                              <button
                                onClick={() => setStatus(t, "pending")}
                                disabled={busyId === t.id}
                                className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center gap-1 disabled:opacity-50"
                              >
                                <Play size={10} /> Reopen
                              </button>
                            )}
                            {!isDone && (
                              <button
                                onClick={() => setStatus(t, "done")}
                                disabled={busyId === t.id}
                                className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-800 flex items-center gap-1 disabled:opacity-50"
                              >
                                <Check size={10} /> Mark done
                              </button>
                            )}
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  })();

  return quickGlance ? (
    // Quick glance modal — owner audit view uses this. Backdrop
    // around a sized card; tap backdrop to close. The CleanerProgress
    // bar is hidden since this isn't part of the cleaner's journey.
    <div
      onClick={onClose}
      className="fixed inset-0 bg-stone-900/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-50 w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="p-4 border-b border-stone-200 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              Quick glance
            </div>
            <div className="font-serif text-lg text-stone-900 truncate">
              {assignment.title}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-100 flex-shrink-0"
          >
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{quickGlanceBody}</div>
      </div>
    </div>
  ) : (
    <div className="fixed inset-0 bg-stone-50 z-50 flex flex-col">
      {attachmentOpen && (
        <AttachmentModal
          url={assignment.file_url}
          kind={assignment.file_kind}
          onClose={() => setAttachmentOpen(false)}
        />
      )}
      {/* Global cleaner progress bar — same 5 segments as the rest of
         the app. Inside an assignment the cleaner has filled the first
         3 segments (Property, Assignment, Items). "Working" is filled
         when they have items in progress; "Complete" turns green when
         everything is done. */}
      <CleanerProgressBar
        segments={[
          { label: "Assignment", filled: true, onClick: onClose },
          {
            label: "Items",
            filled: doneCount > 0 || counts.in_progress > 0,
            isCurrent: !isAllDone,
          },
          { label: "Working", filled: counts.in_progress > 0 || doneCount > 0 },
          { label: "Complete", filled: isAllDone, complete: isAllDone },
        ]}
        inActiveWork={counts.in_progress > 0}
      />
      {/* Header */}
      <div className="bg-stone-900 text-stone-50 px-5 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full bg-stone-800 hover:bg-stone-700"
          >
            <ArrowLeft size={20} />
          </button>
          {assignment.file_url && (
            <button
              onClick={() => setAttachmentOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold active:scale-95 transition"
            >
              <Eye size={13} /> View attachment
            </button>
          )}
        </div>
        <div className="text-xs uppercase tracking-wider font-mono text-stone-400">
          {assignment.sheet_type === "cleaning_check"
            ? "Cleaning check"
            : "Move-out clean"}
        </div>
        <div className="font-serif text-xl font-bold leading-tight break-words">
          {unitLabel}
          {bedroomLabel && (
            <>
              <span className="text-stone-400 mx-1.5">·</span>
              <span className="italic">{bedroomLabel}</span>
            </>
          )}
        </div>
        {bathroomNum && (
          <div className="text-[11px] text-amber-300 font-mono mt-1">
            Bathroom {bathroomNum} (shared between bedrooms{" "}
            {bathroomNum === 1 ? "1 & 2" : "3 & 4"})
          </div>
        )}
        {/* Inline progress text. */}
        <div className="mt-3 text-[11px] font-mono text-stone-400">
          {doneCount} of {total} tasks done
          {counts.in_progress > 0 && ` · ${counts.in_progress} in progress`}
          {isAllDone && (
            <span className="text-emerald-400 font-bold ml-1">✓ All done!</span>
          )}
        </div>
        {/* Bulk action row — start all pending items, pause all in-progress
           ones, request a new item that's not on the sheet. Mirrors the
           legacy AssignmentCard buttons so cleaners aren't missing
           workflow controls when they open the checklist view. */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(counts.not_started > 0 || counts.paused > 0) && (
            <button
              onClick={async () => {
                if (bulkBusy) return;
                setBulkBusy(true);
                const eligible = targets.filter(
                  (t) => t.status === "pending" || t.status === "paused",
                );
                for (const t of eligible) {
                  await updateStatus(t, "in_progress");
                }
                setBulkBusy(false);
              }}
              disabled={bulkBusy}
              className="px-3 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
            >
              <Play size={12} /> Start all
            </button>
          )}
          {counts.in_progress > 0 && (
            <button
              onClick={async () => {
                if (bulkBusy) return;
                setBulkBusy(true);
                const eligible = targets.filter(
                  (t) => t.status === "in_progress",
                );
                for (const t of eligible) {
                  await updateStatus(t, "paused");
                }
                setBulkBusy(false);
              }}
              disabled={bulkBusy}
              className="px-3 py-1.5 rounded-full bg-stone-700 hover:bg-stone-600 text-stone-50 text-xs font-medium border border-stone-500 active:scale-95 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Pause size={12} /> Pause all
            </button>
          )}
          <button
            onClick={() => setRequestModalOpen(true)}
            className="px-3 py-1.5 rounded-full bg-stone-700 hover:bg-stone-600 text-stone-50 text-xs font-medium border border-stone-500 active:scale-95 transition flex items-center gap-1.5"
          >
            <Plus size={12} /> Request item
          </button>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 px-3 py-3 bg-stone-100">
        <button
          onClick={() => setTab("not_started")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium ${tab === "not_started" ? "bg-white shadow-sm text-stone-900 font-bold" : "text-stone-600"}`}
        >
          Not started {counts.not_started > 0 && `(${counts.not_started})`}
        </button>
        <button
          onClick={() => setTab("in_progress")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium ${tab === "in_progress" ? "bg-amber-50 shadow-sm text-amber-900 font-bold" : "text-stone-600"}`}
        >
          Working on now {counts.open_blocks > 0 && `(${counts.open_blocks})`}
        </button>
        <button
          onClick={() => setTab("done")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium ${tab === "done" ? "bg-emerald-50 shadow-sm text-emerald-900 font-bold" : "text-stone-600"}`}
        >
          Done {counts.closed_blocks > 0 && `(${counts.closed_blocks})`}
        </button>
      </div>

      {/* Section sub-tabs — only show on Not Started. They filter
         which section's items are visible below. "All" = original
         behavior (every section grouped). Tap a section pill to
         see just Bedroom items, just Vanity items, etc. — a
         quick-view by area. Counts come from grouped[s] which is
         already scoped to the current tab's pending items. */}
      {tab === "not_started" && counts.not_started > 0 && (
        <div className="flex gap-1.5 px-3 pt-2 pb-1 overflow-x-auto -mx-0">
          <button
            onClick={() => setSectionFilter("all")}
            className={`px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap ${sectionFilter === "all" ? "bg-stone-900 text-stone-50 font-bold" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
          >
            All ({counts.not_started})
          </button>
          {sectionOrder.map((s) => {
            const n = grouped[s]?.length || 0;
            if (n === 0) return null;
            const active = sectionFilter === s;
            return (
              <button
                key={s}
                onClick={() => setSectionFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap ${active ? "bg-stone-900 text-stone-50 font-bold" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
              >
                {sectionLabel[s]} ({n})
              </button>
            );
          })}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-3 pb-24">
        {(() => {
          // Working on now / Done tabs now render WORK BLOCKS scoped
          // to THIS bedroom, not item-status rows. Open blocks live
          // under Working on now; closed blocks under Done. Tapping
          // a block card surfaces its tasks (the work the cleaner
          // logged inside that block). Items remain non-interactive
          // here — this view is a quick reference, not a control panel.
          if (tab === "in_progress" || tab === "done") {
            const wantsOpen = tab === "in_progress";
            const blocks = workBlocks.filter((b) =>
              wantsOpen ? !b.end_time : !!b.end_time,
            );
            if (blocks.length === 0) {
              return (
                <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                  {wantsOpen
                    ? "No work blocks open at this bedroom right now."
                    : "No completed work blocks for this bedroom yet."}
                </div>
              );
            }
            return (
              <div className="space-y-2">
                {blocks.map((b) => {
                  const start = b.start_time ? new Date(b.start_time) : null;
                  const end = b.end_time ? new Date(b.end_time) : null;
                  const durMs = end
                    ? end - start
                    : start
                      ? Date.now() - start.getTime()
                      : 0;
                  const hrs = Math.floor(durMs / 3600000);
                  const mins = Math.floor((durMs % 3600000) / 60000);
                  const durLabel = `${hrs > 0 ? hrs + "h " : ""}${mins}m`;
                  const taskCount = (b.tasks || []).length;
                  const cleaner = b.shift?.employee?.name || "Unknown";
                  return (
                    <div
                      key={b.id}
                      className={`p-3 rounded-xl border-2 ${wantsOpen ? "bg-amber-50 border-amber-300" : "bg-white border-stone-200"}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="font-serif text-sm text-stone-900 font-bold">
                          {cleaner}
                        </div>
                        <span
                          className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full ${wantsOpen ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-emerald-100 text-emerald-800 border border-emerald-300"}`}
                        >
                          {wantsOpen ? "In progress" : "Done"}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-stone-500">
                        {start &&
                          start.toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        {" · "}
                        {durLabel}
                        {taskCount > 0 && (
                          <>
                            {" "}
                            · {taskCount} task{taskCount === 1 ? "" : "s"}
                          </>
                        )}
                      </div>
                      {b.work_notes && (
                        <div className="text-xs text-stone-700 mt-1 italic">
                          "{b.work_notes}"
                        </div>
                      )}
                      {taskCount > 0 && (
                        <ul className="mt-2 text-xs text-stone-700 space-y-0.5 pl-3 border-l-2 border-stone-200">
                          {b.tasks.map((t) => (
                            <li
                              key={t.id}
                              className="flex items-center gap-1.5"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.end_time ? "bg-emerald-500" : "bg-amber-500"}`}
                              />
                              <span
                                className={
                                  t.end_time
                                    ? "line-through text-stone-500"
                                    : ""
                                }
                              >
                                {t.name || t.category || "(unnamed)"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          }
          // Not started tab — keep the existing grouped, read-only,
          // section-filterable layout. visibleTargets / grouped were
          // computed against status='pending' above.
          if (visibleTargets.length === 0) {
            return (
              <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                No items to start. Either everything is in progress or already
                done.
              </div>
            );
          }
          return (
            <div className="space-y-4">
              {sectionOrder
                .filter((s) => grouped[s].length > 0)
                .filter((s) => sectionFilter === "all" || sectionFilter === s)
                .map((s) => (
                  <div key={s}>
                    <div className="text-sm font-bold text-stone-800 tracking-wide mb-1.5 px-1">
                      {sectionLabel[s]}{" "}
                      <span className="text-xs font-mono text-stone-500">
                        ({grouped[s].length})
                      </span>
                    </div>
                    {/* Two-column grid keeps the quick-view short
                     so the cleaner doesn't have to scroll a whole
                     bedroom's worth of items. The rows are
                     read-only anyway so density is fine. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {grouped[s].map(renderItemRow)}
                    </div>
                  </div>
                ))}
            </div>
          );
        })()}

        {/* Other assignments at this bedroom — only show on Not Started
           tab so the cleaner can hop between sibling assignments
           without going back to the property home. */}
        {tab === "not_started" && otherAssignments.length > 0 && (
          <div className="mt-6 pt-4 border-t border-stone-200">
            <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-2 px-1">
              Other assignments at this bedroom
            </div>
            <div className="space-y-1.5">
              {otherAssignments.map((oa) => {
                const totalItems = (oa.targets || []).length;
                const remaining = (oa.targets || []).filter(
                  (t) => t.status !== "done",
                ).length;
                const typeLabel =
                  oa.sheet_type === "cleaning_check"
                    ? "Cleaning check"
                    : oa.sheet_type === "move_out_clean"
                      ? "Move-out clean"
                      : "Legacy upload";
                return (
                  <button
                    key={oa.id}
                    onClick={() => onOpenSibling && onOpenSibling(oa)}
                    disabled={!onOpenSibling}
                    className="w-full text-left p-3 rounded-xl bg-white border border-stone-200 hover:border-stone-400 hover:bg-stone-50 active:scale-[0.99] transition disabled:hover:border-stone-200 disabled:hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-serif text-sm text-stone-900 truncate">
                        {oa.title || typeLabel}
                      </div>
                      {onOpenSibling && (
                        <ChevronRight
                          size={14}
                          className="text-stone-400 flex-shrink-0"
                        />
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-stone-500 mt-1 flex items-center gap-2 flex-wrap">
                      <span>{typeLabel}</span>
                      <span className="text-stone-300">·</span>
                      <span>
                        {totalItems} item{totalItems === 1 ? "" : "s"}
                      </span>
                      {remaining > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          {remaining} left
                        </span>
                      )}
                      {remaining === 0 && totalItems > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Done
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="bg-stone-900 px-5 py-3">
        <div className="text-[10px] uppercase tracking-wider font-mono text-stone-400 text-center">
          Tap any item to advance ·{" "}
          {tab === "not_started"
            ? "Pending → In progress"
            : tab === "in_progress"
              ? "In progress → Done"
              : "Done → Re-open"}
        </div>
      </div>
      {/* Request-item modal — cleaner taps "Request item" to log an
         extra cleaning task that wasn't on the inspection sheet. We
         insert a new assignment_target on this assignment with a
         status_notes payload describing the request. Manager/owner
         sees it next to the rest of the items. */}
      {requestModalOpen && (
        <RequestNewItemModal
          assignment={assignment}
          employee={employee}
          onClose={() => setRequestModalOpen(false)}
          onSaved={() => {
            setRequestModalOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
