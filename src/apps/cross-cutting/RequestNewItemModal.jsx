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
} from "../../lib/supabase.js";
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
} from "../../lib/constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "../../lib/permissions.js";
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
} from "../../lib/format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "../../lib/compare.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
} from "../../lib/photos.js";
import { sessionStore } from "../../lib/sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "../../lib/translation.js";
import {
  buildTargetTitle,
  unitSizeLabel,
  shortenBedroom,
  partyDisplay,
  unitPartyLabel,
  bathroomNumberForBedroom,
} from "../../lib/labels.js";
import { splitTaskName } from "../../lib/tasks.js";
import { useAssignmentSync } from "../../hooks/useAssignmentSync.js";
import { useIdleDetector } from "../../hooks/useIdleDetector.js";
import { usePagePersistence } from "../../hooks/usePagePersistence.js";
import { useItemLabelOverrides } from "../../hooks/useItemLabelOverrides.js";
import { useTick } from "../../hooks/useTick.js";
import { useUnreadCount } from "../../hooks/useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "../../hooks/useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "../../contexts/LocaleContext.jsx";
import { PreviewContext } from "../../contexts/PreviewContext.jsx";
import { AssignmentTypeChip } from "../../components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "../../components/chips/PriorityChip.jsx";
import { Splash } from "../../components/Splash.jsx";
import { ScreenId } from "../../components/ScreenId.jsx";
import { OwnerOnly } from "../../components/OwnerOnly.jsx";
import { DueDateEditor } from "../../components/DueDateEditor.jsx";
import { ProgressBar } from "../../components/ProgressBar.jsx";
import { CleanerProgressBar } from "../../components/CleanerProgressBar.jsx";
import { ConfirmModal } from "../../components/ConfirmModal.jsx";
import { AddressLink } from "../../components/AddressLink.jsx";
import { TranslatableText } from "../../components/TranslatableText.jsx";
import { PhotoModal } from "../../components/PhotoModal.jsx";
import { NotificationBell } from "../../components/NotificationBell.jsx";
import { Header } from "../../components/Header.jsx";
import { TeamClockIcon } from "../../components/TeamClockIcon.jsx";
import { TabButton } from "../../components/TabButton.jsx";
import { PhotoZoomViewer } from "../../components/PhotoZoomViewer.jsx";
import { TranslateButton } from "../../components/TranslateButton.jsx";
import { ZoomableImage } from "../../components/ZoomableImage.jsx";

export function RequestNewItemModal({ assignment, employee, onClose, onSaved }) {
  const [text, setText] = useState("");
  const [section, setSection] = useState("bedroom");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setErr("Describe what needs cleaning.");
      return;
    }
    if (busy) return;
    setBusy(true);
    setErr("");
    // Pull the assignment's unit/party from any existing target on it
    // so the request lives at the same bedroom.
    const { data: sib } = await supabase
      .from("assignment_targets")
      .select("unit_id, party_id")
      .eq("assignment_id", assignment.id)
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("assignment_targets").insert({
      assignment_id: assignment.id,
      unit_id: sib?.unit_id || null,
      party_id: sib?.party_id || null,
      status: "pending",
      template_section: section,
      // Use a clearly-marked custom item key so it's obvious downstream
      // that this came from a cleaner request and not a template seed.
      template_item_key: `requested:${Date.now()}`,
      status_notes: trimmed,
    });
    setBusy(false);
    if (error) {
      setErr("Could not save: " + error.message);
      return;
    }
    onSaved();
  };
  return (
    <div className="fixed inset-0 bg-stone-900/80 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div>
            <div className="font-serif text-xl text-stone-900">
              Request a new item
            </div>
            <div className="text-xs text-stone-500 font-mono mt-0.5">
              Add a cleaning task not on the sheet
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-100"
          >
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1 block">
              Section
            </label>
            <div className="grid grid-cols-4 gap-1">
              {[
                { id: "bedroom", label: "Bedroom" },
                { id: "vanity", label: "Vanity" },
                { id: "bathroom", label: "Bathroom" },
                { id: "general", label: "General" },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={`py-2 px-2 rounded-lg border-2 text-xs font-medium ${section === s.id ? "border-amber-500 bg-amber-50 text-amber-900" : "border-stone-200 bg-white text-stone-700"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1 block">
              What needs cleaning?
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="e.g. Sticky stain on the ceiling near the vent"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:border-stone-900 resize-none"
            />
          </div>
          {err && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
        </div>
        <div className="p-5 pt-0 flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-700 font-medium text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy || !text.trim()}
            className="flex-1 py-3 rounded-xl bg-stone-900 text-stone-50 font-medium text-sm disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add item"}
          </button>
        </div>
      </div>
    </div>
  );
}
