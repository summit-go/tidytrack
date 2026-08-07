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

export function ChangePortalCodeModal({ portalUser, onClose, onSaved }) {
  const [oldCode, setOldCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const validateCode = (c) => {
    if (c.length < 6) return "Code must be at least 6 characters.";
    if (!/[a-z]/i.test(c)) return "Code must contain at least one letter.";
    if (!/\d/.test(c)) return "Code must contain at least one number.";
    return null;
  };

  const save = async () => {
    setError("");
    if (portalUser._legacy) {
      setError(
        "Code changes require a small data migration. Contact Summit Clean to enable this feature for your account.",
      );
      return;
    }
    if (
      oldCode.trim().toLowerCase() !== (portalUser.code || "").toLowerCase()
    ) {
      setError("Old code is incorrect.");
      return;
    }
    const cleanNew = newCode.trim().toLowerCase();
    const v = validateCode(cleanNew);
    if (v) {
      setError(v);
      return;
    }
    if (cleanNew !== confirmCode.trim().toLowerCase()) {
      setError("New codes don't match.");
      return;
    }
    if (cleanNew === oldCode.trim().toLowerCase()) {
      setError("New code must be different from the old code.");
      return;
    }
    setBusy(true);
    // Check it's not already in use by another portal user
    const { data: dupe } = await supabase
      .from("portal_users")
      .select("id")
      .eq("code", cleanNew)
      .neq("id", portalUser.id)
      .maybeSingle();
    // Also check legacy customer codes for safety
    const { data: dupePortal } = await supabase
      .from("customers")
      .select("id")
      .eq("portal_code", cleanNew)
      .maybeSingle();
    const { data: dupeStaff } = await supabase
      .from("customers")
      .select("id")
      .eq("staff_portal_code", cleanNew)
      .maybeSingle();
    if (dupe || dupePortal || dupeStaff) {
      setBusy(false);
      setError("That code is already in use. Try a different one.");
      return;
    }
    // Update the code on the portal_users row
    const { error: upErr } = await supabase
      .from("portal_users")
      .update({ code: cleanNew })
      .eq("id", portalUser.id);
    if (upErr) {
      setBusy(false);
      setError("Could not save: " + upErr.message);
      return;
    }
    // Hash the new code so it survives table lockdown.
    await secureSetCredential("portal", portalUser.id, cleanNew);
    // Update local portal session so the new code is remembered
    try {
      const stored = localStorage.getItem("tidytrack_portal");
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.code = cleanNew;
        localStorage.setItem("tidytrack_portal", JSON.stringify(parsed));
      }
    } catch {}
    setBusy(false);
    alert("Code updated. Use your new code next time you sign in.");
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              Account
            </div>
            <div className="font-serif text-xl text-stone-900">
              Change my access code
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
          <p className="text-sm text-stone-600">
            Pick a new code that's at least 6 characters long with both letters
            and numbers. You'll use this code the next time you sign in.
          </p>
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-1 block">
              Current code
            </label>
            <input
              type="text"
              value={oldCode}
              onChange={(e) => setOldCode(e.target.value)}
              autoComplete="off"
              className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white font-mono"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-1 block">
              New code
            </label>
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              autoComplete="off"
              placeholder="At least 6 chars, with letters + numbers"
              className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white font-mono"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-1 block">
              Confirm new code
            </label>
            <input
              type="text"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              autoComplete="off"
              className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white font-mono"
            />
          </div>
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="p-5 border-t border-stone-200 space-y-2">
          <button
            onClick={save}
            disabled={busy}
            className="w-full py-3 rounded-2xl bg-stone-900 text-stone-50 font-medium disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save new code"}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="w-full py-2 rounded-2xl text-stone-600 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
