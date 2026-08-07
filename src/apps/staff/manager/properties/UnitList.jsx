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
import { buildTargetTitle, unitSizeLabel, shortenBedroom } from "../../../../lib/labels.js";
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
import { AssignmentList } from "../assignments/AssignmentList.jsx";
import { PropertyTeamTab } from "../properties/PropertyTeamTab.jsx";

export function UnitList({
  property,
  employee,
  onBack,
  onEditProperty,
  onUnitOpen,
  onUnitEdit,
  onUnitNew,
  onBulkNew,
  onAssignments,
  onAssignmentNew,
  onAssignmentNewChecklist,
  onAssignmentNewQuick,
  onAssignmentOpen,
}) {
  const [units, setUnits] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("units"); // 'units' | 'team'
  const load = async () => {
    const { data } = await supabase
      .from("units")
      .select("*, parties(id)")
      .eq("customer_id", property.id)
      .order("sort_order")
      .order("label");
    const sorted = (data || [])
      .slice()
      .sort((a, b) => naturalCompare(a.label, b.label));
    setUnits(sorted);
    setLoaded(true);
  };
  useEffect(() => {
    load();
  }, [property.id]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? units.filter((u) => u.label.toLowerCase().includes(q))
    : units;

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-stone-200">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-full hover:bg-stone-100"
          >
            <ArrowLeft size={20} className="text-stone-700" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              Property
            </div>
            <div className="font-serif text-xl text-stone-900 truncate">
              {property.name}
            </div>
          </div>
        </div>
        <button
          onClick={onEditProperty}
          className="p-2 rounded-full hover:bg-stone-100"
        >
          <Edit2 size={16} className="text-stone-600" />
        </button>
      </div>
      <div className="px-5 pt-6">
        {/* Units / Assignments / Team toggle. Consolidates the three
           things you do to a property in one row of tabs. */}
        <div className="flex p-0.5 bg-stone-100 rounded-xl mb-5">
          <button
            onClick={() => setTab("units")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${tab === "units" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
          >
            Units
          </button>
          <button
            onClick={() => setTab("assignments")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${tab === "assignments" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
          >
            Assignments
          </button>
          <button
            onClick={() => setTab("team")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${tab === "team" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
          >
            Team
          </button>
        </div>

        {tab === "team" ? (
          <PropertyTeamTab property={property} />
        ) : tab === "assignments" ? (
          <AssignmentList
            property={property}
            employee={employee}
            embedded
            onNew={onAssignmentNew}
            onNewChecklist={onAssignmentNewChecklist}
            onNewQuick={onAssignmentNewQuick}
            onOpen={onAssignmentOpen}
          />
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-serif text-2xl text-stone-900">Units</h2>
              <span className="text-xs font-mono text-stone-500">
                {units.length} total
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={onUnitNew}
                className="p-3 rounded-2xl bg-stone-900 text-stone-50 font-medium text-sm flex items-center justify-center gap-2 active:scale-98"
              >
                <Plus size={16} /> Add one
              </button>
              <button
                onClick={onBulkNew}
                className="p-3 rounded-2xl bg-amber-700 text-stone-50 font-medium text-sm flex items-center justify-center gap-2 active:scale-98"
              >
                <Layers size={16} /> Bulk create
              </button>
            </div>

            {units.length >= 8 && (
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${units.length} units…`}
                className="w-full mb-3 px-4 py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 text-sm"
              />
            )}

            {!loaded ? (
              <Splash text="Loading…" />
            ) : units.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                No units yet. Use "Bulk create" to set up many at once.
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                No units match "{search}".
              </div>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const commonAreas = filtered.filter(
                    (u) => u.kind === "common_area",
                  );
                  const regularUnits = filtered.filter(
                    (u) => u.kind !== "common_area",
                  );
                  const renderUnit = (u) => (
                    <div
                      key={u.id}
                      className={`rounded-2xl border ${u.active ? "bg-white border-stone-200" : "bg-stone-100 border-stone-200 opacity-60"}`}
                    >
                      <button
                        onClick={() => onUnitOpen(u)}
                        className="w-full text-left p-4 hover:border-stone-400 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-serif text-lg text-stone-900 flex items-center gap-2 flex-wrap">
                              {u.label}
                              {u.kind === "common_area" && (
                                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono">
                                  Common
                                </span>
                              )}
                              {u.kind === "townhome" && (
                                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-stone-200 text-stone-700 font-mono">
                                  Townhome
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-stone-500 font-mono">
                              {u.parties?.length || 0}{" "}
                              {u.parties?.length === 1
                                ? u.kind === "common_area"
                                  ? "area"
                                  : "party"
                                : u.kind === "common_area"
                                  ? "areas"
                                  : "parties"}
                            </div>
                          </div>
                          <ChevronRight
                            size={16}
                            className="text-stone-400 flex-shrink-0"
                          />
                        </div>
                      </button>
                      <div className="px-4 pb-3 pt-0">
                        <button
                          onClick={() => onUnitEdit(u)}
                          className="text-xs font-mono text-stone-600 hover:text-stone-900 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-stone-200 hover:border-stone-400 hover:bg-stone-50 active:scale-95 transition"
                        >
                          <Edit2 size={11} /> Edit unit
                        </button>
                      </div>
                    </div>
                  );
                  return (
                    <>
                      {commonAreas.length > 0 && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider font-mono text-amber-800 mb-2 px-1 flex items-center gap-1.5">
                            <Building2 size={11} /> Common areas (
                            {commonAreas.length})
                          </div>
                          <div className="space-y-2">
                            {commonAreas.map(renderUnit)}
                          </div>
                        </div>
                      )}
                      {regularUnits.length > 0 && (
                        <div>
                          {commonAreas.length > 0 && (
                            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-2 px-1">
                              Units ({regularUnits.length})
                            </div>
                          )}
                          <div className="space-y-2">
                            {regularUnits.map(renderUnit)}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
