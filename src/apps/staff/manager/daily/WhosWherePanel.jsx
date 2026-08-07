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
  BUILD_TAG,
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
import { buildTargetTitle, unitSizeLabel, shortenBedroom } from "../../../../lib/labels.js";
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

export function WhosWherePanel({ employee }) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // useTick so the elapsed timer updates live.
  useTick(true);

  // Two-tier auto-close:
  //   1) SOFT — shifts with last_activity_at older than 90 min get
  //      end_time = last_activity_at. Cleaner gets credit only for
  //      time they were actually active in the app.
  //   2) HARD — anything still open with start_time older than 120 min
  //      gets end_time = NOW. Catches sessions where last_activity_at
  //      is null or somehow missed the soft pass.
  // Work blocks: no last_activity_at column on that table, so we
  // hard-close them at 120 min from start. A workblock open longer
  // than 2 hours is almost certainly stale (a real bedroom clean
  // rarely exceeds that).
  const cleanupStale = async () => {
    const now = Date.now();
    const idleCutoffISO = new Date(
      now - STALE_IDLE_MIN * 60 * 1000,
    ).toISOString();
    const forceCutoffISO = new Date(
      now - STALE_FORCE_MIN * 60 * 1000,
    ).toISOString();
    try {
      // 1. Soft auto-clockout — pull shifts past the idle cutoff and
      //    set end_time per-row to their last_activity_at. We can't
      //    do this in a single UPDATE (Supabase JS doesn't support
      //    column-to-column updates) so we fetch then patch.
      const { data: idleShifts } = await supabase
        .from("shifts")
        .select("id, last_activity_at, start_time")
        .is("end_time", null)
        .not("last_activity_at", "is", null)
        .lt("last_activity_at", idleCutoffISO);
      for (const s of idleShifts || []) {
        const endTime = s.last_activity_at || s.start_time;
        await supabase
          .from("shifts")
          .update({ end_time: endTime })
          .eq("id", s.id);
        // Also close any open work_block belonging to this shift, with
        // the same end_time so timing stays consistent.
        await supabase
          .from("work_blocks")
          .update({ end_time: endTime })
          .eq("shift_id", s.id)
          .is("end_time", null);
      }
      // 2. Hard force close — catch-all for anything still open beyond
      //    the 2-hour cutoff (e.g. shift with no last_activity_at, or
      //    a work_block whose parent shift is somehow already closed).
      await supabase
        .from("shifts")
        .update({ end_time: new Date().toISOString() })
        .is("end_time", null)
        .lt("start_time", forceCutoffISO);
      await supabase
        .from("work_blocks")
        .update({ end_time: new Date().toISOString() })
        .is("end_time", null)
        .lt("start_time", forceCutoffISO);
    } catch (e) {
      console.warn("[whos-where] stale cleanup failed:", e);
    }
  };

  const load = async () => {
    // Run cleanup first so the next two queries only return live rows.
    await cleanupStale();
    // Defensive client-side cutoff using the hard threshold — even if
    // cleanup failed, we never show a session "active" beyond
    // STALE_FORCE_MIN.
    const cutoffMs = Date.now() - STALE_FORCE_MIN * 60 * 1000;
    // Open work_blocks property-wide. Pull cleaner + property +
    // unit/party labels in one shot via embeds so we don't fan out
    // queries per block.
    const { data: blocks } = await supabase
      .from("work_blocks")
      .select(
        "id, start_time, unit_id, party_id, unit:units(label), party:parties(label), shift:shifts!inner(id, customer_id, employee:employees(id, name), customer:customers(id, name))",
      )
      .is("end_time", null)
      .order("start_time", { ascending: true });
    // Also pull cleaners who are clocked in but not yet at a bedroom
    // (active shift, no open work_block). Helpful for the owner to
    // see "Maria is at the property but hasn't started a bedroom yet."
    const { data: shifts } = await supabase
      .from("shifts")
      .select(
        "id, start_time, customer_id, employee:employees(id, name), customer:customers(id, name)",
      )
      .is("end_time", null);
    const blockedShiftIds = new Set(
      (blocks || []).map((b) => b.shift?.id).filter(Boolean),
    );
    const standby = (shifts || []).filter((s) => !blockedShiftIds.has(s.id));
    setRows([
      ...(blocks || [])
        .filter((b) => new Date(b.start_time).getTime() > cutoffMs)
        .map((b) => ({
          kind: "block",
          id: b.id,
          cleanerName: b.shift?.employee?.name || "?",
          propertyName: b.shift?.customer?.name || "",
          unitLabel: b.unit?.label,
          partyLabel: b.party?.label,
          startTime: b.start_time,
        })),
      ...standby
        .filter((s) => new Date(s.start_time).getTime() > cutoffMs)
        .map((s) => ({
          kind: "standby",
          id: s.id,
          cleanerName: s.employee?.name || "?",
          propertyName: s.customer?.name || "",
          startTime: s.start_time,
        })),
    ]);
    setLoaded(true);
  };
  useEffect(() => {
    load();
    const iv = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (!loaded) return null;
  const activeCount = rows.filter((r) => r.kind === "block").length;
  const standbyCount = rows.filter((r) => r.kind === "standby").length;
  return (
    <div className="mb-5 rounded-2xl bg-white border border-stone-200 overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors"
      >
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
        <div className="text-left flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500">
            Who's working right now
          </div>
          <div className="text-sm text-stone-900 font-medium">
            {activeCount > 0 ? (
              <>
                {activeCount} {activeCount === 1 ? "cleaner" : "cleaners"} in
                bedrooms
              </>
            ) : (
              <span className="text-stone-500">No one on the clock</span>
            )}
            {standbyCount > 0 && (
              <span className="text-stone-500">
                {" "}
                · {standbyCount} on standby
              </span>
            )}
          </div>
        </div>
        <ChevronRight
          size={16}
          className={`text-stone-400 flex-shrink-0 transition-transform ${collapsed ? "" : "rotate-90"}`}
        />
      </button>
      {!collapsed && rows.length > 0 && (
        <div className="border-t border-stone-100 divide-y divide-stone-100">
          {rows.map((r) => {
            const elapsed = Date.now() - new Date(r.startTime).getTime();
            return (
              <div
                key={`${r.kind}:${r.id}`}
                className="px-4 py-2.5 flex items-center gap-3"
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.kind === "block" ? "bg-emerald-500" : "bg-stone-400"}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-stone-900">
                    <span className="font-bold">{r.cleanerName}</span>
                    {r.kind === "block" ? (
                      <>
                        <span className="text-stone-400"> · </span>
                        <span className="text-stone-700">{r.propertyName}</span>
                        {r.unitLabel && (
                          <>
                            <span className="text-stone-400"> · </span>
                            <span className="font-mono text-xs text-stone-700">
                              {r.unitLabel}
                            </span>
                          </>
                        )}
                        {r.partyLabel && (
                          <>
                            <span className="text-stone-400"> · </span>
                            <span className="italic text-amber-700">
                              {r.partyLabel}
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-stone-400"> · </span>
                        <span className="text-stone-700">{r.propertyName}</span>
                        <span className="text-stone-400"> · </span>
                        <span className="text-stone-500 text-xs">
                          on standby
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-[11px] font-mono text-stone-500 flex-shrink-0">
                  {fmtTimeShort(elapsed)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
