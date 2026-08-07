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
} from "../../lib/supabase.js";
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
} from "../../lib/constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "../../lib/permissions.js";
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
} from "../../lib/format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "../../lib/compare.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
} from "../../lib/photos.js";
import { sessionStore } from "../../lib/sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "../../lib/translation.js";
import {
  buildTargetTitle,
  unitSizeLabel,
  shortenBedroom,
  partyDisplay,
  unitPartyLabel,
  bathroomNumberForBedroom,
} from "../../lib/labels.js";
import { splitTaskName } from "../../lib/tasks.js";
import { useAssignmentSync } from "../../hooks/useAssignmentSync.js";
import { useIdleDetector } from "../../hooks/useIdleDetector.js";
import { usePagePersistence } from "../../hooks/usePagePersistence.js";
import { useItemLabelOverrides } from "../../hooks/useItemLabelOverrides.js";
import { useTick } from "../../hooks/useTick.js";
import { useUnreadCount } from "../../hooks/useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "../../hooks/useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "../../contexts/LocaleContext.jsx";
import { PreviewContext } from "../../contexts/PreviewContext.jsx";
import { AssignmentTypeChip } from "../../components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "../../components/chips/PriorityChip.jsx";
import { Splash } from "../../components/Splash.jsx";
import { ScreenId } from "../../components/ScreenId.jsx";
import { OwnerOnly } from "../../components/OwnerOnly.jsx";
import { DueDateEditor } from "../../components/DueDateEditor.jsx";
import { ProgressBar } from "../../components/ProgressBar.jsx";
import { CleanerProgressBar } from "../../components/CleanerProgressBar.jsx";
import { ConfirmModal } from "../../components/ConfirmModal.jsx";
import { AddressLink } from "../../components/AddressLink.jsx";
import { TranslatableText } from "../../components/TranslatableText.jsx";
import { PhotoModal } from "../../components/PhotoModal.jsx";
import { NotificationBell } from "../../components/NotificationBell.jsx";
import { Header } from "../../components/Header.jsx";
import { TeamClockIcon } from "../../components/TeamClockIcon.jsx";
import { TabButton } from "../../components/TabButton.jsx";
import { PhotoZoomViewer } from "../../components/PhotoZoomViewer.jsx";
import { TranslateButton } from "../../components/TranslateButton.jsx";
import { ZoomableImage } from "../../components/ZoomableImage.jsx";
import { InvoiceDocument } from "../../App.jsx";

export function PortalInvoicesTab({ property }) {
  const [invoices, setInvoices] = useState(null);
  const [viewId, setViewId] = useState(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "id, invoice_number, title, created_at, invoice_date, due_date, sent_at, total, status",
      )
      .eq("customer_id", property.id)
      .in("status", ["sent", "paid"])
      .order("sent_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[portal invoices] load failed", error);
      setInvoices([]);
      return;
    }
    setInvoices(data || []);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [property.id]);

  const fmtDay = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  if (viewId) {
    return (
      <InvoiceDocument
        invoiceId={viewId}
        readOnly
        onBack={() => setViewId(null)}
      />
    );
  }

  if (invoices === null) {
    return (
      <div className="px-5 py-10 text-center text-stone-400 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="px-5 pt-4 pb-28">
      <div className="mb-4">
        <h2 className="font-serif text-2xl text-stone-900 mb-1">Invoices</h2>
        <p className="text-sm text-stone-600">
          Invoices from Summit Clean for {property.name}. Tap one to view or
          download.
        </p>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-2xl bg-stone-50 border border-stone-200 p-8 text-center">
          <FileText size={22} className="inline text-stone-300 mb-2" />
          <div className="text-sm text-stone-500">No invoices yet.</div>
          <div className="text-[11px] text-stone-400 font-mono mt-1">
            They'll show up here once they're sent to you.
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {invoices.map((inv) => {
            const paid = inv.status === "paid";
            return (
              <button
                key={inv.id}
                onClick={() => setViewId(inv.id)}
                className="w-full text-left rounded-2xl bg-white border border-stone-200 p-4 hover:border-stone-400 active:scale-[0.99] transition-all flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-lg text-stone-900">
                      {inv.invoice_number
                        ? `#${inv.invoice_number}`
                        : inv.title || "Invoice"}
                    </span>
                    <span
                      className={`text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-full font-bold ${
                        paid
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-blue-100 text-blue-800 border border-blue-200"
                      }`}
                    >
                      {paid ? "Paid" : "Received"}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 font-mono mt-1">
                    Sent {fmtDay(inv.sent_at || inv.created_at)}
                    {inv.due_date && ` · due ${fmtDay(inv.due_date)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-mono text-lg text-stone-900 tabular-nums">
                    {inv.total != null ? fmtMoney(Number(inv.total)) : "—"}
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
