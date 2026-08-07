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

export function PortalTeamModal({ property, portalUser, onClose }) {
  const [users, setUsers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [detaching, setDetaching] = useState(null);

  const load = async () => {
    setLoaded(false);
    const { data: links } = await supabase
      .from("portal_user_properties")
      .select("portal_user:portal_users(*)")
      .eq("property_id", property.id);
    const all = (links || []).map((l) => l.portal_user).filter(Boolean);
    setUsers(all);
    setLoaded(true);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [property.id]);

  const detach = async (user) => {
    if (
      !confirm(
        `Remove ${user.name} from ${property.name}? They'll lose access to this property but keep access to any others.`,
      )
    )
      return;
    setDetaching(user.id);
    const { error } = await supabase
      .from("portal_user_properties")
      .delete()
      .eq("portal_user_id", user.id)
      .eq("property_id", property.id);
    setDetaching(null);
    if (error) {
      alert("Could not remove: " + error.message);
      return;
    }
    load();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-stone-900/60" onClick={onClose} />
      <div className="relative bg-stone-50 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
        <div className="px-5 py-4 border-b border-stone-200 bg-white flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-mono text-amber-700">
              Property team
            </div>
            <div className="font-serif text-lg text-stone-900 truncate">
              {property.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-100 flex-shrink-0"
          >
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {!loaded ? (
            <div className="text-center text-sm text-stone-400 py-8">
              Loading…
            </div>
          ) : users.length === 0 ? (
            <div className="text-center text-sm text-stone-400 py-8">
              No one else has access to this property.
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => {
                const isYou = u.id === portalUser?.id;
                const isOtherOwner = u.kind === "property_owner" && !isYou;
                const canDetach = !isYou && !isOtherOwner;
                return (
                  <div
                    key={u.id}
                    className="p-3 rounded-2xl bg-white border border-stone-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-stone-900 truncate">
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
                          {isYou && (
                            <span className="text-[10px] font-mono text-stone-400">
                              (you)
                            </span>
                          )}
                        </div>
                        {u.phone && (
                          <div className="text-xs text-stone-500">
                            {u.phone}
                          </div>
                        )}
                      </div>
                      {canDetach && (
                        <button
                          onClick={() => detach(u)}
                          disabled={detaching === u.id}
                          className="px-3 py-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-700 text-xs font-mono flex-shrink-0 active:scale-95 disabled:opacity-50"
                        >
                          {detaching === u.id ? "…" : "Remove"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 p-3 rounded-xl bg-stone-100 text-xs text-stone-600">
            To add a new PM, contact Summit Clean. You can only remove non-owner
            team members from this property.
          </div>
        </div>
      </div>
    </div>
  );
}
