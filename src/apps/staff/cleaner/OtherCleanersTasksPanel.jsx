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

export function OtherCleanersTasksPanel({ block }) {
  const [data, setData] = useState({ byCleaner: [], loading: true });

  const load = async () => {
    if (!block?.unit_id || !block?.party_id) return;
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const startIso = start.toISOString();

      const { data: blocks } = await supabase
        .from("work_blocks")
        .select(
          "id, start_time, end_time, shift:shifts!inner(id, employee:employees!inner(id, name)), tasks(id, name, start_time, end_time)",
        )
        .eq("unit_id", block.unit_id)
        .eq("party_id", block.party_id)
        .gte("start_time", startIso)
        .neq("id", block.id);

      // Group tasks by cleaner
      const byCleanerMap = new Map();
      (blocks || []).forEach((b) => {
        const cleanerId = b.shift?.employee?.id;
        const cleanerName = b.shift?.employee?.name || "A cleaner";
        if (!cleanerId) return;
        if (!byCleanerMap.has(cleanerId)) {
          byCleanerMap.set(cleanerId, {
            id: cleanerId,
            name: cleanerName,
            tasks: [],
          });
        }
        const tasks = (b.tasks || []).map((t) => ({
          ...t,
          completed: !!t.end_time,
        }));
        byCleanerMap.get(cleanerId).tasks.push(...tasks);
      });

      // For each cleaner: sort tasks (in-progress first, then completed by start_time)
      const byCleaner = Array.from(byCleanerMap.values())
        .map((c) => ({
          ...c,
          tasks: c.tasks.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return new Date(a.start_time) - new Date(b.start_time);
          }),
        }))
        .filter((c) => c.tasks.length > 0);

      setData({ byCleaner, loading: false });
    } catch (e) {
      console.warn("[OtherCleanersTasksPanel] failed", e);
      setData((d) => ({ ...d, loading: false }));
    }
  };

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [block?.id, block?.unit_id, block?.party_id]);

  if (data.loading || data.byCleaner.length === 0) return null;

  const totalTasks = data.byCleaner.reduce((sum, c) => sum + c.tasks.length, 0);

  return (
    <div className="mx-4 mt-3 rounded-2xl bg-amber-50 border border-amber-200 overflow-hidden">
      <div className="px-4 py-3 bg-amber-100">
        <div className="flex items-center gap-2">
          <Check size={14} className="text-amber-900" />
          <div className="text-xs uppercase tracking-wider text-amber-900 font-mono flex-1">
            Tasks others did today ({totalTasks})
          </div>
        </div>
        {(block?.unit?.label || block?.party?.label) && (
          <div className="text-[11px] text-amber-800 font-mono mt-0.5 pl-6">
            {block?.unit?.label}
            {block?.unit?.label && block?.party?.label ? " · " : ""}
            {block?.party?.label}
          </div>
        )}
      </div>
      <div className="px-4 py-3 space-y-3">
        {data.byCleaner.map((c) => (
          <div key={c.id}>
            <div className="text-[11px] uppercase tracking-wider font-mono text-amber-800 mb-1.5">
              By {c.name}
            </div>
            <ul className="space-y-1">
              {c.tasks.map((t) => {
                const dur = t.end_time
                  ? new Date(t.end_time) - new Date(t.start_time)
                  : null;
                return (
                  <li key={t.id} className="flex items-start gap-2 text-sm">
                    {t.completed ? (
                      <Check
                        size={12}
                        className="text-emerald-600 mt-1 flex-shrink-0"
                      />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-2 flex-shrink-0 animate-pulse" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span
                        className={
                          t.completed
                            ? "text-stone-700"
                            : "text-stone-900 font-medium"
                        }
                      >
                        {t.name}
                      </span>
                      {dur && (
                        <span className="text-[10px] text-stone-500 font-mono ml-1.5">
                          {fmtTimeShort(dur)}
                        </span>
                      )}
                      {!t.completed && (
                        <span className="text-[10px] text-amber-700 font-mono ml-1.5">
                          in progress
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="px-4 pb-3 text-[11px] text-amber-800/80 italic">
        These are read-only. Add your own tasks below if you're doing more work
        here.
      </div>
    </div>
  );
}
