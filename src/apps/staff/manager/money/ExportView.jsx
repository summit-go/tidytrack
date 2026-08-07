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

export function ExportView({
  employee,
  onSignOut,
  onOpenMessages,
  onLogoClick,
  topToggle,
}) {
  const today = new Date().toISOString().split("T")[0];
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const [start, setStart] = useState(twoWeeksAgo);
  const [end, setEnd] = useState(today);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [fullShifts, setFullShifts] = useState(null); // full shifts for the interactive by-cleaner view
  const [selCleaner, setSelCleaner] = useState(null);
  // Local-day bounds (fixes the UTC off-by-a-day that hid late-night shifts).
  const dayBounds = (from, to) => {
    const [fy, fm, fd] = from.split("-").map(Number);
    const [ty, tm, td] = to.split("-").map(Number);
    return {
      startIso: new Date(fy, fm - 1, fd, 0, 0, 0, 0).toISOString(),
      endIso: new Date(ty, tm - 1, td, 23, 59, 59, 999).toISOString(),
    };
  };
  const loadFull = async () => {
    const { startIso, endIso } = dayBounds(start, end);
    const { data } = await supabase
      .from("shifts")
      .select(
        "*, employee:employees(id,name,pay_rate_hourly), customer:customers(id,name,property_type,bill_rate_hourly), work_blocks(id, end_time, start_time, bill_rate_at_work, unit:units(label), party:parties(label))",
      )
      .eq("is_preview", false)
      .gte("start_time", startIso)
      .lte("start_time", endIso)
      .order("start_time", { ascending: false });
    setFullShifts(data || []);
  };
  const fetchData = async () => {
    setBusy(true);
    await loadFull();
    const { startIso, endIso } = dayBounds(start, end);
    const { data } = await supabase
      .from("shifts")
      .select(
        "start_time, end_time, bill_rate_at_work, idle_seconds, manual_adjustment_seconds, auto_clocked_out, adjustment_notes, employee:employees(name), customer:customers(name, property_type, bill_rate_hourly), work_blocks(start_time, end_time, bill_rate_at_work)",
      )
      .gte("start_time", startIso)
      .lte("start_time", endIso)
      .eq("is_preview", false) // Never include preview shifts in payroll
      .not("end_time", "is", null)
      .order("start_time");
    const rows = (data || []).map((s) => {
      const rawHours =
        (new Date(s.end_time) - new Date(s.start_time)) / 1000 / 3600;
      const billableHrs = shiftBillableHours(s);
      const idleHrs = (s.idle_seconds || 0) / 3600;
      const adjHrs = (s.manual_adjustment_seconds || 0) / 3600;
      let billable = null;
      if (s.customer?.property_type === "multi_unit") {
        billable = (s.work_blocks || []).reduce((sum, b) => {
          if (!b.end_time) return sum;
          const h =
            (new Date(b.end_time) - new Date(b.start_time)) / 1000 / 3600;
          return (
            sum + h * (b.bill_rate_at_work || s.customer?.bill_rate_hourly || 0)
          );
        }, 0);
      } else if (s.bill_rate_at_work) {
        billable = billableHrs * s.bill_rate_at_work;
      }
      return {
        employee: s.employee?.name || "",
        date: new Date(s.start_time).toLocaleDateString("en-US"),
        clock_in: new Date(s.start_time).toLocaleTimeString("en-US"),
        clock_out: new Date(s.end_time).toLocaleTimeString("en-US"),
        raw_hours: rawHours.toFixed(2),
        idle_hours: idleHrs.toFixed(2),
        adjustment_hours: adjHrs.toFixed(2),
        billable_hours: billableHrs.toFixed(2),
        property: s.customer?.name || "",
        billable: billable != null ? billable.toFixed(2) : "",
        auto_clocked_out: s.auto_clocked_out ? "yes" : "",
        notes: s.adjustment_notes || "",
      };
    });
    setPreview(rows);
    setBusy(false);
  };
  const downloadCSV = () => {
    if (!preview || preview.length === 0) return;
    const headers = [
      "Employee",
      "Date",
      "Clock In",
      "Clock Out",
      "Raw Hours",
      "Idle Hours",
      "Adjustment Hours",
      "Billable Hours",
      "Property",
      "Billable $",
      "Auto Clock Out",
      "Notes",
    ];
    const csv = [
      headers.join(","),
      ...preview.map((r) =>
        [
          `"${r.employee}"`,
          r.date,
          r.clock_in,
          r.clock_out,
          r.raw_hours,
          r.idle_hours,
          r.adjustment_hours,
          r.billable_hours,
          `"${r.property}"`,
          r.billable,
          r.auto_clocked_out,
          `"${(r.notes || "").replace(/"/g, '""')}"`,
        ].join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tidytrack-payroll-${start}-to-${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const byEmployee = {};
  (preview || []).forEach((r) => {
    if (!byEmployee[r.employee])
      byEmployee[r.employee] = { hours: 0, shifts: 0, billable: 0 };
    byEmployee[r.employee].hours += parseFloat(r.billable_hours);
    byEmployee[r.employee].shifts += 1;
    if (r.billable) byEmployee[r.employee].billable += parseFloat(r.billable);
  });
  return (
    <div className="pb-24">
      <Header
        name={employee.name}
        onSignOut={onSignOut}
        role={employee.role}
        employee={employee}
        onOpenMessages={onOpenMessages}
        onLogoClick={onLogoClick}
      />
      {topToggle}
      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-3">
          Payroll
        </div>
        <h1 className="text-4xl font-light text-stone-900 tracking-tight mb-6">
          Export <span className="font-serif italic text-amber-700">hours</span>
        </h1>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
              Start
            </label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
              End
            </label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white"
            />
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={busy}
          className="w-full py-3 rounded-xl bg-stone-900 text-stone-50 font-medium mb-6 disabled:opacity-50"
        >
          {busy ? "Loading…" : "Generate report"}
        </button>
        {preview && preview.length === 0 && (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No completed shifts in this date range.
          </div>
        )}
        {preview && preview.length > 0 && (
          <>
            <div className="mb-6">
              <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
                By employee — tap a name to see shifts, adjust hours/pay, or
                remove a fake one
              </div>
              {fullShifts && fullShifts.length > 0 ? (
                <div className="-mx-5">
                  <ShiftsByCleanerView
                    shifts={fullShifts}
                    showMoney
                    selectedCleanerId={selCleaner}
                    onSelectCleaner={setSelCleaner}
                    onOpenShift={() => {}}
                    currentEmployee={employee}
                    onReload={loadFull}
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                  No shifts in this range.
                </div>
              )}
            </div>
            <button
              onClick={downloadCSV}
              className="w-full py-4 rounded-2xl bg-amber-700 text-stone-50 font-medium flex items-center justify-center gap-2 active:scale-98"
            >
              <Download size={18} />
              Download CSV ({preview.length} shifts)
            </button>
          </>
        )}
      </div>
    </div>
  );
}
