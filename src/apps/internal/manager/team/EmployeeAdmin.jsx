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
import { sessionStore } from "../../../../domains/auth/sessionStore.js";
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
import { EmployeeForm } from "./EmployeeForm.jsx";

export function EmployeeAdmin({ employee, onSignOut, onOpenMessages, onLogoClick }) {
  const [employees, setEmployees] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const load = async () => {
    const { data } = await supabase
      .from("employees")
      .select("*")
      .order("active", { ascending: false })
      .order("name");
    setEmployees(data || []);
    setLoaded(true);
  };
  useEffect(() => {
    load();
  }, []);

  // Quick activate / deactivate from the list — no need to open the edit
  // form. Deactivating warns first because it's a meaningful action
  // (they can't sign in). Activating is one tap.
  const toggleActive = async (e) => {
    if (e.id === employee.id && e.active) {
      alert("You can't deactivate your own account from here.");
      return;
    }
    const turningOff = e.active;
    if (
      turningOff &&
      !confirm(
        `Deactivate ${e.name}? They won't be able to sign in until reactivated.`,
      )
    ) {
      return;
    }
    setTogglingId(e.id);
    const { error } = await supabase
      .from("employees")
      .update({ active: !e.active })
      .eq("id", e.id);
    setTogglingId(null);
    if (error) {
      alert("Could not update: " + error.message);
      return;
    }
    load();
  };

  if (!loaded) return <Splash text="Loading…" />;
  if (editing) {
    return (
      <EmployeeForm
        employee={editing === "new" ? null : editing}
        currentUserId={employee.id}
        currentUserRole={employee.role}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }
  const visible = employees.filter((e) => showInactive || e.active);
  const activeCount = employees.filter((e) => e.active).length;
  return (
    <div className="pb-24">
      <ScreenId id="OW-TEAM" />
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
          Your <span className="font-serif italic text-amber-700">team</span>
        </h1>
        <p className="text-stone-500 text-sm mb-6">{activeCount} active</p>
        <button
          onClick={() => setEditing("new")}
          className="w-full mb-4 p-4 rounded-2xl bg-stone-900 text-stone-50 font-medium flex items-center justify-center gap-2 active:scale-98"
        >
          <UserPlus size={18} /> Add employee
        </button>
        <button
          onClick={() => setShowInactive(!showInactive)}
          className="text-xs font-mono text-stone-500 mb-4 flex items-center gap-1.5"
        >
          {showInactive ? <EyeOff size={12} /> : <Eye size={12} />}
          {showInactive ? "Hide" : "Show"} inactive (
          {employees.length - activeCount})
        </button>
        <div className="space-y-2">
          {visible.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              No employees yet.
            </div>
          ) : (
            visible.map((e) => {
              const isSelfRow = e.id === employee.id;
              const isToggling = togglingId === e.id;
              return (
                <div
                  key={e.id}
                  onClick={() => setEditing(e)}
                  className={`w-full text-left p-4 rounded-2xl border cursor-pointer ${e.active ? "bg-white border-stone-200 hover:border-stone-400" : "bg-stone-100 border-stone-200 opacity-60"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-serif text-lg text-stone-900">
                          {e.name}
                        </span>
                        {e.role === "owner" && (
                          <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Owner
                          </span>
                        )}
                        {e.role === "manager" && (
                          <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">
                            Manager
                          </span>
                        )}
                        {!e.active && (
                          <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-stone-500 font-mono mb-2">
                        PIN: •••• {isSelfRow && "· (you)"}
                        {canSeeMoney(employee) && e.pay_rate_hourly != null && (
                          <span className="ml-2 text-emerald-700">
                            · ${Number(e.pay_rate_hourly).toFixed(2)}/hr
                          </span>
                        )}
                      </div>
                      {/* Capability summary so owners can scan who has what without
                       drilling into each card. Owners are "Full access" by virtue
                       of their role; others get tiny labelled chips. */}
                      {(() => {
                        if (e.role === "owner") {
                          return (
                            <div className="text-[10px] uppercase tracking-wider font-mono text-amber-700 flex items-center gap-1">
                              <Check size={10} /> Full access
                            </div>
                          );
                        }
                        const r = e.responsibilities || {};
                        const enabled = CAPABILITIES.filter(
                          (c) => r[c.key] === true,
                        );
                        if (enabled.length === 0) {
                          return (
                            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-400 italic">
                              No extra responsibilities
                            </div>
                          );
                        }
                        return (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mr-0.5 self-center">
                              {enabled.length}/{CAPABILITIES.length}:
                            </span>
                            {enabled.map((c) => (
                              <span
                                key={c.key}
                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap"
                              >
                                {c.label}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Inline active toggle — stopPropagation so it doesn't open
                       the edit form. Disabled for self to prevent self-lockout. */}
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          toggleActive(e);
                        }}
                        disabled={isToggling || (isSelfRow && e.active)}
                        title={
                          isSelfRow && e.active
                            ? "Can't deactivate yourself"
                            : e.active
                              ? "Deactivate"
                              : "Activate"
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${e.active ? "bg-emerald-600" : "bg-stone-300"} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${e.active ? "translate-x-5" : "translate-x-0.5"}`}
                        >
                          {isToggling && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <div className="w-2.5 h-2.5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                            </span>
                          )}
                        </span>
                      </button>
                      <ChevronRight size={16} className="text-stone-400" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
