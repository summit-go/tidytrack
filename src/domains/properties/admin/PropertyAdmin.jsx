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
import { buildTargetTitle, unitSizeLabel, shortenBedroom, partyDisplay, unitPartyLabel } from "../../../lib/labels.js";
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
import { AllOpenAssignments } from "../../work/assignments/AllOpenAssignments.jsx";
import { AssignmentDetail } from "../../work/assignments/AssignmentDetail.jsx";
import { AssignmentForm } from "../../work/assignments/AssignmentForm.jsx";
import { AssignmentList } from "../../work/assignments/AssignmentList.jsx";
import { BulkCreateUnits } from "./BulkCreateUnits.jsx";
import { ChecklistAssignmentWizard } from "../../work/cross-cutting/ChecklistAssignmentWizard.jsx";
import { PartyForm } from "./PartyForm.jsx";
import { PartyList } from "./PartyList.jsx";
import { PortalUsersAdmin } from "../../../apps/internal/manager/team/PortalUsersAdmin.jsx";
import { PropertyForm } from "./PropertyForm.jsx";
import { PropertySetup } from "./PropertySetup.jsx";
import { QuickAssignmentForm } from "../../work/assignments/QuickAssignmentForm.jsx";
import { UnitForm } from "./UnitForm.jsx";
import { UnitList } from "./UnitList.jsx";

export function PropertyAdmin({ employee, onSignOut, onOpenMessages, onLogoClick }) {
  const [view, setView] = useState({ kind: "list" });
  const [props, setProps] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const load = async () => {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .order("active", { ascending: false })
      .order("name");
    setProps(visibleProps(data, employee));
    setLoaded(true);
  };
  useEffect(() => {
    load();
  }, []);
  if (!loaded) return <Splash text="Loading…" />;
  if (view.kind === "property-edit") {
    return (
      <PropertyForm
        property={view.property}
        currentUserRole={employee.role}
        onCancel={() => setView({ kind: "list" })}
        onSaved={(savedRow) => {
          // For NEW properties, drop into the setup landing so the user can
          // assign portal users + build out units in one flow.
          if (!view.property && savedRow?.id) {
            setView({ kind: "property-setup", property: savedRow });
          } else {
            setView({ kind: "list" });
            load();
          }
        }}
        onManageAssignments={
          view.property
            ? () =>
                setView({ kind: "assignment-list", property: view.property })
            : null
        }
      />
    );
  }
  if (view.kind === "property-setup") {
    return (
      <PropertySetup
        property={view.property}
        onDone={() => {
          setView({ kind: "list" });
          load();
        }}
        onAssignPortalUsers={() =>
          setView({ kind: "portal-users", focusProperty: view.property })
        }
        onAddUnits={() =>
          view.property.property_type === "multi_unit"
            ? setView({ kind: "bulk-create", property: view.property })
            : setView({ kind: "unit-list", property: view.property })
        }
        onEditProperty={() =>
          setView({ kind: "property-edit", property: view.property })
        }
      />
    );
  }
  if (view.kind === "unit-list") {
    return (
      <UnitList
        property={view.property}
        employee={employee}
        onAssignmentNew={() =>
          setView({ kind: "assignment-new", property: view.property })
        }
        onAssignmentNewChecklist={() =>
          setView({ kind: "assignment-new-checklist", property: view.property })
        }
        onAssignmentNewQuick={() =>
          setView({ kind: "assignment-new-quick", property: view.property })
        }
        onAssignmentOpen={(a) =>
          setView({
            kind: "assignment-detail",
            property: view.property,
            assignment: a,
          })
        }
        onBack={() => {
          setView({ kind: "list" });
          load();
        }}
        onEditProperty={() =>
          setView({ kind: "property-edit", property: view.property })
        }
        onUnitOpen={(unit) =>
          setView({ kind: "party-list", property: view.property, unit })
        }
        onUnitEdit={(unit) =>
          setView({ kind: "unit-edit", property: view.property, unit })
        }
        onUnitNew={() =>
          setView({ kind: "unit-edit", property: view.property, unit: null })
        }
        onBulkNew={() =>
          setView({ kind: "bulk-create", property: view.property })
        }
        onAssignments={() =>
          setView({ kind: "assignment-list", property: view.property })
        }
      />
    );
  }
  if (view.kind === "bulk-create") {
    return (
      <BulkCreateUnits
        property={view.property}
        onCancel={() => setView({ kind: "unit-list", property: view.property })}
        onSaved={() => setView({ kind: "unit-list", property: view.property })}
      />
    );
  }
  if (view.kind === "unit-edit") {
    return (
      <UnitForm
        property={view.property}
        unit={view.unit}
        onCancel={() => setView({ kind: "unit-list", property: view.property })}
        onSaved={() => setView({ kind: "unit-list", property: view.property })}
      />
    );
  }
  if (view.kind === "party-list") {
    return (
      <PartyList
        property={view.property}
        unit={view.unit}
        onBack={() => setView({ kind: "unit-list", property: view.property })}
        onPartyEdit={(party) =>
          setView({
            kind: "party-edit",
            property: view.property,
            unit: view.unit,
            party,
          })
        }
        onPartyNew={() =>
          setView({
            kind: "party-edit",
            property: view.property,
            unit: view.unit,
            party: null,
          })
        }
      />
    );
  }
  if (view.kind === "party-edit") {
    return (
      <PartyForm
        property={view.property}
        unit={view.unit}
        party={view.party}
        onCancel={() =>
          setView({
            kind: "party-list",
            property: view.property,
            unit: view.unit,
          })
        }
        onSaved={() =>
          setView({
            kind: "party-list",
            property: view.property,
            unit: view.unit,
          })
        }
      />
    );
  }
  if (view.kind === "assignment-list") {
    return (
      <AssignmentList
        property={view.property}
        employee={employee}
        onBack={() => {
          if (view.property.property_type === "multi_unit")
            setView({ kind: "unit-list", property: view.property });
          else setView({ kind: "list" });
        }}
        onNew={() =>
          setView({ kind: "assignment-new", property: view.property })
        }
        onNewChecklist={() =>
          setView({ kind: "assignment-new-checklist", property: view.property })
        }
        onNewQuick={() =>
          setView({ kind: "assignment-new-quick", property: view.property })
        }
        onOpen={(a) =>
          setView({
            kind: "assignment-detail",
            property: view.property,
            assignment: a,
          })
        }
      />
    );
  }
  if (view.kind === "assignment-new-quick") {
    return (
      <QuickAssignmentForm
        property={view.property}
        employee={employee}
        onCancel={() =>
          setView({ kind: "assignment-list", property: view.property })
        }
        onSaved={() =>
          setView({ kind: "assignment-list", property: view.property })
        }
      />
    );
  }
  if (view.kind === "assignment-new") {
    return (
      <AssignmentForm
        property={view.property}
        employee={employee}
        onCancel={() =>
          setView({ kind: "assignment-list", property: view.property })
        }
        onSaved={() =>
          setView({ kind: "assignment-list", property: view.property })
        }
      />
    );
  }
  if (view.kind === "assignment-new-checklist") {
    return (
      <ChecklistAssignmentWizard
        property={view.property}
        employee={employee}
        onCancel={() =>
          setView({ kind: "assignment-list", property: view.property })
        }
        onSaved={() =>
          setView({ kind: "assignment-list", property: view.property })
        }
      />
    );
  }
  if (view.kind === "assignment-detail") {
    return (
      <AssignmentDetail
        property={view.property}
        assignment={view.assignment}
        employee={employee}
        onBack={() =>
          setView({ kind: "assignment-list", property: view.property })
        }
      />
    );
  }
  if (view.kind === "all-open-assignments") {
    return (
      <AllOpenAssignments
        employee={employee}
        onBack={() => setView({ kind: "list" })}
        onOpenAssignment={(property, assignment) =>
          setView({ kind: "assignment-detail", property, assignment })
        }
      />
    );
  }
  if (view.kind === "portal-users") {
    return (
      <PortalUsersAdmin
        employee={employee}
        onBack={() => setView({ kind: "list" })}
      />
    );
  }
  const visible = props.filter((p) => showInactive || p.active);
  const activeCount = props.filter((p) => p.active).length;
  return (
    <div className="pb-24">
      <ScreenId id="OW-PROPS" />
      <Header
        name={employee.name}
        onSignOut={onSignOut}
        role={employee.role}
        employee={employee}
        onOpenMessages={onOpenMessages}
        onLogoClick={onLogoClick}
      />
      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-3">
          Admin
        </div>
        <h1 className="text-4xl font-light text-stone-900 tracking-tight mb-2">
          Your{" "}
          <span className="font-serif italic text-amber-700">properties</span>
        </h1>
        <p className="text-stone-500 text-sm mb-6">{activeCount} active</p>
        <button
          onClick={() => setView({ kind: "property-edit", property: null })}
          className="w-full mb-2 p-4 rounded-2xl bg-stone-900 text-stone-50 font-medium flex items-center justify-center gap-2 active:scale-98"
        >
          <Plus size={18} /> Add property
        </button>
        <button
          onClick={() => setView({ kind: "all-open-assignments" })}
          className="w-full mb-2 p-3 rounded-2xl bg-white border-2 border-stone-300 text-stone-800 text-sm font-medium flex items-center justify-center gap-2 active:scale-98 hover:border-stone-900"
        >
          <FileText size={16} /> View all open assignments
        </button>
        <button
          onClick={() => setView({ kind: "portal-users" })}
          className="w-full mb-4 p-3 rounded-2xl bg-white border-2 border-stone-300 text-stone-800 text-sm font-medium flex items-center justify-center gap-2 active:scale-98 hover:border-stone-900"
        >
          <Users size={16} /> Manage PMs &amp; property owners
        </button>
        <button
          onClick={() => setShowInactive(!showInactive)}
          className="text-xs font-mono text-stone-500 mb-4 flex items-center gap-1.5"
        >
          {showInactive ? <EyeOff size={12} /> : <Eye size={12} />}
          {showInactive ? "Hide" : "Show"} inactive (
          {props.length - activeCount})
        </button>
        <div className="space-y-2">
          {visible.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              No properties yet.
            </div>
          ) : (
            visible.map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  p.property_type === "multi_unit"
                    ? setView({ kind: "unit-list", property: p })
                    : setView({ kind: "property-edit", property: p })
                }
                className={`w-full text-left p-4 rounded-2xl border transition-colors ${p.active ? "bg-white border-stone-200 hover:border-stone-400" : "bg-stone-100 border-stone-200 opacity-60"}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-serif text-lg text-stone-900">
                        {p.name}
                      </span>
                      {p.property_type === "multi_unit" && (
                        <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Multi-unit
                        </span>
                      )}
                      {!p.active && (
                        <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    {p.address && (
                      <div className="text-xs text-stone-500 font-mono">
                        <AddressLink address={p.address} />
                      </div>
                    )}
                    {canSeeMoney(employee) && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-stone-600">
                        {p.bill_mode === "hourly" && p.bill_rate_hourly && (
                          <span className="flex items-center gap-1">
                            <DollarSign size={11} />
                            {Number(p.bill_rate_hourly).toFixed(2)}/hr
                          </span>
                        )}
                        {p.bill_mode === "flat" && p.flat_rate_amount && (
                          <span className="flex items-center gap-1">
                            <DollarSign size={11} />
                            {Number(p.flat_rate_amount).toFixed(2)} flat
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-stone-400 flex-shrink-0 ml-2 mt-1"
                  />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
