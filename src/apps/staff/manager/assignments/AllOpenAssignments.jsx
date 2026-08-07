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
} from "../../../../lib/supabase.js";
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
} from "../../../../lib/constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "../../../../lib/permissions.js";
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
} from "../../../../lib/format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "../../../../lib/compare.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
} from "../../../../lib/photos.js";
import { sessionStore } from "../../../../lib/sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "../../../../lib/translation.js";
import { buildTargetTitle, unitSizeLabel, shortenBedroom, partyDisplay, unitPartyLabel } from "../../../../lib/labels.js";
import { splitTaskName } from "../../../../lib/tasks.js";
import { useAssignmentSync } from "../../../../hooks/useAssignmentSync.js";
import { useIdleDetector } from "../../../../hooks/useIdleDetector.js";
import { usePagePersistence } from "../../../../hooks/usePagePersistence.js";
import { useItemLabelOverrides } from "../../../../hooks/useItemLabelOverrides.js";
import { useTick } from "../../../../hooks/useTick.js";
import { useUnreadCount } from "../../../../hooks/useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "../../../../hooks/useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "../../../../contexts/LocaleContext.jsx";
import { PreviewContext } from "../../../../contexts/PreviewContext.jsx";
import { AssignmentTypeChip } from "../../../../components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "../../../../components/chips/PriorityChip.jsx";
import { Splash } from "../../../../components/Splash.jsx";
import { ScreenId } from "../../../../components/ScreenId.jsx";
import { OwnerOnly } from "../../../../components/OwnerOnly.jsx";
import { DueDateEditor } from "../../../../components/DueDateEditor.jsx";
import { ProgressBar } from "../../../../components/ProgressBar.jsx";
import { CleanerProgressBar } from "../../../../components/CleanerProgressBar.jsx";
import { ConfirmModal } from "../../../../components/ConfirmModal.jsx";
import { AddressLink } from "../../../../components/AddressLink.jsx";
import { TranslatableText } from "../../../../components/TranslatableText.jsx";
import { PhotoModal } from "../../../../components/PhotoModal.jsx";
import { NotificationBell } from "../../../../components/NotificationBell.jsx";
import { Header } from "../../../../components/Header.jsx";
import { TeamClockIcon } from "../../../../components/TeamClockIcon.jsx";
import { TabButton } from "../../../../components/TabButton.jsx";
import { PhotoZoomViewer } from "../../../../components/PhotoZoomViewer.jsx";
import { TranslateButton } from "../../../../components/TranslateButton.jsx";
import { ZoomableImage } from "../../../../components/ZoomableImage.jsx";
import { ItemsDropdown } from "../../cleaner/ItemsDropdown.jsx";

export function AllOpenAssignments({ employee, onBack, onOpenAssignment }) {
  const [data, setData] = useState([]); // grouped: [{ property, assignments: [...] }]
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all"); // all | pending | in_progress | blocked

  const load = async () => {
    setLoadError(null);
    const { data: aData, error: aErr } = await supabase
      .from("assignments")
      .select(
        "*, property:customers(id, name, property_type), targets:assignment_targets(id, status, unit:units(label), party:parties(label), starter:employees!started_by(name), completer:employees!completed_by(name))",
      )
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (aErr) {
      console.error("[AllOpenAssignments] load error:", aErr);
      setLoadError(aErr.message);
      setData([]);
      setLoaded(true);
      return;
    }

    // Keep only assignments with at least one non-done target
    const openOnly = (aData || []).filter((a) =>
      (a.targets || []).some((t) => t.status !== "done"),
    );

    // Group by property
    const byProp = {};
    openOnly.forEach((a) => {
      const pId = a.property?.id;
      if (!pId) return;
      if (!byProp[pId]) byProp[pId] = { property: a.property, assignments: [] };
      // Decorate with counts
      const counts = { pending: 0, in_progress: 0, done: 0, blocked: 0 };
      (a.targets || []).forEach((t) => {
        counts[t.status] = (counts[t.status] || 0) + 1;
      });
      byProp[pId].assignments.push({ ...a, counts });
    });

    const grouped = Object.values(byProp).sort((x, y) =>
      naturalCompare(x.property.name, y.property.name),
    );
    setData(grouped);
    setLoaded(true);
  };
  useEffect(() => {
    load();
  }, []);
  useAssignmentSync(load, "asgn-all-open");

  // Filter at the per-target level for the status filter (visual only)
  const filterMatch = (a) => {
    if (statusFilter === "all") return true;
    return (a.targets || []).some((t) => t.status === statusFilter);
  };

  const totalOpen = data.reduce(
    (s, g) => s + g.assignments.filter(filterMatch).length,
    0,
  );

  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100"
        >
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
            All properties
          </div>
          <div className="font-serif text-xl text-stone-900">
            Open assignments
          </div>
        </div>
      </div>

      <div className="px-5 pt-6">
        <div className="text-stone-500 text-sm mb-4">
          {totalOpen === 0
            ? "Nothing open right now"
            : `${totalOpen} ${totalOpen === 1 ? "assignment" : "assignments"} with open work`}
        </div>

        {/* Status filter pills */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
          {[
            { id: "all", label: "All open" },
            { id: "pending", label: "Pending" },
            { id: "in_progress", label: "In progress" },
            { id: "blocked", label: "Blocked" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${statusFilter === f.id ? "bg-stone-900 text-stone-50" : "bg-stone-100 text-stone-600"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loadError && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
            <div className="flex items-start gap-2 mb-1">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span className="font-medium">Couldn't load</span>
            </div>
            <div className="text-xs font-mono mt-2">{loadError}</div>
          </div>
        )}

        {!loaded ? (
          <Splash text="Loading…" />
        ) : totalOpen === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            {statusFilter === "all"
              ? "No open assignments across any property. Everything is done!"
              : `No assignments are currently ${statusFilter.replace("_", " ")}.`}
          </div>
        ) : (
          <div className="space-y-6">
            {data.map((group) => {
              const filtered = group.assignments.filter(filterMatch);
              if (filtered.length === 0) return null;

              // Sub-group filtered assignments by building (derived from first target's unit label)
              const isMulti = group.property.property_type === "multi_unit";
              const buildings = {};
              filtered.forEach((a) => {
                const firstUnit = (a.targets || []).find((t) => t.unit?.label)
                  ?.unit?.label;
                const b = isMulti ? buildingFromLabel(firstUnit) || "—" : "—";
                if (!buildings[b]) buildings[b] = [];
                buildings[b].push(a);
              });
              const buildingKeys = Object.keys(buildings).sort(naturalCompare);
              const showSubGroups = isMulti && buildingKeys.length > 1;

              return (
                <div key={group.property.id}>
                  <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-stone-200">
                    <h3 className="font-serif text-lg text-stone-900 flex items-center gap-2">
                      <Building2 size={14} /> {group.property.name}
                    </h3>
                    <span className="text-xs font-mono text-stone-500">
                      {filtered.length}{" "}
                      {filtered.length === 1 ? "open" : "open"}
                    </span>
                  </div>

                  {buildingKeys.map((b) => {
                    const items = buildings[b];
                    return (
                      <div key={b} className="mb-4">
                        {showSubGroups && (
                          <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-2 px-1 flex items-center gap-1.5">
                            <Building2 size={11} />
                            {b === "—"
                              ? "No unit"
                              : `Building ${b.replace(/^B/i, "")}`}
                            <span className="text-stone-400">
                              ({items.length})
                            </span>
                          </div>
                        )}
                        <div className="space-y-2">
                          {items.map((a) => {
                            const openTargets = (a.targets || []).filter(
                              (t) => t.status !== "done",
                            );
                            const inProgressBy = openTargets
                              .filter(
                                (t) =>
                                  t.status === "in_progress" && t.starter?.name,
                              )
                              .map((t) => t.starter.name);
                            const uniqStarters = [...new Set(inProgressBy)];
                            const hasBlocked = a.counts.blocked > 0;
                            return (
                              <button
                                key={a.id}
                                onClick={() =>
                                  onOpenAssignment(group.property, a)
                                }
                                className={`w-full text-left p-4 rounded-2xl border transition-colors ${hasBlocked ? "bg-red-50/50 border-red-200 hover:border-red-400" : "bg-white border-stone-200 hover:border-stone-400"}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      {a.file_kind === "pdf" ? (
                                        <FileText
                                          size={13}
                                          className="text-stone-500 flex-shrink-0"
                                        />
                                      ) : (
                                        <ImageIcon
                                          size={13}
                                          className="text-stone-500 flex-shrink-0"
                                        />
                                      )}
                                      <span className="font-serif text-base text-stone-900 truncate">
                                        {a.title}
                                      </span>
                                      {hasBlocked && (
                                        <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                          ⚠ Blocked
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-stone-500 font-mono">
                                      {a.counts.done}/{a.targets?.length || 0}{" "}
                                      done
                                      {a.counts.in_progress > 0 &&
                                        ` · ${a.counts.in_progress} in progress`}
                                      {a.counts.pending > 0 &&
                                        ` · ${a.counts.pending} pending`}
                                      {a.counts.blocked > 0 &&
                                        ` · ${a.counts.blocked} blocked`}
                                    </div>
                                    {uniqStarters.length > 0 && (
                                      <div className="text-xs text-amber-700 mt-1">
                                        {uniqStarters.length === 1
                                          ? `${uniqStarters[0]} is working on this`
                                          : `${uniqStarters.length} cleaners: ${uniqStarters.join(", ")}`}
                                      </div>
                                    )}
                                  </div>
                                  <ChevronRight
                                    size={16}
                                    className="text-stone-400 flex-shrink-0"
                                  />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
