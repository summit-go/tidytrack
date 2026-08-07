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

export function WhosWorkingNowModal({ employee, onClose }) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useTick(true);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const cutoffMs = Date.now() - STALE_FORCE_MIN * 60 * 1000;
      const [blocksRes, shiftsRes] = await Promise.all([
        supabase
          .from("work_blocks")
          .select(
            "id, start_time, unit:units(label), party:parties(label), shift:shifts!inner(id, is_preview, employee:employees(id, name), customer:customers(id, name))",
          )
          .is("end_time", null)
          .order("start_time", { ascending: true }),
        supabase
          .from("shifts")
          .select(
            "id, start_time, is_preview, employee:employees(id, name), customer:customers(id, name)",
          )
          .is("end_time", null),
      ]);
      const blocks = (blocksRes.data || []).filter((b) => !b.shift?.is_preview);
      const blockedShiftIds = new Set(
        blocks.map((b) => b.shift?.id).filter(Boolean),
      );
      const standby = (shiftsRes.data || []).filter(
        (s) => !s.is_preview && !blockedShiftIds.has(s.id),
      );
      const out = [
        ...blocks
          .filter((b) => new Date(b.start_time).getTime() > cutoffMs)
          .map((b) => ({
            kind: "block",
            id: b.id,
            cleanerName: b.shift?.employee?.name || "?",
            isMe: b.shift?.employee?.id === employee?.id,
            propertyName: b.shift?.customer?.name || "",
            where: unitPartyLabel(b.unit?.label, b.party?.label),
            startTime: b.start_time,
          })),
        ...standby
          .filter((s) => new Date(s.start_time).getTime() > cutoffMs)
          .map((s) => ({
            kind: "standby",
            id: s.id,
            cleanerName: s.employee?.name || "?",
            isMe: s.employee?.id === employee?.id,
            propertyName: s.customer?.name || "",
            where: "",
            startTime: s.start_time,
          })),
      ];
      if (!cancelled) {
        setRows(out);
        setLoaded(true);
      }
    };
    load();
    const iv = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [employee?.id]);

  const working = rows.filter((r) => r.kind === "block");
  const standby = rows.filter((r) => r.kind === "standby");
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
              Right now
            </div>
            <div className="font-serif text-lg text-stone-900">
              Who's working
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-100 flex-shrink-0"
          >
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!loaded ? (
            <div className="text-center py-8 text-stone-400 text-sm">
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-stone-400 text-sm">
              Nobody's on the clock right now.
            </div>
          ) : (
            <>
              {working.map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-2xl bg-white border border-stone-200"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-stone-900 truncate">
                        {r.cleanerName}
                        {r.isMe && (
                          <span className="ml-1.5 text-[10px] font-mono text-stone-400">
                            (you)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-stone-500 font-mono truncate">
                        {r.propertyName}
                        {r.where ? ` · ${r.where}` : ""}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-mono text-emerald-700">
                        {fmtTimeShort(
                          Date.now() - new Date(r.startTime).getTime(),
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-stone-400">
                        since {fmtClock(r.startTime)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {standby.length > 0 && (
                <div className="text-[10px] uppercase tracking-wider font-mono text-stone-400 pt-2">
                  Clocked in, not started
                </div>
              )}
              {standby.map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-2xl bg-stone-100 border border-stone-200"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-stone-700 truncate">
                        {r.cleanerName}
                        {r.isMe && (
                          <span className="ml-1.5 text-[10px] font-mono text-stone-400">
                            (you)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-stone-500 font-mono truncate">
                        {r.propertyName || "No property"}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-stone-400 flex-shrink-0">
                      since {fmtClock(r.startTime)}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
