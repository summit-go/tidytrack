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
  isLead,
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
import { buildTargetTitle, unitSizeLabel, shortenBedroom, partyDisplay, unitPartyLabel } from "../../../lib/labels.js";
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
import { isBetaFeaturesEnabled } from "../../../apps/internal/BetaShell.jsx";
import { ActivityTimelineView } from "./ActivityTimelineView.jsx";
import { SupplyChecklistManager } from "../../../apps/internal/cleaner/SupplyChecklistManager.jsx";
import { TranslationOverridesModal } from "../cross-cutting/TranslationOverridesModal.jsx";
import { WhosWherePanel } from "./WhosWherePanel.jsx";

export function DailyCalendar({
  employee,
  onSignOut,
  onPickDay,
  onOpenInbox,
  onOpenAssignedVsCleaned,
  onOpenMessages,
  onLogoClick,
}) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [activity, setActivity] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [inboxCounts, setInboxCounts] = useState({
    pendingAssignments: 0,
    pendingRechecks: 0,
    newPhotos: 0,
  });
  // Owner-only modal for managing Spanish label overrides across properties.
  const [showOverrides, setShowOverrides] = useState(false);
  // Owner admin for the supply checklist cleaners confirm at sign-in.
  const [showSupplyChecklist, setShowSupplyChecklist] = useState(false);
  // Beta-gated demo view. Only mounts when isBetaFeaturesEnabled
  // returns true (beta tester logged in + currently in BETA view).
  const [showActivityTimeline, setShowActivityTimeline] = useState(false);
  const betaEnabled = isBetaFeaturesEnabled(employee);
  // Who's-where modal — opened from the person icon in the header,
  // replacing the always-visible panel on the home screen.
  const [whosWhereOpen, setWhosWhereOpen] = useState(false);

  // Load inbox counts
  useEffect(() => {
    (async () => {
      const { count: pAssign } = await supabase
        .from("assignments")
        .select("id", { count: "exact", head: true })
        .eq("source", "pm")
        .eq("pm_status", "pending")
        .is("deleted_at", null);
      const { count: pRechecks } = await supabase
        .from("recheck_requests")
        .select("id", { count: "exact", head: true })
        .eq("pm_status", "pending");
      const { count: pPhotos } = await supabase
        .from("pm_photos")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      setInboxCounts({
        pendingAssignments: pAssign || 0,
        pendingRechecks: pRechecks || 0,
        newPhotos: pPhotos || 0,
      });
    })();
  }, []);
  const inboxTotal =
    inboxCounts.pendingAssignments +
    inboxCounts.pendingRechecks +
    inboxCounts.newPhotos;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoaded(false);
      // Pull just shift summary for this month (3-month buffer)
      const start = new Date(
        viewMonth.getFullYear(),
        viewMonth.getMonth() - 1,
        1,
      ).toISOString();
      const end = new Date(
        viewMonth.getFullYear(),
        viewMonth.getMonth() + 2,
        1,
      ).toISOString();

      // Lightweight: just shift IDs, start, property — no nested rows
      const { data: shifts, error: sErr } = await supabase
        .from("shifts")
        .select("id, start_time, customer_id")
        .gte("start_time", start)
        .lt("start_time", end)
        .eq("is_preview", false); // Don't mark calendar days for preview-only activity
      if (sErr) {
        console.error("[DailyCalendar] shifts error:", sErr);
      }
      if (cancelled) return;

      // Separately: which days in this window have damage photos? One query, ID-only.
      // We get all UNRESOLVED damage photos created in the window, then
      // map their task → shift → date. Resolved damage doesn't contribute
      // to the red dot on the calendar.
      const { data: damagePhotos } = await supabase
        .from("photos")
        .select(
          "kind, task_id, resolved_at, tasks!inner(shift_id, work_block_id, shifts(start_time), work_blocks(shift_id, shifts(start_time)))",
        )
        .in("kind", FLAG_KINDS)
        .is("resolved_at", null);
      if (cancelled) return;

      // Build a set of date keys that have at least one damage photo
      const damageDays = new Set();
      const cannotDays = new Set();
      (damagePhotos || []).forEach((p) => {
        const startTime =
          p.tasks?.shifts?.start_time ||
          p.tasks?.work_blocks?.shifts?.start_time;
        if (!startTime) return;
        const key = toDateKey(new Date(startTime));
        if (p.kind === KIND_CANNOT) cannotDays.add(key);
        else damageDays.add(key);
      });

      // Build per-day counts from shifts alone
      const map = {};
      (shifts || []).forEach((s) => {
        const key = toDateKey(new Date(s.start_time));
        if (!map[key]) map[key] = { shiftCount: 0, properties: new Set() };
        map[key].shiftCount++;
        if (s.customer_id) map[key].properties.add(s.customer_id);
      });

      const final = {};
      Object.entries(map).forEach(([k, v]) => {
        final[k] = {
          shiftCount: v.shiftCount,
          propertyCount: v.properties.size,
          hasDamage: damageDays.has(k),
          hasCannot: cannotDays.has(k),
        };
      });
      if (cancelled) return;
      setActivity(final);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [viewMonth]);

  // Build the calendar grid
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDay.getDay(); // 0 = Sunday

  const cells = [];
  // Leading blanks
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ day: d, key: toDateKey(date), date });
  }
  // Trailing blanks to fill last row
  while (cells.length % 7 !== 0) cells.push(null);

  const monthName = viewMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const todayKey = toDateKey(today);

  const goPrev = () => setViewMonth(new Date(year, month - 1, 1));
  const goNext = () => setViewMonth(new Date(year, month + 1, 1));
  const goToday = () =>
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));

  return (
    <div className="pb-24">
      <ScreenId id="OW-DAILY" />
      <Header
        name={employee.name}
        onSignOut={onSignOut}
        role={employee.role}
        employee={employee}
        onOpenMessages={onOpenMessages}
        onLogoClick={onLogoClick}
        onOpenWhosHere={() => setWhosWhereOpen(true)}
        onNotificationNavigate={(n) => {
          // PM assignment / recheck notifications open the review screen where
          // the owner approves or denies. Other kinds just dismiss.
          if (
            n?.kind === "pm_assignment" ||
            n?.kind === "recheck" ||
            n?.link_kind === "assignment"
          ) {
            onOpenInbox && onOpenInbox();
          }
        }}
        menuItems={[
          ...(onOpenAssignedVsCleaned
            ? [
                {
                  icon: <Eye size={18} />,
                  label: "Assigned vs cleaned",
                  onClick: onOpenAssignedVsCleaned,
                },
              ]
            : []),
          ...(betaEnabled
            ? [
                {
                  icon: <Clock size={18} />,
                  label: "Activity timeline",
                  onClick: () => setShowActivityTimeline(true),
                },
              ]
            : []),
          {
            icon: <Languages size={18} />,
            label: "Label overrides",
            onClick: () => setShowOverrides(true),
          },
          {
            icon: <ClipboardList size={18} />,
            label: "Supply checklist",
            onClick: () => setShowSupplyChecklist(true),
          },
        ]}
      />
      <div className="px-5 pt-6">
        {/* The inbox banner was removed — PM assignments now surface in the
           header notification bell. Tapping a bell item opens the same
           review screen (InboxView) to approve/deny. */}
        {/* "Who's working now" moved to the person icon in the header.
           The three occasional tools (Assigned vs cleaned, Activity
           timeline, Label overrides) moved into the header ⋯ menu — see
           the menuItems passed to <Header> above. This keeps the home
           focused on the inbox + the calendar. */}
        <div className="flex items-center justify-between mb-3 mt-1">
          <div className="text-xs uppercase tracking-widest text-stone-400 font-mono">
            Daily browser
          </div>
        </div>

        {/* Month navigator */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goPrev}
            className="p-2 rounded-full bg-stone-100 hover:bg-stone-200 active:scale-95 transition-all"
          >
            <ChevronLeft size={18} className="text-stone-700" />
          </button>
          <div className="text-center">
            <div className="font-serif text-xl text-stone-900">{monthName}</div>
            <button
              onClick={goToday}
              className="text-xs font-mono text-amber-700 hover:text-amber-800 mt-0.5"
            >
              Jump to today
            </button>
          </div>
          <button
            onClick={goNext}
            className="p-2 rounded-full bg-stone-100 hover:bg-stone-200 active:scale-95 transition-all"
          >
            <ChevronRight size={18} className="text-stone-700" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div
              key={i}
              className="text-center text-[10px] font-mono uppercase tracking-wider text-stone-400 py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) return <div key={i} />;
            const a = activity[cell.key];
            const isToday = cell.key === todayKey;
            const isFuture = cell.date > today;
            return (
              <button
                key={i}
                disabled={!a}
                onClick={() => a && onPickDay(cell.key)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm relative transition-all ${
                  !a
                    ? isFuture
                      ? "text-stone-300"
                      : "text-stone-400 hover:bg-stone-50"
                    : a.hasDamage
                      ? "bg-red-50 border-2 border-red-300 text-red-900 hover:border-red-500 active:scale-95"
                      : a.hasCannot
                        ? "bg-yellow-50 border-2 border-yellow-400 text-yellow-900 hover:border-yellow-600 active:scale-95"
                        : "bg-amber-50 border-2 border-amber-300 text-amber-900 hover:border-amber-500 active:scale-95"
                } ${isToday ? "ring-2 ring-stone-900 ring-offset-1" : ""}`}
              >
                <div className={`font-mono ${a ? "font-bold" : ""}`}>
                  {cell.day}
                </div>
                {a && (
                  <div className="text-[9px] font-mono mt-0.5 leading-none">
                    {a.shiftCount} {a.shiftCount === 1 ? "shift" : "shifts"}
                  </div>
                )}
                {a?.hasDamage && (
                  <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
                {a?.hasCannot && (
                  <div
                    className={`absolute top-0.5 ${a?.hasDamage ? "right-2.5" : "right-0.5"} w-1.5 h-1.5 rounded-full bg-yellow-500`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-stone-500 font-mono">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-50 border-2 border-amber-300" />
            Cleaned
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-50 border-2 border-red-300" />
            Damage
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded ring-2 ring-stone-900" />
            Today
          </div>
        </div>

        {!loaded && (
          <div className="text-center mt-6 text-xs text-stone-400 font-mono">
            Loading…
          </div>
        )}
        {loaded && Object.keys(activity).length === 0 && (
          <div className="mt-6 text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No cleanings recorded this month.
          </div>
        )}
      </div>
      {showOverrides && (
        <TranslationOverridesModal
          employee={employee}
          onClose={() => setShowOverrides(false)}
        />
      )}
      {showSupplyChecklist && (
        <SupplyChecklistManager onClose={() => setShowSupplyChecklist(false)} />
      )}
      {showActivityTimeline && (
        <ActivityTimelineView
          employee={employee}
          onClose={() => setShowActivityTimeline(false)}
        />
      )}
      {/* Who's-where modal — opened from the header person icon. Reuses
         the all-properties live panel that used to sit on the home. */}
      {whosWhereOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setWhosWhereOpen(false)}
        >
          <div
            className="bg-stone-50 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 sticky top-0 bg-stone-50 z-10">
              <div className="font-serif text-lg text-stone-900">
                Who's where right now
              </div>
              <button
                onClick={() => setWhosWhereOpen(false)}
                className="p-2 rounded-full hover:bg-stone-200 active:scale-95 transition-transform"
              >
                <X size={18} className="text-stone-600" />
              </button>
            </div>
            <div className="p-4">
              <WhosWherePanel employee={employee} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
