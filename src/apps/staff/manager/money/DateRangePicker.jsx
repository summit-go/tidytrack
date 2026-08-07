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
  isoToLocalInput,
  localInputToISO,
  shiftBillableAmount,
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
  readPhotoTakenAt,
  sharePhotos,
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
import {
  buildTargetTitle,
  unitSizeLabel,
  shortenBedroom,
  partyDisplay,
  unitPartyLabel,
  bathroomNumberForBedroom,
} from "../../../../lib/labels.js";
import { resolveItemLabel } from "../../../../lib/pickerLabels.js";
import { generatePortalUserCode } from "../../../../lib/portal.js";
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

export function DateRangePicker({ start, end, onChange }) {
  const [open, setOpen] = useState(false);
  const initDate = start ? new Date(start + "T00:00:00") : new Date();
  const [view, setView] = useState(
    new Date(initDate.getFullYear(), initDate.getMonth(), 1),
  );

  const toIso = (d) => {
    const y = d.getFullYear(),
      m = String(d.getMonth() + 1).padStart(2, "0"),
      day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const fmt = (iso) =>
    iso
      ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "";
  const fmtFull = (iso) =>
    iso
      ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";
  const label =
    start && end
      ? `${fmt(start)} – ${fmtFull(end)}`
      : start
        ? `${fmt(start)} – pick end date`
        : "Pick date range";

  const clickDay = (iso) => {
    if (!start || (start && end)) {
      onChange(iso, "");
      return;
    } // begin a new range
    if (iso < start) {
      onChange(iso, start);
      setOpen(false);
    } // tapped before start → swap
    else {
      onChange(start, iso);
      setOpen(false);
    } // set the end
  };

  const today = new Date();
  const todayIso = toIso(today);
  const thisMonthStart = toIso(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const thisMonthEnd = toIso(
    new Date(today.getFullYear(), today.getMonth() + 1, 0),
  );
  const lastMonthStart = toIso(
    new Date(today.getFullYear(), today.getMonth() - 1, 1),
  );
  const lastMonthEnd = toIso(
    new Date(today.getFullYear(), today.getMonth(), 0),
  );
  const last30 = toIso(new Date(Date.now() - 29 * 86400000));
  const setPreset = (s, e) => {
    onChange(s, e);
    setOpen(false);
  };

  const year = view.getFullYear(),
    month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-left flex items-center justify-between hover:border-stone-400"
      >
        <span
          className={`text-sm ${start ? "text-stone-900" : "text-stone-400"}`}
        >
          {label}
        </span>
        <Calendar size={16} className="text-stone-400" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
          />
          <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-auto bg-white rounded-2xl border border-stone-200 shadow-xl p-3">
            <div className="flex gap-1 mb-3 flex-wrap">
              <button
                onClick={() => setPreset(thisMonthStart, thisMonthEnd)}
                className="text-[11px] px-2 py-1 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200"
              >
                This month
              </button>
              <button
                onClick={() => setPreset(lastMonthStart, lastMonthEnd)}
                className="text-[11px] px-2 py-1 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200"
              >
                Last month
              </button>
              <button
                onClick={() => setPreset(last30, todayIso)}
                className="text-[11px] px-2 py-1 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200"
              >
                Last 30 days
              </button>
            </div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setView(new Date(year, month - 1, 1))}
                className="p-1.5 rounded-lg hover:bg-stone-100"
              >
                <ChevronLeft size={16} className="text-stone-600" />
              </button>
              <span className="text-sm font-medium text-stone-800">
                {view.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button
                onClick={() => setView(new Date(year, month + 1, 1))}
                className="p-1.5 rounded-lg hover:bg-stone-100"
              >
                <ChevronRight size={16} className="text-stone-600" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div
                  key={i}
                  className="text-center text-[10px] font-mono text-stone-400"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const iso = toIso(d);
                const st = iso === start,
                  en = iso === end,
                  rng = start && end && iso > start && iso < end;
                const isToday = iso === todayIso;
                return (
                  <button
                    key={i}
                    onClick={() => clickDay(iso)}
                    className={`h-9 text-xs rounded-lg flex items-center justify-center ${
                      st || en
                        ? "bg-stone-900 text-white font-medium"
                        : rng
                          ? "bg-amber-100 text-amber-900"
                          : isToday
                            ? "text-stone-900 font-bold ring-1 ring-stone-300"
                            : "text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between items-center mt-3 pt-2 border-t border-stone-100">
              <span className="text-[11px] font-mono text-stone-400">
                {start
                  ? end
                    ? `${fmt(start)} – ${fmt(end)}`
                    : `${fmt(start)} – pick end`
                  : "pick a start date"}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-xs px-3 py-1.5 rounded-lg bg-stone-900 text-white"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
