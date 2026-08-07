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

export function WhosHerePopup({
  propertyId,
  myEmployeeId,
  propertyName,
  onClose,
  onJoinBlock,
}) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useTick(true); // tick so timers update

  const load = async () => {
    // Open work_blocks for cleaners on shifts at THIS property.
    // main_section pulled so the popup can show which section each
    // cleaner is working (e.g. "Maria · Bathroom").
    const { data: blocks } = await supabase
      .from("work_blocks")
      .select(
        "id, start_time, main_section, unit:units(label), party:parties(label), shift:shifts!inner(id, customer_id, employee:employees(id, name))",
      )
      .is("end_time", null)
      .order("start_time", { ascending: true });
    // Also include cleaners clocked in at this property without an
    // open work block ("standby" — at property but between bedrooms).
    const { data: shifts } = await supabase
      .from("shifts")
      .select("id, start_time, customer_id, employee:employees(id, name)")
      .is("end_time", null)
      .eq("customer_id", propertyId);
    const propertyBlocks = (blocks || []).filter(
      (b) => b.shift?.customer_id === propertyId,
    );
    const blockedShiftIds = new Set(
      propertyBlocks.map((b) => b.shift?.id).filter(Boolean),
    );
    const standby = (shifts || []).filter((s) => !blockedShiftIds.has(s.id));
    setRows([
      ...propertyBlocks.map((b) => ({
        kind: "block",
        id: b.id,
        employeeId: b.shift?.employee?.id,
        name: b.shift?.employee?.name || "?",
        unitLabel: b.unit?.label,
        partyLabel: b.party?.label,
        mainSection: b.main_section, // 'bedroom' | 'vanity' | 'bathroom' | 'general' | null
        startTime: b.start_time,
      })),
      ...standby.map((s) => ({
        kind: "standby",
        id: s.id,
        employeeId: s.employee?.id,
        name: s.employee?.name || "?",
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
  }, [propertyId]);

  // Exclude self — the cleaner already knows where THEY are
  const others = rows.filter((r) => r.employeeId !== myEmployeeId);
  const inBedrooms = others.filter((r) => r.kind === "block");
  const onStandby = others.filter((r) => r.kind === "standby");

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl flex flex-col max-h-[80vh]"
      >
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              Who's here
            </div>
            <div className="font-serif text-lg text-stone-900 truncate">
              {propertyName}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-100 flex-shrink-0"
          >
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {!loaded ? (
            <div className="text-center py-8 text-stone-400 text-sm">
              Loading…
            </div>
          ) : others.length === 0 ? (
            <div className="text-center py-10 text-stone-400 text-sm">
              You're the only one at this property right now.
            </div>
          ) : (
            <div className="space-y-3">
              {inBedrooms.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1.5">
                    In bedrooms ({inBedrooms.length})
                  </div>
                  <div className="space-y-1.5">
                    {inBedrooms.map((r) => {
                      const elapsed =
                        Date.now() - new Date(r.startTime).getTime();
                      return (
                        <div
                          key={r.id}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-stone-200"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-stone-900">
                              <span className="font-bold">{r.name}</span>
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
                                  <span className="italic text-amber-700 text-xs">
                                    {r.partyLabel}
                                  </span>
                                </>
                              )}
                              {r.mainSection && (
                                <span className="ml-1.5 text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                                  {r.mainSection}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-[11px] font-mono text-stone-500 flex-shrink-0">
                            {fmtTimeShort(elapsed)}
                          </div>
                          {onJoinBlock && (
                            <button
                              onClick={() => {
                                onJoinBlock({ id: r.id });
                                onClose();
                              }}
                              className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded-full bg-stone-900 hover:bg-stone-800 text-stone-50 font-bold flex items-center gap-1 active:scale-95 flex-shrink-0"
                            >
                              <Plus size={10} /> Join
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {onStandby.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1.5">
                    On standby ({onStandby.length})
                  </div>
                  <div className="space-y-1.5">
                    {onStandby.map((r) => {
                      const elapsed =
                        Date.now() - new Date(r.startTime).getTime();
                      return (
                        <div
                          key={r.id}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-stone-200"
                        >
                          <span className="w-2 h-2 rounded-full bg-stone-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-stone-900">
                              <span className="font-bold">{r.name}</span>
                              <span className="text-stone-400"> · </span>
                              <span className="text-stone-500 text-xs">
                                between bedrooms
                              </span>
                            </div>
                          </div>
                          <div className="text-[11px] font-mono text-stone-500 flex-shrink-0">
                            {fmtTimeShort(elapsed)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
