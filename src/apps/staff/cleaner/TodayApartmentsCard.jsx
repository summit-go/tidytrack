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
import { sessionStore } from "../../../lib/sessionStore.js";
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
import { ItemsDropdown } from "./ItemsDropdown.jsx";
import { LeaveWorkblockModal } from "./LeaveWorkblockModal.jsx";

export function TodayApartmentsCard({ propertyId, onGoToBedroom, full = false }) {
  const [units, setUnits] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const todayKey = localTodayKey();
      const { data: propUnits } = await supabase
        .from("units")
        .select("id,label")
        .eq("customer_id", propertyId);
      const unitIds = (propUnits || []).map((u) => u.id);
      const labelById = Object.fromEntries(
        (propUnits || []).map((u) => [u.id, u.label]),
      );
      let rows = [];
      if (unitIds.length) {
        const { data } = await supabase
          .from("assignment_targets")
          .select(
            "id, unit_id, party_id, status, assignment:assignments!inner(active, deleted_at, scheduled_date, title, assignment_type)",
          )
          .in("unit_id", unitIds)
          .in("status", ["pending", "in_progress", "paused"]);
        rows = (data || []).filter(
          (t) =>
            t.assignment &&
            t.assignment.active !== false &&
            !t.assignment.deleted_at &&
            t.assignment.scheduled_date === todayKey,
        );
      }
      const byUnit = {};
      rows.forEach((t) => {
        if (!byUnit[t.unit_id])
          byUnit[t.unit_id] = {
            unitId: t.unit_id,
            label: labelById[t.unit_id] || "",
            count: 0,
            partyId: t.party_id,
            title: t.assignment?.title || "",
            type: t.assignment?.assignment_type || "",
          };
        byUnit[t.unit_id].count++;
      });
      if (!cancelled) {
        setUnits(
          Object.values(byUnit).sort((a, b) =>
            naturalCompare(a.label, b.label),
          ),
        );
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  // Full list variant — used by the Home "Today" toggle.
  if (full) {
    if (!loaded)
      return (
        <div className="px-4 mt-6 text-center text-stone-400 text-sm">
          Loading…
        </div>
      );
    if (units.length === 0)
      return (
        <div className="px-4 mt-10 text-center text-stone-400 text-sm">
          Nothing scheduled for today. 🎉
        </div>
      );
    return (
      <div className="px-4 mt-4 space-y-2 pb-4">
        <div className="text-xs uppercase tracking-wider text-amber-800 font-mono mb-1">
          Due today · {units.length}{" "}
          {units.length === 1 ? "apartment" : "apartments"} left
        </div>
        {units.map((u) => (
          <button
            key={u.unitId}
            onClick={() =>
              onGoToBedroom &&
              onGoToBedroom({ unit_id: u.unitId, party_id: u.partyId })
            }
            className="w-full text-left p-4 rounded-2xl bg-white border border-stone-200 active:scale-98 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-serif text-lg text-stone-900">
                  {u.label}
                </span>
                {u.count > 1 && (
                  <span className="text-[10px] font-mono text-amber-700">
                    ×{u.count}
                  </span>
                )}
                {u.type && (
                  <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {assignmentTypeLabel(u.type)}
                  </span>
                )}
              </div>
              {u.title && (
                <div className="text-xs text-stone-500 mt-0.5 truncate">
                  {u.title}
                </div>
              )}
            </div>
            <ChevronRight size={16} className="text-stone-400 flex-shrink-0" />
          </button>
        ))}
      </div>
    );
  }

  if (!loaded || units.length === 0) return null;
  return (
    <div className="mx-4 mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200">
      <div className="text-xs uppercase tracking-wider text-amber-800 font-mono mb-2.5">
        Due today · {units.length}{" "}
        {units.length === 1 ? "apartment" : "apartments"} left
      </div>
      <div className="flex flex-wrap gap-2">
        {units.map((u) => (
          <button
            key={u.unitId}
            onClick={() =>
              onGoToBedroom &&
              onGoToBedroom({ unit_id: u.unitId, party_id: u.partyId })
            }
            className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-sm font-mono text-stone-800 active:scale-95 flex items-center gap-1.5"
          >
            {u.label}
            {u.count > 1 ? (
              <span className="text-[10px] text-amber-700">×{u.count}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
