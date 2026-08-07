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
  isoToLocalInput,
  localInputToISO,
  shiftBillableAmount,
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
  readPhotoTakenAt,
  sharePhotos,
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
import { resolveItemLabel } from "../../lib/pickerLabels.js";
import { generatePortalUserCode } from "../../lib/portal.js";
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


export function PortalSignIn({ onSignIn }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const tryLogin = async () => {
    if (!code.trim()) return;
    setError("");
    setBusy(true);
    const trimmed = code.trim().toLowerCase();

    // Secure server-side code check (falls back to direct query
    // pre-lockdown so nobody's locked out during migration).
    const user = await securePortalSignIn(trimmed);

    if (user) {
      // Load their properties
      const { data: links } = await supabase
        .from("portal_user_properties")
        .select("property:customers(*)")
        .eq("portal_user_id", user.id);
      const props = (links || [])
        .map((r) => r.property)
        .filter((p) => p && p.active)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setBusy(false);
      if (props.length === 0) {
        setError(
          "Your code is valid but no properties are assigned to you yet. Contact Summit Clean.",
        );
        return;
      }
      onSignIn(user, props);
      return;
    }

    // Backward-compat fallback: try the old per-property codes
    // (in case the v18 migration hasn't been run yet, or wasn't able to migrate this code)
    let { data } = await supabase
      .from("customers")
      .select("*")
      .eq("portal_code", trimmed)
      .eq("active", true)
      .maybeSingle();
    let kind = "pm";
    if (!data) {
      ({ data } = await supabase
        .from("customers")
        .select("*")
        .eq("staff_portal_code", trimmed)
        .eq("active", true)
        .maybeSingle());
      kind = "pm_staff";
    }
    setBusy(false);
    if (!data) {
      setError("That code didn't match. Check with your cleaning company.");
      return;
    }
    // Synthesize a "fake" portal user so the rest of the flow works
    const synthUser = {
      id: "legacy-" + data.id,
      code: trimmed,
      name:
        kind === "pm_staff" ? `PM staff of ${data.name}` : `PM of ${data.name}`,
      kind: kind,
      active: true,
      _legacy: true, // marker so we don't try to update portal_users table for these
    };
    onSignIn(synthUser, [data]);
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Dark brand header band — tightened so content fits on small phones */}
      <div className="flex flex-col items-center py-5 sm:py-8 bg-stone-900">
        <img
          src="https://bbaynvqnbkjyqhzhhypr.supabase.co/storage/v1/object/public/brand/unnamed%20(2).png"
          alt="Summit Clean"
          className="w-28 sm:w-40 h-auto mx-auto"
        />
      </div>

      <div className="flex-1 flex flex-col justify-center items-center px-6 max-w-sm mx-auto w-full py-4 sm:py-8">
        <div className="mb-4 sm:mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.25em] font-mono text-stone-500">
            Welcome
          </p>
          <h2 className="font-serif text-xl sm:text-2xl mt-2 text-stone-900">
            Property manager portal
          </h2>
        </div>

        <div className="w-full">
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Access code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))
            }
            placeholder="e.g. sunset2024"
            onKeyDown={(e) => e.key === "Enter" && tryLogin()}
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono text-lg tracking-wide"
          />

          {error && (
            <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={tryLogin}
            disabled={busy || !code.trim()}
            className="w-full mt-4 py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-xs text-stone-500 mt-6 text-center">
            Don't have a code? Ask Summit Clean for access.
          </p>
        </div>
      </div>
      <div className="text-center pb-6 text-xs text-stone-400 font-mono">
        <button
          onClick={() => {
            // Clear any remembered choice so they get to the landing page
            try {
              localStorage.removeItem("tt_role_choice");
            } catch {}
            window.location.hash = "";
          }}
          className="hover:text-stone-600"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
