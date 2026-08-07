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

export function ChangePinModal({ employee, onClose, onSaved }) {
  const [step, setStep] = useState("current"); // current | new | confirm
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activePin =
    step === "current" ? currentPin : step === "new" ? newPin : confirmPin;

  const setActivePin = (val) => {
    setError("");
    if (step === "current") setCurrentPin(val);
    else if (step === "new") setNewPin(val);
    else setConfirmPin(val);
  };

  const press = (n) => {
    if (busy) return;
    if (activePin.length >= 4) return;
    setActivePin(activePin + String(n));
  };
  const backspace = () => {
    if (busy) return;
    setActivePin(activePin.slice(0, -1));
  };

  // Auto-advance when 4 digits entered
  useEffect(() => {
    if (activePin.length !== 4 || busy) return;
    (async () => {
      if (step === "current") {
        // Validate current PIN through the secure function (the app can't
        // read the stored PIN once the table is locked).
        setBusy(true);
        const who = await secureEmployeeSignIn(activePin);
        setBusy(false);
        if (!who || who.id !== employee.id) {
          setError("That's not your current PIN.");
          setCurrentPin("");
          return;
        }
        setStep("new");
      } else if (step === "new") {
        // Validate the new PIN
        if (OBVIOUS_PINS.has(activePin)) {
          setError("That PIN is too easy to guess. Try a less obvious one.");
          setNewPin("");
          return;
        }
        setStep("confirm");
      } else {
        // Confirm matches new
        if (activePin !== newPin) {
          setError("PINs don't match. Try again.");
          setConfirmPin("");
          return;
        }
        // Final save: the function checks uniqueness, hashes, and writes
        // both pin and pin_hash server-side.
        setBusy(true);
        const res = await secureSetCredential("employee", employee.id, newPin);
        setBusy(false);
        if (res?.error) {
          if (res.error.includes("in use")) {
            setError(
              "That PIN is already in use by another employee. Try a different one.",
            );
            setConfirmPin("");
            setNewPin("");
            setStep("new");
          } else {
            setError("Could not save: " + res.error);
            setConfirmPin("");
          }
          return;
        }
        alert("PIN updated! Use your new PIN next time you sign in.");
        onSaved(newPin);
      }
    })();
    // eslint-disable-next-line
  }, [activePin, step]);

  const titles = {
    current: "Enter your current PIN",
    new: "Choose a new 4-digit PIN",
    confirm: "Confirm your new PIN",
  };
  const subtitles = {
    current: "We need to verify it's really you.",
    new: "Pick something memorable but not obvious.",
    confirm: "Type it once more to make sure.",
  };

  return (
    <div className="fixed inset-0 bg-stone-900/90 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 text-stone-50">
        <button
          onClick={onClose}
          className="text-stone-300 text-sm font-mono hover:text-stone-50 disabled:opacity-50"
          disabled={busy}
        >
          Cancel
        </button>
        <div className="text-xs font-mono text-stone-400 uppercase tracking-wider">
          Step {step === "current" ? "1" : step === "new" ? "2" : "3"} of 3
        </div>
        <div className="w-12" />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-sm mx-auto w-full">
        <div className="text-center mb-6">
          <div className="font-serif text-2xl text-stone-50 mb-1">
            {titles[step]}
          </div>
          <div className="text-sm text-stone-400">{subtitles[step]}</div>
        </div>
        <div className="flex gap-3 mb-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                activePin.length > i
                  ? error
                    ? "bg-red-500 border-red-500"
                    : "bg-amber-500 border-amber-500"
                  : "bg-transparent border-stone-600"
              }`}
            />
          ))}
        </div>
        <div className="h-6 mb-6 text-xs font-mono text-red-400 text-center">
          {error}
        </div>
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => press(n)}
              disabled={busy}
              className="aspect-square rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-50 text-2xl font-mono active:scale-95 transition-transform disabled:opacity-50"
            >
              {n}
            </button>
          ))}
          <div />
          <button
            onClick={() => press(0)}
            disabled={busy}
            className="aspect-square rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-50 text-2xl font-mono active:scale-95 transition-transform disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={backspace}
            disabled={busy || activePin.length === 0}
            className="aspect-square rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-50 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30"
          >
            <Delete size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
