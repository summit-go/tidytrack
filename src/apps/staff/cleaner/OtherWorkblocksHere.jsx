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

export function OtherWorkblocksHere({
  unitId,
  partyId,
  currentBlockId,
  currentEmployeeId,
  onJoin,
}) {
  const [blocks, setBlocks] = useState([]);
  useTick(true); // tick so the elapsed-time labels update each second
  const load = async () => {
    if (!unitId || !partyId) return;
    const { data } = await supabase
      .from("work_blocks")
      .select(
        "id, start_time, main_section, shift:shifts!inner(customer_id, employee:employees(id, name)), tasks(id, name, category, subcategory, end_time, photos(id))",
      )
      .eq("unit_id", unitId)
      .eq("party_id", partyId)
      .is("end_time", null);
    const filtered = (data || []).filter(
      (b) =>
        b.id !== currentBlockId && // exclude the viewer's own active block
        b.shift?.employee?.id !== currentEmployeeId, // exclude any block owned by the viewer
    );
    setBlocks(filtered);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [unitId, partyId, currentBlockId]);
  useAssignmentSync(load, "other-workblocks-here");

  if (blocks.length === 0) return null;

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  return (
    <div className="space-y-2">
      {blocks.map((b) => {
        const elapsed = Date.now() - new Date(b.start_time).getTime();
        // Section label: prefer main_section, fall back to dominant
        // task category. Without this, B can't tell what they'd be
        // joining (bedroom? bathroom? vanity? general?).
        let sectionLabel = b.main_section ? cap(b.main_section) : null;
        if (!sectionLabel && b.tasks?.length > 0) {
          const counts = {};
          b.tasks.forEach((t) => {
            if (t.category) counts[t.category] = (counts[t.category] || 0) + 1;
          });
          const dom = Object.keys(counts).sort(
            (a, c) => counts[c] - counts[a],
          )[0];
          if (dom) sectionLabel = cap(dom);
        }
        const cleanerName = b.shift?.employee?.name || "Another cleaner";
        const photoCount = (b.tasks || []).reduce(
          (sum, t) => sum + (t.photos?.length || 0),
          0,
        );
        return (
          <div
            key={b.id}
            className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4"
          >
            {/* Header: "[Name] here" + section, with Join button on right */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-amber-900 font-mono font-bold mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                  {cleanerName} here
                </div>
                {sectionLabel && (
                  <div className="font-serif text-lg text-stone-900 leading-tight">
                    {sectionLabel}
                  </div>
                )}
              </div>
              {onJoin && (
                <button
                  onClick={() => onJoin({ id: b.id })}
                  className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-50 text-sm font-bold flex items-center gap-1.5 active:scale-95 flex-shrink-0"
                >
                  <Plus size={14} /> Join
                </button>
              )}
            </div>
            {/* Bullet list of task names — what's being / has been
               cleaned in this workblock. Read-only: NO checkboxes,
               NO click handlers, the viewer can't mark items off
               since they're not in this workblock yet. */}
            {b.tasks && b.tasks.length > 0 && (
              <ul className="space-y-1 text-sm text-stone-800 mb-3">
                {b.tasks.map((t) => (
                  <li
                    key={t.id}
                    className="leading-snug flex items-start gap-2"
                  >
                    <span className="text-amber-700 mt-1.5 flex-shrink-0">
                      •
                    </span>
                    <span className="flex-1 min-w-0">
                      {t.name || t.subcategory || t.category || "Task"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {/* Footer: start time + elapsed + photo count */}
            <div className="text-[11px] font-mono text-stone-500 pt-2 border-t border-amber-200">
              started{" "}
              {new Date(b.start_time).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
              <span className="text-stone-400 mx-1">·</span>
              {fmtTimeShort(elapsed)}
              {photoCount > 0 && (
                <>
                  <span className="text-stone-400 mx-1">·</span>
                  {photoCount} photo{photoCount === 1 ? "" : "s"}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
