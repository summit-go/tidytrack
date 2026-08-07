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

export function AdjustmentModal({ shift, busy, onSave, onClose }) {
  const cur = shift.manual_adjustment_seconds || 0;
  const sign = cur >= 0 ? "+" : "−";
  const [direction, setDirection] = useState(cur >= 0 ? "add" : "subtract");
  const [minutes, setMinutes] = useState(
    String(Math.abs(Math.round(cur / 60))),
  );
  const [notes, setNotes] = useState(shift.adjustment_notes || "");

  const handleSave = () => {
    const mins = parseInt(minutes || "0", 10);
    if (isNaN(mins) || mins < 0) {
      alert("Minutes must be 0 or a positive number.");
      return;
    }
    const seconds = (direction === "add" ? 1 : -1) * mins * 60;
    onSave(seconds, notes.trim());
    onClose();
  };

  const totalMs =
    (shift.end_time ? new Date(shift.end_time) : new Date()) -
    new Date(shift.start_time);
  const idleSec = shift.idle_seconds || 0;
  const newAdjSec =
    (direction === "add" ? 1 : -1) * (parseInt(minutes || "0", 10) || 0) * 60;
  const previewBillableMs = Math.max(
    0,
    totalMs - idleSec * 1000 + newAdjSec * 1000,
  );

  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              Shift adjustment
            </div>
            <div className="font-serif text-xl text-stone-900">
              Adjust billable time
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-100"
          >
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="p-3 rounded-xl bg-stone-100 text-sm text-stone-600">
            Use this to add or subtract billable time. For example, if a cleaner
            forgot to clock out for lunch, subtract 30 min. If they did extra
            work after clocking out, add it back.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDirection("add")}
              className={`py-3 rounded-xl border-2 text-sm font-medium ${direction === "add" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-white text-stone-600"}`}
            >
              + Add time
            </button>
            <button
              onClick={() => setDirection("subtract")}
              className={`py-3 rounded-xl border-2 text-sm font-medium ${direction === "subtract" ? "border-red-500 bg-red-50 text-red-700" : "border-stone-200 bg-white text-stone-600"}`}
            >
              − Remove time
            </button>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-1 block">
              Minutes
            </label>
            <input
              type="number"
              min="0"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              style={{ fontSize: 16 }}
              className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white font-mono"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-1 block">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Reason for adjustment…"
              style={{ fontSize: 16 }}
              className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-sm resize-none"
            />
          </div>
          <div className="p-3 rounded-xl bg-stone-900 text-stone-50 font-mono text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-stone-400">Clocked in</span>
              <span>{fmtTimeShort(totalMs)}</span>
            </div>
            {idleSec > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-400">− Idle</span>
                <span>{fmtTimeShort(idleSec * 1000)}</span>
              </div>
            )}
            {newAdjSec !== 0 && (
              <div className="flex justify-between">
                <span className="text-stone-400">
                  {newAdjSec >= 0 ? "+" : "−"} Adjustment
                </span>
                <span>{fmtTimeShort(Math.abs(newAdjSec) * 1000)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-stone-700 pt-1.5">
              <span className="text-amber-400">= Billable</span>
              <span>{fmtTimeShort(previewBillableMs)}</span>
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-stone-200 flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-3 rounded-2xl bg-stone-100 text-stone-700 font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex-1 py-3 rounded-2xl bg-stone-900 text-stone-50 font-medium disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
