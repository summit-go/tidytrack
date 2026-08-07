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
  localTodayStart,
  localTodayStartISO,
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
import { ItemsDropdown } from "../../../apps/internal/cleaner/ItemsDropdown.jsx";
import { LeaveWorkblockModal } from "./LeaveWorkblockModal.jsx";

export function OtherCleanersActivity({ block, myEmployeeId }) {
  const [data, setData] = useState({
    activeNow: [],
    pastBlocks: [],
    allPhotos: [],
    loading: true,
  });

  const load = async () => {
    if (!block?.unit_id || !block?.party_id) return;
    try {
      // Today = midnight local time
      const startIso = localTodayStartISO();

      // Fetch all work_blocks at this bedroom started today, with their tasks/photos and the cleaner who did them
      const { data: blocks } = await supabase
        .from("work_blocks")
        .select(
          "id, start_time, end_time, shift:shifts!inner(id, employee:employees!inner(id, name)), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
        )
        .eq("unit_id", block.unit_id)
        .eq("party_id", block.party_id)
        .gte("start_time", startIso)
        .neq("id", block.id);

      const all = blocks || [];
      const activeNow = all.filter((b) => !b.end_time);
      const pastBlocks = all.filter((b) => b.end_time);

      // Flatten photos from all OTHER blocks, with attribution. We
      // prefer the actual photographer's name (taken_by_employee from
      // the photos join) over the shift owner so multi-cleaner blocks
      // attribute photos correctly. Falls back to the shift owner for
      // legacy photos that don't have taken_by populated.
      const photos = [];
      all.forEach((b) => {
        const blockOwnerName = b.shift?.employee?.name || "A cleaner";
        const blockOwnerId = b.shift?.employee?.id;
        (b.tasks || []).forEach((t) => {
          (t.photos || [])
            .filter((p) => !p.deleted_at)
            .forEach((p) => {
              const photoTakerName =
                p.taken_by_employee?.name || blockOwnerName;
              const photoTakerId = p.taken_by || blockOwnerId;
              photos.push({
                ...p,
                cleanerName: photoTakerName,
                cleanerId: photoTakerId,
                taskName: t.name,
              });
            });
        });
      });
      // Sort: group by kind (before → after → damage → couldn't clean → other),
      // then oldest-first within each kind
      const KIND_ORDER = { before: 0, after: 1, damage: 2, [KIND_CANNOT]: 3 };
      photos.sort((a, b) => {
        const aOrder = KIND_ORDER[a.kind] ?? 99;
        const bOrder = KIND_ORDER[b.kind] ?? 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      });

      setData({ activeNow, pastBlocks, allPhotos: photos, loading: false });
    } catch (e) {
      console.warn("[other cleaners] failed", e);
      setData((d) => ({ ...d, loading: false }));
    }
  };

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [block?.id, block?.unit_id, block?.party_id]);

  if (data.loading) return null;

  const totalOthers = data.activeNow.length + data.pastBlocks.length;
  if (totalOthers === 0) return null;

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-blue-50 border border-blue-200 overflow-hidden">
      <div className="px-4 py-3 bg-blue-100 flex items-center gap-2">
        <Users size={14} className="text-blue-800" />
        <div className="text-xs uppercase tracking-wider text-blue-900 font-mono flex-1">
          Today's activity here
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {data.activeNow.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0 animate-pulse" />
            <div>
              <span className="text-stone-800 font-medium">
                {data.activeNow
                  .map((b) => b.shift?.employee?.name || "Someone")
                  .join(", ")}
              </span>
              <span className="text-stone-600">
                {" "}
                {data.activeNow.length === 1 ? "is" : "are"} here right now
              </span>
            </div>
          </div>
        )}
        {data.pastBlocks.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <Clock size={12} className="text-stone-500 mt-1 flex-shrink-0" />
            <div>
              <span className="text-stone-800 font-medium">
                {[
                  ...new Set(
                    data.pastBlocks.map(
                      (b) => b.shift?.employee?.name || "Someone",
                    ),
                  ),
                ].join(", ")}
              </span>
              <span className="text-stone-600"> worked here earlier today</span>
            </div>
          </div>
        )}
      </div>

      {data.allPhotos.length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-[10px] uppercase tracking-wider font-mono text-blue-900 mb-2">
            Photos taken by others ({data.allPhotos.length})
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {data.allPhotos.slice(0, 9).map((p) => (
              <a
                key={p.id}
                href={p.public_url}
                target="_blank"
                rel="noreferrer"
                className="relative aspect-square rounded-lg overflow-hidden bg-stone-200 active:opacity-80 transition-opacity"
              >
                <img
                  src={p.public_url}
                  alt={p.taskName || ""}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                  <div className="text-[9px] text-white font-mono leading-tight truncate">
                    {p.cleanerName}
                  </div>
                  {p.kind && (
                    <div className="text-[8px] text-white/80 uppercase tracking-wider leading-tight">
                      {p.kind}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
          {data.allPhotos.length > 9 && (
            <div className="text-[11px] text-stone-500 mt-2 text-center">
              + {data.allPhotos.length - 9} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}
