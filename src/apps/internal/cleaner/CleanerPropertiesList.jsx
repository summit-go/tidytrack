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
import { sessionStore } from "../../../domains/auth/sessionStore.js";
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
import { LeaveWorkblockModal } from "../../../domains/work/cleaner/LeaveWorkblockModal.jsx";

export function CleanerPropertiesList({
  currentPropertyId,
  employee,
  onOpenCurrent,
  onSwitch,
}) {
  const [props, setProps] = useState([]);
  const [counts, setCounts] = useState({});
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Paginated: this counts open work across EVERY property, so a plain
      // call stops at PostgREST's 1000-row cap and undercounts silently.
      const fetchAllTargets = async () => {
        let rows = [];
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("assignment_targets")
            .select(
              "unit_id, party_id, status, assignment:assignments!inner(customer_id, active, deleted_at)",
            )
            .not("status", "in", "(done,blocked)")
            .range(from, from + PAGE - 1);
          if (error || !data) break;
          rows = rows.concat(data);
          if (data.length < PAGE) break;
          if (from > 100000) break;
        }
        return rows;
      };
      const [pRes, allTargets] = await Promise.all([
        supabase.from("customers").select("*").eq("active", true).order("name"),
        fetchAllTargets(),
      ]);
      const c = {};
      const seen = new Set();
      (allTargets || []).forEach((t) => {
        const a = t.assignment;
        if (!a || a.active === false || a.deleted_at) return;
        const cid = a.customer_id;
        if (!cid) return;
        const k = `${cid}:${t.unit_id || ""}:${t.party_id || ""}`;
        if (!seen.has(k)) {
          seen.add(k);
          c[cid] = (c[cid] || 0) + 1;
        }
      });
      if (!cancelled) {
        setProps(visibleProps(pRes.data || [], employee));
        setCounts(c);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  if (!loaded)
    return (
      <div className="text-center py-8 text-stone-400 text-sm">Loading…</div>
    );
  const sorted = [...props].sort(
    (a, b) =>
      (a.id === currentPropertyId ? -1 : b.id === currentPropertyId ? 1 : 0) ||
      (counts[b.id] || 0) - (counts[a.id] || 0) ||
      (a.name || "").localeCompare(b.name || ""),
  );
  return (
    <div className="px-4 pt-4 pb-4 space-y-2">
      {sorted.map((p) => {
        const here = p.id === currentPropertyId;
        return (
          <button
            key={p.id}
            onClick={() => (here ? onOpenCurrent() : onSwitch(p))}
            className={`w-full text-left p-4 rounded-2xl border active:scale-98 ${here ? "bg-amber-50 border-amber-300" : "bg-white border-stone-200"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-serif text-lg text-stone-900 truncate">
                {p.name}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {here && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-600 text-white">
                    You're here
                  </span>
                )}
                {(counts[p.id] || 0) > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                    {counts[p.id]} open
                  </span>
                )}
              </div>
            </div>
            {p.address && (
              <div className="text-xs text-stone-500 font-mono mt-1 truncate">
                {p.address}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
