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
import { buildTargetTitle, unitSizeLabel, shortenBedroom, partyDisplay, unitPartyLabel } from "../../../../lib/labels.js";
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

export function QuickAddPortalUserModal({ defaultKind = "pm", onClose, onCreated }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState(defaultKind);
  const [code, setCode] = useState(generatePortalUserCode());
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    if (!name.trim()) {
      setError("Please enter a name.");
      return;
    }
    const cleanCode = code.trim().toLowerCase();
    if (
      cleanCode.length < 6 ||
      !/[a-z]/i.test(cleanCode) ||
      !/\d/.test(cleanCode) ||
      !/^[a-z0-9]+$/i.test(cleanCode)
    ) {
      setError("Code must be at least 6 characters with letters and numbers.");
      return;
    }
    setBusy(true);
    // Check uniqueness
    const { data: dupe } = await supabase
      .from("portal_users")
      .select("id")
      .eq("code", cleanCode)
      .maybeSingle();
    if (dupe) {
      setBusy(false);
      setError("That code is already in use — pick a different one.");
      return;
    }
    const { data, error: e } = await supabase
      .from("portal_users")
      .insert({
        name: name.trim(),
        code: cleanCode,
        kind,
        phone: phone.trim() || null,
        active: true,
      })
      .select()
      .single();
    if (!e && data?.id) await secureSetCredential("portal", data.id, cleanCode);
    setBusy(false);
    if (e) {
      setError("Could not save: " + e.message);
      return;
    }
    onCreated(data);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              Quick add
            </div>
            <div className="font-serif text-lg text-stone-900">
              New portal user
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-2 rounded-full hover:bg-stone-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-1.5 block">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Jenkins"
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-1.5 block">
              Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "pm", label: "Manager" },
                { id: "property_owner", label: "Owner" },
                { id: "pm_staff", label: "PM Staff" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setKind(opt.id)}
                  className={`py-2 px-2 rounded-xl border-2 text-xs font-medium transition-all ${kind === opt.id ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-200 bg-white text-stone-700"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-1.5 block">
              Portal code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toLowerCase())}
                className="flex-1 px-3 py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setCode(generatePortalUserCode())}
                className="px-3 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-mono"
              >
                Generate
              </button>
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              This is how they'll sign in.
            </p>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-1.5 block">
              Phone (optional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="For future SMS notifications"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 text-sm"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />{" "}
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={busy}
              className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-700 font-medium text-sm hover:bg-stone-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy || !name.trim()}
              className="flex-1 py-3 rounded-xl bg-stone-900 text-stone-50 font-medium text-sm disabled:opacity-50"
            >
              {busy ? "Saving…" : "Create & check"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
