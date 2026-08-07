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

export function ActivityTimelineView({ employee, onClose }) {
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  // Use today's local start/end as ISO strings for the queries.
  const dayBounds = (() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { startISO: start.toISOString(), endISO: end.toISOString() };
  })();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { startISO, endISO } = dayBounds;
      // Pull everything in parallel. Each event source maps to a
      // normalized { ts, kind, title, body, actor } shape for rendering.
      const [shiftsR, blocksR, photosR, rechecksR] = await Promise.all([
        supabase
          .from("shifts")
          .select(
            "id, start_time, end_time, employee:employees(id, name), customer:customers(id, name)",
          )
          .gte("start_time", startISO)
          .lte("start_time", endISO)
          .eq("is_preview", false),
        supabase
          .from("work_blocks")
          .select(
            "id, start_time, end_time, unit:units(label), party:parties(label), shift:shifts(employee:employees(id, name), customer:customers(id, name))",
          )
          .gte("start_time", startISO)
          .lte("start_time", endISO),
        supabase
          .from("photos")
          .select(
            "id, created_at, kind, taken_by_employee:employees!taken_by(id, name), task:tasks(work_block:work_blocks(unit:units(label), party:parties(label), shift:shifts(customer:customers(name))))",
          )
          .in("kind", FLAG_KINDS)
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .is("deleted_at", null),
        supabase
          .from("recheck_requests")
          .select(
            "id, created_at, status, target:assignment_targets(unit:units(label), party:parties(label), assignment:assignments(property:customers(name)))",
          )
          .gte("created_at", startISO)
          .lte("created_at", endISO),
      ]);
      if (cancelled) return;
      const all = [];
      // Shifts: clock in + clock out
      (shiftsR.data || []).forEach((s) => {
        all.push({
          ts: s.start_time,
          kind: "shift_start",
          actor: s.employee?.name || "?",
          title: `${s.employee?.name || "A cleaner"} clocked in`,
          body: s.customer?.name || "",
        });
        if (s.end_time) {
          all.push({
            ts: s.end_time,
            kind: "shift_end",
            actor: s.employee?.name || "?",
            title: `${s.employee?.name || "A cleaner"} clocked out`,
            body: s.customer?.name || "",
          });
        }
      });
      // Work blocks: started + finished
      (blocksR.data || []).forEach((b) => {
        const cleaner = b.shift?.employee?.name || "?";
        const where = `${b.unit?.label || ""} · ${b.party?.label || ""}`;
        all.push({
          ts: b.start_time,
          kind: "block_start",
          actor: cleaner,
          title: `${cleaner} started cleaning ${where}`,
          body: b.shift?.customer?.name || "",
        });
        if (b.end_time) {
          all.push({
            ts: b.end_time,
            kind: "block_end",
            actor: cleaner,
            title: `${cleaner} finished ${where}`,
            body: b.shift?.customer?.name || "",
          });
        }
      });
      // Flagged photos — damage and couldn't-clean both land here.
      (photosR.data || []).forEach((p) => {
        const cleaner = p.taken_by_employee?.name || "A cleaner";
        const where = `${p.task?.work_block?.unit?.label || ""} · ${p.task?.work_block?.party?.label || ""}`;
        const isCannot = p.kind === KIND_CANNOT;
        all.push({
          ts: p.created_at,
          kind: isCannot ? KIND_CANNOT : "damage",
          actor: cleaner,
          title: isCannot
            ? `⚠ ${cleaner} couldn't clean ${where}`
            : `⚠ ${cleaner} flagged damage at ${where}`,
          body: p.task?.work_block?.shift?.customer?.name || "",
        });
      });
      // Recheck requests
      (rechecksR.data || []).forEach((r) => {
        const where = `${r.target?.unit?.label || ""} · ${r.target?.party?.label || ""}`;
        all.push({
          ts: r.created_at,
          kind: "recheck",
          actor: "PM",
          title: `PM requested recheck at ${where}`,
          body: r.target?.assignment?.property?.name || "",
        });
      });
      // Sort reverse-chronological so most recent is on top
      all.sort((a, b) => new Date(b.ts) - new Date(a.ts));
      setEvents(all);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iconFor = (kind) => {
    switch (kind) {
      case "shift_start":
        return { Icon: Play, color: "bg-emerald-100 text-emerald-700" };
      case "shift_end":
        return { Icon: Pause, color: "bg-stone-100 text-stone-600" };
      case "block_start":
        return { Icon: Camera, color: "bg-blue-100 text-blue-700" };
      case "block_end":
        return { Icon: Check, color: "bg-emerald-100 text-emerald-700" };
      case "damage":
        return { Icon: ImageIcon, color: "bg-red-100 text-red-700" };
      case KIND_CANNOT:
        return { Icon: AlertCircle, color: "bg-yellow-100 text-yellow-800" };
      case "recheck":
        return { Icon: Eye, color: "bg-amber-100 text-amber-700" };
      default:
        return { Icon: Clock, color: "bg-stone-100 text-stone-500" };
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-stone-50 overflow-y-auto">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200 bg-white sticky top-0 z-10">
        <button
          onClick={onClose}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100"
        >
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono flex items-center gap-2">
            Beta · Today
            <span className="text-[8px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800">
              Beta
            </span>
          </div>
          <h1 className="font-serif text-2xl text-stone-900">
            Activity timeline
          </h1>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-5 py-6">
        {!loaded ? (
          <div className="text-center py-12 text-stone-400 text-sm">
            Loading…
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No activity yet today.
          </div>
        ) : (
          <div className="relative">
            {/* Vertical timeline rule */}
            <div className="absolute left-4 top-2 bottom-2 w-px bg-stone-200" />
            <div className="space-y-2">
              {events.map((e, i) => {
                const { Icon, color } = iconFor(e.kind);
                return (
                  <div key={i} className="relative flex items-start gap-3 pl-1">
                    <div
                      className={`relative z-10 w-8 h-8 rounded-full ${color} flex items-center justify-center flex-shrink-0 ring-4 ring-stone-50`}
                    >
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0 pt-1 pb-3">
                      <div className="text-sm text-stone-900">{e.title}</div>
                      {e.body && (
                        <div className="text-[11px] text-stone-500 font-mono mt-0.5 truncate">
                          {e.body}
                        </div>
                      )}
                      <div className="text-[10px] font-mono text-stone-400 mt-0.5">
                        {fmtClock(e.ts)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
