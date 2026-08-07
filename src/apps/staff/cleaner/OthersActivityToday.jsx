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

export function OthersActivityToday({
  propertyId,
  myEmployeeId,
  onOpenBedroomHistory,
}) {
  const [blocks, setBlocks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("work_blocks")
        .select(
          "id, start_time, end_time, work_notes, unit:units(id, label), party:parties(id, label), shift:shifts!inner(customer_id, employee:employees(id, name)), tasks(id, photos(id))",
        )
        .eq("shift.customer_id", propertyId)
        .gte("start_time", todayStart.toISOString())
        .order("start_time", { ascending: false });
      const mine = myEmployeeId;
      setBlocks((data || []).filter((b) => b.shift?.employee?.id !== mine));
      setLoaded(true);
    })();
  }, [propertyId, myEmployeeId]);
  if (!loaded)
    return (
      <div className="text-center py-8 text-stone-400 text-sm">Loading…</div>
    );
  if (blocks.length === 0) {
    return (
      <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
        No other cleaners have worked here today.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {blocks.map((b) => {
        const dur =
          (b.end_time ? new Date(b.end_time) : new Date()) -
          new Date(b.start_time);
        const photoCount = (b.tasks || []).reduce(
          (sum, t) => sum + (t.photos?.length || 0),
          0,
        );
        const isDone = !!b.end_time;
        const name = b.shift?.employee?.name || "A cleaner";
        return (
          <div
            key={b.id}
            className={`rounded-2xl p-4 border ${isDone ? "bg-white border-stone-200" : "bg-blue-50 border-blue-200"}`}
          >
            <div className="flex items-start gap-2">
              <div
                className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${isDone ? "bg-stone-300" : "bg-blue-500 animate-pulse"}`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono uppercase tracking-wider text-blue-700 mb-0.5">
                  {name}
                  {isDone ? "" : " · working now"}
                </div>
                <div className="font-serif text-base text-stone-900 truncate">
                  {unitPartyLabel(b.unit?.label, b.party?.label)}
                </div>
                <div className="text-xs text-stone-500 font-mono mt-0.5">
                  {fmtClock(b.start_time)}
                  {b.end_time && ` — ${fmtClock(b.end_time)}`} ·{" "}
                  {fmtTimeShort(dur)}
                  {photoCount > 0 && <> · {photoCount} photos</>}
                </div>
                {b.work_notes && (
                  <div className="text-xs text-stone-600 mt-1 italic">
                    "{b.work_notes}"
                  </div>
                )}
                {onOpenBedroomHistory && b.unit?.id && b.party?.id && (
                  <button
                    onClick={() =>
                      onOpenBedroomHistory({
                        unitId: b.unit.id,
                        unitLabel: b.unit.label,
                        partyId: b.party.id,
                        partyLabel: b.party.label,
                      })
                    }
                    className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-700 text-[11px] font-mono active:scale-95"
                  >
                    <Clock size={10} /> Bedroom history
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
