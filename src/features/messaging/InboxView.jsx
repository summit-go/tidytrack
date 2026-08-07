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
  isLead,
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
  isoToLocalInput,
  localInputToISO,
  shiftBillableAmount,
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
  readPhotoTakenAt,
  sharePhotos,
} from "../../lib/photos.js";
import { sessionStore } from "../../domains/auth/sessionStore.js";
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
import { resolveItemLabel } from "../../lib/pickerLabels.js";
import { generatePortalUserCode } from "../../lib/portal.js";
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
import { ReviewAssignmentModal } from "../../domains/work/cross-cutting/ReviewAssignmentModal.jsx";
import { ReviewRecheckModal } from "../../domains/work/portal/ReviewRecheckModal.jsx";

export function InboxView({ employee, onBack }) {
  const [tab, setTab] = useState("assignments");
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [reviewedAssignments, setReviewedAssignments] = useState([]);
  const [pendingRechecks, setPendingRechecks] = useState([]); // PM recheck requests waiting for owner
  const [reviewRecheck, setReviewRecheck] = useState(null); // currently-open recheck in review modal
  const [newPhotos, setNewPhotos] = useState([]);
  const [reviewedPhotos, setReviewedPhotos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [reviewAssignment, setReviewAssignment] = useState(null);
  const [reviewPhoto, setReviewPhoto] = useState(null);
  const [togglingAssignmentId, setTogglingAssignmentId] = useState(null);
  // Queue review mode — when on, the inbox auto-opens the first pending
  // assignment as a review modal. After approve / send-back, we
  // immediately advance to the next pending one. When the queue empties
  // we show an "all caught up" prompt + the owner confirms to leave.
  const [queueMode, setQueueMode] = useState(false);
  const [queueDone, setQueueDone] = useState(false);

  // Discard a PM submission straight from the row — soft-delete, so it's
  // recoverable, and reload so it leaves the queue.
  const discardPmAssignment = async (assignment) => {
    if (togglingAssignmentId) return;
    if (
      !confirm(
        `Discard "${assignment.title || "this submission"}"? It won\u2019t be cleaned or billed. This can be undone later.`,
      )
    )
      return;
    setTogglingAssignmentId(assignment.id);
    const { error } = await supabase
      .from("assignments")
      .update({ deleted_at: new Date().toISOString(), deleted_by: employee.id })
      .eq("id", assignment.id);
    setTogglingAssignmentId(null);
    if (error) {
      alert("Could not discard: " + error.message);
      return;
    }
    load();
  };

  // Flip priority on every target of an assignment from the inbox row.
  // Sweep mode: if ANY target is priority, turn all off; otherwise turn
  // all on. Lets owners flag urgent PM submissions without opening the
  // review modal.
  const togglePmAssignmentPriority = async (assignment) => {
    if (togglingAssignmentId) return;
    const targetIds = (assignment.targets || []).map((t) => t.id);
    if (targetIds.length === 0) return;
    const anyPriority = (assignment.targets || []).some((t) => t.priority);
    const newPriority = !anyPriority;
    setTogglingAssignmentId(assignment.id);
    // Optimistic update across both lists (might appear in either)
    const flip = (list) =>
      list.map((a) =>
        a.id === assignment.id
          ? {
              ...a,
              targets: (a.targets || []).map((t) => ({
                ...t,
                priority: newPriority,
              })),
            }
          : a,
      );
    setPendingAssignments((prev) => flip(prev));
    setReviewedAssignments((prev) => flip(prev));
    const { error } = await supabase
      .from("assignment_targets")
      .update({ priority: newPriority })
      .in("id", targetIds);
    setTogglingAssignmentId(null);
    if (error) {
      alert("Could not update priority: " + error.message);
      load();
    }
  };

  const load = async () => {
    setLoaded(false);
    // Pending assignments
    const { data: aData } = await supabase
      .from("assignments")
      .select(
        "*, property:customers(id, name, property_type), targets:assignment_targets(id, priority, unit:units(label), party:parties(label))",
      )
      .eq("source", "pm")
      .eq("pm_status", "pending")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setPendingAssignments(aData || []);

    // Pending recheck requests — PM submissions saying "tenant passed
    // these items on recheck, don't need cleaning anymore". Pull the
    // item rows + assignment context for the review modal.
    const { data: rcData } = await supabase
      .from("recheck_requests")
      .select(
        `
        id, assignment_id, created_at, pm_status, notes,
        assignment:assignments(id, title, customer_id, property:customers(id, name, property_type)),
        items:recheck_request_items(
          id,
          target:assignment_targets(id, status, template_section, template_item_key, status_notes, unit:units(label), party:parties(label))
        )
      `,
      )
      .eq("pm_status", "pending")
      .order("created_at", { ascending: false });
    setPendingRechecks(rcData || []);

    // Already-reviewed PM assignments (approved or rejected) — for the "Reviewed" tab
    const { data: rData } = await supabase
      .from("assignments")
      .select(
        "*, property:customers(id, name, property_type), targets:assignment_targets(id, priority, unit:units(label), party:parties(label))",
      )
      .eq("source", "pm")
      .in("pm_status", ["approved", "rejected"])
      .order("approved_at", { ascending: false, nullsFirst: false })
      .limit(50);
    setReviewedAssignments(rData || []);

    // New photos
    const { data: pData } = await supabase
      .from("pm_photos")
      .select(
        "*, property:customers(id, name), unit:units(label), party:parties(label)",
      )
      .eq("status", "new")
      .order("created_at", { ascending: false });
    setNewPhotos(pData || []);

    // Reviewed photos (seen or archived)
    const { data: rpData } = await supabase
      .from("pm_photos")
      .select(
        "*, property:customers(id, name), unit:units(label), party:parties(label)",
      )
      .in("status", ["seen", "archived"])
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .limit(50);
    setReviewedPhotos(rpData || []);

    setLoaded(true);
  };
  useEffect(() => {
    load();
  }, []);
  useAssignmentSync(load, "inbox-sync");

  // When in queue mode and no modal open, pick the next pending
  // assignment to review. When the list drains, flip to "done" so the
  // owner sees the all-caught-up screen instead of looping.
  useEffect(() => {
    if (!queueMode || reviewAssignment) return;
    if (!loaded) return;
    if (pendingAssignments.length > 0) {
      setReviewAssignment(pendingAssignments[0]);
    } else {
      setQueueDone(true);
    }
  }, [queueMode, reviewAssignment, pendingAssignments, loaded]);

  const markPhotoSeen = async (photo) => {
    await supabase
      .from("pm_photos")
      .update({
        status: "seen",
        reviewed_by: employee.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", photo.id);
    load();
  };
  const archivePhoto = async (photo) => {
    if (!confirm("Archive this photo? It will no longer appear in your inbox."))
      return;
    await supabase
      .from("pm_photos")
      .update({
        status: "archived",
        reviewed_by: employee.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", photo.id);
    load();
  };
  const restorePhoto = async (photo) => {
    await supabase
      .from("pm_photos")
      .update({
        status: "new",
        reviewed_by: null,
        reviewed_at: null,
      })
      .eq("id", photo.id);
    load();
  };
  const deletePhoto = async (photo) => {
    if (!confirm("Permanently delete this photo? This cannot be undone."))
      return;
    if (photo.photo_path)
      await supabase.storage.from(PM_UPLOAD_BUCKET).remove([photo.photo_path]);
    await supabase.from("pm_photos").delete().eq("id", photo.id);
    load();
  };

  return (
    <div className="pb-24">
      <ScreenId id="OW-INBOX" />
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100"
        >
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
            From property managers
          </div>
          <div className="font-serif text-xl text-stone-900">Inbox</div>
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-5 overflow-x-auto">
          <button
            onClick={() => setTab("assignments")}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium whitespace-nowrap ${tab === "assignments" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
          >
            Assignments ({pendingAssignments.length})
          </button>
          <button
            onClick={() => setTab("photos")}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium whitespace-nowrap ${tab === "photos" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
          >
            Photos ({newPhotos.length})
          </button>
          <button
            onClick={() => setTab("reviewed")}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium whitespace-nowrap ${tab === "reviewed" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
          >
            Reviewed
          </button>
        </div>

        {!loaded ? (
          <Splash text="Loading…" />
        ) : tab === "assignments" ? (
          pendingAssignments.length === 0 && pendingRechecks.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              No assignments waiting for review.
            </div>
          ) : (
            <>
              {/* Pending recheck requests from PMs — these are
                 "tenant passed items X, Y, Z" submissions. Approve
                 marks those items done + recheck_passed_at so the
                 cleaning team stops seeing them. Shown above new
                 assignment submissions so they're easy to spot. */}
              {pendingRechecks.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-2">
                    Recheck requests ({pendingRechecks.length})
                  </div>
                  <div className="space-y-2">
                    {pendingRechecks.map((rc) => (
                      <div
                        key={rc.id}
                        onClick={() => setReviewRecheck(rc)}
                        tabIndex={0}
                        role="button"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setReviewRecheck(rc);
                          }
                        }}
                        className="w-full text-left p-4 rounded-2xl bg-white border-2 border-purple-200 hover:border-purple-500 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-mono">
                                RECHECK
                              </span>
                              <span className="font-serif text-base text-stone-900 truncate">
                                {rc.assignment?.title || "Recheck request"}
                              </span>
                            </div>
                            <div className="text-xs text-stone-600 font-mono mt-0.5">
                              {rc.assignment?.property?.name}
                              {" · "}
                              {rc.items?.length || 0}{" "}
                              {(rc.items?.length || 0) === 1 ? "item" : "items"}{" "}
                              the PM says passed
                            </div>
                            <div className="text-xs text-stone-400 font-mono mt-1">
                              Submitted {fmtDate(rc.created_at)}
                            </div>
                          </div>
                          <ChevronRight
                            size={16}
                            className="text-stone-400 flex-shrink-0"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Queue mode CTA — owner taps once, then walks through
                 every pending review one at a time. Approve / send back
                 → auto-advances. When the queue empties we show a
                 confirmation before leaving the queue screen. */}
              {pendingAssignments.length > 0 && (
                <button
                  onClick={() => {
                    setQueueDone(false);
                    setQueueMode(true);
                  }}
                  className="w-full mb-3 py-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-stone-50 font-medium text-sm flex items-center justify-center gap-2 active:scale-98"
                >
                  <Play size={14} /> Review all {pendingAssignments.length} in
                  queue
                </button>
              )}
              <div className="space-y-2">
                {pendingAssignments.map((a) => {
                  const anyPriority = (a.targets || []).some((t) => t.priority);
                  const isToggling = togglingAssignmentId === a.id;
                  return (
                    <div
                      key={a.id}
                      onClick={() => setReviewAssignment(a)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setReviewAssignment(a);
                        }
                      }}
                      className="w-full text-left p-4 rounded-2xl bg-white border-2 border-amber-200 hover:border-amber-500 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {a.file_kind === "pdf" ? (
                              <FileText
                                size={14}
                                className="text-stone-500 flex-shrink-0"
                              />
                            ) : (
                              <ImageIcon
                                size={14}
                                className="text-stone-500 flex-shrink-0"
                              />
                            )}
                            <span className="font-serif text-base text-stone-900 truncate">
                              {a.title}
                            </span>
                          </div>
                          {/* Priority + cleaning-type chips. Priority is a
                           click-to-toggle button right on the capsule —
                           owners can flag urgent PM submissions without
                           opening the review modal. */}
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePmAssignmentPriority(a);
                              }}
                              disabled={isToggling}
                              className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 transition-colors disabled:opacity-50 ${
                                anyPriority
                                  ? "bg-red-100 text-red-800 border-red-300 font-bold hover:bg-red-200"
                                  : "bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200"
                              }`}
                            >
                              <AlertCircle size={10} />{" "}
                              {anyPriority ? "Priority" : "Mark priority"}
                            </button>
                            <AssignmentTypeChip type={a.assignment_type} />
                          </div>
                          <div className="text-xs text-stone-600 font-mono mb-1 flex items-center gap-1.5">
                            <Building2 size={11} /> {a.property?.name}
                          </div>
                          {a.targets?.[0] &&
                            (a.targets[0].unit?.label ||
                              a.targets[0].party?.label) && (
                              <div className="text-xs text-stone-500 font-mono">
                                {a.targets[0].unit?.label}
                                {a.targets[0].party?.label &&
                                  ` · ${a.targets[0].party.label}`}
                              </div>
                            )}
                          <div className="text-xs text-stone-400 font-mono mt-1 flex items-center gap-2">
                            Submitted {fmtDate(a.created_at)}
                            {a.actor_kind === "pm_staff" && (
                              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600">
                                PM staff
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              discardPmAssignment(a);
                            }}
                            disabled={isToggling}
                            title="Discard — not needed at all"
                            className="p-1.5 rounded-lg text-stone-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 size={16} />
                          </button>
                          <ChevronRight size={16} className="text-stone-400" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )
        ) : tab === "photos" ? (
          newPhotos.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              No new photos.
            </div>
          ) : (
            <div className="space-y-3">
              {newPhotos.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-white border-2 border-amber-200"
                >
                  <div className="text-xs text-stone-600 font-mono mb-2 flex items-center gap-1.5">
                    <Building2 size={11} /> {p.property?.name}
                    {p.unit?.label && <span>· {p.unit.label}</span>}
                    {p.party?.label && <span>· {p.party.label}</span>}
                  </div>
                  {p.title && (
                    <div className="font-serif text-base text-stone-900 mb-1">
                      {p.title}
                    </div>
                  )}
                  {p.notes && (
                    <div className="text-sm text-stone-700 mb-2 whitespace-pre-wrap">
                      {p.notes}
                    </div>
                  )}
                  <button
                    onClick={() => setReviewPhoto(p)}
                    className="block w-full rounded-xl overflow-hidden bg-stone-100 mb-3"
                  >
                    <img
                      loading="lazy"
                      src={p.photo_url}
                      alt={p.title || ""}
                      className="w-full max-h-96 object-contain"
                    />
                  </button>
                  <div className="text-[10px] text-stone-400 font-mono mb-3 flex items-center gap-2">
                    Sent {fmtDate(p.created_at)}
                    {p.actor_kind === "pm_staff" && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600">
                        PM staff
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => markPhotoSeen(p)}
                      className="flex-1 py-2 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Check size={14} /> Mark seen
                    </button>
                    <button
                      onClick={() => archivePhoto(p)}
                      className="py-2 px-3 rounded-xl border border-stone-300 text-stone-600 text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <X size={14} /> Archive
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Reviewed tab — combines reviewed photos and reviewed assignments */
          <div className="space-y-6">
            {reviewedPhotos.length === 0 && reviewedAssignments.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                Nothing reviewed yet. Once you review photos or approve/reject
                assignments they show up here.
              </div>
            ) : (
              <>
                {reviewedAssignments.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
                      Reviewed assignments ({reviewedAssignments.length})
                    </div>
                    <div className="space-y-2">
                      {reviewedAssignments.map((a) => {
                        const isApproved = a.pm_status === "approved";
                        return (
                          <div
                            key={a.id}
                            className={`p-4 rounded-2xl border ${isApproved ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}
                          >
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {a.file_kind === "pdf" ? (
                                <FileText
                                  size={14}
                                  className="text-stone-600 flex-shrink-0"
                                />
                              ) : (
                                <ImageIcon
                                  size={14}
                                  className="text-stone-600 flex-shrink-0"
                                />
                              )}
                              <span className="font-serif text-base text-stone-900 truncate flex-1">
                                {a.title}
                              </span>
                              <span
                                className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full ${isApproved ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}
                              >
                                {isApproved ? "Approved" : "Rejected"}
                              </span>
                            </div>
                            <div className="text-xs text-stone-600 font-mono mb-1 flex items-center gap-1.5">
                              <Building2 size={11} /> {a.property?.name}
                            </div>
                            {a.pm_rejection_reason && (
                              <div className="text-xs text-red-700 italic mt-1">
                                "{a.pm_rejection_reason}"
                              </div>
                            )}
                            <div className="flex gap-2 mt-2">
                              {a.file_url && (
                                <a
                                  href={a.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium flex items-center gap-1"
                                >
                                  <Eye size={12} /> Open file
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {reviewedPhotos.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
                      Reviewed photos ({reviewedPhotos.length})
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {reviewedPhotos.map((p) => (
                        <div key={p.id} className="relative">
                          <button
                            onClick={() => setReviewPhoto(p)}
                            className="block w-full aspect-square rounded-xl overflow-hidden bg-stone-100"
                          >
                            <img
                              loading="lazy"
                              src={p.photo_url}
                              alt={p.title || ""}
                              className="w-full h-full object-cover"
                            />
                          </button>
                          <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                            <span
                              className={`text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-full ${p.status === "seen" ? "bg-emerald-600 text-white" : "bg-stone-700 text-white"}`}
                            >
                              {p.status}
                            </span>
                          </div>
                          <div className="mt-1 px-1 text-[10px] font-mono text-stone-500 truncate">
                            {p.property?.name}
                            {p.unit?.label && ` · ${p.unit.label}`}
                          </div>
                          <div className="px-1 flex gap-2 mt-1">
                            <button
                              onClick={() => restorePhoto(p)}
                              className="text-[10px] font-mono text-stone-600 hover:text-stone-900"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => deletePhoto(p)}
                              className="text-[10px] font-mono text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {reviewAssignment && (
        <ReviewAssignmentModal
          assignment={reviewAssignment}
          employee={employee}
          onDone={() => {
            // CRITICAL — optimistically drop the just-handled assignment
            // from local state BEFORE clearing reviewAssignment. The
            // queue-advance useEffect runs the moment reviewAssignment
            // flips to null, and at that instant pendingAssignments is
            // still the stale list including the one we just approved
            // (load() is in flight, hasn't returned yet). Without this
            // optimistic prune, the useEffect picks the same row at
            // index 0 and re-opens the modal with the assignment the
            // user thought they just finished — every other "approve"
            // click ends up being a no-op database update on an
            // already-approved row. End result: 48 clicks → maybe 20
            // real approvals, the rest invisible to cleaners because
            // they were never actually advanced through the queue.
            const id = reviewAssignment.id;
            setPendingAssignments((prev) => prev.filter((a) => a.id !== id));
            setReviewAssignment(null);
            load();
          }}
          onClose={() => {
            // Closing the modal mid-queue also exits queue mode (the
            // owner chose to stop). They can re-enter from the button.
            if (queueMode) setQueueMode(false);
            setReviewAssignment(null);
          }}
        />
      )}
      {reviewRecheck && (
        <ReviewRecheckModal
          recheck={reviewRecheck}
          employee={employee}
          onDone={() => {
            setReviewRecheck(null);
            load();
          }}
          onClose={() => setReviewRecheck(null)}
        />
      )}
      {/* "All caught up" overlay — shown when the queue empties.
         Owner taps to confirm and exits queue mode. */}
      {queueDone && (
        <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
              <Check size={32} />
            </div>
            <div className="font-serif text-2xl text-stone-900 mb-1">
              All caught up
            </div>
            <div className="text-sm text-stone-600 mb-5">
              No more PM submissions waiting for your review.
            </div>
            <button
              onClick={() => {
                setQueueDone(false);
                setQueueMode(false);
              }}
              className="w-full py-3 rounded-2xl bg-stone-900 text-stone-50 font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      )}
      {reviewPhoto && (
        <div className="fixed inset-0 bg-stone-900/95 z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 text-stone-50 bg-stone-900 flex-shrink-0">
            <div className="text-sm font-mono truncate flex-1">
              {reviewPhoto.title || "Photo from PM"}
            </div>
            <button
              onClick={() => setReviewPhoto(null)}
              className="p-2 rounded-full bg-stone-800 ml-2 flex-shrink-0"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <img
              loading="lazy"
              src={reviewPhoto.photo_url}
              alt=""
              className="w-full h-auto rounded-xl"
            />
            {reviewPhoto.notes && (
              <div className="mt-3 p-3 rounded-xl bg-stone-800 text-stone-200 text-sm whitespace-pre-wrap">
                {reviewPhoto.notes}
              </div>
            )}
          </div>
          <div className="p-3 bg-stone-900 flex-shrink-0">
            <a
              href={reviewPhoto.photo_url}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center py-3 rounded-xl bg-stone-50 text-stone-900 text-sm font-medium"
            >
              Open full-size in new tab
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
