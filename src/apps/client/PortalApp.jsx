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
  isLead,
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
  isoToLocalInput,
  localInputToISO,
  shiftBillableAmount,
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
  readPhotoTakenAt,
  sharePhotos,
} from "../../lib/photos.js";
import { sessionStore } from "../../domains/auth/sessionStore.js";
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
import { resolveItemLabel } from "../../lib/pickerLabels.js";
import { generatePortalUserCode } from "../../lib/portal.js";
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
import { PortalSignIn } from "../../domains/auth/PortalSignIn.jsx";
import { PortalPropertyPicker } from "../../domains/properties/portal/PortalPropertyPicker.jsx";
import { PortalDashboard } from "./PortalDashboard.jsx";

export function PortalApp({
  previewMode = false,
  previewEmployee = null,
  onExitPreview = null,
}) {
  const [portalUser, setPortalUser] = useState(null); // the portal_users row
  const [properties, setProperties] = useState([]); // all props this user can access
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Load properties for a given portal user
  const loadProperties = async (userId) => {
    const { data } = await supabase
      .from("portal_user_properties")
      .select("property:customers(*)")
      .eq("portal_user_id", userId);
    const props = (data || [])
      .map((r) => r.property)
      .filter((p) => p && p.active)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return props;
  };

  useEffect(() => {
    // Owner "Preview as PM": synthetic PM user + all multi-unit properties.
    if (previewMode) {
      (async () => {
        const synth = {
          id: null,
          name: previewEmployee?.name || "Owner",
          kind: "property_manager",
          __preview: true,
        };
        const { data } = await supabase
          .from("customers")
          .select("*")
          .eq("active", true)
          .eq("property_type", "multi_unit")
          .order("name");
        const props = data || [];
        setPortalUser(synth);
        setProperties(props);
        if (props.length === 1) setSelectedProperty(props[0]);
        setLoaded(true);
      })();
      return;
    }
    // Auto-restore previous portal session
    (async () => {
      try {
        const stored = localStorage.getItem("tidytrack_portal");
        if (stored) {
          const parsed = JSON.parse(stored);
          // New format: { userId, propertyId, code }
          if (parsed.userId) {
            const { data: pu } = await supabase
              .from("portal_users")
              .select("*")
              .eq("id", parsed.userId)
              .eq("active", true)
              .maybeSingle();
            if (pu) {
              const props = await loadProperties(pu.id);
              setPortalUser(pu);
              setProperties(props);
              // Re-select previously-viewed property if it's still in their list
              const stillThere = props.find((p) => p.id === parsed.propertyId);
              if (stillThere) setSelectedProperty(stillThere);
              else if (props.length === 1) setSelectedProperty(props[0]);
            } else {
              localStorage.removeItem("tidytrack_portal");
            }
          } else if (parsed.code) {
            // Old localStorage format — restore via the secure function
            // (the app can't read portal_users by code once locked).
            const pu = await securePortalSignIn(parsed.code);
            if (pu) {
              const props = await loadProperties(pu.id);
              setPortalUser(pu);
              setProperties(props);
              const stillThere = props.find((p) => p.id === parsed.propertyId);
              if (stillThere) setSelectedProperty(stillThere);
              else if (props.length === 1) setSelectedProperty(props[0]);
              // Upgrade localStorage to the new format
              localStorage.setItem(
                "tidytrack_portal",
                JSON.stringify({
                  userId: pu.id,
                  propertyId:
                    stillThere?.id || (props.length === 1 ? props[0].id : null),
                  code: pu.code,
                }),
              );
            } else {
              localStorage.removeItem("tidytrack_portal");
            }
          }
        }
      } catch (e) {
        console.warn("[portal] auto-restore failed", e);
      }
      setLoaded(true);
    })();
  }, [previewMode]);

  const onSignIn = async (user, props) => {
    setPortalUser(user);
    setProperties(props);
    // If only 1 property, auto-select it
    const auto = props.length === 1 ? props[0] : null;
    setSelectedProperty(auto);
    localStorage.setItem(
      "tidytrack_portal",
      JSON.stringify({
        userId: user.id,
        propertyId: auto?.id || null,
        code: user.code,
      }),
    );
  };

  const onPickProperty = (prop) => {
    setSelectedProperty(prop);
    if (previewMode) return;
    localStorage.setItem(
      "tidytrack_portal",
      JSON.stringify({
        userId: portalUser.id,
        propertyId: prop.id,
        code: portalUser.code,
      }),
    );
  };

  const onBackToPicker = () => {
    setSelectedProperty(null);
    if (previewMode) return;
    localStorage.setItem(
      "tidytrack_portal",
      JSON.stringify({
        userId: portalUser.id,
        propertyId: null,
        code: portalUser.code,
      }),
    );
  };

  const onSignOut = () => {
    if (previewMode) {
      onExitPreview && onExitPreview();
      return;
    }
    localStorage.removeItem("tidytrack_portal");
    setPortalUser(null);
    setProperties([]);
    setSelectedProperty(null);
  };

  // Refresh the selected property record + reload properties list
  const refreshProperty = async () => {
    if (previewMode || !portalUser || !portalUser.id) return;
    const props = await loadProperties(portalUser.id);
    setProperties(props);
    if (selectedProperty) {
      const fresh = props.find((p) => p.id === selectedProperty.id);
      if (fresh) setSelectedProperty(fresh);
      else setSelectedProperty(null); // they were detached from this property
    }
  };

  const withPreviewBanner = (node) =>
    previewMode ? (
      <div className="min-h-screen bg-stone-50">
        <div className="bg-indigo-600 text-white px-3 py-1 text-[10px] font-mono flex items-center justify-between gap-2 sticky top-0 z-50">
          <div className="flex items-center gap-1.5 min-w-0">
            <Eye size={11} className="flex-shrink-0" />
            <span className="font-bold">Preview · PM</span>
            <span className="text-white/70 truncate hidden sm:inline">
              — what your PMs see
            </span>
          </div>
          <button
            onClick={() => onExitPreview && onExitPreview()}
            className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 flex-shrink-0"
          >
            Exit
          </button>
        </div>
        {node}
      </div>
    ) : (
      node
    );

  if (!loaded) return withPreviewBanner(<Splash text="Loading…" />);
  if (!portalUser) return <PortalSignIn onSignIn={onSignIn} />;
  if (!selectedProperty) {
    return withPreviewBanner(
      <PortalPropertyPicker
        portalUser={portalUser}
        properties={properties}
        onPick={onPickProperty}
        onSignOut={onSignOut}
      />,
    );
  }
  return withPreviewBanner(
    <PortalDashboard
      property={selectedProperty}
      portalKind={portalUser.kind}
      portalUser={portalUser}
      properties={properties}
      onSwitchProperty={onPickProperty}
      hasMultipleProperties={properties.length > 1}
      onBackToPicker={onBackToPicker}
      onSignOut={onSignOut}
      onRefreshProperty={refreshProperty}
    />,
  );
}
