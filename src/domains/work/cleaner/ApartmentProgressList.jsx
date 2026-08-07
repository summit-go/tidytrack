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
import { isVisibleAssignmentTarget } from "../../../lib/assignments.js";
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

export function ApartmentProgressList({ propertyId, workBlocks }) {
  const [apartments, setApartments] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Refresh signal — bumps whenever a work block opens or closes at
  // this property. finishBlock auto-completes in_progress targets, so
  // we need this fingerprint to bring the counter back in sync without
  // requiring the cleaner to leave the Home tab.
  const blocksFingerprint = (workBlocks || [])
    .map((b) => `${b.id}:${b.end_time || "open"}`)
    .join("|");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!propertyId) return;
      const PAGE = 1000;
      let data = [];
      for (let from = 0; ; from += PAGE) {
        const { data: page, error: pErr } = await supabase
          .from("assignment_targets")
          .select(
            `
            status, unit_id, party_id, assignment_id,
            unit:units(id, label),
            assignment:assignments!inner(customer_id, active, source, pm_status, deleted_at)
          `,
          )
          .eq("assignment.customer_id", propertyId)
          .eq("assignment.active", true)
          .is("assignment.deleted_at", null)
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (pErr) break;
        data = data.concat(page || []);
        if (!page || page.length < PAGE) break;
        if (from > 200000) break;
      }
      if (cancelled) return;
      const filtered = (data || []).filter(
        isVisibleAssignmentTarget &&
          t.unit_id &&
          t.party_id,
      );
      // Group by apartment. For each, track unique bedroom keys and
      // separately the bedrooms where ALL items are done. A bedroom
      // counts as "done" only if every one of its items has status='done'.
      const byApt = new Map();
      // First pass: build bedroom-level rollup so we can tell which
      // bedrooms are fully done vs partial. A bedroom counts as "done"
      // when every item is either DONE or BLOCKED — blocked means the
      // cleaner is finished dealing with it (waiting on owner review),
      // not still pending work. Treating blocked as done here keeps
      // the apartment counter from getting stuck.
      const bedrooms = new Map(); // key = unit_id::party_id → { allDone: true, unit_id, label }
      filtered.forEach((t) => {
        const key = `${t.unit_id}::${t.party_id}`;
        if (!bedrooms.has(key))
          bedrooms.set(key, {
            unit_id: t.unit_id,
            unit_label: t.unit?.label || "Apartment",
            allDone: true,
          });
        if (t.status !== "done" && t.status !== "blocked")
          bedrooms.get(key).allDone = false;
      });
      // Second pass: aggregate per apartment.
      bedrooms.forEach((b) => {
        if (!byApt.has(b.unit_id))
          byApt.set(b.unit_id, {
            unit_id: b.unit_id,
            label: b.unit_label,
            total: 0,
            done: 0,
          });
        const a = byApt.get(b.unit_id);
        a.total += 1;
        if (b.allDone) a.done += 1;
      });
      // Only show apartments with at least one incomplete bedroom.
      const out = Array.from(byApt.values())
        .filter((a) => a.done < a.total)
        .sort((a, b) => naturalCompare(a.label, b.label));
      setApartments(out);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId, blocksFingerprint]);

  if (!loaded || apartments.length === 0) return null;

  return (
    <div className="px-4 pt-6">
      <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
        Apartment progress
      </div>
      <div className="space-y-2">
        {apartments.map((a) => {
          const pct = a.total > 0 ? Math.round((a.done / a.total) * 100) : 0;
          const isComplete = pct === 100;
          return (
            <div
              key={a.unit_id}
              className="p-3 rounded-2xl bg-white border border-stone-200"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isComplete
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <Building2 size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-stone-900 truncate">
                    {a.label}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="text-[11px] font-mono text-stone-600 whitespace-nowrap">
                      <span className="text-stone-900 font-bold">{a.done}</span>
                      <span className="text-stone-400"> / </span>
                      <span>{a.total}</span>
                      <span className="text-stone-500"> bedrooms done</span>
                    </div>
                    <div className="flex-1 h-1 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          isComplete
                            ? "bg-emerald-500"
                            : pct > 0
                              ? "bg-amber-500"
                              : "bg-red-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
