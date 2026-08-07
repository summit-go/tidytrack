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
import { PortalUserForm } from "../team/PortalUserForm.jsx";

export function PortalUsersAdmin({ employee, onBack }) {
  const [view, setView] = useState({ kind: "list" }); // list | edit
  const [users, setUsers] = useState([]);
  const [props, setProps] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const load = async () => {
    const [usersRes, propsRes, linksRes] = await Promise.all([
      supabase.from("portal_users").select("*").order("name"),
      supabase.from("customers").select("*").eq("active", true).order("name"),
      supabase.from("portal_user_properties").select("*"),
    ]);
    // Attach assigned property objects to each user
    const linksByUser = {};
    (linksRes.data || []).forEach((l) => {
      if (!linksByUser[l.portal_user_id]) linksByUser[l.portal_user_id] = [];
      linksByUser[l.portal_user_id].push(l.property_id);
    });
    const propsById = {};
    (propsRes.data || []).forEach((p) => {
      propsById[p.id] = p;
    });
    const enriched = (usersRes.data || []).map((u) => ({
      ...u,
      properties: (linksByUser[u.id] || [])
        .map((pid) => propsById[pid])
        .filter(Boolean),
    }));
    setUsers(enriched);
    setProps(propsRes.data || []);
    setLoaded(true);
  };
  useEffect(() => {
    load();
  }, []);

  if (!loaded) return <Splash text="Loading…" />;

  if (view.kind === "edit") {
    return (
      <PortalUserForm
        employee={employee}
        user={view.user}
        allProperties={props}
        onCancel={() => setView({ kind: "list" })}
        onSaved={() => {
          setView({ kind: "list" });
          load();
        }}
      />
    );
  }

  const visible = users.filter((u) => showInactive || u.active);

  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100"
        >
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
            Admin
          </div>
          <h1 className="font-serif text-2xl text-stone-900">
            PMs &amp; property owners
          </h1>
        </div>
      </div>

      <div className="px-5 pt-4">
        <button
          onClick={() => setView({ kind: "edit", user: null })}
          className="w-full mb-4 p-4 rounded-2xl bg-stone-900 text-stone-50 font-medium flex items-center justify-center gap-2 active:scale-98"
        >
          <Plus size={18} /> Add portal user
        </button>

        <label className="flex items-center gap-2 text-xs font-mono text-stone-500 mb-4">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>

        {visible.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No portal users yet. Tap "Add portal user" above.
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((u) => (
              <button
                key={u.id}
                onClick={() => setView({ kind: "edit", user: u })}
                className={`w-full p-4 rounded-2xl bg-white border text-left active:scale-[0.99] transition-transform ${u.active ? "border-stone-200" : "border-stone-200 opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-serif text-lg text-stone-900 truncate">
                        {u.name}
                      </span>
                      <span
                        className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-mono ${
                          u.kind === "property_owner"
                            ? "bg-amber-100 text-amber-900"
                            : u.kind === "pm_staff"
                              ? "bg-stone-200 text-stone-700"
                              : "bg-stone-900 text-stone-50"
                        }`}
                      >
                        {u.kind === "property_owner"
                          ? "OWNER"
                          : u.kind === "pm_staff"
                            ? "STAFF"
                            : "PM"}
                      </span>
                      {!u.active && (
                        <span className="text-[10px] font-mono text-stone-400">
                          inactive
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-stone-500 font-mono mb-1">
                      Code: {u.code}
                    </div>
                    <div className="text-xs text-stone-600">
                      {u.properties.length === 0 ? (
                        <span className="text-red-600">
                          No properties assigned
                        </span>
                      ) : (
                        <>
                          <span className="text-stone-500">Properties: </span>
                          {u.properties.map((p) => p.name).join(", ")}
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-stone-400 flex-shrink-0 mt-1"
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
