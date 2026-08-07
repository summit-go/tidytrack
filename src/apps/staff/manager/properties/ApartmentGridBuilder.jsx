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

export function ApartmentGridBuilder({ property, onSaved }) {
  const [buildings, setBuildings] = useState(10);
  const [floors, setFloors] = useState(3);
  const [unitsPerFloor, setUnitsPerFloor] = useState(4);
  const [partiesPerUnit, setPartiesPerUnit] = useState(4);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  // Compute the preview labels.
  // Pattern: unit numbers cumulate across buildings (don't reset per building).
  // Floor digit goes in the hundreds place.
  // e.g. B1 floor 1 unit 1 = 101; B2 floor 1 unit 1 = 105; B10 floor 3 unit 4 = 340
  const computePreview = () => {
    const labels = [];
    for (let b = 1; b <= buildings; b++) {
      for (let f = 1; f <= floors; f++) {
        for (let u = 1; u <= unitsPerFloor; u++) {
          // Unit's position on this floor across the whole complex
          const unitOnFloor = (b - 1) * unitsPerFloor + u;
          const aptNum = f * 100 + unitOnFloor;
          labels.push(`B${b}-${aptNum}`);
        }
      }
    }
    return labels;
  };

  const preview = computePreview();
  const totalUnits = preview.length;
  const totalParties = totalUnits * partiesPerUnit;

  const create = async () => {
    if (totalUnits === 0) return;
    if (
      !confirm(
        `Create ${totalUnits} units and ${totalParties} bedrooms under "${property.name}"? This can't be undone in bulk — you'd have to delete units one-by-one or delete the whole property.`,
      )
    )
      return;

    setBusy(true);
    setError("");
    setProgress("Creating units…");

    // Build the unit rows. sort_order encodes the natural order.
    const unitRows = [];
    let order = 0;
    for (let b = 1; b <= buildings; b++) {
      for (let f = 1; f <= floors; f++) {
        for (let u = 1; u <= unitsPerFloor; u++) {
          const unitOnFloor = (b - 1) * unitsPerFloor + u;
          const aptNum = f * 100 + unitOnFloor;
          unitRows.push({
            customer_id: property.id,
            label: `B${b}-${aptNum}`,
            sort_order: order++,
            active: true,
          });
        }
      }
    }

    // Insert in chunks so we don't blow past any single-request limits
    const CHUNK = 50;
    const createdUnits = [];
    for (let i = 0; i < unitRows.length; i += CHUNK) {
      const slice = unitRows.slice(i, i + CHUNK);
      setProgress(
        `Creating units ${i + 1}–${Math.min(i + CHUNK, unitRows.length)} of ${unitRows.length}…`,
      );
      const { data, error: e } = await supabase
        .from("units")
        .insert(slice)
        .select();
      if (e) {
        setBusy(false);
        setError(`Failed at unit batch ${i + 1}: ${e.message}`);
        return;
      }
      createdUnits.push(...(data || []));
    }

    // Now build the party rows for every unit we just made
    if (partiesPerUnit > 0) {
      const partyRows = [];
      for (const u of createdUnits) {
        for (let p = 1; p <= partiesPerUnit; p++) {
          partyRows.push({
            unit_id: u.id,
            label: `Bedroom ${p}`,
            sort_order: p,
            active: true,
          });
        }
      }
      for (let i = 0; i < partyRows.length; i += CHUNK) {
        const slice = partyRows.slice(i, i + CHUNK);
        setProgress(
          `Creating parties ${i + 1}–${Math.min(i + CHUNK, partyRows.length)} of ${partyRows.length}…`,
        );
        const { error: e } = await supabase.from("parties").insert(slice);
        if (e) {
          setBusy(false);
          setError(`Failed at party batch ${i + 1}: ${e.message}`);
          return;
        }
      }
    }

    setBusy(false);
    onSaved();
  };

  return (
    <div className="px-5 pt-2 space-y-5">
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
        <strong>How it works:</strong> labels follow{" "}
        <code className="font-mono bg-white/60 px-1 rounded">
          B<em>X</em>-<em>FUU</em>
        </code>{" "}
        where X is the building, F is the floor, and UU is the unit number. Unit
        numbers cumulate across buildings — Building 1 floor 1 is{" "}
        <code className="font-mono bg-white/60 px-1 rounded">B1-101</code>{" "}
        through{" "}
        <code className="font-mono bg-white/60 px-1 rounded">B1-104</code>,
        Building 2 floor 1 is{" "}
        <code className="font-mono bg-white/60 px-1 rounded">B2-105</code>{" "}
        through{" "}
        <code className="font-mono bg-white/60 px-1 rounded">B2-108</code>, and
        so on.
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Buildings
          </label>
          <input
            type="number"
            min="1"
            max="99"
            value={buildings}
            onChange={(e) =>
              setBuildings(
                Math.max(1, Math.min(99, parseInt(e.target.value) || 1)),
              )
            }
            className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono text-center text-lg"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Floors each
          </label>
          <input
            type="number"
            min="1"
            max="9"
            value={floors}
            onChange={(e) =>
              setFloors(Math.max(1, Math.min(9, parseInt(e.target.value) || 1)))
            }
            className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono text-center text-lg"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Units/floor
          </label>
          <input
            type="number"
            min="1"
            max="99"
            value={unitsPerFloor}
            onChange={(e) =>
              setUnitsPerFloor(
                Math.max(1, Math.min(99, parseInt(e.target.value) || 1)),
              )
            }
            className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono text-center text-lg"
          />
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
          Bedrooms per unit
        </label>
        <div className="grid grid-cols-4 gap-2">
          {[0, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <button
              key={n}
              onClick={() => setPartiesPerUnit(n)}
              type="button"
              className={`py-3 rounded-xl border-2 font-mono text-sm transition-all ${
                partiesPerUnit === n
                  ? "border-stone-900 bg-stone-900 text-stone-50"
                  : "border-stone-200 bg-white text-stone-700"
              }`}
            >
              {n === 0 ? "—" : n}
            </button>
          ))}
        </div>
        <p className="text-xs text-stone-500 mt-2">
          Each unit gets "Bedroom 1" through "Bedroom N". You can rename them
          later.
        </p>
      </div>

      {/* Preview */}
      <div className="p-4 rounded-2xl bg-white border border-stone-200">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
            Preview
          </div>
          <div className="font-mono text-sm">
            <span className="text-stone-900 font-medium">{totalUnits}</span>
            <span className="text-stone-500"> units · </span>
            <span className="text-stone-900 font-medium">{totalParties}</span>
            <span className="text-stone-500"> bedrooms</span>
          </div>
        </div>
        <div className="font-mono text-sm text-stone-700 space-y-0.5 max-h-48 overflow-y-auto">
          {preview.length <= 30 ? (
            preview.map((label) => <div key={label}>{label}</div>)
          ) : (
            <>
              {preview.slice(0, 6).map((label) => (
                <div key={label}>{label}</div>
              ))}
              <div className="text-stone-400">
                …and {preview.length - 12} more…
              </div>
              {preview.slice(-6).map((label) => (
                <div key={label}>{label}</div>
              ))}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {busy && progress && (
        <div className="p-3 rounded-xl bg-stone-100 text-stone-700 text-sm font-mono flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-stone-700 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          {progress}
        </div>
      )}

      <button
        onClick={create}
        disabled={busy || totalUnits === 0}
        className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy ? (
          "Creating…"
        ) : (
          <>
            Create {totalUnits} units &amp; {totalParties} bedrooms
          </>
        )}
      </button>

      <p className="text-xs text-stone-500 text-center">
        ⚠️ Existing units with duplicate labels will cause errors. Run this on
        an empty property.
      </p>
    </div>
  );
}
