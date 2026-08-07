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
import { can, canSeeMoney, isLead, isOwner, visibleProps } from "../../../lib/permissions.js";
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

export function LiveCleanersSheet({ viewer, onClose, onOpenShift }) {
  const [shifts, setShifts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const canForceOut =
    viewer && (isLead(viewer));

  const loadFn = async () => {
    const { data } = await supabase
      .from("shifts")
      .select(
        "*, employee:employees(id, name), customer:customers(id, name), work_blocks(id, start_time, end_time, unit:units(label), party:parties(label))",
      )
      .is("end_time", null)
      .eq("is_preview", false) // Don't show preview shifts as on-the-clock
      .order("start_time", { ascending: true });
    setShifts(data || []);
    setLoaded(true);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (cancelled) return;
      await loadFn();
    };
    load();
    // Refresh every 30s while visible (was 15s, always-on). Pauses when hidden.
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useTick(true);

  // Force-end someone's shift. Ends any open work block first, then
  // closes the shift. Confirmed because it's irreversible without a
  // manual reopen.
  const forceClockOut = async (s) => {
    if (
      !confirm(
        `Force clock out ${s.employee?.name || "this cleaner"}? Any active work block will end now.`,
      )
    )
      return;
    setBusyId(s.id);
    try {
      const activeBlock = (s.work_blocks || []).find((b) => !b.end_time);
      if (activeBlock) {
        await supabase
          .from("work_blocks")
          .update({ end_time: new Date().toISOString() })
          .eq("id", activeBlock.id);
      }
      await supabase
        .from("shifts")
        .update({ end_time: new Date().toISOString() })
        .eq("id", s.id);
      await loadFn();
    } catch (e) {
      alert("Could not clock out: " + (e.message || e));
    }
    setBusyId(null);
  };

  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              Live
            </div>
            <div className="font-serif text-xl text-stone-900">
              On the clock right now
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-100"
          >
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {!loaded ? (
            <div className="text-center py-12 text-stone-400 text-sm">
              Loading…
            </div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              Nobody on the clock right now.
            </div>
          ) : (
            <div className="space-y-2">
              {shifts.map((s) => {
                const shiftDur = Date.now() - new Date(s.start_time).getTime();
                // Find current active work block (no end_time)
                const activeBlock = (s.work_blocks || []).find(
                  (b) => !b.end_time,
                );
                const blockDur = activeBlock
                  ? Date.now() - new Date(activeBlock.start_time).getTime()
                  : 0;
                const completedBlocks = (s.work_blocks || []).filter(
                  (b) => b.end_time,
                ).length;
                const isBusy = busyId === s.id;
                return (
                  <div
                    key={s.id}
                    className="w-full text-left p-4 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <button
                        onClick={() => onOpenShift(s)}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left"
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                        <span className="font-serif text-lg text-stone-900 truncate">
                          {s.employee?.name}
                        </span>
                      </button>
                      <span className="text-xs font-mono text-stone-500 flex-shrink-0">
                        {fmtTimeShort(shiftDur)}
                      </span>
                    </div>
                    {s.customer && (
                      <div className="text-xs text-amber-700 font-mono mb-1 flex items-center gap-1.5">
                        <Building2 size={11} /> {s.customer.name}
                      </div>
                    )}
                    {activeBlock ? (
                      <div className="text-xs text-stone-700 font-mono flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] uppercase tracking-wider">
                          Cleaning
                        </span>
                        <span>
                          {activeBlock.unit?.label}
                          {activeBlock.party?.label &&
                            ` · ${activeBlock.party.label}`}
                        </span>
                        <span className="text-stone-500">
                          · {fmtTimeShort(blockDur)}
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs text-stone-500 font-mono">
                        At property
                        {completedBlocks > 0 &&
                          ` · ${completedBlocks} ${completedBlocks === 1 ? "apt cleaned" : "apts cleaned"}`}
                      </div>
                    )}
                    {/* Owner/manager action bar — force clock-out + open shift detail */}
                    {canForceOut && (
                      <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => onOpenShift(s)}
                          className="text-[10px] uppercase tracking-wider font-mono text-stone-600 hover:text-stone-900 flex items-center gap-1"
                        >
                          Open shift <ChevronRight size={10} />
                        </button>
                        <button
                          onClick={() => forceClockOut(s)}
                          disabled={isBusy}
                          className="h-9 px-3 rounded-lg border border-red-200 hover:bg-red-50 text-red-700 text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                        >
                          {isBusy ? (
                            <div className="w-3 h-3 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <LogOut size={12} />
                          )}
                          Force clock out
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-3 text-center text-[10px] font-mono text-stone-400 border-t border-stone-200">
          Auto-refreshes every 15 seconds · tap a cleaner to see their shift
        </div>
      </div>
    </div>
  );
}
