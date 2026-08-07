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
import { isPmApprovedAssignment } from "../../../lib/assignments.js";
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
import { AssignmentViewer } from "../cross-cutting/AssignmentViewer.jsx";
import { DayPhotoTabs } from "./DayPhotoTabs.jsx";

export function BedroomHistoryView({
  propertyId,
  propertyName,
  unitId,
  unitLabel,
  partyId,
  partyLabel,
  employee,
  onBack,
}) {
  const isStaff = employee?.role === "owner" || employee?.role === "manager";
  const [data, setData] = useState({ days: [], loading: true });
  const [openedAssignment, setOpenedAssignment] = useState(null);
  // Pull a wide window in one query so the date pills can show
  // which days have work. The user picks ONE day to focus on
  // (default: today). Cleaners are capped at 180 days.
  const WINDOW_DAYS = isStaff ? 365 : 180;
  // selectedDay = null → "all days in window"
  //            = 'today' → today only
  //            = 'YYYY-MM-DD' → that specific date
  const todayKey = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  })();
  const [selectedDay, setSelectedDay] = useState("today");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setData((d) => ({ ...d, loading: true }));
      // Load the full window in one go. The "selected day" is a
      // display filter only; we want the pill row to show every day
      // that has activity so the cleaner can browse between them.
      const since = new Date();
      since.setDate(since.getDate() - WINDOW_DAYS);
      since.setHours(0, 0, 0, 0);
      const sinceISO = since.toISOString();

      // Fetch work blocks at this bedroom in the window. We pull the
      // shift owner (the cleaner who started the block) PLUS the
      // multi-cleaner participants table so a shared block lists every
      // helper, not just whoever opened it first.
      //
      // Photos include both active AND soft-deleted ones so the
      // history can surface deletion audit. We resolve names for both
      // the taker AND deleter via two FK aliases.
      let blocksQ = supabase
        .from("work_blocks")
        .select(
          `
          *, shift:shifts!inner(id, customer_id, employee:employees(id, name)),
          tasks(*, photos(*, taken_by_employee:employees!taken_by(name), deleted_by_employee:employees!deleted_by(name))),
          participants:work_block_participants(id, joined_at, left_at, employee:employees(id, name))
        `,
        )
        .eq("unit_id", unitId)
        .eq("party_id", partyId)
        .order("start_time", { ascending: false });
      if (sinceISO) blocksQ = blocksQ.gte("start_time", sinceISO);
      const { data: blocksRaw } = await blocksQ;
      const blocks = (blocksRaw || []).filter(
        (b) => b.shift?.customer_id === propertyId,
      );

      // Fetch assignment_targets at this bedroom (and property-wide) in the window
      let targetsQ = supabase
        .from("assignment_targets")
        .select(
          "*, assignment:assignments!inner(id, title, notes, file_url, file_kind, customer_id, active, source, pm_status, deleted_at, assignment_type, scheduled_date, created_at)",
        )
        .or(
          `and(unit_id.eq.${unitId},party_id.eq.${partyId}),and(unit_id.is.null,party_id.is.null)`,
        )
        .order("created_at", { ascending: false });
      const { data: targetsRaw } = await targetsQ;
      const targets = (targetsRaw || [])
        .filter(
          (t) =>
            t.assignment?.customer_id === propertyId &&
            t.assignment?.active &&
            !t.assignment?.deleted_at &&
            isPmApprovedAssignment(t.assignment),
        )
        .filter((t) => {
          if (!sinceISO) return true;
          const dateStr =
            t.assignment?.scheduled_date || t.assignment?.created_at;
          return !dateStr || dateStr >= sinceISO.slice(0, 10);
        });

      if (cancelled) return;

      // Group by local date key (YYYY-MM-DD)
      const dayMap = new Map();
      const ensureDay = (key) => {
        if (!dayMap.has(key)) {
          dayMap.set(key, {
            key,
            blocks: [],
            targets: [],
            photos: [],
            totalMs: 0,
          });
        }
        return dayMap.get(key);
      };

      blocks.forEach((b) => {
        const d = new Date(b.start_time);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const day = ensureDay(key);
        day.blocks.push(b);
        const dur =
          (b.end_time ? new Date(b.end_time) : new Date()) -
          new Date(b.start_time);
        day.totalMs += dur;
        // Flatten photos — split active vs deleted. Active photos go
        // into the visible strip; deleted ones go into a separate
        // audit list rendered for owners/managers only. Photo taker
        // preferred from join, falls back to shift owner for legacy.
        (b.tasks || []).forEach((t) => {
          (t.photos || []).forEach((p) => {
            const takerName =
              p.taken_by_employee?.name || b.shift?.employee?.name || "Cleaner";
            if (p.deleted_at) {
              day.deletedPhotos = day.deletedPhotos || [];
              day.deletedPhotos.push({
                ...p,
                taskName: t.name,
                cleanerName: takerName,
                deletedByName: p.deleted_by_employee?.name || "someone",
              });
            } else {
              day.photos.push({
                ...p,
                taskName: t.name,
                cleanerName: takerName,
              });
            }
          });
        });
      });

      targets.forEach((t) => {
        const dateStr =
          t.assignment?.scheduled_date ||
          t.assignment?.created_at?.slice(0, 10);
        if (!dateStr) return;
        const day = ensureDay(dateStr);
        day.targets.push(t);
      });

      const days = Array.from(dayMap.values()).sort((a, b) =>
        b.key.localeCompare(a.key),
      );
      setData({ days, loading: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId, unitId, partyId, WINDOW_DAYS, isStaff]);

  return (
    <div className="fixed inset-0 z-40 bg-stone-50 overflow-y-auto">
      <ScreenId id="OW-BR-HIST" />
      <div className="pb-24 min-h-screen">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200 bg-white sticky top-0 z-10">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-full hover:bg-stone-100"
          >
            <ArrowLeft size={20} className="text-stone-700" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono truncate">
              {propertyName}
            </div>
            <h1 className="font-serif text-2xl text-stone-900 truncate">
              {unitLabel}
              {partyLabel && (
                <span className="italic text-amber-700"> · {partyLabel}</span>
              )}
            </h1>
            <div className="text-xs text-stone-500 mt-0.5">Bedroom history</div>
          </div>
        </div>

        <div className="px-5 pt-4">
          {(() => {
            // Build a pill set: Today + every day that has activity
            // (work blocks OR targets) within the window. Days are
            // sorted newest-first. The first pill is always "Today"
            // (highlighted as default). If today itself has activity
            // it's not duplicated.
            const dayKeys = data.days.map((d) => d.key);
            const set = new Set(dayKeys);
            set.add(todayKey);
            const allKeys = Array.from(set).sort((a, b) => b.localeCompare(a));
            // Render
            return (
              <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedDay(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-mono whitespace-nowrap ${
                    selectedDay === null
                      ? "bg-stone-900 text-stone-50"
                      : "bg-white border border-stone-200 text-stone-600 hover:border-stone-400"
                  }`}
                >
                  All ({data.days.length})
                </button>
                {allKeys.map((dk) => {
                  const isToday = dk === todayKey;
                  const hasActivity = dayKeys.includes(dk);
                  const dayData = data.days.find((d) => d.key === dk);
                  const count = dayData
                    ? dayData.blocks.length + dayData.targets.length
                    : 0;
                  const active =
                    (selectedDay === "today" && isToday) || selectedDay === dk;
                  const label = isToday
                    ? "Today"
                    : (() => {
                        const d = new Date(dk + "T12:00:00");
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        yesterday.setHours(0, 0, 0, 0);
                        const yKey = yesterday.toISOString().slice(0, 10);
                        if (dk === yKey) return "Yesterday";
                        return d.toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        });
                      })();
                  return (
                    <button
                      key={dk}
                      onClick={() => setSelectedDay(isToday ? "today" : dk)}
                      className={`px-3 py-1.5 rounded-full text-xs font-mono whitespace-nowrap flex items-center gap-1 ${
                        active
                          ? "bg-stone-900 text-stone-50"
                          : hasActivity
                            ? "bg-white border border-stone-200 text-stone-700 hover:border-stone-400"
                            : "bg-stone-50 border border-stone-200 text-stone-400"
                      }`}
                    >
                      <span>{label}</span>
                      {count > 0 && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full ${active ? "bg-stone-700 text-stone-50" : "bg-stone-200 text-stone-600"}`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
                {/* Pick a specific date — opens native picker. */}
                <label className="px-3 py-1.5 rounded-full text-xs font-mono whitespace-nowrap bg-white border border-stone-200 text-stone-600 flex items-center gap-1 cursor-pointer hover:bg-stone-50">
                  <Calendar size={11} />
                  <span>Pick date</span>
                  <input
                    type="date"
                    max={todayKey}
                    onChange={(e) => {
                      if (e.target.value) setSelectedDay(e.target.value);
                      e.target.value = "";
                    }}
                    className="sr-only"
                  />
                </label>
              </div>
            );
          })()}
          {!isStaff && (
            <div className="text-[11px] text-stone-500 italic mb-3">
              Cleaners can view up to 6 months of history.
            </div>
          )}

          {data.loading ? (
            <div className="text-center py-12 text-stone-400 text-sm">
              Loading history…
            </div>
          ) : (
            (() => {
              // Filter days to the picked one (or show all)
              const days =
                selectedDay === null
                  ? data.days
                  : selectedDay === "today"
                    ? data.days.filter((d) => d.key === todayKey)
                    : data.days.filter((d) => d.key === selectedDay);
              if (days.length === 0) {
                const dayLabel =
                  selectedDay === "today"
                    ? "today"
                    : selectedDay
                      ? new Date(selectedDay + "T12:00:00").toLocaleDateString(
                          [],
                          { month: "long", day: "numeric" },
                        )
                      : "this window";
                return (
                  <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                    No activity for this bedroom on {dayLabel}.
                  </div>
                );
              }
              return (
                <div className="space-y-6">
                  {days.map((day) => (
                    <div key={day.key}>
                      <div className="sticky top-0 bg-stone-50 py-2 z-10 border-b border-stone-200 mb-3">
                        <div className="font-serif text-lg text-stone-900">
                          {fmtDateWithDay(day.key + "T12:00:00")}
                        </div>
                        <div className="text-[11px] text-stone-500 font-mono">
                          {day.blocks.length > 0 &&
                            `${day.blocks.length} work block${day.blocks.length === 1 ? "" : "s"}`}
                          {day.targets.length > 0 &&
                            ` · ${day.targets.length} assignment${day.targets.length === 1 ? "" : "s"}`}
                          {day.totalMs > 0 &&
                            ` · ${fmtTimeShort(day.totalMs)} total`}
                        </div>
                      </div>

                      {day.targets.length > 0 && (
                        <div className="mb-3 space-y-2">
                          {day.targets.map((t) => {
                            const a = t.assignment;
                            return (
                              <div
                                key={t.id}
                                className="p-3 rounded-xl bg-amber-50 border border-amber-200"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                      <span className="text-[10px] uppercase tracking-wider font-mono text-amber-900">
                                        Assignment
                                      </span>
                                      {a.assignment_type && (
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900">
                                          {assignmentTypeLabel(
                                            a.assignment_type,
                                          )}
                                        </span>
                                      )}
                                      <span className="text-[10px] font-mono text-stone-500">
                                        {t.status}
                                      </span>
                                    </div>
                                    <div className="text-sm font-medium text-stone-900 truncate">
                                      {a.title}
                                    </div>
                                    {a.notes && (
                                      <div className="text-xs text-stone-600 mt-1 line-clamp-2">
                                        {a.notes}
                                      </div>
                                    )}
                                  </div>
                                  {a.file_url && (
                                    <button
                                      onClick={() => setOpenedAssignment(t)}
                                      className="px-3 py-1.5 rounded-full bg-stone-900 hover:bg-stone-700 text-stone-50 text-xs font-mono flex items-center gap-1 flex-shrink-0 active:scale-95"
                                    >
                                      {a.file_kind === "pdf" ? (
                                        <FileText size={11} />
                                      ) : (
                                        <ImageIcon size={11} />
                                      )}
                                      View
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {day.blocks.length > 0 && (
                        <div className="space-y-3 mb-3">
                          {day.blocks.map((b) => {
                            const dur =
                              (b.end_time ? new Date(b.end_time) : new Date()) -
                              new Date(b.start_time);
                            // Build the list of cleaners on this block:
                            // start with the shift owner, then merge in
                            // every participant (deduped by id). Single-
                            // cleaner blocks render as before.
                            const cleanerSet = new Map();
                            if (b.shift?.employee?.id)
                              cleanerSet.set(
                                b.shift.employee.id,
                                b.shift.employee.name || "Cleaner",
                              );
                            (b.participants || []).forEach((p) => {
                              if (
                                p.employee?.id &&
                                !cleanerSet.has(p.employee.id)
                              ) {
                                cleanerSet.set(
                                  p.employee.id,
                                  p.employee.name || "Cleaner",
                                );
                              }
                            });
                            const cleaners = Array.from(cleanerSet.values());
                            const cleaner =
                              cleaners.length === 0
                                ? "Cleaner"
                                : cleaners.length === 1
                                  ? cleaners[0]
                                  : cleaners.join(" + ");
                            const isMultiCleaner = cleaners.length > 1;
                            return (
                              <div
                                key={b.id}
                                className="p-3 rounded-xl bg-white border border-stone-200"
                              >
                                <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {isMultiCleaner ? (
                                      <Users
                                        size={13}
                                        className="text-amber-600 flex-shrink-0"
                                      />
                                    ) : (
                                      <User
                                        size={13}
                                        className="text-stone-400 flex-shrink-0"
                                      />
                                    )}
                                    <span
                                      className={`font-medium text-sm truncate ${isMultiCleaner ? "text-amber-900" : "text-stone-900"}`}
                                    >
                                      {cleaner}
                                    </span>
                                    {isMultiCleaner && (
                                      <span className="text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                                        Team
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs font-mono text-stone-500">
                                    {fmtClock(b.start_time)}
                                    {b.end_time &&
                                      ` — ${fmtClock(b.end_time)}`}{" "}
                                    · {fmtTimeShort(dur)}
                                  </div>
                                </div>
                                {b.work_notes && (
                                  <div className="text-xs text-stone-600 italic pl-5 mb-2">
                                    "
                                    <TranslatableText
                                      text={b.work_notes}
                                      targetLang="en"
                                    />
                                    "
                                  </div>
                                )}
                                {b.tasks?.length > 0 && (
                                  <div className="pl-5 space-y-1.5">
                                    {b.tasks.map((t) => (
                                      <div
                                        key={t.id}
                                        className="text-xs text-stone-700 flex items-start gap-1.5"
                                      >
                                        {t.end_time ? (
                                          <Check
                                            size={11}
                                            className="text-emerald-600 mt-0.5 flex-shrink-0"
                                          />
                                        ) : (
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mt-1 flex-shrink-0" />
                                        )}
                                        <span className="flex-1">
                                          <TranslatableText
                                            text={t.name}
                                            targetLang="en"
                                          />
                                        </span>
                                        {t.photos?.length > 0 && (
                                          <span className="text-[10px] font-mono text-stone-400">
                                            {t.photos.length} 📷
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {day.photos.length > 0 && (
                        <DayPhotoTabs photos={day.photos} isStaff={isStaff} />
                      )}
                      {/* Deleted photos audit — visible to owner/manager only.
                   Shows who deleted what and when so accountability is
                   preserved even after the photo is hidden from view. */}
                      {isStaff &&
                        day.deletedPhotos &&
                        day.deletedPhotos.length > 0 && (
                          <div className="mt-3 p-3 rounded-xl bg-stone-100 border border-stone-200">
                            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-2 flex items-center gap-1.5">
                              <Trash2 size={10} /> Deleted photos (
                              {day.deletedPhotos.length})
                            </div>
                            <div className="space-y-1">
                              {day.deletedPhotos.map((p) => (
                                <div
                                  key={p.id}
                                  className="text-[11px] font-mono text-stone-600 flex items-baseline gap-2"
                                >
                                  <span className="text-stone-400">·</span>
                                  <span>
                                    <span className="text-stone-900">
                                      {p.deletedByName}
                                    </span>
                                    <span className="text-stone-500">
                                      {" "}
                                      deleted{" "}
                                    </span>
                                    <span className="text-stone-700">
                                      {p.kind || "a photo"}
                                    </span>
                                    <span className="text-stone-500"> by </span>
                                    <span className="text-stone-900">
                                      {p.cleanerName}
                                    </span>
                                  </span>
                                  <span className="text-stone-400 flex-shrink-0">
                                    {p.deleted_at && fmtClock(p.deleted_at)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>

        {openedAssignment && (
          <AssignmentViewer
            target={openedAssignment}
            employee={employee}
            onClose={() => setOpenedAssignment(null)}
          />
        )}
      </div>
    </div>
  );
}
