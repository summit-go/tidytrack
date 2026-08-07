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
  isoToLocalInput,
  localInputToISO,
  shiftBillableAmount,
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
  readPhotoTakenAt,
  sharePhotos,
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
import {
  buildTargetTitle,
  unitSizeLabel,
  shortenBedroom,
  partyDisplay,
  unitPartyLabel,
  bathroomNumberForBedroom,
} from "../../../../lib/labels.js";
import { resolveItemLabel } from "../../../../lib/pickerLabels.js";
import { generatePortalUserCode } from "../../../../lib/portal.js";
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

export function InvoiceList({ property, onOpen, onNew }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [needsInvoicing, setNeedsInvoicing] = useState(0);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("customer_id", property.id)
      .order("created_at", { ascending: false });
    setInvoices(data || []);

    // Flag jobs done over a week ago that still haven't been invoiced
    // (done targets with no invoiced_on and completed_at older than 7 days).
    try {
      const weekAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
      // Don't chase history: only flag work from this month onward.
      const mStart = (() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
      })();
      const { data: propUnits } = await supabase
        .from("units")
        .select("id")
        .eq("customer_id", property.id);
      const unitIds = (propUnits || []).map((u) => u.id);
      if (unitIds.length) {
        const { data: needRows, error } = await supabase
          .from("assignment_targets")
          .select(
            "assignment_id, unit_id, assignment:assignments!inner(deleted_at, active)",
          )
          .eq("status", "done")
          .is("invoiced_on", null)
          .in("unit_id", unitIds)
          .lt("completed_at", weekAgo)
          .gte("completed_at", mStart);
        if (!error) {
          const jobs = new Set();
          (needRows || []).forEach((t) => {
            if (t.assignment?.deleted_at || t.assignment?.active === false)
              return;
            jobs.add(t.assignment_id || t.unit_id);
          });
          setNeedsInvoicing(jobs.size);
        } else {
          setNeedsInvoicing(0);
        }
      }
    } catch {
      setNeedsInvoicing(0);
    }

    setLoading(false);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [property.id]);

  if (loading) return <Splash text="Loading invoices…" />;

  return (
    <div>
      {needsInvoicing > 0 && (
        <button
          onClick={onNew}
          className="w-full mb-3 p-3 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-3 text-left active:scale-98"
        >
          <div className="flex items-center gap-2.5">
            <Clock size={18} className="text-amber-700 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-amber-900">
                {needsInvoicing} {needsInvoicing === 1 ? "job" : "jobs"} need
                invoicing
              </div>
              <div className="text-xs text-amber-700 font-mono">
                Done over a week ago and not yet billed
              </div>
            </div>
          </div>
          <span className="text-xs font-medium text-amber-900 flex items-center gap-1 flex-shrink-0">
            Invoice now <ChevronRight size={14} />
          </span>
        </button>
      )}
      {invoices.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-stone-200 rounded-2xl">
          <div className="text-sm text-stone-500 mb-4">
            No saved invoices for {property.name} yet.
          </div>
          <button
            onClick={onNew}
            className="px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium inline-flex items-center gap-2"
          >
            <FileText size={15} /> Generate one
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((iv) => {
            const total = parseFloat(iv.total) || 0;
            return (
              <button
                key={iv.id}
                onClick={() => onOpen(iv.id)}
                className="w-full text-left p-4 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 transition-colors flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-stone-900">
                      #{iv.invoice_number || "—"}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${INVOICE_STATUS_STYLE[iv.status] || "bg-stone-100 text-stone-600"}`}
                    >
                      {iv.status}
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 font-mono mt-1">
                    {iv.title ? iv.title + " · " : ""}
                    {(iv.status === "sent" || iv.status === "paid") &&
                    iv.sent_at
                      ? `Sent ${fmtInvoiceDate(String(iv.sent_at).slice(0, 10))}`
                      : fmtInvoiceDate(iv.invoice_date)}
                  </div>
                  {iv.period_start && iv.period_end && (
                    <div className="text-[11px] text-stone-400 font-mono mt-0.5">
                      Covers {fmtInvoiceDate(iv.period_start)} –{" "}
                      {fmtInvoiceDate(iv.period_end)}
                    </div>
                  )}
                </div>
                <div className="text-right flex items-center gap-2">
                  <span className="font-mono text-sm text-stone-900">
                    ${total.toFixed(2)}
                  </span>
                  <ChevronRight size={16} className="text-stone-400" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
