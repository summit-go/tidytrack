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
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
} from "../../../lib/photos.js";
import { sessionStore } from "../../../lib/sessionStore.js";
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
import { ItemsDropdown } from "./ItemsDropdown.jsx";
import { LeaveWorkblockModal } from "./LeaveWorkblockModal.jsx";
import { AssignmentViewer } from "../../cross-cutting/AssignmentViewer.jsx";
import { AssignmentsPanel } from "./AssignmentsPanel.jsx";

export function ViewOnlyAssignmentsPanel({
  propertyId,
  employee,
  onOpenBedroomHistory,
}) {
  const [targets, setTargets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [opened, setOpened] = useState(null);
  const [filter, setFilter] = useState("open"); // 'open' | 'done'

  const load = async () => {
    const PAGE = 1000;
    let data = [];
    let error = null;
    for (let from = 0; ; from += PAGE) {
      const { data: page, error: pErr } = await supabase
        .from("assignment_targets")
        .select(
          "*, assignment:assignments!inner(id, title, notes, file_url, file_kind, customer_id, active, source, pm_status, deleted_at, assignment_type, scheduled_date), unit:units(id, label), party:parties(id, label), starter:employees!started_by(name), completer:employees!completed_by(name)",
        )
        .eq("assignment.customer_id", propertyId)
        .eq("assignment.active", true)
        .is("assignment.deleted_at", null)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (pErr) {
        error = pErr;
        break;
      }
      data = data.concat(page || []);
      if (!page || page.length < PAGE) break;
      if (from > 200000) break;
    }
    if (error) {
      console.warn(error);
      setLoaded(true);
      return;
    }
    const filtered = (data || []).filter(
      (t) =>
        !t.assignment?.deleted_at &&
        (t.assignment?.source !== "pm" ||
          t.assignment?.pm_status === "approved"),
    );
    setTargets(filtered);
    setLoaded(true);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [propertyId]);
  useAssignmentSync(load, "view-only-asgn");

  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  // Rank for sorting: overdue first, then today, then undated, then upcoming.
  const dueRank = (t) => {
    const sd = t.assignment?.scheduled_date;
    if (!sd) return 2;
    if (sd < todayKey) return 0;
    if (sd === todayKey) return 1;
    return 3;
  };
  const dueTodayCount = targets.filter(
    (t) => t.status !== "done" && t.assignment?.scheduled_date === todayKey,
  ).length;
  const overdueCount = targets.filter(
    (t) =>
      t.status !== "done" &&
      t.assignment?.scheduled_date &&
      t.assignment.scheduled_date < todayKey,
  ).length;

  const canEditDates = can(employee, "edit_due_dates");
  const [editDateId, setEditDateId] = useState(null);
  const saveDue = async (id, date) => {
    setEditDateId(null);
    if (id) {
      await supabase
        .from("assignments")
        .update({ scheduled_date: date || null })
        .eq("id", id);
      load();
    }
  };

  const visible =
    filter === "open"
      ? targets
          .filter((t) => t.status !== "done")
          .sort((a, b) => {
            const ra = dueRank(a),
              rb = dueRank(b);
            if (ra !== rb) return ra - rb;
            return (a.assignment?.scheduled_date || "").localeCompare(
              b.assignment?.scheduled_date || "",
            );
          })
      : targets
          .filter((t) => t.status === "done")
          .sort(
            (a, b) =>
              new Date(b.completed_at || 0) - new Date(a.completed_at || 0),
          );

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <FileText size={14} className="text-stone-500" />
        <span className="text-xs uppercase tracking-wider text-stone-500 font-mono">
          Assignments
        </span>
      </div>
      <div className="flex gap-1 mb-3 bg-stone-100 p-1 rounded-xl">
        <button
          onClick={() => setFilter("open")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium ${filter === "open" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
        >
          Open ({targets.filter((t) => t.status !== "done").length})
        </button>
        <button
          onClick={() => setFilter("done")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium ${filter === "done" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
        >
          Done ({targets.filter((t) => t.status === "done").length})
        </button>
      </div>

      {filter === "open" && (dueTodayCount > 0 || overdueCount > 0) && (
        <div className="flex items-center gap-2 mb-3 text-xs font-mono">
          {dueTodayCount > 0 && (
            <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">
              {dueTodayCount} due today
            </span>
          )}
          {overdueCount > 0 && (
            <span className="px-2 py-1 rounded-full bg-red-100 text-red-700">
              {overdueCount} overdue
            </span>
          )}
        </div>
      )}

      {!loaded ? (
        <Splash text="Loading…" />
      ) : visible.length === 0 ? (
        <div className="text-center py-10 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
          No {filter === "open" ? "open" : "done"} assignments.
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((t) => {
            const a = t.assignment;
            const s =
              ASSIGNMENT_STATUSES[t.status] || ASSIGNMENT_STATUSES.pending;
            return (
              <div
                key={t.id}
                className="p-3 rounded-xl bg-white border border-stone-200"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-serif text-base text-stone-900 truncate">
                      {a.title}
                    </div>
                    {unitPartyLabel(t.unit?.label, t.party?.label) && (
                      <div className="text-xs font-mono text-stone-500 mt-0.5">
                        {unitPartyLabel(t.unit?.label, t.party?.label)}
                      </div>
                    )}
                    {a.notes && (
                      <div className="text-xs text-stone-600 mt-1 line-clamp-2">
                        {a.notes}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border ${s.color}`}
                      >
                        {s.label}
                      </span>
                      {a.assignment_type && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                          {assignmentTypeLabel(a.assignment_type)}
                        </span>
                      )}
                      {t.status === "done" ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-900 text-white flex items-center gap-1">
                          <Check size={9} />{" "}
                          {t.completed_at
                            ? `Done ${fmtDueDate(String(t.completed_at).slice(0, 10))}`
                            : "Done"}
                        </span>
                      ) : editDateId === a.id ? (
                        <DueDateEditor
                          compact
                          value={a.scheduled_date || ""}
                          onSave={(d) => saveDue(a.id, d)}
                          onCancel={() => setEditDateId(null)}
                        />
                      ) : canEditDates ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditDateId(a.id);
                          }}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                            a.scheduled_date
                              ? a.scheduled_date < todayKey
                                ? "bg-red-100 text-red-700 border-red-200"
                                : a.scheduled_date === todayKey
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : "bg-stone-200 text-stone-600 border-stone-300"
                              : "bg-white text-stone-500 border-dashed border-stone-300"
                          }`}
                        >
                          <Calendar size={9} />{" "}
                          {a.scheduled_date
                            ? a.scheduled_date < todayKey
                              ? `Overdue · ${fmtDueDate(a.scheduled_date)}`
                              : a.scheduled_date === todayKey
                                ? "Today"
                                : fmtDueDate(a.scheduled_date)
                            : "Set due date"}
                        </button>
                      ) : (
                        a.scheduled_date &&
                        (a.scheduled_date < todayKey ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                            <Calendar size={9} /> Overdue ·{" "}
                            {fmtDueDate(a.scheduled_date)}
                          </span>
                        ) : a.scheduled_date === todayKey ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <Calendar size={9} /> Today
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-200 text-stone-600 flex items-center gap-1">
                            <Calendar size={9} /> {fmtDueDate(a.scheduled_date)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap mt-2">
                  {a.file_url && (
                    <button
                      onClick={() => setOpened(t)}
                      className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium flex items-center gap-1"
                    >
                      {a.file_kind === "pdf" ? (
                        <FileText size={12} />
                      ) : (
                        <ImageIcon size={12} />
                      )}
                      View
                    </button>
                  )}
                  {onOpenBedroomHistory && t.unit_id && t.party_id && (
                    <button
                      onClick={() =>
                        onOpenBedroomHistory({
                          unitId: t.unit_id,
                          unitLabel: t.unit?.label,
                          partyId: t.party_id,
                          partyLabel: t.party?.label,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium flex items-center gap-1"
                    >
                      <Clock size={12} /> History
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {opened && (
        <AssignmentViewer
          target={opened}
          employee={employee}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}
