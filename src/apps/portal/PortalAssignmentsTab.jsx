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
import { ChecklistAssignmentWizard } from "../cross-cutting/ChecklistAssignmentWizard.jsx";
import { PortalAssignmentDetail } from "./PortalAssignmentDetail.jsx";
import { PortalAssignmentForm } from "./PortalAssignmentForm.jsx";
import { PortalAssignmentSection } from "./PortalAssignmentSection.jsx";
import { QuickAssignmentForm } from "../staff/manager/assignments/QuickAssignmentForm.jsx";

export function PortalAssignmentsTab({ property, portalKind, portalUser }) {
  const [assignments, setAssignments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  // Added 'wizard' kind so the PM can open the new ChecklistAssignmentWizard.
  // Legacy upload (PortalAssignmentForm) still reachable via the greyed-out
  // button below — but only if the owner explicitly turned the permission
  // on for this PM (portalUser.allow_legacy_uploads).
  const [view, setView] = useState({ kind: "list" });
  const [search, setSearch] = useState("");

  const allowLegacy = !!portalUser?.allow_legacy_uploads;
  // Per-property control of which upload styles this PM sees. Unconfigured
  // (null) keeps the old default: checklist on, quick off, legacy following
  // the per-PM allow_legacy_uploads flag.
  const pmm = property?.pm_upload_methods;
  const showQuick = pmm ? !!pmm.quick : false;
  const showChecklist = pmm ? !!pmm.checklist : true;
  const showLegacy = pmm ? !!pmm.legacy : allowLegacy;

  const load = async () => {
    const { data } = await supabase
      .from("assignments")
      .select(
        "*, targets:assignment_targets(id, status, priority, unit:units(label), party:parties(label))",
      )
      .eq("customer_id", property.id)
      .eq("source", "pm")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setAssignments(data || []);
    setLoaded(true);
  };
  useEffect(() => {
    load();
  }, [property.id]);

  if (view.kind === "wizard") {
    return (
      <ChecklistAssignmentWizard
        property={property}
        employee={null} /* no staff employee in PM context */
        actorKind={portalKind || "pm"}
        portalUser={portalUser}
        onCancel={() => setView({ kind: "list" })}
        onSaved={() => {
          setView({ kind: "list" });
          load();
        }}
      />
    );
  }
  if (view.kind === "quick") {
    return (
      <QuickAssignmentForm
        property={property}
        employee={null}
        portalKind={portalKind || "pm"}
        portalUser={portalUser}
        onCancel={() => setView({ kind: "list" })}
        onSaved={() => {
          setView({ kind: "list" });
          load();
        }}
      />
    );
  }
  if (view.kind === "new") {
    return (
      <PortalAssignmentForm
        property={property}
        portalKind={portalKind}
        onCancel={() => setView({ kind: "list" })}
        onSaved={() => {
          setView({ kind: "list" });
          load();
        }}
      />
    );
  }
  if (view.kind === "edit") {
    return (
      <PortalAssignmentForm
        property={property}
        assignment={view.assignment}
        portalKind={portalKind}
        onCancel={() => setView({ kind: "list" })}
        onSaved={() => {
          setView({ kind: "list" });
          load();
        }}
      />
    );
  }
  if (view.kind === "detail") {
    return (
      <PortalAssignmentDetail
        property={property}
        assignment={view.assignment}
        portalUser={portalUser}
        onBack={() => {
          setView({ kind: "list" });
          load();
        }}
        onEdit={() => setView({ kind: "edit", assignment: view.assignment })}
      />
    );
  }

  // Decorate assignments with priority + primary unit label for search/grouping
  const decorated = assignments.map((a) => {
    const targets = a.targets || [];
    const hasPriority = targets.some((t) => t.priority);
    const firstUnitLabel =
      targets.find((t) => t.unit?.label)?.unit?.label || "";
    return { ...a, hasPriority, firstUnitLabel };
  });

  // Search across title, notes, unit, bedroom
  const q = search.trim().toLowerCase();
  const matchesSearch = (a) => {
    if (!q) return true;
    if ((a.title || "").toLowerCase().includes(q)) return true;
    if ((a.notes || "").toLowerCase().includes(q)) return true;
    if ((a.firstUnitLabel || "").toLowerCase().includes(q)) return true;
    return (a.targets || []).some((t) =>
      (t.party?.label || "").toLowerCase().includes(q),
    );
  };
  const visible = decorated.filter(matchesSearch);

  const groups = {
    draft: visible.filter((a) => a.pm_status === "draft"),
    pending: visible.filter((a) => a.pm_status === "pending"),
    approved: visible.filter((a) => a.pm_status === "approved"),
    rejected: visible.filter((a) => a.pm_status === "rejected"),
  };

  return (
    <div className="px-5 pt-6 space-y-5">
      <ScreenId id="PM-ASGN" />
      <div>
        <h2 className="font-serif text-2xl text-stone-900 mb-1">
          Your assignments
        </h2>
        <p className="text-sm text-stone-600">
          Create assignments for the cleaning team. They take effect once
          approved.
        </p>
      </div>

      {/* Quick assignment — enabled per-property. Fast builder, no cleaner
         picker; lands as a draft for owner approval. */}
      {showQuick && (
        <button
          onClick={() => setView({ kind: "quick" })}
          className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium flex items-center justify-center gap-2"
        >
          <Building2 size={18} /> Quick assignment
        </button>
      )}

      {/* Checklist wizard — structured "New assignment". Shown per-property. */}
      {showChecklist && (
        <button
          onClick={() => setView({ kind: "wizard" })}
          className={`w-full py-4 rounded-2xl font-medium flex items-center justify-center gap-2 ${showQuick ? "border-2 border-stone-300 bg-white text-stone-700" : "bg-stone-900 text-stone-50"}`}
        >
          <Plus size={18} /> New assignment
        </button>
      )}

      {/* Legacy upload — shown per-property (falls back to the per-PM flag
         when the property hasn't been configured). */}
      {showLegacy && (
        <button
          onClick={() => setView({ kind: "new" })}
          title="Upload a file or photo as the source for an assignment (legacy flow)."
          className="w-full py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border bg-stone-50 border-stone-300 text-stone-700 hover:bg-stone-100"
        >
          <FileText size={12} /> Legacy file upload
        </button>
      )}

      {!showQuick && !showChecklist && !showLegacy && (
        <div className="text-center py-4 text-xs text-stone-400 border-2 border-dashed border-stone-200 rounded-xl">
          Assignment uploads aren't enabled for this property. Ask Summit Clean
          to turn one on.
        </div>
      )}

      {/* Search — filters across title, unit, bedroom, notes. PMs don't
         need cleaner/category filters but search by apartment/building
         is universally useful. */}
      {assignments.length > 0 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${assignments.length} assignment${assignments.length === 1 ? "" : "s"} (apartment, bedroom, title)…`}
          className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 text-sm"
        />
      )}

      {!loaded ? (
        <Splash text="Loading…" />
      ) : assignments.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
          You haven't created any assignments yet.
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
          No assignments match "{search}".
        </div>
      ) : (
        <>
          <PortalAssignmentSection
            title="Drafts"
            subtitle="You can still edit these"
            items={groups.draft}
            color="stone"
            onOpen={(a) => setView({ kind: "detail", assignment: a })}
          />
          <PortalAssignmentSection
            title="Pending review"
            subtitle="Waiting for the owner to approve"
            items={groups.pending}
            color="amber"
            onOpen={(a) => setView({ kind: "detail", assignment: a })}
          />
          <PortalAssignmentSection
            title="Needs changes"
            subtitle="Owner asked for changes — edit and resubmit"
            items={groups.rejected}
            color="red"
            onOpen={(a) => setView({ kind: "detail", assignment: a })}
          />
          <PortalAssignmentSection
            title="Approved"
            subtitle="Active — visible to the cleaning team"
            items={groups.approved}
            color="emerald"
            onOpen={(a) => setView({ kind: "detail", assignment: a })}
          />
        </>
      )}
    </div>
  );
}
