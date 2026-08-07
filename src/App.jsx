import React, { useState, useEffect, useCallback, useRef } from "react";
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
} from "./lib/supabase.js";
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
} from "./lib/constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "./lib/permissions.js";
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
} from "./lib/format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "./lib/compare.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
} from "./lib/photos.js";
import { sessionStore } from "./lib/sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "./lib/translation.js";
import { useAssignmentSync } from "./hooks/useAssignmentSync.js";
import { useIdleDetector } from "./hooks/useIdleDetector.js";
import { usePagePersistence } from "./hooks/usePagePersistence.js";
import { useItemLabelOverrides } from "./hooks/useItemLabelOverrides.js";
import { useTick } from "./hooks/useTick.js";
import { useUnreadCount } from "./hooks/useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "./hooks/useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "./contexts/LocaleContext.jsx";
import { PreviewContext } from "./contexts/PreviewContext.jsx";
import { AssignmentTypeChip } from "./components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "./components/chips/PriorityChip.jsx";
import { Splash } from "./components/Splash.jsx";
import { ScreenId } from "./components/ScreenId.jsx";
import { OwnerOnly } from "./components/OwnerOnly.jsx";
import { DueDateEditor } from "./components/DueDateEditor.jsx";
import { ProgressBar } from "./components/ProgressBar.jsx";
import { CleanerProgressBar } from "./components/CleanerProgressBar.jsx";
import { ConfirmModal } from "./components/ConfirmModal.jsx";
import { AddressLink } from "./components/AddressLink.jsx";
import { TranslatableText } from "./components/TranslatableText.jsx";
import { PhotoModal } from "./components/PhotoModal.jsx";
import { NotificationBell } from "./components/NotificationBell.jsx";
import { Header } from "./components/Header.jsx";
import { TeamClockIcon } from "./components/TeamClockIcon.jsx";
import { TabButton } from "./components/TabButton.jsx";
import { PhotoZoomViewer } from "./components/PhotoZoomViewer.jsx";
import { TranslateButton } from "./components/TranslateButton.jsx";
import { ZoomableImage } from "./components/ZoomableImage.jsx";
import { splitTaskName } from "./lib/tasks.js";
import { buildTargetTitle, unitSizeLabel, shortenBedroom, partyDisplay, unitPartyLabel, bathroomNumberForBedroom } from "./lib/labels.js";
import { ItemsDropdown } from "./apps/staff/cleaner/ItemsDropdown.jsx";
import { RootRouter } from "./apps/RootRouter.jsx";
import { SignIn } from "./apps/staff/SignIn.jsx";
import { ConfigError } from "./apps/staff/ConfigError.jsx";
import { ManagerDashboard } from "./apps/staff/manager/dashboard/ManagerDashboard.jsx";
import { ShiftsByCleanerView } from "./apps/staff/manager/dashboard/ShiftsByCleanerView.jsx";
import { EmployeeAdmin } from "./apps/staff/manager/team/EmployeeAdmin.jsx";
import { PropertyAdmin } from "./apps/staff/manager/properties/PropertyAdmin.jsx";
import { AssignmentsTab } from "./apps/staff/manager/assignments/AssignmentsTab.jsx";
import { QuickAssignmentForm } from "./apps/staff/manager/assignments/QuickAssignmentForm.jsx";
import { AssignmentForm } from "./apps/staff/manager/assignments/AssignmentForm.jsx";
import { AssignmentBanner } from "./apps/staff/manager/assignments/AssignmentBanner.jsx";
import { AssignmentCard } from "./apps/staff/manager/assignments/AssignmentCard.jsx";
import { DailyView } from "./apps/staff/manager/daily/DailyView.jsx";
import { BedroomHistoryView } from "./apps/staff/manager/daily/BedroomHistoryView.jsx";
import { SearchableUnitPicker } from "./apps/staff/cleaner/SearchableUnitPicker.jsx";
import { SupplyChecklistGate } from "./apps/staff/cleaner/SupplyChecklistGate.jsx";
import { SupplyChecklistManager } from "./apps/staff/cleaner/SupplyChecklistManager.jsx";
import { BedBathPicker } from "./apps/staff/cleaner/BedBathPicker.jsx";
import { RequestItemsModal } from "./apps/staff/cleaner/RequestItemsModal.jsx";
import { TaskCategoryPicker } from "./apps/staff/cleaner/TaskCategoryPicker.jsx";
import { EditItemLabelModal } from "./apps/staff/cleaner/EditItemLabelModal.jsx";
import { EmployeeApp } from "./apps/staff/cleaner/EmployeeApp.jsx";
import { WhosHerePopup } from "./apps/staff/cleaner/WhosHerePopup.jsx";
import { CleanerMoreExtras } from "./apps/staff/cleaner/CleanerMoreExtras.jsx";
import { CleanerBottomNav } from "./apps/staff/cleaner/CleanerBottomNav.jsx";
import { OthersActivityToday } from "./apps/staff/cleaner/OthersActivityToday.jsx";
import { ClosedBlockMenu } from "./apps/staff/cleaner/ClosedBlockMenu.jsx";
import { ApartmentProgressList } from "./apps/staff/cleaner/ApartmentProgressList.jsx";
import { FloorFocusList } from "./apps/staff/cleaner/FloorFocusList.jsx";
import { TodayApartmentsCard } from "./apps/staff/cleaner/TodayApartmentsCard.jsx";
import { YourJobsCard } from "./apps/staff/cleaner/YourJobsCard.jsx";
import { AssignPicker } from "./apps/staff/cleaner/AssignPicker.jsx";
import { WhosWorkingNowModal } from "./apps/staff/cleaner/WhosWorkingNowModal.jsx";
import { JobPeekModal } from "./apps/staff/cleaner/JobPeekModal.jsx";
import { AssignmentWorkHistory } from "./apps/staff/cleaner/AssignmentWorkHistory.jsx";
import { CleanerWorkList } from "./apps/staff/cleaner/CleanerWorkList.jsx";
import { CleanerPropertiesList } from "./apps/staff/cleaner/CleanerPropertiesList.jsx";
import { PropertyHub } from "./apps/staff/cleaner/PropertyHub.jsx";
import { CleanerMenuSheet } from "./apps/staff/cleaner/CleanerMenuSheet.jsx";
import { OtherCleanersActivity } from "./apps/staff/cleaner/OtherCleanersActivity.jsx";
import { OtherCleanersTasksPanel } from "./apps/staff/cleaner/OtherCleanersTasksPanel.jsx";
import { OtherWorkblocksHere } from "./apps/staff/cleaner/OtherWorkblocksHere.jsx";
import { InlineBedroomTasks } from "./apps/staff/cleaner/InlineBedroomTasks.jsx";
import { PreparingBlockView } from "./apps/staff/cleaner/PreparingBlockView.jsx";
import { UndoMoveMenu } from "./apps/staff/cleaner/UndoMoveMenu.jsx";
import { BlockView } from "./apps/staff/cleaner/BlockView.jsx";
import { MoveBlockModalInline } from "./apps/staff/cleaner/MoveBlockModalInline.jsx";
import { SimpleShiftView } from "./apps/staff/cleaner/SimpleShiftView.jsx";
import { PropertyPicker } from "./apps/staff/cleaner/PropertyPicker.jsx";
import { ViewOnlyDashboard } from "./apps/staff/cleaner/ViewOnlyDashboard.jsx";
import { ViewOnlyAssignmentsPanel } from "./apps/staff/cleaner/ViewOnlyAssignmentsPanel.jsx";
import { UnitPicker } from "./apps/staff/cleaner/UnitPicker.jsx";
import { PartyPicker } from "./apps/staff/cleaner/PartyPicker.jsx";
import { SectionPicker } from "./apps/staff/cleaner/SectionPicker.jsx";
import { ActiveWorkblockCard } from "./apps/staff/cleaner/ActiveWorkblockCard.jsx";
import { TaskCard } from "./apps/staff/cleaner/TaskCard.jsx";
import { AssignmentsPanel } from "./apps/staff/cleaner/AssignmentsPanel.jsx";
import { MoveBlockModal } from "./apps/staff/cleaner/MoveBlockModal.jsx";
import { LiveCleanersSheet } from "./apps/staff/cleaner/LiveCleanersSheet.jsx";
import { PortalMenuSheet } from "./apps/portal/PortalMenuSheet.jsx";
import { PortalTeamModal } from "./apps/portal/PortalTeamModal.jsx";
import { ChangePortalCodeModal } from "./apps/portal/ChangePortalCodeModal.jsx";
import { PortalLangToggle } from "./apps/portal/PortalLangToggle.jsx";
import { PortalHome } from "./apps/portal/PortalHome.jsx";
import { PortalInvoicesTab } from "./apps/portal/PortalInvoicesTab.jsx";
import { PortalHistoryTab } from "./apps/portal/PortalHistoryTab.jsx";
import { PortalUnitDay } from "./apps/portal/PortalUnitDay.jsx";
import { ResolvedDamageHistory } from "./apps/portal/ResolvedDamageHistory.jsx";
import { PortalPhotoSection } from "./apps/portal/PortalPhotoSection.jsx";
import { PortalPhotoUploadTab } from "./apps/portal/PortalPhotoUploadTab.jsx";
import { PortalScheduleTab } from "./apps/portal/PortalScheduleTab.jsx";
import { PortalAssignmentsTab } from "./apps/portal/PortalAssignmentsTab.jsx";
import { PortalAssignmentSection } from "./apps/portal/PortalAssignmentSection.jsx";
import { PortalAssignmentForm } from "./apps/portal/PortalAssignmentForm.jsx";
import { RecheckRequestModal } from "./apps/portal/RecheckRequestModal.jsx";
import { PortalAssignmentDetail } from "./apps/portal/PortalAssignmentDetail.jsx";
import { ReviewRecheckModal } from "./apps/portal/ReviewRecheckModal.jsx";
import { WorkBlockAssignmentLink } from "./apps/cross-cutting/WorkBlockAssignmentLink.jsx";
import { SpanishTranslationPanel } from "./apps/cross-cutting/SpanishTranslationPanel.jsx";
import { WelcomeModal } from "./apps/cross-cutting/WelcomeModal.jsx";
import { IdleWarningModal } from "./apps/cross-cutting/IdleWarningModal.jsx";
import { ChangePinModal } from "./apps/cross-cutting/ChangePinModal.jsx";
import { TranslationOverridesModal } from "./apps/cross-cutting/TranslationOverridesModal.jsx";
import { SheetQuickViewModal } from "./apps/cross-cutting/SheetQuickViewModal.jsx";
import { ReviewLine } from "./apps/cross-cutting/ReviewLine.jsx";
import { NextUpModal } from "./apps/cross-cutting/NextUpModal.jsx";
import { SwitchBedroomModal } from "./apps/cross-cutting/SwitchBedroomModal.jsx";
import { ReassignModal } from "./apps/cross-cutting/ReassignModal.jsx";
import { AttachmentModal } from "./apps/cross-cutting/AttachmentModal.jsx";
import { BlockedNoteModal } from "./apps/cross-cutting/BlockedNoteModal.jsx";
import { RequestNewItemModal } from "./apps/cross-cutting/RequestNewItemModal.jsx";
import { ReviewAssignmentModal } from "./apps/cross-cutting/ReviewAssignmentModal.jsx";
import { AssignmentViewer } from "./apps/cross-cutting/AssignmentViewer.jsx";
import { ChecklistAssignmentView } from "./apps/cross-cutting/ChecklistAssignmentView.jsx";
import { SuggestedTabContent } from "./apps/cross-cutting/SuggestedTabContent.jsx";
import { ChecklistAssignmentWizard } from "./apps/cross-cutting/ChecklistAssignmentWizard.jsx";
import { AssignmentTabContent } from "./apps/cross-cutting/AssignmentTabContent.jsx";

// =================================================================
// Top-level App
// =================================================================
export default function App() {
  // Hash-based routing so we can have different routes (#/portal, #/staff, etc.)
  // without setting up react-router.
  const [route, setRoute] = useState(() => window.location.hash || "");

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || "");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Shrink text + spacing slightly on phones so dense cards fit more info
  // without cramming. rem-based (Tailwind) sizes scale with the root font.
  useEffect(() => {
    const id = "tt-mobile-scale";
    if (document.getElementById(id)) return;
    const st = document.createElement("style");
    st.id = id;
    st.textContent = "@media (max-width: 640px){ html{ font-size: 14.5px; } }";
    document.head.appendChild(st);
  }, []);

  // Decide which screen to mount, then wrap in TranslationProvider so
  // the Spanish toggle works across every surface (cleaner, PM, owner).
  let inner;
  if (route.startsWith("#/portal") || route.startsWith("#portal")) {
    inner = <PortalApp />;
  } else if (route.startsWith("#/staff") || route.startsWith("#staff")) {
    inner = <StaffApp />;
  } else {
    inner = <RootRouter />;
  }
  return <TranslationProvider>{inner}</TranslationProvider>;
}

export function StaffApp() {
  const [session, setSession] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    if (
      SUPABASE_URL.includes("PASTE_") ||
      SUPABASE_ANON_KEY.includes("PASTE_")
    ) {
      setConfigError(true);
      setLoaded(true);
      return;
    }
    (async () => {
      const s = await sessionStore.get();
      if (s?.employeeId) {
        const { data } = await supabase
          .from("employees")
          .select("*")
          .eq("id", s.employeeId)
          .maybeSingle();
        if (data) setSession({ employee: data });
        else await sessionStore.clear();
      }
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return <Splash text="Loading…" />;
  if (configError) return <ConfigError />;

  if (!session) {
    return (
      <SignIn
        onSignIn={async (employee) => {
          // Remember they chose staff (in case localStorage was cleared)
          try {
            localStorage.setItem("tt_role_choice", "staff");
          } catch {}
          // Apply per-employee language pref before any UI mounts so the
          // cleaner sees the right locale immediately on this device.
          if (employee?.locale) {
            try {
              localStorage.setItem("tidytrack_locale", employee.locale);
            } catch {}
          }
          await sessionStore.set({ employeeId: employee.id });
          setSession({ employee });
        }}
      />
    );
  }
  const signOut = async () => {
    // Clear any persisted "preview as cleaner/PM" flags so a deliberate
    // sign-out doesn't drop the owner back into a preview session on their
    // next login. (These are keyed per-employee, so they never leak between
    // users — this is just for the same owner signing back in.)
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith("tidytrack_page_manager_preview_"))
          localStorage.removeItem(k);
      }
    } catch {}
    await sessionStore.clear();
    setSession(null);
  };
  // Beta testers (is_beta_tester=true) get a sticky top toggle bar
  // letting them swap between BETA / EMPLOYEE / PM views. The flag is
  // set via SQL on a dedicated test-harness employee row — your real
  // owner account stays untouched.
  if (session.employee.is_beta_tester) {
    return <BetaShell employee={session.employee} onSignOut={signOut} />;
  }
  if (
    session.employee.role === "manager" ||
    session.employee.role === "owner"
  ) {
    return <ManagerShell employee={session.employee} onSignOut={signOut} />;
  }
  // Cleaner path. The supply checklist gate now lives inside EmployeeApp so it
  // also covers Beta accounts and preview — see the gate there.
  return <EmployeeApp employee={session.employee} onSignOut={signOut} />;
}

// =================================================================
// BETA SHELL — wraps the appropriate inner shell (ManagerShell /
// EmployeeApp / PortalShell-stub) based on the current view. Only
// rendered for employees with is_beta_tester=true.
//
// View state is persisted to localStorage so a reload keeps you in
// whichever view you were last in. Window global is mirrored so any
// component anywhere in the tree can check the active view without
// needing context plumbing (matches the locale pattern).
// =================================================================
const BETA_VIEW_LS_KEY = "tidytrack_beta_view";
function readBetaView() {
  try {
    const v = localStorage.getItem(BETA_VIEW_LS_KEY);
    if (v === "beta" || v === "employee" || v === "pm") return v;
  } catch {}
  return "beta";
}
function writeBetaView(v) {
  try {
    localStorage.setItem(BETA_VIEW_LS_KEY, v);
  } catch {}
  if (typeof window !== "undefined") window.__tidytrack_beta_view = v;
}
// Gate helper used by features that want to render only inside the
// BETA view of a beta-tester account. Closed for everyone else even
// if they somehow set the window global manually.
function isBetaFeaturesEnabled(employee) {
  if (!employee?.is_beta_tester) return false;
  const v =
    (typeof window !== "undefined" && window.__tidytrack_beta_view) || "beta";
  return v === "beta";
}

function BetaShell({ employee, onSignOut }) {
  const [view, setView] = useState(readBetaView());
  // Mirror to window global so deep components can read without prop drilling
  useEffect(() => {
    writeBetaView(view);
  }, [view]);
  // On mount, set the global once (in case something reads it before
  // the effect runs in StrictMode dev double-render).
  useEffect(() => {
    if (typeof window !== "undefined") window.__tidytrack_beta_view = view;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const VIEWS = [
    { id: "beta", label: "BETA", desc: "Admin + new features" },
    { id: "employee", label: "EMPLOYEE", desc: "What cleaners see" },
    { id: "pm", label: "PM", desc: "What property managers see" },
  ];
  const banner = (
    <div className="fixed top-0 inset-x-0 z-50 bg-stone-900 text-stone-50 px-2 py-1.5 flex items-center gap-1 shadow-lg">
      <span className="text-[9px] uppercase tracking-widest font-mono text-amber-400 px-1.5 flex-shrink-0">
        Beta
      </span>
      <div className="flex-1 flex items-center gap-1 overflow-x-auto">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
              view === v.id
                ? "bg-amber-500 text-stone-900 font-bold"
                : "bg-stone-800 text-stone-400 hover:text-stone-100"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <button
        onClick={onSignOut}
        className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full text-stone-400 hover:text-stone-100 flex-shrink-0"
      >
        Sign out
      </button>
    </div>
  );
  // Each branch keeps its own state (mount/unmount on switch).
  // That's intentional — a fresh EMPLOYEE view from BETA shows a clean
  // cleaner experience, not a half-finished one.
  let inner;
  if (view === "beta") {
    inner = <ManagerShell employee={employee} onSignOut={onSignOut} />;
  } else if (view === "employee") {
    inner = <EmployeeApp employee={employee} onSignOut={onSignOut} />;
  } else {
    // PM view — implemented in the next turn. Synthetic portalUser
    // injection requires PortalShell refactor we haven't done yet.
    inner = (
      <div className="min-h-screen bg-stone-50 pt-12 flex items-center justify-center">
        <div className="max-w-md mx-auto p-8 text-center">
          <div className="text-xs uppercase tracking-widest text-stone-500 font-mono mb-3">
            Coming soon
          </div>
          <div className="font-serif text-2xl text-stone-900 mb-2">PM view</div>
          <div className="text-sm text-stone-600">
            PM impersonation needs PortalShell adapter work. Shipping in a
            follow-up turn. For now, use BETA or EMPLOYEE.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      {banner}
      {/* Push the inner shell down so the banner doesn't overlap.
         The banner is ~32px tall; pt-9 (36px) gives a tiny buffer. */}
      <div className="pt-9">{inner}</div>
    </div>
  );
}

// =================================================================
// TASK CATEGORY PICKER — structured task starter for cleaners.
// Cleaner picks one of: Bedroom / Bathroom / Vanity / General.
// If General, a row of sub-category chips appears (kitchen, living
// room, hallways, fridge). Sub-categories support multi-select.
//
// Cleaner can also type a custom name to override the auto-filled
// name OR specify (freeform coexists with the structured picker).
//
// On submit:
//   - For single-select categories (bedroom/bathroom/vanity, or
//     general+0-or-1 subcategory): calls onStartOne(name, cat, sub).
//   - For multi-select general: calls onStartMany([{name,cat,sub}, ...])
//     which creates multiple tasks at once (first becomes active,
//     rest are queued for resume).
//
// Props:
//   busy: disabled state from parent
//   onStartOne(name, category, subcategory)
//   onStartMany(taskInputs)  // optional; falls back to onStartOne if not provided
//   defaultName, setDefaultName: shared freeform name state (for the
//                                 existing "type your own name" flow)
// =================================================================
// =================================================================
// PICKER TRANSLATIONS (Spanish)
//
// Static dictionary mapping template_item_key → ES label. Used by
// labelForTarget when the cleaner's locale is 'es'. Keys mirror the
// shape the DB produces ("bedroom:mirror", "general:living_room",
// etc.); the label after the colon is normalized in labelForTarget
// before lookup. Items missing here fall back to humanized English
// which the Google Translate layer (when configured) further
// translates — but the static dictionary avoids API lag for the
// common picker labels.
//
// Cleaners can override any of these per-property via the
// item_label_overrides table; the lookup order is:
//   override(property, key, locale) > dictionary(key) > English
// =================================================================
const PICKER_ES = {
  // Sections
  __section_bedroom: "Dormitorio",
  __section_bathroom: "Baño",
  __section_vanity: "Tocador",
  __section_general: "General",
  // General subgroup labels (group letters)
  __general_group_a: "Sala / Patio / Calentador",
  __general_group_b: "Refri / Microondas / Pasillo",
  __general_group_c: "Ventilas / Estufa / Horno / Lavavajillas",
  __general_group_d: "Cocina",
  // General subcategory items
  "general:living_room": "Sala",
  "general:patio": "Patio",
  "general:water_heater": "Calentador de agua",
  "general:hallways": "Pasillo",
  "general:refrigerator": "Refrigerador",
  "general:freezer": "Congelador",
  "general:microwave": "Microondas",
  "general:breezeway": "Pasillo exterior",
  "general:vents": "Ventilas",
  "general:stove": "Estufa",
  "general:oven": "Horno",
  "general:dishwasher": "Lavavajillas",
  "general:kitchen": "Cocina",
  // Common Bedroom items (best-effort — extend as the team adds more)
  "bedroom:bed": "Cama",
  "bedroom:nightstand": "Mesa de noche",
  "bedroom:dresser": "Cómoda",
  "bedroom:mirror": "Espejo",
  "bedroom:closet": "Clóset",
  "bedroom:windows": "Ventanas",
  "bedroom:blinds": "Persianas",
  "bedroom:floor": "Piso",
  "bedroom:baseboards": "Zócalos",
  "bedroom:fan": "Ventilador",
  "bedroom:light_fixture": "Lámpara",
  "bedroom:outlets": "Tomacorrientes",
  "bedroom:doors": "Puertas",
  "bedroom:walls": "Paredes",
  // Common Bathroom items
  "bathroom:toilet": "Inodoro",
  "bathroom:shower": "Ducha",
  "bathroom:tub": "Tina",
  "bathroom:sink": "Lavabo",
  "bathroom:mirror": "Espejo",
  "bathroom:floor": "Piso",
  "bathroom:walls": "Paredes",
  "bathroom:vent": "Ventila",
  "bathroom:cabinets": "Gabinetes",
  // Common Vanity items
  "vanity:counter": "Mesón",
  "vanity:sink": "Lavabo",
  "vanity:faucet": "Grifo",
  "vanity:mirror": "Espejo",
  "vanity:cabinets": "Gabinetes",
  "vanity:floor": "Piso",
  // Common request keys
  "requested:extra_item": "Tarea adicional",
};

// Resolve a label for an item key in the current locale.
// Lookup order: override > dictionary > humanized English fallback.
// English display labels for template item keys, keyed by
// `${section}:${item_key}`. Sourced from section_template_items so the
// app shows the clean stored label (e.g. 'Breezeway sweep') instead of
// a humanized key ('Bw sweep'). Falls through to humanize for any key
// not listed here.
const PICKER_EN = {
  "general:sink_short": "Sink",
  "general:faucet_short": "Faucet",
  "general:under_sink": "Under sink",
  "general:counter_tops": "Counter tops",
  "general:cupboards_oiled": "Cupboards oiled",
  "general:drawers_oiled": "Drawers oiled",
  "general:kitchen_floor": "Kitchen floor",
  "general:table_chairs_short": "Table/chairs",
  "general:kitchen_walls_short": "Walls",
  "general:baseboards": "Baseboards",
  "general:lt_switches": "Light switches",
  "general:lt_fixtures": "Light fixtures",
  "general:trash": "Trash",
  "vanity:sink": "Sink",
  "vanity:faucet": "Faucet",
  "vanity:counter": "Counter",
  "vanity:mirror": "Mirror",
  "vanity:lt_switch": "Light switch",
  "vanity:walls": "Walls",
  "vanity:floor": "Floor",
  "vanity:baseboard": "Baseboard",
  "vanity:door_knob": "Door knob",
  "bathroom:tub": "Tub",
  "bathroom:faucet": "Faucet",
  "bathroom:tub_walls": "Tub walls",
  "bathroom:walls_above_tub": "Walls above tub",
  "bathroom:door_knob": "Door knobs",
  "bathroom:light_fixtures": "Light fixtures",
  "bathroom:lt_switch": "Light switches",
  "bedroom:vacuum_entire": "Vacuum",
  "bedroom:dust": "Dust",
  "bedroom:lt_switch": "Light switch",
  "bedroom:dr_knob": "Door knob",
  "bedroom:top_df_ct": "Top of door frame & closet trim",
  "bedroom:window_blinds": "Blinds",
  "bedroom:window_track": "Window track",
  "bedroom:window_sill": "Window sill",
  "bedroom:window_walls": "Window walls",
  "bedroom:baseboard": "Baseboard",
  "general:lrm_vac": "LRM vac",
  "general:hw_mop_vac": "HW mop/vac",
  "general:lrm_hw_bb": "LRM/HW baseboards",
  "general:lrm_hw_walls": "LRM/HW walls",
  "general:dust_furniture": "Dust furniture",
  "general:lamp_shades": "Lamp/shades",
  "general:under_cushions": "Under cushions",
  "general:blinds": "Blinds",
  "general:patio_door": "Patio door",
  "general:track": "Track",
  "general:patio_walls": "Patio walls",
  "general:patio_floor": "Patio floor",
  "general:top_water_heater": "Top of water heater",
  "general:heater_closet_floor": "Heater closet floor",
  "general:stove_top_short": "Stove top",
  "general:hood": "Hood",
  "general:under_burners": "Under burners",
  "general:rings_spill_pan": "Rings/spill pan",
  "general:oven_inside_short": "Oven inside",
  "general:oven_outside": "Oven outside",
  "general:oven_handle": "Oven handle",
  "general:drawer_handle": "Drawer handle",
  "general:drawer": "Drawer",
  "general:dishwasher_inside": "Dishwasher inside",
  "general:dishwasher_outside": "Dishwasher outside",
  "general:vents_4": "Vents in hallway (4)",
  "bathroom:toilet_ring": "Toilet/ring",
  "bathroom:fan_vent": "Fan vent",
  "bathroom:walls": "Walls",
  "bathroom:baseboard": "Baseboard",
  "bathroom:floor": "Floor",
  "bathroom:ceiling_mold": "Ceiling mold",
  "general:fridge_top": "Fridge outside/top",
  "general:fridge_drawers": "Fridge inside/drawers",
  "general:fridge_gasket": "Fridge rubber gasket",
  "general:freezer_inside": "Freezer inside",
  "general:freezer_gasket": "Freezer rubber gasket",
  "general:microwave_short": "Microwave",
  "general:bw_sweep": "Breezeway sweep",
  "general:bw_vacuum": "Breezeway vacuum",
  "general:bw_walls": "Breezeway walls",
  "general:fd_inside": "Front door inside",
  "general:fd_outside": "Front door outside",
  "general:doorbell": "Doorbell",
  "general:bw_ceiling": "Breezeway ceiling around front door",
  "general:front_room_closet": "Front room closet",
};

export function resolveItemLabel(key, locale, overrides, englishFallback) {
  if (overrides && overrides.has(key)) return overrides.get(key);
  if (locale === "es" && PICKER_ES[key]) return PICKER_ES[key];
  if (PICKER_EN[key]) return PICKER_EN[key];
  return englishFallback;
}

// Reads the "date taken" (EXIF DateTimeOriginal) out of a JPEG the cleaner
// uploaded, so we can show when a photo was actually shot — not just when it
// was uploaded. Self-contained (no library). Returns an ISO-ish local string
// or null when the file has no EXIF date (screenshots, edited/stripped
// images, non-JPEGs). Never throws.
async function readPhotoTakenAt(file) {
  try {
    if (!file || !file.arrayBuffer) return null;
    const buf = await file.arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // not JPEG
    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset);
      if (marker === 0xffe1) {
        // APP1 (EXIF)
        const exifStart = offset + 4;
        if (view.getUint32(exifStart) !== 0x45786966) return null; // "Exif"
        const tiff = exifStart + 6;
        const little = view.getUint16(tiff) === 0x4949;
        const u16 = (o) => view.getUint16(o, little);
        const u32 = (o) => view.getUint32(o, little);
        const ifd0 = tiff + u32(tiff + 4);
        const readDate = (ifd) => {
          const n = u16(ifd);
          for (let i = 0; i < n; i++) {
            const e = ifd + 2 + i * 12;
            const tag = u16(e);
            if (tag === 0x9003 || tag === 0x0132) {
              // DateTimeOriginal / DateTime
              const valOff = tiff + u32(e + 8);
              let s = "";
              for (let j = 0; j < 19 && valOff + j < view.byteLength; j++)
                s += String.fromCharCode(view.getUint8(valOff + j));
              const m = s.match(
                /^(\d{4}):(\d{2}):(\d{2})\s(\d{2}):(\d{2}):(\d{2})/,
              );
              if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
            }
          }
          return null;
        };
        // Prefer the EXIF sub-IFD's DateTimeOriginal; fall back to IFD0 DateTime.
        const n0 = u16(ifd0);
        let exifPtr = null;
        for (let i = 0; i < n0; i++) {
          const e = ifd0 + 2 + i * 12;
          if (u16(e) === 0x8769) {
            exifPtr = tiff + u32(e + 8);
            break;
          }
        }
        return (exifPtr && readDate(exifPtr)) || readDate(ifd0);
      }
      if ((marker & 0xff00) !== 0xff00) break;
      offset += 2 + view.getUint16(offset + 2);
    }
    return null;
  } catch {
    return null;
  }
}

// Bell icon + dropdown feed for the header. Shows unread count, lists recent
// notifications (read + unread) as 7-day history, marks them read on open.
// =================================================================

function ManagerShell({ employee, onSignOut }) {
  // Persist the active tab in localStorage so an accidental refresh
  // brings the user back to where they were (Assignments, Properties,
  // etc) instead of always dumping them on Daily.
  const [tab, setTab] = usePagePersistence(
    `manager_tab_${employee.id}`,
    "daily",
  );
  const [showMessages, setShowMessages] = useState(false);
  // "Preview as cleaner" mode — owner can browse the cleaner UI as
  // themselves (replaces the need for a dummy "Beta" account). All
  // their actions in this mode go to the database under their own
  // employee record, just like a normal cleaner shift. They can
  // exit any time via the banner.
  // Persisted to localStorage (keyed per employee) so a browser refresh
  // while the owner is previewing the cleaner/PM side keeps them there,
  // rather than snapping back to the manager view every reload.
  const [previewMode, setPreviewMode] = usePagePersistence(
    `manager_preview_cleaner_${employee.id}`,
    false,
  );
  const showMoneyTabs = canSeeMoney(employee); // owner only
  const isOwner = employee?.role === "owner";
  // Owner "hats": Operations (cleaning side) vs Business (management).
  // Reshapes the bottom nav so each mode only shows its own tabs.
  // Managers keep the flat nav.
  const [mode, setMode] = usePagePersistence(
    `manager_mode_${employee.id}`,
    "ops",
  ); // 'ops' | 'business'
  const [pmPreview, setPmPreview] = usePagePersistence(
    `manager_preview_pm_${employee.id}`,
    false,
  );
  // Cleaner-preview and PM-preview are mutually exclusive. If a stale
  // localStorage from an interrupted session ever had both set, let
  // cleaner-preview win (it renders first below) and clear the other.
  useEffect(() => {
    if (previewMode && pmPreview) setPmPreview(false);
    /* eslint-disable-next-line */
  }, []);
  const switchMode = (m) => {
    setMode(m);
    if (m === "ops" && !["daily", "dashboard", "assignments"].includes(tab))
      setTab("daily");
    if (m === "business" && !["props", "money", "team"].includes(tab))
      setTab("props");
  };
  // Keep the active tab valid for the current mode (handles stale
  // persisted tabs after a refresh).
  useEffect(() => {
    if (!isOwner) return;
    if (mode === "ops" && !["daily", "dashboard", "assignments"].includes(tab))
      setTab("daily");
    if (mode === "business" && !["props", "money", "team"].includes(tab))
      setTab("props");
    /* eslint-disable-next-line */
  }, [mode, isOwner]);

  // If a manager somehow lands on the money tab (e.g. via stale state), bounce them home
  useEffect(() => {
    if (!showMoneyTabs && tab === "money") setTab("daily");
  }, [showMoneyTabs, tab]);

  // Tab count: managers get 5 (no Money), owners get 6.
  const colCount = showMoneyTabs ? 6 : 5;
  const openMessages = () => setShowMessages(true);
  const goHome = () => setTab("daily");

  // Exiting preview mode: gracefully close any open preview-mode shift
  // / work_block so we don't leave dangling rows. They're flagged
  // is_preview so reports already ignore them, but cleaning them up
  // keeps the DB tidy and avoids the next preview session "resuming"
  // the stale one.
  const exitPreviewMode = async () => {
    try {
      const ts = new Date().toISOString();
      const { data: openShifts } = await supabase
        .from("shifts")
        .select("id")
        .eq("employee_id", employee.id)
        .eq("is_preview", true)
        .is("end_time", null);
      if (openShifts && openShifts.length > 0) {
        const ids = openShifts.map((s) => s.id);
        await supabase
          .from("work_blocks")
          .update({ end_time: ts })
          .in("shift_id", ids)
          .is("end_time", null);
        await supabase.from("shifts").update({ end_time: ts }).in("id", ids);
      }
    } catch (e) {
      console.warn("[exitPreviewMode] cleanup failed", e);
    }
    setPreviewMode(false);
  };

  // Preview mode: render the cleaner-side EmployeeApp with a sticky
  // banner that lets the owner return to the manager view. In preview
  // mode every write (shift, work_block, task, photo) carries
  // is_preview=true so reports, payroll, and the live-cleaners sheet
  // filter the noise out.
  if (previewMode) {
    return (
      <div className="min-h-screen bg-stone-50">
        <div className="bg-amber-600 text-white px-3 py-1 text-[10px] font-mono flex items-center justify-between gap-2 sticky top-0 z-50">
          <div className="flex items-center gap-1.5 min-w-0">
            <Eye size={11} className="flex-shrink-0" />
            <span className="font-bold">Preview · cleaner</span>
            <span className="text-white/70 truncate hidden sm:inline">
              — doesn't affect reports
            </span>
          </div>
          <button
            onClick={exitPreviewMode}
            className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 flex-shrink-0"
          >
            Exit
          </button>
        </div>
        <EmployeeApp
          employee={employee}
          previewMode={true}
          onSignOut={exitPreviewMode}
        />
      </div>
    );
  }

  // Owner "Preview as PM" — renders the portal as a synthetic PM.
  if (pmPreview) {
    return (
      <PortalApp
        previewMode
        previewEmployee={employee}
        onExitPreview={() => setPmPreview(false)}
      />
    );
  }

  // Messages takes over the whole screen as an overlay
  if (showMessages) {
    return (
      <StaffMessagesTab
        employee={employee}
        onClose={() => setShowMessages(false)}
      />
    );
  }

  return (
    <PreviewContext.Provider
      value={{
        onPreview: () => setPreviewMode(true),
        isOwner: employee?.role === "owner",
      }}
    >
      <div className="min-h-screen bg-stone-50">
        {tab === "daily" && (
          <DailyView
            employee={employee}
            onSignOut={onSignOut}
            onOpenMessages={openMessages}
            onLogoClick={goHome}
          />
        )}
        {tab === "dashboard" && (
          <ManagerDashboard
            employee={employee}
            onSignOut={onSignOut}
            onOpenMessages={openMessages}
            onLogoClick={goHome}
          />
        )}
        {tab === "team" && (
          <EmployeeAdmin
            employee={employee}
            onSignOut={onSignOut}
            onOpenMessages={openMessages}
            onLogoClick={goHome}
          />
        )}
        {tab === "props" && (
          <PropertyAdmin
            employee={employee}
            onSignOut={onSignOut}
            onOpenMessages={openMessages}
            onLogoClick={goHome}
          />
        )}
        {tab === "assignments" && (
          <AssignmentsTab
            employee={employee}
            onSignOut={onSignOut}
            onOpenMessages={openMessages}
            onLogoClick={goHome}
          />
        )}
        {showMoneyTabs && tab === "money" && (
          <MoneyView
            employee={employee}
            onSignOut={onSignOut}
            onOpenMessages={openMessages}
            onLogoClick={goHome}
          />
        )}

        {/* Spacer so the two-row owner nav doesn't cover the last content. */}
        {isOwner && <div aria-hidden className="h-20 print:hidden" />}

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-1 py-2 z-30 print:hidden">
          {isOwner ? (
            <div className="max-w-md mx-auto">
              {/* Operations / Business hat toggle — color-coded so the two
               modes read as distinct contexts, matching their nav tabs. */}
              <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-2">
                <button
                  onClick={() => switchMode("ops")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium ${mode === "ops" ? "bg-stone-900 text-white shadow-sm" : "text-stone-500"}`}
                >
                  Operations
                </button>
                <button
                  onClick={() => switchMode("business")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium ${mode === "business" ? "bg-amber-700 text-white shadow-sm" : "text-stone-500"}`}
                >
                  Business
                </button>
              </div>
              {mode === "ops" ? (
                <div
                  className="grid gap-0.5"
                  style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
                >
                  <TabButton
                    tone="ops"
                    active={tab === "daily"}
                    onClick={() => setTab("daily")}
                    icon={<Calendar size={18} />}
                    label="Daily"
                  />
                  <TabButton
                    tone="ops"
                    active={tab === "assignments"}
                    onClick={() => setTab("assignments")}
                    icon={<FileText size={18} />}
                    label="Assignments"
                  />
                  <TabButton
                    tone="ops"
                    active={tab === "dashboard"}
                    onClick={() => setTab("dashboard")}
                    icon={<LayoutDashboard size={18} />}
                    label="Shifts"
                  />
                  <TabButton
                    tone="ops"
                    active={false}
                    onClick={() => setPreviewMode(true)}
                    icon={<Eye size={18} />}
                    label="Cleaner view"
                  />
                </div>
              ) : (
                <div
                  className="grid gap-0.5"
                  style={{
                    gridTemplateColumns: `repeat(${showMoneyTabs ? 4 : 3}, minmax(0, 1fr))`,
                  }}
                >
                  <TabButton
                    tone="business"
                    active={tab === "props"}
                    onClick={() => setTab("props")}
                    icon={<Building2 size={18} />}
                    label="Properties"
                  />
                  {showMoneyTabs && (
                    <TabButton
                      tone="business"
                      active={tab === "money"}
                      onClick={() => setTab("money")}
                      icon={<DollarSign size={18} />}
                      label="Money"
                    />
                  )}
                  <TabButton
                    tone="business"
                    active={tab === "team"}
                    onClick={() => setTab("team")}
                    icon={<TeamClockIcon size={18} />}
                    label="Team"
                  />
                  <TabButton
                    tone="business"
                    active={false}
                    onClick={() => setPmPreview(true)}
                    icon={<Eye size={18} />}
                    label="PM view"
                  />
                </div>
              )}
            </div>
          ) : (
            <div
              className="max-w-md mx-auto grid gap-0.5"
              style={{
                gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
              }}
            >
              <TabButton
                active={tab === "daily"}
                onClick={() => setTab("daily")}
                icon={<Calendar size={18} />}
                label="Daily"
              />
              <TabButton
                active={tab === "dashboard"}
                onClick={() => setTab("dashboard")}
                icon={<LayoutDashboard size={18} />}
                label="Shifts"
              />
              <TabButton
                active={tab === "team"}
                onClick={() => setTab("team")}
                icon={<TeamClockIcon size={18} />}
                label="Team"
              />
              <TabButton
                active={tab === "props"}
                onClick={() => setTab("props")}
                icon={<Building2 size={18} />}
                label="Properties"
              />
              <TabButton
                active={tab === "assignments"}
                onClick={() => setTab("assignments")}
                icon={<FileText size={18} />}
                label="Assignments"
              />
            </div>
          )}
        </div>
      </div>
    </PreviewContext.Provider>
  );
}

// Per-shift billable helper shared by the cleaner views.
function shiftBillableAmount(s, showMoney) {
  if (!showMoney || !s.end_time) return 0;
  if (s.customer?.property_type === "multi_unit") {
    return (s.work_blocks || []).reduce((sum, b) => {
      if (!b.end_time) return sum;
      const h = (new Date(b.end_time) - new Date(b.start_time)) / 1000 / 3600;
      return (
        sum + h * (b.bill_rate_at_work || s.customer?.bill_rate_hourly || 0)
      );
    }, 0);
  }
  if (s.bill_rate_at_work) return shiftBillableHours(s) * s.bill_rate_at_work;
  return 0;
}

// =================================================================
// Edit/delete modals
// =================================================================

// Convert an ISO timestamp into the value format the <input type="datetime-local"> expects:
// YYYY-MM-DDTHH:MM in *local* time (no timezone suffix).
function isoToLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// And the reverse: convert "YYYY-MM-DDTHH:MM" local-time string into a UTC ISO string.
function localInputToISO(local) {
  if (!local) return null;
  // new Date('YYYY-MM-DDTHH:MM') is interpreted as local time
  return new Date(local).toISOString();
}

// =================================================================

// Share photos via native share sheet. Returns true on success,
// false if not supported or user cancelled.
async function sharePhotos(photos, contextFn) {
  if (!canShareFiles()) return false;
  try {
    const files = [];
    for (const p of photos) {
      const ctx = typeof contextFn === "function" ? contextFn(p) : contextFn;
      const filename = photoFilename(p, ctx);
      const resp = await fetch(p.public_url);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      files.push(
        new File([blob], filename, { type: blob.type || "image/jpeg" }),
      );
    }
    if (files.length === 0) return false;
    if (!navigator.canShare({ files })) return false;
    await navigator.share({ files, title: "Cleaning photos" });
    return true;
  } catch (e) {
    if (e.name === "AbortError") return true; // User cancelled — not an error
    console.error("[sharePhotos] failed", e);
    return false;
  }
}

// Generate a random portal code: 4 letters + 4 digits
function generatePortalUserCode() {
  const words = [
    "oak",
    "elm",
    "pine",
    "sage",
    "fern",
    "rose",
    "iris",
    "clay",
    "reed",
    "moss",
    "dune",
    "bay",
    "rain",
    "mesa",
    "peak",
    "vale",
    "glen",
    "ridge",
    "cove",
    "wave",
  ];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}${n}`;
}

// =================================================================
// PRICE BOOK EDITOR — per-property "subsection" prices the invoice
// generator reads to auto-price each line. Each subsection is either
// a FIXED base price (e.g. tub = $22.50) or TIME-based (a $/hr rate
// multiplied by minutes entered per line). This is the "remember".
// =================================================================
function PriceBookEditor({ property, onBack }) {
  // Priceable "subsections" are the real checklist ITEMS (tub, vanity,
  // fridge inside, ...), keyed `section:item_key` so they match what's
  // recorded as cleaned. Loaded from the property's template set.
  const [items, setItems] = useState([]); // [{key, section, label, sort}]
  const [prices, setPrices] = useState({}); // key -> {mode, base_amount, rate, default_minutes}
  const [originalKeys, setOriginalKeys] = useState([]);
  const [defaultRate, setDefaultRate] = useState(""); // preset $/hr for time items
  const [aptSizes, setAptSizes] = useState([]); // [{key:'2x2', bedrooms, bathrooms, label}]
  const [aptPrices, setAptPrices] = useState({}); // '__apt__:2x2' -> amount string
  const [expanded, setExpanded] = useState(new Set());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const SECTION_LABELS = {
    bedroom: "Bedroom",
    vanity: "Vanity",
    bathroom: "Bathroom",
    general: "General / kitchen",
  };
  const SECTION_ORDER = ["bathroom", "vanity", "general", "bedroom"];

  useEffect(() => {
    (async () => {
      setLoaded(false);
      setError(null);
      try {
        // Resolve template set: property-specific, else global default.
        let { data: ownSet } = await supabase
          .from("section_template_sets")
          .select("*")
          .eq("customer_id", property.id)
          .limit(1);
        let chosen = (ownSet && ownSet[0]) || null;
        if (!chosen) {
          const { data: def } = await supabase
            .from("section_template_sets")
            .select("*")
            .eq("is_default", true)
            .is("customer_id", null)
            .limit(1);
          chosen = (def && def[0]) || null;
        }
        if (!chosen) {
          setError("No checklist template found for this property.");
          setLoaded(true);
          return;
        }
        const { data: vData } = await supabase
          .from("section_template_variants")
          .select("*")
          .eq("set_id", chosen.id)
          .order("sort_order");
        const variants = vData || [];
        const variantById = Object.fromEntries(variants.map((v) => [v.id, v]));
        const variantIds = variants.map((v) => v.id);
        let itemRows = [];
        if (variantIds.length) {
          const { data: iData } = await supabase
            .from("section_template_items")
            .select("*")
            .in("variant_id", variantIds)
            .order("sort_order");
          itemRows = iData || [];
        }
        const seen = new Set();
        const built = [];
        itemRows.forEach((it) => {
          const v = variantById[it.variant_id];
          const section = (v?.section_key || "general").toLowerCase();
          const key = `${section}:${it.item_key}`;
          if (seen.has(key)) return;
          seen.add(key);
          built.push({
            key,
            section,
            label: resolveItemLabel(key, "en", null, it.label || it.item_key),
            sort: it.sort_order ?? 0,
            vsort: v?.sort_order ?? 0,
            vlabel: v?.label || "",
            vkey: v?.variant_key || "",
          });
        });
        setItems(built);
        const { data: pb } = await supabase
          .from("invoice_price_book")
          .select("*")
          .eq("customer_id", property.id);
        const pmap = {};
        let dr = "";
        (pb || []).forEach((r) => {
          if (r.subsection_key === "__hourly_rate__") {
            dr = r.rate ?? "";
            return;
          }
          pmap[r.subsection_key] = {
            mode: r.mode,
            base_amount: r.base_amount ?? "",
            rate: r.rate ?? "",
            default_minutes: r.default_minutes ?? "",
          };
        });
        setPrices(pmap);
        setDefaultRate(dr === 0 ? "" : (dr ?? ""));
        // Apartment SIZE tiers (1x1, 2x2, 3x2…) for whole-apartment flat
        // pricing at Bridges/Citifront-style properties. Discover which
        // sizes actually exist here from the units table, then load any
        // saved __apt__ prices.
        const { data: unitRows } = await supabase
          .from("units")
          .select("bedrooms, bathrooms")
          .eq("customer_id", property.id);
        const sizeSet = new Map();
        (unitRows || []).forEach((u) => {
          if (u.bedrooms == null || u.bathrooms == null) return;
          const key = `${u.bedrooms}x${u.bathrooms}`;
          if (!sizeSet.has(key))
            sizeSet.set(key, {
              key,
              bedrooms: u.bedrooms,
              bathrooms: u.bathrooms,
            });
        });
        const sizes = Array.from(sizeSet.values()).sort(
          (a, b) => a.bedrooms - b.bedrooms || a.bathrooms - b.bathrooms,
        );
        setAptSizes(sizes);
        const apmap = {};
        (pb || []).forEach((r) => {
          if (r.subsection_key?.startsWith("__apt__:")) {
            apmap[r.subsection_key] =
              r.base_amount != null ? String(r.base_amount) : "";
          }
        });
        setAptPrices(apmap);
        setOriginalKeys(
          (pb || [])
            .filter((r) => r.subsection_key !== "__hourly_rate__")
            .map((r) => r.subsection_key),
        );
      } catch (e) {
        setError(e.message || "Could not load template.");
      }
      setLoaded(true);
    })(); /* eslint-disable-next-line */
  }, [property.id]);

  const setPrice = (key, patch) =>
    setPrices((p) => ({
      ...p,
      [key]: {
        mode: "fixed",
        base_amount: "",
        rate: "",
        default_minutes: "",
        ...(p[key] || {}),
        ...patch,
      },
    }));
  const clearPrice = (key) =>
    setPrices((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
  const toggleSection = (s) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(s) ? n.delete(s) : n.add(s);
      return n;
    });

  // Effective rate for a time item = its own rate, else the preset.
  const effRate = (pr) => parseFloat(pr?.rate) || parseFloat(defaultRate) || 0;

  const pricedCount = (sectionItems) =>
    sectionItems.filter((it) => {
      const pr = prices[it.key];
      if (!pr) return false;
      return (
        (pr.mode === "time" ? effRate(pr) : parseFloat(pr.base_amount)) > 0
      );
    }).length;

  const save = async () => {
    setSaving(true);
    const payload = [];
    const keepKeys = [];
    items.forEach((it) => {
      const pr = prices[it.key];
      if (!pr) return;
      const mode = pr.mode === "time" ? "time" : "fixed";
      const base = mode === "fixed" ? parseFloat(pr.base_amount) || 0 : 0;
      const rate = mode === "time" ? effRate(pr) : 0;
      if (mode === "fixed" && base === 0) return; // unpriced — skip
      if (mode === "time" && rate === 0) return;
      keepKeys.push(it.key);
      payload.push({
        customer_id: property.id,
        subsection_key: it.key,
        label: it.label,
        mode,
        base_amount: base,
        rate,
        default_minutes:
          mode === "time" ? parseFloat(pr.default_minutes) || 0 : 0,
        sort_order: 0,
        updated_at: new Date().toISOString(),
      });
    });
    // Apartment size-tier flat prices (__apt__:2x2 etc).
    const aptKeep = [];
    aptSizes.forEach((sz) => {
      const k = `__apt__:${sz.key}`;
      const amt = parseFloat(aptPrices[k]) || 0;
      if (amt <= 0) return;
      aptKeep.push(k);
      payload.push({
        customer_id: property.id,
        subsection_key: k,
        label: `${sz.bedrooms}x${sz.bathrooms} apartment`,
        mode: "fixed",
        base_amount: amt,
        rate: 0,
        default_minutes: 0,
        sort_order: 0,
        updated_at: new Date().toISOString(),
      });
    });
    // Persist the preset hourly rate as a sentinel row (skipped by the
    // invoice generator). Generators must ignore keys starting with '__'.
    const dr = parseFloat(defaultRate) || 0;
    if (dr > 0) {
      payload.push({
        customer_id: property.id,
        subsection_key: "__hourly_rate__",
        label: "Default hourly rate",
        mode: "time",
        base_amount: 0,
        rate: dr,
        default_minutes: 0,
        sort_order: -1,
        updated_at: new Date().toISOString(),
      });
    }
    if (payload.length) {
      const { error: upErr } = await supabase
        .from("invoice_price_book")
        .upsert(payload, { onConflict: "customer_id,subsection_key" });
      if (upErr) {
        setSaving(false);
        alert("Could not save prices: " + upErr.message);
        return;
      }
    }
    if (dr <= 0) {
      await supabase
        .from("invoice_price_book")
        .delete()
        .eq("customer_id", property.id)
        .eq("subsection_key", "__hourly_rate__");
    }
    // Only remove template-item keys the user cleared — never touch
    // learned keys like "__flat__:cleaning_check" that aren't in the
    // template item list.
    const templateKeys = new Set(items.map((it) => it.key));
    const removed = originalKeys.filter(
      (k) => !keepKeys.includes(k) && templateKeys.has(k),
    );
    for (const k of removed) {
      await supabase
        .from("invoice_price_book")
        .delete()
        .eq("customer_id", property.id)
        .eq("subsection_key", k);
    }
    // Remove size-tier prices the user cleared to zero/blank.
    const aptClearedKeys = aptSizes
      .map((sz) => `__apt__:${sz.key}`)
      .filter((k) => !aptKeep.includes(k) && originalKeys.includes(k));
    for (const k of aptClearedKeys) {
      await supabase
        .from("invoice_price_book")
        .delete()
        .eq("customer_id", property.id)
        .eq("subsection_key", k);
    }
    setSaving(false);
    onBack();
  };

  // Group items by section in a friendly order.
  const bySection = {};
  items.forEach((it) => {
    (bySection[it.section] = bySection[it.section] || []).push(it);
  });
  const sections = [
    ...SECTION_ORDER.filter((s) => bySection[s]),
    ...Object.keys(bySection).filter((s) => !SECTION_ORDER.includes(s)),
  ];

  return (
    <div className="pb-28">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-stone-200 bg-white sticky top-0 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-stone-700 text-sm"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save prices"}
        </button>
      </div>
      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">
          {property.name}
        </div>
        <h1 className="text-3xl font-light text-stone-900 tracking-tight mb-2">
          Item <span className="font-serif italic text-amber-700">prices</span>
        </h1>
        <p className="text-sm text-stone-600 mb-4">
          Price the items you bill for (tub, vanity, fridge inside…). Each can
          be a fixed amount or a $/hr rate × minutes. Invoices add up the items
          that were actually cleaned. Leave the rest blank.
        </p>

        {/* Preset hourly rate — time items use this so you only type
           minutes, not the rate, on every item. */}
        <div className="mb-5 p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono uppercase tracking-wider text-amber-800">
            Default hourly rate
          </span>
          <span className="text-amber-700 font-mono">$</span>
          <input
            type="number"
            step="0.01"
            value={defaultRate}
            onChange={(e) => setDefaultRate(e.target.value)}
            placeholder="0.00"
            className="w-28 px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-right text-sm font-mono"
          />
          <span className="text-[11px] text-amber-700/80 font-mono">
            /hr — time items use this unless you override one
          </span>
        </div>

        {/* Whole-apartment flat pricing by SIZE. For properties billed per
           apartment (not per item) — a 2x2 is one price regardless of what
           was cleaned. Only the sizes that exist at this property show. */}
        {aptSizes.length > 0 && (
          <div className="mb-5 p-3 rounded-2xl bg-stone-100 border border-stone-200">
            <div className="text-xs font-mono uppercase tracking-wider text-stone-600 mb-1">
              Whole-apartment price by size
            </div>
            <p className="text-[11px] text-stone-500 mb-3">
              A flat rate per apartment size, used when the whole unit is
              cleaned. Leave blank for sizes you price by item instead.
            </p>
            <div className="space-y-2">
              {aptSizes.map((sz) => {
                const k = `__apt__:${sz.key}`;
                return (
                  <div key={k} className="flex items-center gap-2">
                    <span className="font-mono text-sm text-stone-800 w-16">
                      {sz.bedrooms}x{sz.bathrooms}
                    </span>
                    <span className="text-[10px] font-mono text-stone-400 flex-1">
                      {sz.bedrooms} bed / {sz.bathrooms} bath
                    </span>
                    <span className="text-stone-400 font-mono">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={aptPrices[k] || ""}
                      onChange={(e) =>
                        setAptPrices((p) => ({ ...p, [k]: e.target.value }))
                      }
                      placeholder="0.00"
                      className="w-28 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-right text-sm font-mono"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loaded ? (
          <Splash text="Loading items…" />
        ) : error ? (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No template items found.
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((s) => {
              // Order by variant first, then by the item's own order, so
              // related items (fridge inside / freezer inside) stay
              // together instead of interleaving across variants.
              const list = bySection[s]
                .slice()
                .sort(
                  (a, b) =>
                    a.vsort - b.vsort ||
                    a.sort - b.sort ||
                    a.label.localeCompare(b.label),
                );
              const open = expanded.has(s);
              const np = pricedCount(list);
              // Group consecutive items by variant.
              const groups = [];
              list.forEach((it) => {
                const last = groups[groups.length - 1];
                if (last && last.vkey === it.vkey) last.items.push(it);
                else
                  groups.push({
                    vkey: it.vkey,
                    vlabel: it.vlabel,
                    items: [it],
                  });
              });
              const showSub = groups.length > 1;
              return (
                <div
                  key={s}
                  className="rounded-2xl bg-white border border-stone-200 overflow-hidden"
                >
                  <button
                    onClick={() => toggleSection(s)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50"
                  >
                    <span className="font-serif text-base text-stone-900">
                      {SECTION_LABELS[s] || s}
                    </span>
                    <span className="flex items-center gap-2">
                      {np > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {np} priced
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-stone-400">
                        {list.length} items
                      </span>
                      <ChevronRight
                        size={15}
                        className={`text-stone-400 transition-transform ${open ? "rotate-90" : ""}`}
                      />
                    </span>
                  </button>
                  {open && (
                    <div className="border-t border-stone-100">
                      {groups.map((g, gi) => (
                        <div key={g.vkey || gi}>
                          {showSub && g.vlabel && (
                            <div className="px-4 pt-2.5 pb-1 text-[10px] uppercase tracking-wider font-mono text-amber-700/80 bg-stone-50/60">
                              {g.vlabel}
                            </div>
                          )}
                          <div className="divide-y divide-stone-100">
                            {g.items.map((it) => {
                              const pr = prices[it.key];
                              const isTime = pr?.mode === "time";
                              const hasPrice =
                                pr &&
                                (isTime
                                  ? effRate(pr)
                                  : parseFloat(pr.base_amount)) > 0;
                              return (
                                <div key={it.key} className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`flex-1 text-sm ${hasPrice ? "text-stone-900" : "text-stone-500"}`}
                                    >
                                      {it.label}
                                    </span>
                                    <div className="flex p-0.5 bg-stone-100 rounded-lg">
                                      <button
                                        onClick={() =>
                                          setPrice(it.key, { mode: "fixed" })
                                        }
                                        className={`px-2 py-1 rounded-md text-[10px] font-mono flex items-center gap-0.5 ${!isTime ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
                                      >
                                        <DollarSign size={10} />
                                      </button>
                                      <button
                                        onClick={() =>
                                          setPrice(it.key, { mode: "time" })
                                        }
                                        className={`px-2 py-1 rounded-md text-[10px] font-mono flex items-center gap-0.5 ${isTime ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
                                      >
                                        <Clock size={10} />
                                      </button>
                                    </div>
                                    {!isTime ? (
                                      <span className="flex items-center gap-1 text-sm font-mono text-stone-700">
                                        <span className="text-stone-400">
                                          $
                                        </span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={pr?.base_amount ?? ""}
                                          onChange={(e) =>
                                            setPrice(it.key, {
                                              base_amount: e.target.value,
                                            })
                                          }
                                          placeholder="0.00"
                                          className="w-24 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-right"
                                        />
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1.5 text-sm font-mono text-stone-700 flex-wrap justify-end">
                                        <span className="text-stone-400">
                                          $
                                        </span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={pr?.rate ?? ""}
                                          onChange={(e) =>
                                            setPrice(it.key, {
                                              rate: e.target.value,
                                            })
                                          }
                                          placeholder={
                                            defaultRate
                                              ? String(defaultRate)
                                              : "0.00"
                                          }
                                          title="Leave blank to use the default rate"
                                          className="w-20 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-right"
                                        />
                                        <span className="text-stone-400 text-[11px]">
                                          /hr ×
                                        </span>
                                        <input
                                          type="number"
                                          step="1"
                                          value={pr?.default_minutes ?? ""}
                                          onChange={(e) =>
                                            setPrice(it.key, {
                                              default_minutes: e.target.value,
                                            })
                                          }
                                          placeholder="min"
                                          className="w-20 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-right"
                                        />
                                        <span className="text-stone-400 text-[11px]">
                                          min =
                                        </span>
                                        <span className="text-emerald-700 font-medium min-w-[60px] text-right">
                                          $
                                          {(
                                            (effRate(pr) *
                                              (parseFloat(
                                                pr?.default_minutes,
                                              ) || 0)) /
                                            60
                                          ).toFixed(2)}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// =================================================================
// INVOICE DRAFT EDITOR (Phase 1b) — generates an editable draft from
// the items actually cleaned in the period, auto-priced from the
// property's price book, then lets the owner adjust and save it.
// =================================================================

function subAmount(s) {
  return s.mode === "time"
    ? ((parseFloat(s.rate) || 0) * (parseFloat(s.minutes) || 0)) / 60
    : parseFloat(s.amount) || 0;
}
// The line BEFORE any extra. "Override line total" replaces this figure;
// it does not replace the extra.
function baseAmount(l) {
  if (l.overrideMode === "time") {
    return (
      ((parseFloat(l.overrideRate) || 0) *
        (parseFloat(l.overrideMinutes) || 0)) /
      60
    );
  }
  if (l.amountOverride !== "" && l.amountOverride != null)
    return parseFloat(l.amountOverride) || 0;
  return (l.subsections || [])
    .filter((s) => s.included)
    .reduce((sum, s) => sum + subAmount(s), 0);
}
// The extra ADDS to the base — that's the whole point of it being separate.
// Entered either as a flat dollar amount or as minutes × rate.
function extraAmount(l) {
  if (!l.extraOn) return 0;
  return l.extraMode === "time"
    ? ((parseFloat(l.extraRate) || 0) * (parseFloat(l.extraMinutes) || 0)) / 60
    : parseFloat(l.extraAmount) || 0;
}
function lineAmount(l) {
  // Non-billable = the owner is eating this one (comp, redo, courtesy). It
  // still shows in the editor and still gets stamped invoiced so reporting
  // knows the work was accounted for, but it adds nothing to what the
  // property is charged and it's hidden from the printed invoice.
  if (l.nonBillable) return 0;
  return baseAmount(l) + extraAmount(l);
}
// What the line WOULD have billed, ignoring the non-billable flag — used
// by reporting so a comped clean still shows its real value.
function lineFullAmount(l) {
  return baseAmount(l) + extraAmount(l);
}

function InvoiceDraftEditor({
  property,
  start,
  end,
  employee,
  onBack,
  onSaved,
  seedInvoice = null,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [takenNumbers, setTakenNumbers] = useState(new Set()); // numbers already used
  const [unfinished, setUnfinished] = useState([]); // scheduled in range, not finished
  const [dismissed, setDismissed] = useState(new Set()); // ones you've waved off
  const [title, setTitle] = useState("");
  const today = new Date().toISOString().split("T")[0];
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [billTo, setBillTo] = useState({
    org: "",
    contact: "",
    email: "",
    phone: "",
    address: "",
  });
  const [billOpen, setBillOpen] = useState(false);
  const [diag, setDiag] = useState(null);
  // Done work in this window that an earlier invoice already claimed.
  const [billedElsewhere, setBilledElsewhere] = useState({
    bedrooms: 0,
    invoices: [],
  });
  const [rebillWarning, setRebillWarning] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [defaultRate, setDefaultRate] = useState(0);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // 1) Price book for this property (+ preset hourly rate).
      const { data: pb } = await supabase
        .from("invoice_price_book")
        .select("*")
        .eq("customer_id", property.id);
      let defRate = 0;
      const book = {};
      (pb || []).forEach((r) => {
        if (r.subsection_key === "__hourly_rate__") {
          defRate = r.rate || 0;
          return;
        }
        book[r.subsection_key] = r;
      });
      setDefaultRate(defRate);
      // 2) Units for this property.
      const { data: unitRows } = await supabase
        .from("units")
        .select("id,label,bedrooms,bathrooms")
        .eq("customer_id", property.id);
      const unitIds = (unitRows || []).map((u) => u.id);
      const unitLabelById = Object.fromEntries(
        (unitRows || []).map((u) => [u.id, u.label]),
      );
      const unitMetaById = Object.fromEntries(
        (unitRows || []).map((u) => [
          u.id,
          { bedrooms: u.bedrooms, bathrooms: u.bathrooms },
        ]),
      );
      // 3) Done items in range (paginated). Resilient: if v41's
      //    invoiced_on column isn't there yet, retry without that filter.
      let targets = [];
      let fetchErr = null;
      const fetchTargets = async (useInvoiced) => {
        let rows = [];
        let err = null;
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          let q = supabase
            .from("assignment_targets")
            .select(
              "id, unit_id, party_id, assignment_id, template_item_key, template_section, status_notes, completed_at, status, assignment:assignments(id, assignment_type, deleted_at, took_longer), party:parties(id,label)",
            )
            .eq("status", "done")
            .in("unit_id", unitIds)
            .gte("completed_at", start + "T00:00:00")
            .lte("completed_at", end + "T23:59:59")
            .range(from, from + PAGE - 1);
          if (useInvoiced) q = q.is("invoiced_on", null);
          const { data, error } = await q;
          if (error) {
            err = error;
            break;
          }
          rows = rows.concat(data || []);
          if (!data || data.length < PAGE) break;
          if (from > 100000) break;
        }
        return { rows, err };
      };
      if (unitIds.length) {
        let res = await fetchTargets(true);
        if (
          res.err &&
          /invoiced_on|column|does not exist/i.test(res.err.message || "")
        ) {
          // The invoiced_on column is what stops already-billed work from
          // reappearing on a new invoice. If it's missing we must NOT silently
          // fall back to showing everything — that's how a bedroom gets billed
          // twice. Surface it loudly and keep the fallback only so the screen
          // isn't blank, with a banner the owner can't miss.
          console.error(
            "[invoice] invoiced_on column missing — re-bill protection OFF until v41 is run",
          );
          setRebillWarning(true);
          res = await fetchTargets(false);
        }
        targets = res.rows;
        fetchErr = res.err;
      }
      // 3a2) Work in this range that ISN'T finished. It has no completed_at
      //      (only done targets get stamped), so "in this range" can only
      //      mean the assignment's SCHEDULED date. Never billed — you can't
      //      charge for a clean that hasn't happened — but it's listed so
      //      you can see what the range was expecting and chase it.
      let notDone = [];
      if (unitIds.length) {
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("assignment_targets")
            .select(
              "id, unit_id, party_id, assignment_id, status, assignment:assignments!inner(id, assignment_type, deleted_at, scheduled_date), unit:units(label), party:parties(label)",
            )
            .not("status", "in", "(done)")
            .in("unit_id", unitIds)
            .gte("assignment.scheduled_date", start)
            .lte("assignment.scheduled_date", end)
            .range(from, from + PAGE - 1);
          if (error || !data) break;
          notDone = notDone.concat(data);
          if (data.length < PAGE) break;
          if (from > 100000) break;
        }
      }
      {
        const byJob = new Map();
        notDone
          .filter((t) => t.assignment && !t.assignment.deleted_at)
          .forEach((t) => {
            const k = t.assignment_id;
            if (!byJob.has(k))
              byJob.set(k, {
                id: k,
                label: unitPartyLabel(t.unit?.label, t.party?.label) || "Job",
                type: t.assignment?.assignment_type || "",
                scheduled: t.assignment?.scheduled_date || null,
                total: 0,
                started: 0,
              });
            const r = byJob.get(k);
            r.total++;
            if (t.status === "in_progress" || t.status === "paused")
              r.started++;
          });
        setUnfinished(
          Array.from(byJob.values()).sort((a, b) =>
            String(a.label).localeCompare(String(b.label), undefined, {
              numeric: true,
            }),
          ),
        );
      }

      // 3b) The gap. `invoiced_on IS NULL` above is the ONLY filter this
      //     draft applies that the property's Done tab does not — so a
      //     bedroom finished in this window that an earlier invoice already
      //     stamped is done, in range, and still absent here with no
      //     explanation. That silence is what makes the two screens look
      //     like they disagree. Count it and say so.
      let alreadyBilled = { bedrooms: 0, invoices: [], items: [] };
      if (unitIds.length) {
        let billed = [];
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("assignment_targets")
            .select(
              "unit_id, party_id, invoiced_on, completed_at, assignment:assignments(assignment_type)",
            )
            .eq("status", "done")
            .in("unit_id", unitIds)
            .gte("completed_at", start + "T00:00:00")
            .lte("completed_at", end + "T23:59:59")
            .not("invoiced_on", "is", null)
            .range(from, from + PAGE - 1);
          if (error || !data) break;
          billed = billed.concat(data);
          if (data.length < PAGE) break;
          if (from > 100000) break;
        }
        const beds = new Set(billed.map((b) => `${b.unit_id}:${b.party_id}`));
        const invIds = [
          ...new Set(billed.map((b) => b.invoiced_on).filter(Boolean)),
        ];
        let invMeta = [];
        if (invIds.length) {
          const { data: im } = await supabase
            .from("invoices")
            .select("id, invoice_number, invoice_date, status")
            .in("id", invIds);
          invMeta = im || [];
        }
        const invById = Object.fromEntries(invMeta.map((i) => [i.id, i]));
        // One row per unit:party:invoice so the verify panel can show exactly
        // which already-sent invoice each cleaning is sitting on.
        const seenBilled = new Map();
        billed.forEach((b) => {
          const k = `${b.unit_id}:${b.party_id}:${b.invoiced_on}`;
          if (seenBilled.has(k)) {
            const ex = seenBilled.get(k);
            if (b.completed_at && (!ex.date || b.completed_at < ex.date))
              ex.date = b.completed_at;
            return;
          }
          const inv = invById[b.invoiced_on];
          seenBilled.set(k, {
            unitLabel: unitLabelById[b.unit_id] || "—",
            type: b.assignment?.assignment_type || "",
            date: b.completed_at || null,
            invoiceNumber: inv?.invoice_number || null,
            invoiceStatus: inv?.status || null,
          });
        });
        const billedItems = Array.from(seenBilled.values()).sort((a, b) =>
          String(a.unitLabel).localeCompare(String(b.unitLabel), undefined, {
            numeric: true,
          }),
        );
        alreadyBilled = {
          bedrooms: beds.size,
          invoices: invMeta,
          items: billedItems,
        };
      }
      setBilledElsewhere(alreadyBilled);
      // 4) Group by assignment (= one bedroom clean).
      const byAssign = new Map();
      const sampleItems = [];
      const sampleSecs = [];
      let withItemKey = 0,
        sectionOnly = 0;
      targets.forEach((t) => {
        if (t.assignment && t.assignment.deleted_at) return; // skip soft-deleted assignments
        const aid = t.assignment_id || `${t.unit_id}:${t.party_id}`;
        if (!byAssign.has(aid))
          byAssign.set(aid, {
            aid,
            unit_id: t.unit_id,
            party_id: t.party_id,
            type: t.assignment?.assignment_type,
            partyLabel: t.party?.label || "",
            tookLonger: false,
            days: new Set(),
            items: [],
            targetIds: [],
          });
        // The Extra flag lives on the ASSIGNMENT, so capture it here off the
        // target's joined assignment. It used to be read off the item objects
        // pushed below, which never carried an `assignment` key — so it was
        // always undefined and no line was ever marked EXTRA.
        if (t.assignment?.took_longer) byAssign.get(aid).tookLonger = true;
        // When the work actually happened. Every target carries completed_at
        // (the draft only takes status='done'), so collect the distinct days.
        if (t.completed_at)
          byAssign.get(aid).days.add(String(t.completed_at).slice(0, 10));
        const sec = (t.template_section || "").toLowerCase();
        const itemKey = t.template_item_key || "";
        const fullKey = itemKey
          ? itemKey.includes(":")
            ? itemKey
            : sec
              ? `${sec}:${itemKey}`
              : itemKey
          : sec
            ? `${sec}:__section__`
            : null;
        if (fullKey)
          byAssign
            .get(aid)
            .items.push({ fullKey, sec, itemKey, notes: t.status_notes });
        if (t.id) byAssign.get(aid).targetIds.push(t.id);
        const aType = t.assignment?.assignment_type || "?";
        if (itemKey) {
          withItemKey++;
          if (sampleItems.length < 15)
            sampleItems.push(`${sec || "(no sec)"}:${itemKey} · ${aType}`);
        } else {
          sectionOnly++;
          if (sampleSecs.length < 8)
            sampleSecs.push(`sec=${sec || "(empty)"} · ${aType}`);
        }
      });
      // 5) Build lines (show every cleaned thing — priced or not).
      // Pull the P&L manual charges so an apartment you priced in the report
      // but never invoiced pre-fills its line here — the "vice versa" half of
      // the two-way flow. Keyed by unit (invoice lines are per apartment).
      const mcUnitIds = [
        ...new Set(
          Array.from(byAssign.values())
            .map((g) => g.unit_id)
            .filter(Boolean),
        ),
      ];
      const manualByUnit = {};
      for (let i = 0; i < mcUnitIds.length; i += 200) {
        const { data: mcs } = await supabase
          .from("manual_charges")
          .select("unit_id, amount")
          .in("unit_id", mcUnitIds.slice(i, i + 200));
        (mcs || []).forEach((m) => {
          if (Number(m.amount) > 0) manualByUnit[m.unit_id] = Number(m.amount);
        });
      }
      const SEC_LABEL = {
        bathroom: "Bathroom",
        vanity: "Vanity",
        general: "General / kitchen",
        bedroom: "Bedroom",
      };
      const built = Array.from(byAssign.values())
        .map((g) => {
          const unitLabel = unitLabelById[g.unit_id] || "";
          const apt = String(unitLabel)
            .replace(/^B\d+-/i, "")
            .trim();
          const brm = (g.partyLabel.match(/(\d+)\s*$/) || [])[1] || "";
          // Whole-apartment (quick) cleans have no bedroom number — surface the
          // apartment's bed/bath count (e.g. "D302 · 2BR/2BA") on the invoice.
          const meta = unitMetaById[g.unit_id] || {};
          const brBa =
            !brm && (meta.bedrooms || meta.bathrooms)
              ? ` · ${meta.bedrooms || 0}BR/${meta.bathrooms || 0}BA`
              : "";
          const tookLonger = !!g.tookLonger;
          // NOTE: `label` prints on the client's invoice (see the print view), so
          // the EXTRA flag deliberately does NOT go in here. It rides on the line
          // as `tookLonger` and shows as an amber chip in the editor only.
          const label = brm ? `${apt} - ${brm}` : `${apt}${brBa}`;
          const subs = [];
          const seen = new Set();
          g.items.forEach((it) => {
            if (seen.has(it.fullKey)) return;
            seen.add(it.fullKey);
            const b = book[it.fullKey];
            const isSection = !it.itemKey;
            const isCustom = it.itemKey && it.itemKey.startsWith("custom_");
            const fallback = isSection
              ? `Whole ${SEC_LABEL[it.sec] || it.sec || "section"}`
              : isCustom
                ? it.notes || "Custom item"
                : resolveItemLabel(
                    it.fullKey,
                    "en",
                    null,
                    String(it.itemKey)
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase()),
                  );
            if (b) {
              const mode = b.mode === "time" ? "time" : "fixed";
              subs.push({
                key: it.fullKey,
                label: b.label || fallback,
                mode,
                amount: mode === "fixed" ? b.base_amount || 0 : "",
                rate: b.rate || defRate || 0,
                minutes: b.default_minutes || "",
                included: true,
                fromBook: true,
              });
            } else {
              subs.push({
                key: it.fullKey,
                label: fallback,
                mode: "fixed",
                amount: "",
                rate: defRate || 0,
                minutes: "",
                included: true,
                fromBook: false,
              });
            }
          });
          // Bedrooms with no itemized failures (cleaning checks where nothing
          // failed) still get billed — give them one flat "whole bedroom"
          // line, priced per service type and remembered like any item.
          if (subs.length === 0) {
            // Whole-apartment (nothing itemized failed). Price by SIZE first —
            // a 1x1 / 2x2 / 3x2 tier in the price book — because Bridges and
            // Citifront bill a flat rate per apartment size. Fall back to the
            // per-type flat price, then to unpriced.
            const meta = unitMetaById[g.unit_id] || {};
            const bd = meta.bedrooms != null ? meta.bedrooms : null;
            const ba = meta.bathrooms != null ? meta.bathrooms : null;
            const sizeKey =
              bd != null && ba != null ? `__apt__:${bd}x${ba}` : null;
            const flatKey = `__flat__:${g.type || "clean"}`;
            const sizeBook = sizeKey ? book[sizeKey] : null;
            const b = sizeBook || book[flatKey];
            const flatLabel =
              g.type === "cleaning_check"
                ? "Cleaning check (whole bedroom)"
                : g.type === "move_out_check"
                  ? "Move-out clean (whole bedroom)"
                  : "Whole bedroom";
            // Use the size key when a size price exists so removing/relabeling
            // stays stable; otherwise keep the flat-by-type key.
            const useKey = sizeBook ? sizeKey : flatKey;
            if (b) {
              const mode = b.mode === "time" ? "time" : "fixed";
              subs.push({
                key: useKey,
                label: b.label || flatLabel,
                mode,
                amount: mode === "fixed" ? b.base_amount || 0 : "",
                rate: b.rate || defRate || 0,
                minutes: b.default_minutes || "",
                included: true,
                fromBook: true,
              });
            } else if (manualByUnit[g.unit_id] != null) {
              // No price-book entry, but you set a charge for this apartment in
              // the P&L — pull it in so you're not re-typing it.
              subs.push({
                key: useKey,
                label: flatLabel,
                mode: "fixed",
                amount: String(manualByUnit[g.unit_id]),
                rate: 0,
                minutes: "",
                included: true,
                fromBook: false,
              });
            } else {
              subs.push({
                key: useKey,
                label: flatLabel,
                mode: "fixed",
                amount: "",
                rate: defRate || 0,
                minutes: "",
                included: true,
                fromBook: false,
              });
            }
          }
          subs.sort((a, b) => a.label.localeCompare(b.label));
          // #3 — remember what you charged last time for THIS EXACT set of items.
          // The per-item book above prices items individually; but you often price
          // the whole assignment as a bundle (tub alone vs tub+stove+fridge cost
          // different flat amounts). So we also key a "combo" price by the sorted
          // set of item keys. If we've billed this exact combo before, prefill the
          // line's flat total with that amount — you can still override it.
          const comboSig = subs
            .filter((s) => s.included)
            .map((s) => s.key)
            .sort()
            .join("|");
          const comboKey = comboSig
            ? `__combo__:${g.type || "clean"}:${comboSig}`
            : null;
          const comboBook = comboKey ? book[comboKey] : null;
          const amountOverride =
            comboBook &&
            comboBook.base_amount != null &&
            Number(comboBook.base_amount) > 0
              ? String(comboBook.base_amount)
              : "";
          const fromMemory = amountOverride !== "";
          return {
            key: g.aid,
            unitId: g.unit_id,
            partyId: g.party_id,
            label,
            serviceType: g.type,
            tookLonger,
            cleanedDays: Array.from(g.days).sort(),
            description: INVOICE_DESCR[g.type] || "",
            subsections: subs,
            amountOverride,
            comboKey,
            fromMemory,
            extraOn: tookLonger,
            extraMode: "fixed",
            extraAmount: "",
            extraMinutes: "",
            extraRate: "",
            extraNote: "",
            sourceTargetIds: g.targetIds,
          };
        })
        .filter((l) => l.label && l.subsections.length > 0)
        .sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { numeric: true }),
        );

      // Reopen path: carry the SAVED invoice's customizations onto the
      // freshly-regenerated lines, matched by unit:party. Without this,
      // reopening an invoice wiped every manual price, override, extra and
      // description because the editor rebuilds lines from scratch. Newly
      // eligible cleanings still appear (they just won't have a saved line
      // to inherit from); everything you'd already tuned survives.
      let builtSeeded = built;
      if (seedInvoice?.lines?.length) {
        const savedByKey = {};
        seedInvoice.lines.forEach((sl) => {
          savedByKey[`${sl.unit_id || ""}:${sl.party_id || ""}`] = sl;
        });
        builtSeeded = built.map((l) => {
          const sl = savedByKey[`${l.unitId || ""}:${l.partyId || ""}`];
          if (!sl) return l;
          const hasExtra =
            (parseFloat(sl.extra_amount) || 0) > 0 || sl.extra_note;
          // Rebuild subsection prices from the saved line so edited amounts
          // return exactly as they were.
          const savedSubs = Array.isArray(sl.subsections) ? sl.subsections : [];
          const subByKey = {};
          savedSubs.forEach((s) => {
            subByKey[s.key] = s;
          });
          const mergedSubs = l.subsections.map((s) => {
            const ss = subByKey[s.key];
            if (!ss) return s;
            return {
              ...s,
              mode: ss.mode || s.mode,
              amount: ss.amount != null ? ss.amount : s.amount,
              rate: ss.rate != null ? ss.rate : s.rate,
              minutes: ss.minutes != null ? ss.minutes : s.minutes,
              included: true,
            };
          });
          return {
            ...l,
            subsections: mergedSubs,
            description:
              sl.description != null ? sl.description : l.description,
            amountOverride: sl.amount_overridden
              ? String(sl.amount ?? "")
              : l.amountOverride,
            extraOn: !!hasExtra,
            extraMode: sl.extra_mode || "fixed",
            extraAmount:
              sl.extra_mode !== "time" && (parseFloat(sl.extra_amount) || 0) > 0
                ? String(sl.extra_amount)
                : "",
            extraMinutes:
              sl.extra_minutes != null ? String(sl.extra_minutes) : "",
            extraRate: sl.extra_rate != null ? String(sl.extra_rate) : "",
            extraNote: sl.extra_note || "",
            nonBillable: !!sl.non_billable,
          };
        });
      }
      // Any saved line whose apartment didn't regenerate (its targets are
      // no longer inside the date window, or the free-targets update hadn't
      // propagated yet) is REBUILT straight from the saved row. Without
      // this, reopening silently dropped those lines and their prices —
      // which is exactly the "it erased my presets" report. We reconstruct
      // the whole line from what was saved so nothing is lost.
      if (seedInvoice?.lines?.length) {
        const builtKeys = new Set(
          builtSeeded.map((l) => `${l.unitId || ""}:${l.partyId || ""}`),
        );
        const missing = seedInvoice.lines.filter(
          (sl) => !builtKeys.has(`${sl.unit_id || ""}:${sl.party_id || ""}`),
        );
        if (missing.length) {
          const rebuilt = missing.map((sl) => {
            const savedSubs = Array.isArray(sl.subsections)
              ? sl.subsections
              : [];
            const subs = savedSubs.length
              ? savedSubs.map((s) => ({
                  key: s.key,
                  label: s.label,
                  mode: s.mode || "fixed",
                  amount: s.amount != null ? s.amount : "",
                  rate: s.rate || 0,
                  minutes: s.minutes || "",
                  included: true,
                  fromBook: false,
                }))
              : [
                  {
                    key: `__flat__:${sl.service_type || "clean"}`,
                    label: sl.label || "Whole bedroom",
                    mode: "fixed",
                    amount:
                      parseFloat(sl.base_amount) || parseFloat(sl.amount) || 0,
                    rate: 0,
                    minutes: "",
                    included: true,
                    fromBook: false,
                  },
                ];
            const hasExtra =
              (parseFloat(sl.extra_amount) || 0) > 0 || sl.extra_note;
            return {
              key: `saved:${sl.id}`,
              unitId: sl.unit_id || null,
              partyId: sl.party_id || null,
              label: sl.label || "Line",
              serviceType: sl.service_type || "",
              tookLonger: false,
              cleanedDays: [],
              description: sl.description || "",
              subsections: subs,
              amountOverride: sl.amount_overridden
                ? String(sl.amount ?? "")
                : "",
              extraOn: !!hasExtra,
              extraMode: sl.extra_mode || "fixed",
              extraAmount:
                sl.extra_mode !== "time" &&
                (parseFloat(sl.extra_amount) || 0) > 0
                  ? String(sl.extra_amount)
                  : "",
              extraMinutes:
                sl.extra_minutes != null ? String(sl.extra_minutes) : "",
              extraRate: sl.extra_rate != null ? String(sl.extra_rate) : "",
              extraNote: sl.extra_note || "",
              nonBillable: !!sl.non_billable,
              // No source targets to re-stamp — this line was already billed
              // and its targets freed; saving re-stamps whatever regenerated.
              sourceTargetIds: [],
            };
          });
          builtSeeded = [...builtSeeded, ...rebuilt].sort((a, b) =>
            String(a.label).localeCompare(String(b.label), undefined, {
              numeric: true,
            }),
          );
        }
      }
      setLines(builtSeeded);
      // Diagnostics — surfaced in the empty state so we can see where it
      // breaks (no items found vs found-but-unpriced vs query error).
      const pricedKeys = Object.keys(book).length;
      setDiag({
        units: unitIds.length,
        doneItems: targets.length,
        withItemKey,
        sectionOnly,
        bedrooms: byAssign.size,
        lines: built.length,
        pricedKeys,
        sampleItems,
        sampleSecs,
        err: fetchErr ? fetchErr.message || String(fetchErr) : null,
      });
      // 6) Next invoice number = HIGHEST existing number + 1.
      //    This used to take the most recently CREATED row and add one,
      //    which is only the same thing if invoices are always made in
      //    order. Reopen an old invoice, or save one late, and the "last
      //    created" row is a low number — so the next draft would reuse a
      //    number you've already sent. Scan them all and take the max.
      //    Ordering in SQL can't help here: invoice_number is text, so the
      //    database sorts "99" above "472".
      let allNums = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("invoices")
          .select("invoice_number")
          .range(from, from + 999);
        if (error || !data) break;
        allNums = allNums.concat(data);
        if (data.length < 1000) break;
        if (from > 100000) break;
      }
      const maxNum = allNums
        .map((r) =>
          parseInt(String(r.invoice_number || "").replace(/[^0-9]/g, ""), 10),
        )
        .filter((n) => Number.isFinite(n))
        .reduce((m, n) => Math.max(m, n), 0);
      // Reopen keeps the SAME invoice number and metadata — you're editing
      // the same bill, not writing a new one. A fresh draft gets max+1.
      if (seedInvoice?.invoice_number) {
        setInvoiceNumber(String(seedInvoice.invoice_number));
      } else {
        setInvoiceNumber(maxNum > 0 ? String(maxNum + 1) : "1");
      }
      setTakenNumbers(
        new Set(
          allNums
            .map((r) => String(r.invoice_number || "").trim())
            .filter(Boolean),
        ),
      );
      if (seedInvoice) {
        if (seedInvoice.title) setTitle(seedInvoice.title);
        if (seedInvoice.invoice_date) setInvoiceDate(seedInvoice.invoice_date);
        if (seedInvoice.due_date) setDueDate(seedInvoice.due_date);
      }
      // 7) Bill-to: from the reopened invoice if present, else property.
      setBillTo({
        org: seedInvoice?.bill_to_org || property.name || "",
        contact:
          seedInvoice?.bill_to_contact || property.billing_contact_name || "",
        email: seedInvoice?.bill_to_email || property.billing_email || "",
        phone: seedInvoice?.bill_to_phone || property.billing_phone || "",
        address:
          seedInvoice?.bill_to_address ||
          property.billing_address ||
          property.address ||
          "",
      });
      setLoading(false);
    })(); /* eslint-disable-next-line */
  }, []);

  const toggleExpand = (k) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  const updateLine = (key, patch) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const updateSub = (key, si, patch) =>
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const subsections = l.subsections.map((s, i) =>
          i === si ? { ...s, ...patch } : s,
        );
        return { ...l, subsections };
      }),
    );
  const removeLine = (key) => setLines((ls) => ls.filter((l) => l.key !== key));

  const grandTotal = lines.reduce((s, l) => s + lineAmount(l), 0);

  const save = async (status) => {
    setSaving(true);
    const total = lines.reduce((s, l) => s + lineAmount(l), 0);
    const { data: inv, error } = await supabase
      .from("invoices")
      .insert({
        customer_id: property.id,
        invoice_number: invoiceNumber || null,
        title: title || null,
        invoice_date: invoiceDate || null,
        due_date: dueDate || null,
        status: status || "draft",
        bill_to_org: billTo.org || null,
        bill_to_contact: billTo.contact || null,
        bill_to_email: billTo.email || null,
        bill_to_phone: billTo.phone || null,
        bill_to_address: billTo.address || null,
        period_start: start,
        period_end: end,
        total,
        created_by: employee?.id || null,
      })
      .select()
      .single();
    if (error) {
      setSaving(false);
      alert("Could not save invoice: " + error.message);
      return;
    }
    // Remember this billing contact on the property so the next invoice
    // for it prefills automatically instead of re-typing.
    supabase
      .from("customers")
      .update({
        billing_contact_name: billTo.contact || null,
        billing_email: billTo.email || null,
        billing_phone: billTo.phone || null,
        billing_address: billTo.address || null,
      })
      .eq("id", property.id)
      .then(
        () => {},
        () => {},
      );
    const lineRows = lines.map((l, i) => ({
      invoice_id: inv.id,
      unit_id: l.unitId || null,
      party_id: l.partyId || null,
      label: l.label,
      service_type: l.serviceType || null,
      description: l.description || null,
      subsections: l.subsections
        .filter((s) => s.included)
        .map((s) => ({
          key: s.key,
          label: s.label,
          mode: s.mode,
          amount: subAmount(s),
          minutes: s.minutes,
          rate: s.rate,
        })),
      amount: lineAmount(l),
      amount_overridden: l.amountOverride !== "" && l.amountOverride != null,
      base_amount: baseAmount(l),
      extra_amount: extraAmount(l),
      extra_note: l.extraOn && l.extraNote ? l.extraNote : null,
      extra_mode: l.extraOn ? l.extraMode || "fixed" : null,
      extra_minutes:
        l.extraOn && l.extraMode === "time"
          ? parseFloat(l.extraMinutes) || 0
          : null,
      extra_rate:
        l.extraOn && l.extraMode === "time"
          ? parseFloat(l.extraRate) || 0
          : null,
      // Non-billable lines: amount above is 0 (they don't add to the bill),
      // but we keep what they WOULD have been so reporting shows the comp.
      non_billable: !!l.nonBillable,
      full_amount: lineFullAmount(l),
      qty: 1,
      sort_order: i,
      source_unit_id: l.unitId || null,
      source_party_id: l.partyId || null,
    }));
    if (lineRows.length) {
      const { error: le } = await supabase
        .from("invoice_lines")
        .insert(lineRows);
      if (le) {
        setSaving(false);
        alert("Invoice saved but lines failed: " + le.message);
        return;
      }
    }
    // #3 — learn the combo price. For each billable line that has a combo key
    // (its exact item set) and a real total, remember that amount so the next
    // assignment with the same item set prefills automatically. Only stores
    // when there's an actual amount, and never overwrites with 0/blank.
    try {
      const comboPayload = [];
      lines.forEach((l) => {
        if (!l.comboKey || l.nonBillable) return;
        const amt = lineAmount(l);
        if (!amt || amt <= 0) return;
        comboPayload.push({
          customer_id: property.id,
          subsection_key: l.comboKey,
          label: `Last charged for ${l.label}`,
          mode: "fixed",
          base_amount: amt,
          rate: 0,
          default_minutes: 0,
          sort_order: 5,
          updated_at: new Date().toISOString(),
        });
      });
      if (comboPayload.length) {
        await supabase
          .from("invoice_price_book")
          .upsert(comboPayload, { onConflict: "customer_id,subsection_key" });
      }
    } catch (e) {
      console.warn("[combo price learn] skipped", e);
    }
    // Stamp every covered item as invoiced so it can't be billed again.
    // (Removed lines aren't stamped, so they stay billable.)
    const allTargetIds = lines.flatMap((l) => l.sourceTargetIds || []);
    for (let i = 0; i < allTargetIds.length; i += 200) {
      const chunk = allTargetIds.slice(i, i + 200);
      if (chunk.length)
        await supabase
          .from("assignment_targets")
          .update({ invoiced_on: inv.id })
          .in("id", chunk);
    }
    // Learn: any item priced inline that wasn't already in the price book
    // gets remembered for next time (fixed amount or time rate+minutes).
    const learnMap = {};
    lines.forEach((l) =>
      (l.subsections || []).forEach((s) => {
        if (s.fromBook || !s.included) return;
        if (s.mode === "time") {
          const rate = parseFloat(s.rate) || defaultRate || 0;
          if (rate > 0)
            learnMap[s.key] = {
              customer_id: property.id,
              subsection_key: s.key,
              label: s.label,
              mode: "time",
              base_amount: 0,
              rate,
              default_minutes: parseFloat(s.minutes) || 0,
              sort_order: 0,
              updated_at: new Date().toISOString(),
            };
        } else {
          const amt = parseFloat(s.amount) || 0;
          if (amt > 0)
            learnMap[s.key] = {
              customer_id: property.id,
              subsection_key: s.key,
              label: s.label,
              mode: "fixed",
              base_amount: amt,
              rate: 0,
              default_minutes: 0,
              sort_order: 0,
              updated_at: new Date().toISOString(),
            };
        }
      }),
    );
    const learnRows = Object.values(learnMap);
    if (learnRows.length) {
      await supabase
        .from("invoice_price_book")
        .upsert(learnRows, { onConflict: "customer_id,subsection_key" });
    }
    setSaving(false);
    onSaved && onSaved(inv);
  };

  if (loading) return <Splash text="Building draft…" />;

  if (previewing) {
    const previewInv = {
      invoice_number: invoiceNumber,
      title,
      invoice_date: invoiceDate,
      due_date: dueDate,
      status: "draft",
      bill_to_org: billTo.org,
      bill_to_contact: billTo.contact,
      bill_to_email: billTo.email,
      bill_to_phone: billTo.phone,
      bill_to_address: billTo.address,
    };
    // Must mirror what save() writes, or the preview lies about the bill.
    // InvoiceDocument reads the DB column names (extra_amount etc.), and
    // this mapper used to drop them — so an extra charge was invisible in
    // the preview and only appeared once the invoice was saved.
    const previewLines = lines.map((l) => ({
      id: l.key,
      label: l.label,
      service_type: l.serviceType,
      description: l.description,
      qty: 1,
      amount: lineAmount(l),
      base_amount: baseAmount(l),
      extra_amount: extraAmount(l),
      non_billable: !!l.nonBillable,
      full_amount: lineFullAmount(l),
      extra_note: l.extraOn && l.extraNote ? l.extraNote : null,
      extra_mode: l.extraOn ? l.extraMode || "fixed" : null,
      extra_minutes:
        l.extraOn && l.extraMode === "time"
          ? parseFloat(l.extraMinutes) || 0
          : null,
      extra_rate:
        l.extraOn && l.extraMode === "time"
          ? parseFloat(l.extraRate) || 0
          : null,
    }));
    return (
      <InvoiceDocument
        data={{ inv: previewInv, lines: previewLines }}
        preview
        saving={saving}
        onSaveDraft={() => save("draft")}
        onSaveSent={() => save("sent")}
        onSavePaid={() => save("paid")}
        onBack={() => setPreviewing(false)}
      />
    );
  }

  return (
    <div className="pb-28">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-stone-200 bg-white sticky top-0 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-stone-700 text-sm"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewing(true)}
            className="px-3 py-2 rounded-xl bg-white border border-stone-300 text-stone-700 text-sm font-medium flex items-center gap-1.5"
          >
            <Eye size={15} /> Preview
          </button>
          <button
            onClick={() => save("draft")}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
        </div>
      </div>

      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">
          {property.name}
        </div>
        <h1 className="text-3xl font-light text-stone-900 tracking-tight mb-1">
          Invoice{" "}
          <span className="font-serif italic text-amber-700">draft</span>
        </h1>
        <p className="text-xs text-stone-500 font-mono mb-5">
          {start} → {end} · {lines.length} bedrooms
        </p>

        {/* Invoice meta */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="text-xs font-mono text-stone-500">
            Invoice #
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className={`mt-1 w-full px-3 py-2 rounded-lg border bg-white text-sm text-stone-900 ${
                takenNumbers.has(String(invoiceNumber).trim())
                  ? "border-red-400"
                  : "border-stone-300"
              }`}
            />
            {/* Auto-filled with the next number, but it's a free text field —
               so say something if you land on one that's already out there. */}
            {takenNumbers.has(String(invoiceNumber).trim()) && (
              <span className="block mt-1 text-[10px] text-red-600 normal-case">
                #{invoiceNumber} is already used by another invoice.
              </span>
            )}
          </label>
          <label className="text-xs font-mono text-stone-500">
            Invoice date
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm text-stone-900"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="text-xs font-mono text-stone-500">
            Due date
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm text-stone-900"
            />
          </label>
          <label className="text-xs font-mono text-stone-500">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cleaning Checks June Bldg 6-10"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm text-stone-900"
            />
          </label>
        </div>

        {/* Bill to (collapsible, defaulted from property) */}
        <div className="mb-5 rounded-2xl bg-white border border-stone-200 overflow-hidden">
          <button
            onClick={() => setBillOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50"
          >
            <span className="text-sm font-medium text-stone-800">
              Bill to · {billTo.org || "—"}
            </span>
            <ChevronRight
              size={15}
              className={`text-stone-400 transition-transform ${billOpen ? "rotate-90" : ""}`}
            />
          </button>
          {billOpen && (
            <div className="border-t border-stone-100 p-4 space-y-2">
              {[
                ["org", "Organization"],
                ["contact", "Contact name"],
                ["email", "Email"],
                ["phone", "Phone"],
                ["address", "Address"],
              ].map(([k, lbl]) => (
                <label
                  key={k}
                  className="block text-[11px] font-mono text-stone-500"
                >
                  {lbl}
                  <input
                    value={billTo[k]}
                    onChange={(e) =>
                      setBillTo((b) => ({ ...b, [k]: e.target.value }))
                    }
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm text-stone-900"
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Reconciliation. The Done tab on the property side counts every
           finished bedroom in this window; this draft drops the ones an
           earlier invoice already claimed. Without this line the two
           screens disagree for no visible reason. */}
        {rebillWarning && (
          <div className="mb-3 p-3 rounded-2xl bg-red-50 border-2 border-red-300">
            <div className="text-xs text-red-900 font-bold flex items-center gap-1.5">
              <AlertCircle size={14} className="flex-shrink-0" /> Re-bill
              protection is OFF
            </div>
            <div className="text-[11px] text-red-800 mt-1">
              This database is missing the column that tracks which cleanings
              have already been invoiced, so this draft may show work you've{" "}
              <span className="font-bold">already billed</span> (e.g. a bedroom
              that's on another invoice). Don't send this until it's fixed — run
              the <span className="font-mono">v41</span> migration in Supabase,
              then reopen this draft.
            </div>
          </div>
        )}

        {billedElsewhere.bedrooms > 0 && (
          <div className="mb-3 p-3 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="text-xs text-amber-900 font-medium">
              {billedElsewhere.bedrooms} more{" "}
              {billedElsewhere.bedrooms === 1
                ? "cleaning was"
                : "cleanings were"}{" "}
              finished in this window but{" "}
              {billedElsewhere.bedrooms === 1 ? "is" : "are"} already billed —
              not shown below.
            </div>
            {billedElsewhere.invoices.length > 0 && (
              <div className="text-[11px] font-mono text-amber-800/80 mt-1">
                On{" "}
                {billedElsewhere.invoices
                  .map((i) => `#${i.invoice_number || "—"} (${i.status})`)
                  .join(", ")}
              </div>
            )}
            <div className="text-[11px] text-amber-800/70 mt-1">
              This is why the property's Done list can show more than this
              draft. To re-bill them, reopen that invoice with “Edit / add
              cleanings”.
            </div>
          </div>
        )}

        {/* Scheduled in this range but not finished. Deliberately NOT
           billable lines: an invoice is a claim that work happened, and
           nothing here has. Listed so the range can't quietly hide a job,
           and dismissible so a known no-show stops nagging. */}
        {unfinished.filter((u) => !dismissed.has(u.id)).length > 0 && (
          <div className="mb-4 rounded-2xl border-2 border-red-300 bg-red-50 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-red-200">
              <div className="text-xs font-medium text-red-900">
                {unfinished.filter((u) => !dismissed.has(u.id)).length} cleaning
                {unfinished.filter((u) => !dismissed.has(u.id)).length === 1
                  ? ""
                  : "s"}{" "}
                scheduled in this range{" "}
                {unfinished.filter((u) => !dismissed.has(u.id)).length === 1
                  ? "is"
                  : "are"}{" "}
                not finished — not billed below.
              </div>
              <div className="text-[11px] text-red-800/70 mt-0.5">
                Finish them in Operations and regenerate to bill them, or
                dismiss to hide.
              </div>
            </div>
            {unfinished
              .filter((u) => !dismissed.has(u.id))
              .map((u) => (
                <div
                  key={u.id}
                  className="px-4 py-2 flex items-center gap-2 border-b border-red-100 last:border-0"
                >
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex-shrink-0 ${
                      u.started > 0
                        ? "bg-amber-500 text-white"
                        : "bg-white border border-red-300 text-red-700"
                    }`}
                  >
                    {u.started > 0 ? "In progress" : "Not started"}
                  </span>
                  <span className="font-mono text-sm text-stone-900 truncate">
                    {u.label}
                  </span>
                  {u.type && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-stone-600 flex-shrink-0">
                      {assignmentTypeLabel(u.type)}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-stone-500 flex-shrink-0">
                    {u.scheduled ? fmtDueDate(u.scheduled) : "no date"} ·{" "}
                    {u.started}/{u.total} items started
                  </span>
                  <button
                    onClick={() =>
                      setDismissed((prev) => new Set([...prev, u.id]))
                    }
                    title="Hide this — doesn't change the job"
                    className="ml-auto p-1 rounded-lg text-red-400 hover:text-red-700 hover:bg-red-100 flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
          </div>
        )}

        {/* CROSS-CHECK — see the same three things you'd check by hand:
            what this draft bills, what's already on past invoices, and what
            was done in this range but isn't being billed. All for the same
            date window, so you can confirm nothing's double-billed or
            missed before sending. */}
        <div className="mb-4 rounded-2xl border border-stone-200 overflow-hidden">
          <button
            onClick={() => setVerifyOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 hover:bg-stone-100 transition-colors"
          >
            <span className="text-xs uppercase tracking-wider font-mono text-stone-700 flex items-center gap-2">
              <ClipboardList size={13} /> Cross-check this range
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-stone-400">
                {lines.length} to bill · {billedElsewhere.bedrooms} already
                billed
              </span>
              <ChevronRight
                size={15}
                className={`text-stone-400 transition-transform ${verifyOpen ? "rotate-90" : ""}`}
              />
            </span>
          </button>
          {verifyOpen && (
            <div className="p-4 space-y-4 bg-white">
              {/* 1 — On this draft */}
              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono text-emerald-700 mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> On
                  this new invoice ({lines.length})
                </div>
                {lines.length === 0 ? (
                  <div className="text-xs text-stone-400 pl-3.5">
                    Nothing on the draft yet.
                  </div>
                ) : (
                  <div className="space-y-1 pl-3.5">
                    {lines.map((l) => (
                      <div
                        key={l.key}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-mono text-stone-800 truncate">
                          {l.label}
                          {l.serviceType
                            ? ` · ${assignmentTypeLabel ? assignmentTypeLabel(l.serviceType) : l.serviceType}`
                            : ""}
                          {l.cleanedDays?.length > 0 && (
                            <span className="text-stone-400">
                              {" "}
                              · {fmtDueDate(l.cleanedDays[0])}
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-stone-600 flex-shrink-0">
                          {l.nonBillable ? (
                            <span className="text-stone-400">not billed</span>
                          ) : (
                            `$${lineAmount(l).toFixed(2)}`
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2 — Already on past invoices */}
              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono text-blue-700 mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Already
                  billed on a past invoice ({billedElsewhere.items?.length || 0}
                  )
                </div>
                {(billedElsewhere.items?.length || 0) === 0 ? (
                  <div className="text-xs text-stone-400 pl-3.5">
                    None of this range's cleanings are on an earlier invoice.
                  </div>
                ) : (
                  <div className="space-y-1 pl-3.5">
                    {billedElsewhere.items.map((b, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-mono text-stone-800 truncate">
                          {b.unitLabel}
                          {b.type
                            ? ` · ${assignmentTypeLabel ? assignmentTypeLabel(b.type) : b.type}`
                            : ""}
                          {b.date && (
                            <span className="text-stone-400">
                              {" "}
                              · {fmtDueDate(String(b.date).slice(0, 10))}
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-blue-700 flex-shrink-0 whitespace-nowrap">
                          #{b.invoiceNumber || "—"}
                          {b.invoiceStatus ? ` (${b.invoiceStatus})` : ""}
                        </span>
                      </div>
                    ))}
                    <div className="text-[11px] text-stone-400 pt-1">
                      These are hidden from the draft above so they can't be
                      billed twice.
                    </div>
                  </div>
                )}
              </div>

              {/* 3 — Done in range but not on this bill (unfinished / scheduled) */}
              {unfinished.filter((u) => !dismissed.has(u.id)).length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-mono text-amber-700 mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />{" "}
                    Scheduled in range, not finished (
                    {unfinished.filter((u) => !dismissed.has(u.id)).length})
                  </div>
                  <div className="space-y-1 pl-3.5">
                    {unfinished
                      .filter((u) => !dismissed.has(u.id))
                      .map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-mono text-stone-800 truncate">
                            {u.label}
                            {u.type
                              ? ` · ${assignmentTypeLabel ? assignmentTypeLabel(u.type) : u.type}`
                              : ""}
                            {u.scheduled && (
                              <span className="text-stone-400">
                                {" "}
                                · {fmtDueDate(String(u.scheduled).slice(0, 10))}
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-stone-400 flex-shrink-0">
                            {u.started}/{u.total} started
                          </span>
                        </div>
                      ))}
                    <div className="text-[11px] text-stone-400 pt-1">
                      Not billed — the work isn't finished.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wider text-stone-500 font-mono">
            Line items ({lines.length})
          </span>
          {diag && lines.length > 0 && (
            <span className="text-[10px] font-mono text-stone-400">
              {diag.bedrooms} {diag.bedrooms === 1 ? "bedroom" : "bedrooms"}{" "}
              billable · {diag.doneItems} cleaned items
            </span>
          )}
        </div>
        {lines.length === 0 ? (
          <div className="py-6 px-4 border-2 border-dashed border-stone-200 rounded-2xl text-sm">
            <div className="text-stone-500 mb-3 text-center">
              Nothing to bill in this range yet.
            </div>
            {diag && (
              <div className="text-xs font-mono text-stone-500 space-y-1 bg-stone-50 rounded-xl p-3">
                <div>
                  Units in property:{" "}
                  <span className="text-stone-800">{diag.units}</span>
                </div>
                <div>
                  Cleaned items found in range:{" "}
                  <span className="text-stone-800">{diag.doneItems}</span>
                </div>
                <div>
                  Bedrooms with work:{" "}
                  <span className="text-stone-800">{diag.bedrooms}</span>
                </div>
                <div>
                  Priced items in price book:{" "}
                  <span className="text-stone-800">{diag.pricedKeys}</span>
                </div>
                {diag.err && (
                  <div className="text-red-600 break-words">
                    Query error: {diag.err}
                  </div>
                )}
                <div className="pt-2 text-stone-400">
                  {diag.units === 0
                    ? "This property has no units — generation needs unit/bedroom data."
                    : diag.doneItems === 0
                      ? "No items were marked done with a completion date in this range. Try widening the dates, or check that these cleans were completed (not just started)."
                      : diag.pricedKeys === 0
                        ? "Items were cleaned, but nothing is priced yet — set prices in the price book."
                        : "Items were cleaned but none matched a priced subsection key. Tell me a cleaned item and I can check the key mapping."}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {lines.map((l, idx) => {
              const open = expanded.has(l.key);
              const amt = lineAmount(l);
              const base = baseAmount(l);
              const xtra = extraAmount(l);
              // What the ticked items come to, before any override replaces
              // it — shown next to the "Standard" header so the override is
              // visibly a replacement rather than a mystery.
              const baseItemsTotal = (l.subsections || [])
                .filter((x) => x.included)
                .reduce((sum, x) => sum + subAmount(x), 0);
              const overridden =
                l.overrideMode === "time" ||
                (l.amountOverride !== "" && l.amountOverride != null);
              return (
                /* Heavy border + shadow: expanded lines run long, and a 1px
                   hairline made it impossible to see where one apartment
                   ended and the next began. Open lines get an amber edge so
                   the one you're editing is unmistakable. */
                <div
                  key={l.key}
                  className={`rounded-2xl overflow-hidden bg-white shadow-sm ${
                    open
                      ? "border-2 border-amber-400 shadow-md"
                      : "border-2 border-stone-300"
                  }`}
                >
                  <div
                    className={`flex items-center gap-2 px-4 py-3 ${open ? "bg-amber-50 border-b-2 border-amber-200" : ""}`}
                  >
                    <button
                      onClick={() => toggleExpand(l.key)}
                      className="flex-1 flex items-center gap-2 text-left"
                    >
                      <ChevronRight
                        size={15}
                        className={`text-stone-400 transition-transform ${open ? "rotate-90" : ""}`}
                      />
                      <span className="font-mono text-sm font-medium text-stone-900">
                        {l.label}
                      </span>
                      {l.serviceType && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                          {assignmentTypeLabel
                            ? assignmentTypeLabel(l.serviceType)
                            : l.serviceType}
                        </span>
                      )}
                      {/* Two ways a line becomes "extra": the cleaner flagged
                         it in the field (tookLonger), or you priced one here.
                         Either way the chip should say so — a $30 extra with
                         no chip is exactly the thing you'd miss scanning
                         seven lines. */}
                      {(l.tookLonger || xtra > 0) && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white inline-flex items-center gap-1 flex-shrink-0"
                          title={
                            xtra > 0
                              ? `Extra charge of $${xtra.toFixed(2)} on this line`
                              : "Cleaner marked this as taking longer — charge extra"
                          }
                        >
                          <Clock size={9} /> EXTRA
                          {xtra > 0 ? ` +$${xtra.toFixed(2)}` : ""}
                        </span>
                      )}
                    </button>
                    {/* When this bedroom was actually cleaned. The invoice
                       only bills finished work, so every line has a date —
                       and you shouldn't have to trust the range blindly. */}
                    {l.cleanedDays?.length > 0 && (
                      <span className="text-[10px] font-mono text-stone-500 flex-shrink-0 inline-flex items-center gap-1 whitespace-nowrap">
                        <Calendar size={9} className="text-stone-400" />
                        {l.cleanedDays.length === 1
                          ? fmtDueDate(l.cleanedDays[0])
                          : `${fmtDueDate(l.cleanedDays[0])} → ${fmtDueDate(l.cleanedDays[l.cleanedDays.length - 1])}`}
                      </span>
                    )}
                    <span className="text-right flex-shrink-0">
                      {l.nonBillable ? (
                        <>
                          <span className="font-mono text-sm block text-stone-400 line-through">
                            ${lineFullAmount(l).toFixed(2)}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-full bg-stone-200 text-stone-600 font-bold">
                            Not billed
                          </span>
                        </>
                      ) : (
                        <>
                          <span
                            className={`font-mono text-sm block ${overridden ? "text-amber-700" : "text-stone-900"}`}
                          >
                            ${amt.toFixed(2)}
                          </span>
                          {xtra > 0 && (
                            <span className="text-[10px] font-mono text-amber-700 block">
                              ${base.toFixed(2)} + ${xtra.toFixed(2)} extra
                            </span>
                          )}
                        </>
                      )}
                    </span>
                    <button
                      onClick={() => removeLine(l.key)}
                      className="p-1.5 rounded-lg text-stone-300 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {open && (
                    <div className="border-t border-stone-100 p-4 space-y-3">
                      {/* Non-billable: owner eats this line. Excluded from the
                         property's total and hidden on the printed invoice,
                         but still recorded so it shows in reporting. */}
                      <label
                        className={`flex items-center gap-3 p-3 rounded-xl border ${l.nonBillable ? "bg-stone-100 border-stone-300" : "bg-white border-stone-200"}`}
                      >
                        <input
                          type="checkbox"
                          checked={!!l.nonBillable}
                          onChange={(e) =>
                            updateLine(l.key, { nonBillable: e.target.checked })
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-stone-900">
                            Don't bill the property for this
                          </div>
                          <div className="text-xs text-stone-500">
                            Keeps it off the invoice you send and out of the
                            total, but still records it (at{" "}
                            {`$${lineFullAmount(l).toFixed(2)}`}) so it shows in
                            your reports as a comp / redo you covered.
                          </div>
                        </div>
                      </label>
                      {/* Three stages, in the order they apply:
                         1. STANDARD — the priced items
                         2. EXTRA    — added on top
                         3. OVERRIDE — replaces the standard total, so it
                                       goes last where it can't be missed. */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500">
                          1 · Standard
                        </span>
                        <span className="text-[10px] font-mono text-stone-400">
                          what the items come to
                        </span>
                        <div className="flex-1 h-px bg-stone-200" />
                        <span className="text-[11px] font-mono text-stone-700">
                          ${baseItemsTotal.toFixed(2)}
                        </span>
                      </div>
                      {l.subsections.length === 0 ? (
                        <div className="text-xs text-stone-400 font-mono">
                          No priced items detected for this bedroom. Set a line
                          total below, or price its items in the price book.
                        </div>
                      ) : (
                        (() => {
                          const bySection = {};
                          l.subsections.forEach((s, si) => {
                            const sec =
                              String(s.key || "").split(":")[0] || "other";
                            (bySection[sec] = bySection[sec] || []).push({
                              s,
                              si,
                            });
                          });
                          const order = [
                            "bedroom",
                            "vanity",
                            "bathroom",
                            "general",
                            "__flat__",
                            "other",
                          ];
                          // '__flat__' is the synthetic key for a whole-bedroom
                          // line (nothing itemised failed). It was printing raw
                          // as "__FLAT__", which means nothing to anyone.
                          const secLabel = {
                            bedroom: "Bedroom",
                            vanity: "Vanity",
                            bathroom: "Bathroom",
                            general: "General",
                            __flat__: "Whole bedroom",
                            other: "Other",
                          };
                          const secs = Object.keys(bySection).sort((a, b) => {
                            const ia = order.indexOf(a),
                              ib = order.indexOf(b);
                            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
                          });
                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
                              {secs.map((sec) => (
                                <React.Fragment key={sec}>
                                  <div className="col-span-full text-[10px] uppercase tracking-wider font-mono text-stone-400 border-b border-stone-100 pb-1 mt-1">
                                    {secLabel[sec] || sec}
                                  </div>
                                  {bySection[sec].map(({ s, si }) => (
                                    <div
                                      key={s.key}
                                      className="flex items-center gap-1.5 min-w-0 max-w-[340px]"
                                    >
                                      <button
                                        onClick={() =>
                                          updateSub(l.key, si, {
                                            included: !s.included,
                                          })
                                        }
                                        className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${s.included ? "bg-stone-900 text-white" : "border border-stone-300 text-transparent"}`}
                                      >
                                        <Check size={10} />
                                      </button>
                                      <span
                                        className={`flex-1 min-w-0 text-xs truncate ${s.included ? "text-stone-800" : "text-stone-400 line-through"} ${!s.fromBook && s.included ? "font-medium" : ""}`}
                                        title={s.label}
                                      >
                                        {s.label}
                                      </span>
                                      <button
                                        onClick={() =>
                                          updateSub(l.key, si, {
                                            mode:
                                              s.mode === "time"
                                                ? "fixed"
                                                : "time",
                                            rate:
                                              parseFloat(s.rate) > 0
                                                ? s.rate
                                                : defaultRate || 0,
                                          })
                                        }
                                        className={`p-0.5 rounded flex-shrink-0 ${s.mode === "time" ? "text-stone-900 bg-stone-100" : "text-stone-300 hover:text-stone-500"}`}
                                        title="Switch to time × rate"
                                      >
                                        <Clock size={11} />
                                      </button>
                                      {s.mode === "time" ? (
                                        /* Was "47 × 2" with no units — unreadable.
                                         It's an hourly RATE times MINUTES, so say
                                         so, and show what it works out to. */
                                        <span
                                          className="flex items-center gap-0.5 text-[11px] font-mono flex-shrink-0"
                                          title="Hourly rate × minutes"
                                        >
                                          <span className="text-stone-400">
                                            $
                                          </span>
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={s.rate}
                                            onChange={(e) =>
                                              updateSub(l.key, si, {
                                                rate: e.target.value,
                                              })
                                            }
                                            placeholder={
                                              defaultRate
                                                ? String(defaultRate)
                                                : "0"
                                            }
                                            className="w-10 px-1 py-0.5 rounded border border-stone-300 bg-white text-right"
                                          />
                                          <span className="text-stone-400">
                                            /hr ×
                                          </span>
                                          <input
                                            type="number"
                                            value={s.minutes}
                                            onChange={(e) =>
                                              updateSub(l.key, si, {
                                                minutes: e.target.value,
                                              })
                                            }
                                            placeholder="0"
                                            className="w-8 px-1 py-0.5 rounded border border-stone-300 bg-white text-right"
                                          />
                                          <span className="text-stone-400">
                                            m =
                                          </span>
                                          <span className="text-emerald-700 font-medium w-12 text-right">
                                            ${subAmount(s).toFixed(2)}
                                          </span>
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-0.5 text-[11px] font-mono flex-shrink-0">
                                          <span className="text-stone-400">
                                            $
                                          </span>
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={s.amount}
                                            onChange={(e) =>
                                              updateSub(l.key, si, {
                                                amount: e.target.value,
                                              })
                                            }
                                            placeholder="0.00"
                                            className={`w-14 px-1.5 py-0.5 rounded border bg-white text-right ${s.fromBook ? "border-stone-300" : "border-amber-300"}`}
                                          />
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </React.Fragment>
                              ))}
                            </div>
                          );
                        })()
                      )}
                      <div className="pt-2 border-t border-stone-100">
                        <label className="block text-[11px] font-mono text-stone-500 mb-1">
                          Description (prints on invoice)
                        </label>
                        <input
                          value={l.description}
                          onChange={(e) =>
                            updateLine(l.key, { description: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm text-stone-700"
                        />
                      </div>
                      {/* EXTRA — adds on top of the standard total. */}
                      <div className="pt-3 mt-2 border-t-2 border-amber-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] uppercase tracking-wider font-mono text-amber-700">
                            2 · Extra charge
                          </span>
                          <span className="text-[10px] font-mono text-stone-400">
                            added on top
                          </span>
                          <div className="flex-1 h-px bg-amber-100" />
                          <span className="text-[11px] font-mono text-amber-700">
                            +${xtra.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <button
                            onClick={() =>
                              updateLine(l.key, {
                                extraOn: !l.extraOn,
                                extraRate:
                                  !l.extraOn && !l.extraRate
                                    ? defaultRate || ""
                                    : l.extraRate,
                              })
                            }
                            className={`text-[10px] font-mono px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${l.extraOn ? "bg-amber-500 text-white" : "bg-white border border-dashed border-stone-300 text-stone-500"}`}
                          >
                            <Plus size={10} />{" "}
                            {l.extraOn ? "Extra charge" : "Add extra charge"}
                          </button>
                          {l.extraOn && (
                            <div className="flex p-0.5 bg-stone-100 rounded-lg">
                              <button
                                onClick={() =>
                                  updateLine(l.key, { extraMode: "fixed" })
                                }
                                className={`px-2 py-1 rounded-md text-[10px] font-mono flex items-center gap-0.5 ${l.extraMode !== "time" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
                              >
                                <DollarSign size={10} /> Amount
                              </button>
                              <button
                                onClick={() =>
                                  updateLine(l.key, {
                                    extraMode: "time",
                                    extraRate:
                                      parseFloat(l.extraRate) > 0
                                        ? l.extraRate
                                        : defaultRate || 0,
                                  })
                                }
                                className={`px-2 py-1 rounded-md text-[10px] font-mono flex items-center gap-0.5 ${l.extraMode === "time" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
                              >
                                <Clock size={10} /> Time × rate
                              </button>
                            </div>
                          )}
                        </div>
                        {l.extraOn && (
                          <>
                            {l.extraMode === "time" ? (
                              <div className="flex items-center justify-end gap-1 text-sm font-mono text-stone-600 flex-wrap">
                                <span className="text-stone-400">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={l.extraRate || ""}
                                  onChange={(e) =>
                                    updateLine(l.key, {
                                      extraRate: e.target.value,
                                    })
                                  }
                                  placeholder={
                                    defaultRate ? String(defaultRate) : "0.00"
                                  }
                                  className="w-16 px-2 py-1 rounded-lg border border-stone-300 bg-white text-right"
                                />
                                <span className="text-stone-400 text-xs">
                                  /hr ×
                                </span>
                                <input
                                  type="number"
                                  step="1"
                                  value={l.extraMinutes || ""}
                                  onChange={(e) =>
                                    updateLine(l.key, {
                                      extraMinutes: e.target.value,
                                    })
                                  }
                                  placeholder="min"
                                  className="w-16 px-2 py-1 rounded-lg border border-stone-300 bg-white text-right"
                                />
                                <span className="text-stone-400 text-xs">
                                  min =
                                </span>
                                <span className="text-amber-700 font-medium min-w-[56px] text-right">
                                  ${xtra.toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end">
                                <span className="flex items-center gap-1 text-sm font-mono">
                                  <span className="text-stone-400">$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={l.extraAmount}
                                    onChange={(e) =>
                                      updateLine(l.key, {
                                        extraAmount: e.target.value,
                                      })
                                    }
                                    placeholder="0.00"
                                    className="w-24 px-2 py-1 rounded-lg border border-amber-300 bg-white text-right"
                                  />
                                </span>
                              </div>
                            )}
                            <input
                              value={l.extraNote || ""}
                              onChange={(e) =>
                                updateLine(l.key, { extraNote: e.target.value })
                              }
                              placeholder="Why? Prints under the extra, e.g. “Heavy soil — 45 min over”"
                              className="w-full mt-2 px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm text-stone-700"
                            />
                            <div className="flex items-center justify-end gap-3 mt-2 text-[11px] font-mono">
                              <span className="text-stone-500">
                                Base ${base.toFixed(2)}
                              </span>
                              <span className="text-amber-700">
                                Extra ${xtra.toFixed(2)}
                              </span>
                              <span className="text-stone-900 font-medium">
                                Total ${amt.toFixed(2)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="pt-3 mt-2 border-t-2 border-stone-300">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500">
                            3 · Override line total
                          </span>
                          <span className="text-[10px] font-mono text-stone-400">
                            replaces the standard total — the extra still
                            applies
                          </span>
                          {l.fromMemory && (
                            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5 flex items-center gap-1">
                              <Clock size={9} /> from last time
                            </span>
                          )}
                          <div className="flex-1 h-px bg-stone-200" />
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-mono text-stone-500">
                            Set a flat total
                          </span>
                          <div className="flex p-0.5 bg-stone-100 rounded-lg">
                            <button
                              onClick={() =>
                                updateLine(l.key, { overrideMode: "fixed" })
                              }
                              className={`px-2 py-1 rounded-md text-[10px] font-mono flex items-center gap-0.5 ${l.overrideMode !== "time" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
                            >
                              <DollarSign size={10} /> Amount
                            </button>
                            <button
                              onClick={() =>
                                updateLine(l.key, {
                                  overrideMode: "time",
                                  overrideRate:
                                    parseFloat(l.overrideRate) > 0
                                      ? l.overrideRate
                                      : defaultRate || 0,
                                })
                              }
                              className={`px-2 py-1 rounded-md text-[10px] font-mono flex items-center gap-0.5 ${l.overrideMode === "time" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
                            >
                              <Clock size={10} /> Time × rate
                            </button>
                          </div>
                        </div>
                        {l.overrideMode === "time" ? (
                          <div className="flex items-center justify-end gap-1 text-sm font-mono text-stone-600 flex-wrap">
                            <span className="text-stone-400">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={l.overrideRate || ""}
                              onChange={(e) =>
                                updateLine(l.key, {
                                  overrideRate: e.target.value,
                                })
                              }
                              placeholder={
                                defaultRate ? String(defaultRate) : "0.00"
                              }
                              className="w-16 px-2 py-1 rounded-lg border border-stone-300 bg-white text-right"
                            />
                            <span className="text-stone-400 text-xs">
                              /hr ×
                            </span>
                            <input
                              type="number"
                              step="1"
                              value={l.overrideMinutes || ""}
                              onChange={(e) =>
                                updateLine(l.key, {
                                  overrideMinutes: e.target.value,
                                })
                              }
                              placeholder="min"
                              className="w-16 px-2 py-1 rounded-lg border border-stone-300 bg-white text-right"
                            />
                            <span className="text-stone-400 text-xs">
                              min =
                            </span>
                            <span className="text-emerald-700 font-medium min-w-[56px] text-right">
                              ${base.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end">
                            <span className="flex items-center gap-1 text-sm font-mono">
                              <span className="text-stone-400">$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={l.amountOverride}
                                onChange={(e) =>
                                  updateLine(l.key, {
                                    amountOverride: e.target.value,
                                  })
                                }
                                placeholder={l.subsections
                                  .filter((s) => s.included)
                                  .reduce((sum, s) => sum + subAmount(s), 0)
                                  .toFixed(2)}
                                className="w-24 px-2 py-1 rounded-lg border border-stone-300 bg-white text-right"
                              />
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Total */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t-2 border-stone-900">
          <span className="text-xs uppercase tracking-widest text-stone-500 font-mono">
            Total
          </span>
          <span className="font-serif text-2xl text-stone-900">
            ${grandTotal.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// INVOICE DOCUMENT (Phase 1c) — the printable invoice. Loads a saved
// invoice + its lines and renders the polished layout matching the
// company's PDF, with print / status / delete actions.
// =================================================================
export function InvoiceDocument({
  invoiceId,
  data,
  preview,
  onBack,
  onChanged,
  onEditDraft,
  saving = false,
  onSaveDraft,
  onSaveSent,
  onSavePaid,
  readOnly = false,
}) {
  const [inv, setInv] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: invData } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();
    const { data: lineData } = await supabase
      .from("invoice_lines")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("sort_order");
    setInv(invData || null);
    setLines(lineData || []);
    setLoading(false);
  };
  useEffect(() => {
    if (data) {
      setInv(data.inv);
      setLines(data.lines || []);
      setLoading(false);
      return;
    }
    load();
    /* eslint-disable-next-line */
  }, [invoiceId, data]);

  const setStatus = async (status) => {
    setWorking(true);
    const patch = { status };
    if (status === "sent") patch.sent_at = new Date().toISOString();
    if (status === "paid") patch.paid_at = new Date().toISOString();
    await supabase.from("invoices").update(patch).eq("id", invoiceId);
    setWorking(false);
    await load();
    onChanged && onChanged();
  };
  const del = async () => {
    if (!confirm("Delete this invoice? Its items become billable again."))
      return;
    setWorking(true);
    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", invoiceId);
    setWorking(false);
    if (error) {
      alert("Could not delete: " + error.message);
      return;
    }
    onChanged && onChanged();
    onBack && onBack();
  };

  if (loading) return <Splash text="Loading invoice…" />;
  if (!inv)
    return (
      <div className="p-6">
        <button
          onClick={onBack}
          className="text-sm text-stone-600 flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="mt-4 text-stone-500">Invoice not found.</div>
      </div>
    );

  // The printed/PM-facing invoice only shows lines the property is billed
  // for. Non-billable lines (comps/redos the owner ate) are tracked in the
  // data but never appear on the document or in its totals.
  const billableLines = lines.filter((l) => !l.non_billable);
  const total = billableLines.reduce(
    (s, l) => s + (parseFloat(l.amount) || 0),
    0,
  );
  const extraTotal = billableLines.reduce(
    (s, l) => s + (parseFloat(l.extra_amount) || 0),
    0,
  );
  const baseTotal = billableLines.reduce((s, l) => {
    const amt = parseFloat(l.amount) || 0;
    const x = parseFloat(l.extra_amount) || 0;
    return (
      s + (l.base_amount != null ? parseFloat(l.base_amount) || 0 : amt - x)
    );
  }, 0);

  return (
    <div className="pb-28 bg-stone-100 min-h-screen">
      {/* Action bar — hidden when printing */}
      <div className="print:hidden flex items-center justify-between gap-2 px-5 py-3 border-b border-stone-200 bg-white sticky top-0 z-10 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-stone-700 text-sm"
        >
          <ArrowLeft size={16} /> {preview ? "Back to draft" : "Back"}
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {!readOnly && preview && (
            <>
              <span className="text-xs font-mono text-amber-700 px-2 py-1 rounded bg-amber-50">
                Preview
              </span>
              {onSaveDraft && (
                <button
                  onClick={onSaveDraft}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-700 text-xs font-medium disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save draft"}
                </button>
              )}
              {onSaveSent && (
                <button
                  onClick={onSaveSent}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium disabled:opacity-50"
                >
                  Save & mark sent
                </button>
              )}
              {onSavePaid && (
                <button
                  onClick={onSavePaid}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium disabled:opacity-50"
                >
                  Save & mark paid
                </button>
              )}
            </>
          )}
          {!readOnly && !preview && inv.status === "draft" && onEditDraft && (
            <button
              onClick={() => {
                if (
                  confirm(
                    "Reopen this invoice to edit? Your prices, overrides and notes are kept, and any newer cleanings in the period merge in.",
                  )
                )
                  onEditDraft(inv);
              }}
              disabled={working}
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium disabled:opacity-50"
            >
              Edit / add cleanings
            </button>
          )}
          {!readOnly && !preview && inv.status !== "sent" && (
            <button
              onClick={() => setStatus("sent")}
              disabled={working}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium disabled:opacity-50"
            >
              Mark sent
            </button>
          )}
          {!readOnly && !preview && inv.status !== "paid" && (
            <button
              onClick={() => setStatus("paid")}
              disabled={working}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium disabled:opacity-50"
            >
              Mark paid
            </button>
          )}
          {!readOnly && !preview && inv.status !== "draft" && (
            <button
              onClick={() => setStatus("draft")}
              disabled={working}
              className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-600 text-xs"
            >
              Back to draft
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium flex items-center gap-1.5"
          >
            <FileText size={13} />{" "}
            {readOnly ? "Download / print" : "Print / PDF"}
          </button>
          {!readOnly && !preview && (
            <button
              onClick={del}
              disabled={working}
              className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* The sheet */}
      <div
        className="max-w-[800px] mx-auto bg-white my-4 print:my-0 shadow-sm print:shadow-none px-8 py-8 text-stone-800"
        style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-6 pb-6 border-b border-stone-200">
          <img
            src={SUMMIT_LOGO_URL}
            alt="Summit Clean"
            className="w-28 h-28 object-contain bg-stone-900 rounded-lg p-2"
          />
          <div className="text-right">
            <div className="text-3xl font-light tracking-tight text-stone-900">
              INVOICE
            </div>
            {inv.title && (
              <div className="text-sm text-stone-500 mt-0.5">{inv.title}</div>
            )}
            <div className="mt-3 text-xs text-stone-600 leading-relaxed">
              <div className="font-semibold text-stone-800">
                {SUMMIT_COMPANY.name}
              </div>
              {SUMMIT_COMPANY.lines.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
              <div className="mt-2">{SUMMIT_COMPANY.url}</div>
            </div>
          </div>
        </div>

        {/* Bill to + meta */}
        <div className="flex items-start justify-between gap-6 py-6">
          <div className="text-xs text-stone-600 leading-relaxed">
            <div className="text-stone-400 uppercase tracking-wider text-[10px] mb-1">
              Bill to
            </div>
            {inv.bill_to_org && (
              <div className="font-semibold text-stone-800">
                {inv.bill_to_org}
              </div>
            )}
            {inv.bill_to_contact && <div>{inv.bill_to_contact}</div>}
            {inv.bill_to_address && (
              <div className="whitespace-pre-line">{inv.bill_to_address}</div>
            )}
            {inv.bill_to_phone && (
              <div className="mt-1">{inv.bill_to_phone}</div>
            )}
            {inv.bill_to_email && <div>{inv.bill_to_email}</div>}
          </div>
          <div className="text-xs min-w-[220px]">
            <div className="flex justify-between py-1">
              <span className="text-stone-500">Invoice Number:</span>
              <span className="font-medium text-stone-800">
                {inv.invoice_number || "—"}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-stone-500">Invoice Date:</span>
              <span className="text-stone-800">
                {fmtInvoiceDate(inv.invoice_date)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-stone-500">Payment Due:</span>
              <span className="text-stone-800">
                {fmtInvoiceDate(inv.due_date)}
              </span>
            </div>
            <div className="flex justify-between py-2 mt-1 px-2 bg-stone-100 rounded">
              <span className="text-stone-600 font-medium">
                Amount Due (USD):
              </span>
              <span className="font-semibold text-stone-900">
                ${total.toFixed(2)}
              </span>
            </div>
            <div className="mt-2 text-right">
              <span
                className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${INVOICE_STATUS_STYLE[inv.status] || "bg-stone-100 text-stone-600"}`}
              >
                {inv.status}
              </span>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="text-xs text-stone-800">
          {/* Header */}
          <div
            className="flex text-white font-medium px-3 py-2"
            style={{
              background: "#44403c",
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
          >
            <div className="flex-1">Items</div>
            <div className="text-right" style={{ width: 110 }}>
              Amount
            </div>
          </div>
          {billableLines.map((l, i) => {
            const amount = parseFloat(l.amount) || 0;
            const xtra = parseFloat(l.extra_amount) || 0;
            // base_amount is backfilled by v58; fall back for any line
            // written before that migration ran.
            const base =
              l.base_amount != null
                ? parseFloat(l.base_amount) || 0
                : amount - xtra;
            const n = i + 1;
            return (
              <div key={l.id}>
                <div
                  className="flex px-3 py-2.5"
                  style={{
                    background: i % 2 === 0 ? "#ffffff" : "#f5f2ec",
                    WebkitPrintColorAdjust: "exact",
                    printColorAdjust: "exact",
                  }}
                >
                  <div className="flex-1 flex" style={{ gap: 9 }}>
                    <div
                      style={{
                        color: "#2563eb",
                        fontWeight: 600,
                        fontSize: 13,
                        lineHeight: 1.35,
                        minWidth: 12,
                        WebkitPrintColorAdjust: "exact",
                        printColorAdjust: "exact",
                      }}
                    >
                      {n}
                    </div>
                    <div>
                      <div className="font-semibold text-stone-800">
                        {INVOICE_TYPE_LABEL[l.service_type] || "Cleaning"}
                      </div>
                      <div className="text-stone-700">{l.label}</div>
                      {l.description && (
                        <div className="text-stone-500">{l.description}</div>
                      )}
                      {/* Show the PM what they're paying for rather than one
                         lump sum they have to take on faith. */}
                      {xtra > 0 && (
                        <div
                          className="mt-1 text-stone-600"
                          style={{ fontSize: 11 }}
                        >
                          <div>Base clean — ${base.toFixed(2)}</div>
                          <div>
                            Additional work — ${xtra.toFixed(2)}
                            {l.extra_mode === "time" &&
                              parseFloat(l.extra_minutes) > 0 && (
                                <span className="text-stone-500">
                                  {" "}
                                  ({parseFloat(l.extra_minutes)} min @ $
                                  {(parseFloat(l.extra_rate) || 0).toFixed(2)}
                                  /hr)
                                </span>
                              )}
                          </div>
                          {l.extra_note && (
                            <div className="text-stone-500 italic">
                              {l.extra_note}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right align-top" style={{ width: 110 }}>
                    ${amount.toFixed(2)}
                  </div>
                </div>
                {/* Divider that runs to the end and turns up into a numbered arrow */}
                <div
                  style={{
                    position: "relative",
                    height: 1,
                    background: "#a8a29e",
                    WebkitPrintColorAdjust: "exact",
                    printColorAdjust: "exact",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      right: 2,
                      bottom: 0,
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 5,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#2563eb",
                        lineHeight: 1,
                        transform: "translateY(-1px)",
                        WebkitPrintColorAdjust: "exact",
                        printColorAdjust: "exact",
                      }}
                    >
                      {n}
                    </span>
                    <svg
                      width="7"
                      height="15"
                      viewBox="0 0 7 15"
                      style={{ display: "block" }}
                    >
                      <path
                        d="M3.5 15 L3.5 3.5 M1 5.5 L3.5 2.5 L6 5.5"
                        stroke="#2563eb"
                        fill="none"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals — Base / Extra / Total when anything on this invoice
           carries an extra, otherwise just the total as before. */}
        <div className="flex justify-end mt-4">
          <div className="w-64 text-sm">
            {extraTotal > 0 && (
              <>
                <div className="flex justify-between py-1 border-t border-stone-300">
                  <span className="text-stone-600">Base cleaning:</span>
                  <span className="text-stone-800">
                    ${baseTotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-600">Additional work:</span>
                  <span className="text-stone-800">
                    ${extraTotal.toFixed(2)}
                  </span>
                </div>
              </>
            )}
            <div
              className={`flex justify-between py-2 ${extraTotal > 0 ? "border-t border-stone-300" : "border-t border-stone-300"}`}
            >
              <span className="text-stone-600">Total:</span>
              <span className="font-medium text-stone-900">
                ${total.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between py-2 px-2 bg-stone-100 rounded">
              <span className="text-stone-700 font-medium">
                Amount Due (USD):
              </span>
              <span className="font-bold text-stone-900">
                ${total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// INVOICE LIST (Phase 1c) — saved-invoice history for a property.
// =================================================================
function InvoiceList({ property, onOpen, onNew }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [needsInvoicing, setNeedsInvoicing] = useState(0);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("customer_id", property.id)
      .order("created_at", { ascending: false });
    setInvoices(data || []);

    // Flag jobs done over a week ago that still haven't been invoiced
    // (done targets with no invoiced_on and completed_at older than 7 days).
    try {
      const weekAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
      // Don't chase history: only flag work from this month onward.
      const mStart = (() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
      })();
      const { data: propUnits } = await supabase
        .from("units")
        .select("id")
        .eq("customer_id", property.id);
      const unitIds = (propUnits || []).map((u) => u.id);
      if (unitIds.length) {
        const { data: needRows, error } = await supabase
          .from("assignment_targets")
          .select(
            "assignment_id, unit_id, assignment:assignments!inner(deleted_at, active)",
          )
          .eq("status", "done")
          .is("invoiced_on", null)
          .in("unit_id", unitIds)
          .lt("completed_at", weekAgo)
          .gte("completed_at", mStart);
        if (!error) {
          const jobs = new Set();
          (needRows || []).forEach((t) => {
            if (t.assignment?.deleted_at || t.assignment?.active === false)
              return;
            jobs.add(t.assignment_id || t.unit_id);
          });
          setNeedsInvoicing(jobs.size);
        } else {
          setNeedsInvoicing(0);
        }
      }
    } catch {
      setNeedsInvoicing(0);
    }

    setLoading(false);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [property.id]);

  if (loading) return <Splash text="Loading invoices…" />;

  return (
    <div>
      {needsInvoicing > 0 && (
        <button
          onClick={onNew}
          className="w-full mb-3 p-3 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-3 text-left active:scale-98"
        >
          <div className="flex items-center gap-2.5">
            <Clock size={18} className="text-amber-700 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-amber-900">
                {needsInvoicing} {needsInvoicing === 1 ? "job" : "jobs"} need
                invoicing
              </div>
              <div className="text-xs text-amber-700 font-mono">
                Done over a week ago and not yet billed
              </div>
            </div>
          </div>
          <span className="text-xs font-medium text-amber-900 flex items-center gap-1 flex-shrink-0">
            Invoice now <ChevronRight size={14} />
          </span>
        </button>
      )}
      {invoices.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-stone-200 rounded-2xl">
          <div className="text-sm text-stone-500 mb-4">
            No saved invoices for {property.name} yet.
          </div>
          <button
            onClick={onNew}
            className="px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium inline-flex items-center gap-2"
          >
            <FileText size={15} /> Generate one
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((iv) => {
            const total = parseFloat(iv.total) || 0;
            return (
              <button
                key={iv.id}
                onClick={() => onOpen(iv.id)}
                className="w-full text-left p-4 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 transition-colors flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-stone-900">
                      #{iv.invoice_number || "—"}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${INVOICE_STATUS_STYLE[iv.status] || "bg-stone-100 text-stone-600"}`}
                    >
                      {iv.status}
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 font-mono mt-1">
                    {iv.title ? iv.title + " · " : ""}
                    {(iv.status === "sent" || iv.status === "paid") &&
                    iv.sent_at
                      ? `Sent ${fmtInvoiceDate(String(iv.sent_at).slice(0, 10))}`
                      : fmtInvoiceDate(iv.invoice_date)}
                  </div>
                  {iv.period_start && iv.period_end && (
                    <div className="text-[11px] text-stone-400 font-mono mt-0.5">
                      Covers {fmtInvoiceDate(iv.period_start)} –{" "}
                      {fmtInvoiceDate(iv.period_end)}
                    </div>
                  )}
                </div>
                <div className="text-right flex items-center gap-2">
                  <span className="font-mono text-sm text-stone-900">
                    ${total.toFixed(2)}
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

// =================================================================
// PROFIT / LOSS REPORT — one row per invoiced apartment. Owner-only.
//
// Reads INVOICES, not raw work blocks. Each invoice line already IS an
// apartment we billed (unit + size + service type + amount), so a line
// is the natural unit of profit: "F101, 2BR/2BA, charged $X".
//
// The pay side is matched to the SAME apartment over the SAME window
// the invoice covers (its period_start → period_end), so charge and pay
// always describe the same work. The old report compared invoices DATED
// in the range against labor WORKED in the range — two different
// windows — so invoicing at month end put the charge in one bucket and
// the pay in another, and every week looked like a loss.
//
// The date range filters by the work the invoice covers (its period),
// not by when the invoice was typed up.
//
// Any figure can be corrected inline. Corrections live in
// profit_line_reviews and NEVER touch the invoice itself — an invoice
// you already sent must not change because you fixed a number here.
// =================================================================
function ProfitReportView({
  employee,
  onSignOut,
  onOpenMessages,
  onLogoClick,
  topToggle,
}) {
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // Remember the range across refreshes. Re-picking dates and hitting Run
  // again after every reload is pure friction — the report is derived
  // data, so it can just rebuild itself.
  const SAVED_RANGE_KEY = "tidytrack_profit_range";
  const savedRange = (() => {
    try {
      return JSON.parse(localStorage.getItem(SAVED_RANGE_KEY) || "null");
    } catch {
      return null;
    }
  })();
  const [start, setStart] = useState(
    savedRange?.start || iso(new Date(Date.now() - 29 * 86400000)),
  );
  const [end, setEnd] = useState(savedRange?.end || iso(new Date()));
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState(null);
  const [totals, setTotals] = useState({ charge: 0, pay: 0 });
  const [savingId, setSavingId] = useState(null);
  const [cell, setCell] = useState(null); // { id, field } being edited
  const [cellVal, setCellVal] = useState("");
  const [openRow, setOpenRow] = useState(null); // row showing its item breakdown
  const [unbilled, setUnbilled] = useState(0);
  const [unbilledDetail, setUnbilledDetail] = useState([]); // per-property uninvoiced labor
  const [invoiceHint, setInvoiceHint] = useState([]); // what ranges DO have invoices
  const [runaway, setRunaway] = useState({ count: 0, pay: 0, hours: 0 }); // forgotten clock-outs

  const num = (v) => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };

  const run = async () => {
    if (!start || !end) return;
    try {
      localStorage.setItem(SAVED_RANGE_KEY, JSON.stringify({ start, end }));
    } catch {
      /* private mode */
    }
    setLoading(true);
    setCell(null);
    try {
      // 1. Invoices whose covered period overlaps the range. Older
      //    invoices predate period_start/period_end, so fall back to
      //    invoice_date for those.
      const { data: invs, error: invErr } = await supabase
        .from("invoices")
        .select(
          "id, customer_id, invoice_date, period_start, period_end, invoice_number, status, customer:customers(id, name)",
        )
        .or(
          `and(period_start.lte.${end},period_end.gte.${start}),and(period_start.is.null,invoice_date.gte.${start},invoice_date.lte.${end})`,
        );
      if (invErr) throw invErr;
      const invoices = invs || [];

      // Labor fetch, reused below. Always runs, even with zero invoices —
      // "no invoices cover this range" and "nobody worked this range" are
      // very different answers and the screen has to tell them apart.
      const fetchBlocks = async (winStart, winEnd) => {
        let out = [];
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("work_blocks")
            .select(
              "id, unit_id, party_id, start_time, end_time, unit:units(label), shift:shifts!inner(customer_id, is_preview, employee:employees(id, name, pay_rate_hourly), customer:customers(id, name))",
            )
            .gte("start_time", winStart + "T00:00:00")
            .lte("start_time", winEnd + "T23:59:59")
            .not("end_time", "is", null)
            .range(from, from + PAGE - 1);
          if (error || !data) break;
          out = out.concat(data);
          if (data.length < PAGE) break;
          if (from > 100000) break;
        }
        return out.filter((b) => b.shift && !b.shift.is_preview && b.unit_id);
      };
      const blockPay = (b) => {
        const hrs = (new Date(b.end_time) - new Date(b.start_time)) / 3600000;
        if (hrs <= 0) return { hrs: 0, pay: 0 };
        return { hrs, pay: hrs * num(b.shift.employee?.pay_rate_hourly) };
      };
      // Split off the forgotten clock-outs before any money is added up.
      // A block longer than MAX_BLOCK_HOURS isn't a long clean, it's a
      // block nobody closed — counting it as labor turns a normal week
      // into a fake five-figure loss.
      const runawayOf = (list) =>
        list.filter((b) => blockPay(b).hrs > MAX_BLOCK_HOURS);
      const sensibleOf = (list) =>
        list.filter((b) => {
          const h = blockPay(b).hrs;
          return h > 0 && h <= MAX_BLOCK_HOURS;
        });

      if (invoices.length === 0) {
        // Nothing bills this range. Show the labor that's sitting
        // uninvoiced, and tell them which ranges DO have invoices, so the
        // fix is "pick the right dates" not "guess".
        const loose = await fetchBlocks(start, end);
        const runaways = runawayOf(loose);
        setRunaway({
          count: runaways.length,
          pay: runaways.reduce((s, b) => s + blockPay(b).pay, 0),
          hours: runaways.reduce((s, b) => s + blockPay(b).hrs, 0),
        });
        const byProp = {};
        let sum = 0;
        sensibleOf(loose).forEach((b) => {
          const { hrs, pay } = blockPay(b);
          if (hrs <= 0) return;
          sum += pay;
          const cid = b.shift.customer_id || "none";
          byProp[cid] = byProp[cid] || {
            name: b.shift.customer?.name || "No property",
            hours: 0,
            pay: 0,
          };
          byProp[cid].hours += hrs;
          byProp[cid].pay += pay;
        });
        const { data: recent } = await supabase
          .from("invoices")
          .select(
            "invoice_number, invoice_date, period_start, period_end, customer:customers(name)",
          )
          .order("invoice_date", { ascending: false })
          .limit(5);
        setUnbilledDetail(Object.values(byProp).sort((a, b) => b.pay - a.pay));
        setInvoiceHint(recent || []);
        setGroups([]);
        setTotals({ charge: 0, pay: 0 });
        setUnbilled(sum);
        setLoading(false);
        return;
      }
      setInvoiceHint([]);
      setUnbilledDetail([]);

      // 2. Their lines. Paginated — a busy month easily clears 1000 lines.
      const invIds = invoices.map((i) => i.id);
      let lines = [];
      for (let i = 0; i < invIds.length; i += 50) {
        const chunk = invIds.slice(i, i + 50);
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("invoice_lines")
            .select(
              "id, invoice_id, unit_id, party_id, label, service_type, description, amount, base_amount, extra_amount, extra_note, subsections",
            )
            .in("invoice_id", chunk)
            .range(from, from + PAGE - 1);
          if (error || !data) break;
          lines = lines.concat(data);
          if (data.length < PAGE) break;
          if (from > 100000) break;
        }
      }

      // 2b. Real unit + bedroom labels. invoice_lines.label is cosmetic —
      //     the draft builder strips the building prefix off it (B2-233
      //     becomes "233"), which is fine on a bill to one property but
      //     useless in a report spanning several. Join to units/parties
      //     for the real thing.
      const lineUnitIds = [
        ...new Set(lines.map((l) => l.unit_id).filter(Boolean)),
      ];
      const linePartyIds = [
        ...new Set(lines.map((l) => l.party_id).filter(Boolean)),
      ];
      const unitLabelById = {};
      for (let i = 0; i < lineUnitIds.length; i += 200) {
        const { data } = await supabase
          .from("units")
          .select("id, label")
          .in("id", lineUnitIds.slice(i, i + 200));
        (data || []).forEach((u) => {
          unitLabelById[u.id] = u.label;
        });
      }
      const partyLabelById = {};
      for (let i = 0; i < linePartyIds.length; i += 200) {
        const { data } = await supabase
          .from("parties")
          .select("id, label")
          .in("id", linePartyIds.slice(i, i + 200));
        (data || []).forEach((pt) => {
          partyLabelById[pt.id] = pt.label;
        });
      }

      // 3. Corrections. No PostgREST embed — plain read, joined in JS.
      let reviews = [];
      const lineIds = lines.map((l) => l.id);
      for (let i = 0; i < lineIds.length; i += 200) {
        const { data } = await supabase
          .from("profit_line_reviews")
          .select(
            "invoice_line_id, charged_override, paid_override, hours_override, note",
          )
          .in("invoice_line_id", lineIds.slice(i, i + 200));
        reviews = reviews.concat(data || []);
      }
      const reviewByLine = Object.fromEntries(
        reviews.map((r) => [r.invoice_line_id, r]),
      );

      // 4. Labor. One window wide enough to cover every invoice period
      //    touched, then matched per line to that invoice's own period.
      const winStart = invoices.reduce((m, i) => {
        const s = i.period_start || i.invoice_date || start;
        return s < m ? s : m;
      }, start);
      const winEnd = invoices.reduce((m, i) => {
        const e = i.period_end || i.invoice_date || end;
        return e > m ? e : m;
      }, end);
      const allBlocks = await fetchBlocks(winStart, winEnd);
      {
        // Same guard on the invoiced path. Restricted to the report's own
        // range so the count matches what's on screen.
        const inRange = allBlocks.filter((b) => {
          const d = String(b.start_time).slice(0, 10);
          return d >= start && d <= end;
        });
        const runaways = runawayOf(inRange);
        setRunaway({
          count: runaways.length,
          pay: runaways.reduce((s, b) => s + blockPay(b).pay, 0),
          hours: runaways.reduce((s, b) => s + blockPay(b).hrs, 0),
        });
      }
      const liveBlocks = sensibleOf(allBlocks);

      // 5. Build a row per invoice line.
      const invById = Object.fromEntries(invoices.map((i) => [i.id, i]));
      const usedBlockIds = new Set();
      const rows = lines.map((l) => {
        const inv = invById[l.invoice_id];
        const pStart = inv?.period_start || inv?.invoice_date || start;
        const pEnd = inv?.period_end || inv?.invoice_date || end;
        // Match blocks at the SAME apartment inside the invoice's own
        // period. Match on party too when the line names one, so two
        // bedrooms billed separately don't both absorb the same labor.
        const mine = liveBlocks.filter((b) => {
          if (b.unit_id !== l.unit_id) return false;
          if (l.party_id && b.party_id && b.party_id !== l.party_id)
            return false;
          const d = String(b.start_time).slice(0, 10);
          return d >= pStart && d <= pEnd;
        });
        const byPerson = {};
        // The dates the work actually happened. The invoice PERIOD is a
        // billing window, not a clean date — showing only the period made
        // it impossible to tell when this apartment was done.
        const cleanedDays = [
          ...new Set(mine.map((b) => String(b.start_time).slice(0, 10))),
        ].sort();
        let pay = 0,
          hours = 0;
        mine.forEach((b) => {
          usedBlockIds.add(b.id);
          const hrs = (new Date(b.end_time) - new Date(b.start_time)) / 3600000;
          if (hrs <= 0) return;
          const emp = b.shift.employee;
          if (!emp) return;
          const rate = num(emp.pay_rate_hourly);
          hours += hrs;
          pay += hrs * rate;
          byPerson[emp.id] = byPerson[emp.id] || {
            name: emp.name,
            hours: 0,
            pay: 0,
          };
          byPerson[emp.id].hours += hrs;
          byPerson[emp.id].pay += hrs * rate;
        });
        const rev = reviewByLine[l.id];
        const baseCharge = num(l.amount);
        const charge =
          rev && rev.charged_override != null
            ? num(rev.charged_override)
            : baseCharge;
        const paid =
          rev && rev.paid_override != null ? num(rev.paid_override) : pay;
        const hoursEff =
          rev && rev.hours_override != null ? num(rev.hours_override) : hours;
        return {
          id: l.id,
          propertyId: inv?.customer_id,
          propertyName: inv?.customer?.name || "Property",
          invoiceNumber: inv?.invoice_number,
          invoiceStatus: inv?.status,
          periodLabel:
            inv?.period_start && inv?.period_end
              ? `${inv.period_start} → ${inv.period_end}`
              : fmtInvoiceDate(inv?.invoice_date),
          // Prefer the real unit/bedroom labels; fall back to whatever the
          // invoice printed if this line isn't tied to a unit.
          label:
            unitPartyLabel(
              unitLabelById[l.unit_id],
              partyLabelById[l.party_id],
            ) ||
            l.label ||
            "Line",
          invoiceLabel: l.label || "",
          serviceType: l.service_type,
          // The saved item breakdown, so the grid can drop down and show
          // exactly what made up the charge — same detail as the invoice.
          subsections: Array.isArray(l.subsections) ? l.subsections : [],
          description: l.description || "",
          extraAmount: num(l.extra_amount),
          extraNote: l.extra_note || "",
          cleaners: Object.values(byPerson).sort((a, b) => b.hours - a.hours),
          cleanedDays,
          baseHours: hours,
          hours: hoursEff,
          baseCharge,
          basePay: pay,
          charge,
          paid,
          editedCharge: !!rev && rev.charged_override != null,
          editedPaid: !!rev && rev.paid_override != null,
          editedHours: !!rev && rev.hours_override != null,
          edited:
            !!rev &&
            (rev.charged_override != null ||
              rev.paid_override != null ||
              rev.hours_override != null),
          note: rev?.note || "",
        };
      });

      // Cleaned-but-not-invoiced apartments. Instead of hiding this labor in
      // a single "unbilled" number, each apartment becomes its OWN row — pay
      // from the labor, charge from a manual charge you set here (blank until
      // you do). This is the "populate by work done" view: work with no
      // invoice still shows, per apartment, on the days it was cleaned.
      const unclaimedBlocks = liveBlocks
        .filter((b) => !usedBlockIds.has(b.id))
        .filter((b) => {
          const d = String(b.start_time).slice(0, 10);
          return d >= start && d <= end;
        });
      const aptGroups = {};
      unclaimedBlocks.forEach((b) => {
        const hrs = (new Date(b.end_time) - new Date(b.start_time)) / 3600000;
        if (hrs <= 0) return;
        const emp = b.shift.employee;
        if (!emp) return;
        const key = `${b.shift.customer_id}:${b.unit_id}:${b.party_id || ""}`;
        if (!aptGroups[key])
          aptGroups[key] = {
            customerId: b.shift.customer_id,
            customerName: b.shift.customer?.name || "Property",
            unitId: b.unit_id,
            partyId: b.party_id || null,
            unitLabelFallback: b.unit?.label || "",
            pay: 0,
            hours: 0,
            byPerson: {},
            days: new Set(),
          };
        const g = aptGroups[key];
        const rate = num(emp.pay_rate_hourly);
        g.pay += hrs * rate;
        g.hours += hrs;
        g.days.add(String(b.start_time).slice(0, 10));
        g.byPerson[emp.id] = g.byPerson[emp.id] || {
          name: emp.name,
          hours: 0,
          pay: 0,
        };
        g.byPerson[emp.id].hours += hrs;
        g.byPerson[emp.id].pay += hrs * rate;
      });
      // Manual charges + real labels for these apartments.
      const uUnitIds = [
        ...new Set(
          Object.values(aptGroups)
            .map((g) => g.unitId)
            .filter(Boolean),
        ),
      ];
      const uPartyIds = [
        ...new Set(
          Object.values(aptGroups)
            .map((g) => g.partyId)
            .filter(Boolean),
        ),
      ];
      const manualByApt = {};
      for (let i = 0; i < uUnitIds.length; i += 200) {
        const { data } = await supabase
          .from("manual_charges")
          .select("id, unit_id, party_id, amount")
          .in("unit_id", uUnitIds.slice(i, i + 200));
        (data || []).forEach((m) => {
          manualByApt[`${m.unit_id}:${m.party_id || ""}`] = m;
        });
      }
      for (let i = 0; i < uUnitIds.length; i += 200) {
        const { data } = await supabase
          .from("units")
          .select("id, label")
          .in("id", uUnitIds.slice(i, i + 200));
        (data || []).forEach((u) => {
          if (!unitLabelById[u.id]) unitLabelById[u.id] = u.label;
        });
      }
      for (let i = 0; i < uPartyIds.length; i += 200) {
        const { data } = await supabase
          .from("parties")
          .select("id, label")
          .in("id", uPartyIds.slice(i, i + 200));
        (data || []).forEach((pt) => {
          if (!partyLabelById[pt.id]) partyLabelById[pt.id] = pt.label;
        });
      }
      const manualRows = Object.values(aptGroups).map((g) => {
        const mc = manualByApt[`${g.unitId}:${g.partyId || ""}`];
        const charge = mc ? num(mc.amount) : 0;
        return {
          id: `manual:${g.unitId}:${g.partyId || "none"}`,
          isManual: true,
          manualId: mc?.id || null,
          manualUnitId: g.unitId,
          manualPartyId: g.partyId,
          manualCustomerId: g.customerId,
          propertyId: g.customerId,
          propertyName: g.customerName,
          invoiceNumber: null,
          invoiceStatus: "uninvoiced",
          periodLabel: "Not invoiced yet",
          label:
            unitPartyLabel(
              unitLabelById[g.unitId],
              partyLabelById[g.partyId],
            ) ||
            g.unitLabelFallback ||
            "Apartment",
          invoiceLabel: "",
          serviceType: null,
          subsections: [],
          description: "",
          extraAmount: 0,
          extraNote: "",
          cleaners: Object.values(g.byPerson).sort((a, b) => b.hours - a.hours),
          cleanedDays: [...g.days].sort(),
          baseHours: g.hours,
          hours: g.hours,
          baseCharge: charge,
          basePay: g.pay,
          charge,
          paid: g.pay,
          editedCharge: false,
          editedPaid: false,
          editedHours: false,
          edited: false,
          note: "",
        };
      });
      // Uninvoiced work is shown as rows now, not a hidden lump.
      setUnbilled(0);

      const allRows = [...rows, ...manualRows];
      const byProp = {};
      allRows.forEach((r) => {
        byProp[r.propertyId] = byProp[r.propertyId] || {
          id: r.propertyId,
          name: r.propertyName,
          rows: [],
          charge: 0,
          pay: 0,
        };
        byProp[r.propertyId].rows.push(r);
        byProp[r.propertyId].charge += r.charge;
        byProp[r.propertyId].pay += r.paid;
      });
      const out = Object.values(byProp);
      out.forEach((g) =>
        g.rows.sort((a, b) => b.charge - b.paid - (a.charge - a.paid)),
      );
      out.sort((a, b) => b.charge - b.pay - (a.charge - a.pay));
      setGroups(out);
      setTotals({
        charge: allRows.reduce((s, r) => s + r.charge, 0),
        pay: allRows.reduce((s, r) => s + r.paid, 0),
      });
    } catch (e) {
      alert("Could not run the report: " + (e?.message || e));
      setGroups([]);
    }
    setLoading(false);
  };

  // Rebuild on load if we already know the range, so a refresh lands you
  // back on the report instead of a blank form.
  useEffect(() => {
    if (savedRange?.start && savedRange?.end) run();
    /* eslint-disable-next-line */
  }, []);

  // Cell editing. One cell at a time, saved on Enter or blur — the point
  // of a grid is that you can tab through numbers without opening a panel
  // for each one.
  const beginEdit = (r, field) => {
    setCell({ id: r.id, field });
    const cur =
      field === "charge" ? r.charge : field === "paid" ? r.paid : r.hours;
    setCellVal(String(Number(cur).toFixed(field === "hours" ? 2 : 2)));
  };

  const commitCell = async (r, field) => {
    const raw = cellVal.trim();
    setCell(null);
    // Uninvoiced rows: only the charge is editable, saved to manual_charges
    // (one per apartment). Pay comes from labor and isn't overridable here.
    // Insert vs update by the manual_charge id we loaded, so we never depend
    // on upsert conflict-targets across a null party_id.
    if (r.isManual) {
      if (field !== "charge") return;
      const amt = raw === "" ? 0 : num(raw);
      setSavingId(r.id);
      let error;
      if (r.manualId) {
        ({ error } = await supabase
          .from("manual_charges")
          .update({
            amount: amt,
            updated_by: employee?.id || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", r.manualId));
      } else {
        ({ error } = await supabase.from("manual_charges").insert({
          unit_id: r.manualUnitId,
          party_id: r.manualPartyId,
          customer_id: r.manualCustomerId,
          amount: amt,
          updated_by: employee?.id || null,
        }));
      }
      setSavingId(null);
      if (error) {
        alert("Could not save that charge: " + error.message);
        return;
      }
      run();
      return;
    }
    const base =
      field === "charge"
        ? r.baseCharge
        : field === "paid"
          ? r.basePay
          : r.baseHours;
    // Blank, or back to the original figure, clears the override rather
    // than storing a redundant one.
    const next = raw === "" ? null : num(raw);
    const isSame = next != null && Math.abs(next - base) < 0.005;
    const existing = {
      charge: r.editedCharge ? r.charge : null,
      paid: r.editedPaid ? r.paid : null,
      hours: r.editedHours ? r.hours : null,
    };
    const patch = {
      invoice_line_id: r.id,
      charged_override:
        field === "charge"
          ? next == null || isSame
            ? null
            : next
          : existing.charge,
      paid_override:
        field === "paid"
          ? next == null || isSame
            ? null
            : next
          : existing.paid,
      hours_override:
        field === "hours"
          ? next == null || isSame
            ? null
            : next
          : existing.hours,
      note: r.note || null,
      reviewed_by: employee?.id || null,
      reviewed_at: new Date().toISOString(),
    };
    const allClear =
      patch.charged_override == null &&
      patch.paid_override == null &&
      patch.hours_override == null &&
      !patch.note;
    setSavingId(r.id);
    const { error } = allClear
      ? await supabase
          .from("profit_line_reviews")
          .delete()
          .eq("invoice_line_id", r.id)
      : await supabase
          .from("profit_line_reviews")
          .upsert(patch, { onConflict: "invoice_line_id" });
    setSavingId(null);
    if (error) {
      alert("Could not save that cell: " + error.message);
      return;
    }
    run();
  };

  const saveNote = async (r, text) => {
    setSavingId(r.id);
    const { error } = await supabase.from("profit_line_reviews").upsert(
      {
        invoice_line_id: r.id,
        charged_override: r.editedCharge ? r.charge : null,
        paid_override: r.editedPaid ? r.paid : null,
        hours_override: r.editedHours ? r.hours : null,
        note: text || null,
        reviewed_by: employee?.id || null,
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: "invoice_line_id" },
    );
    setSavingId(null);
    if (error) {
      alert("Could not save that note: " + error.message);
      return;
    }
    run();
  };

  const resetRow = async (r) => {
    setSavingId(r.id);
    const { error } = await supabase
      .from("profit_line_reviews")
      .delete()
      .eq("invoice_line_id", r.id);
    setSavingId(null);
    if (error) {
      alert("Could not reset that row: " + error.message);
      return;
    }
    run();
  };

  // Every row, flat — a grid, not cards per property.
  const allRows = (groups || []).flatMap((g) => g.rows);

  // Copy as TSV. Pastes straight into Excel or Sheets as real columns.
  const copyForExcel = async () => {
    const head = [
      "Property",
      "Apartment",
      "Type",
      "Cleaned",
      "Cleaners",
      "Hours",
      "Paid",
      "Charged",
      "Profit",
      "Note",
    ];
    const body = allRows.map((r) => [
      r.propertyName,
      r.label,
      r.serviceType || "",
      r.cleanedDays.join(" "),
      r.cleaners.map((c) => c.name).join(", "),
      r.hours.toFixed(2),
      r.paid.toFixed(2),
      r.charge.toFixed(2),
      (r.charge - r.paid).toFixed(2),
      (r.note || "").replace(/\t|\n/g, " "),
    ]);
    const tsv = [head, ...body].map((row) => row.join("\t")).join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      alert(
        "Copied " +
          allRows.length +
          " rows. Paste straight into Excel or Sheets.",
      );
    } catch {
      alert(
        "Could not copy automatically — your browser blocked clipboard access.",
      );
    }
  };

  const profitTotal = totals.charge - totals.pay;

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <Header
        name={employee.name}
        onSignOut={onSignOut}
        role={employee.role}
        employee={employee}
        onOpenMessages={onOpenMessages}
        onLogoClick={onLogoClick}
      />
      {topToggle}
      {/* The controls stay narrow — a full-width date picker looks silly.
         The grid gets the whole screen, because that's what a grid is for. */}
      <div className="px-5 pt-6 space-y-5 max-w-7xl mx-auto">
        <div className="max-w-2xl space-y-5">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              Report
            </div>
            <h1 className="font-serif text-3xl text-stone-900">
              Profit / loss
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              Every invoiced apartment: what you charged, who cleaned it, what
              they cost.
            </p>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2">
              Date range
            </div>
            <DateRangePicker
              start={start}
              end={end}
              onChange={(s, e) => {
                setStart(s);
                setEnd(e);
              }}
            />
            <p className="text-[11px] text-stone-400 mt-1.5">
              Matches the work an invoice covers, not the date it was written.
            </p>
          </div>

          <button
            onClick={run}
            disabled={loading || !start || !end}
            className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium disabled:opacity-50"
          >
            {loading ? "Crunching…" : "Run report"}
          </button>
        </div>

        {groups && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white border border-stone-200 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] uppercase text-stone-400 font-mono">
                  Charged
                </div>
                <div className="text-lg font-mono text-stone-900">
                  {fmtMoney(totals.charge)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-stone-400 font-mono">
                  Paid
                </div>
                <div className="text-lg font-mono text-stone-900">
                  {fmtMoney(totals.pay)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-stone-400 font-mono">
                  Profit
                </div>
                <div
                  className={`text-lg font-mono ${profitTotal >= 0 ? "text-emerald-700" : "text-red-600"}`}
                >
                  {fmtMoney(profitTotal)}
                </div>
              </div>
            </div>

            {runaway.count > 0 && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-[11px] text-red-900">
                <div className="font-medium">
                  {runaway.count} work{" "}
                  {runaway.count === 1 ? "block" : "blocks"} in this range{" "}
                  {runaway.count === 1 ? "is" : "are"} longer than{" "}
                  {MAX_BLOCK_HOURS}h — {runaway.hours.toFixed(0)}h total,{" "}
                  {fmtMoney(runaway.pay)} of "labor".
                </div>
                <div className="mt-1 text-red-800/80">
                  Almost certainly someone forgot to clock out. Left in, they'd
                  swamp every number on this page, so they're excluded above.
                  Fix them in the timesheet and re-run.
                </div>
              </div>
            )}

            {unbilled > 0.005 && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-mono">
                {fmtMoney(unbilled)} of labor in this range isn't on any invoice
                yet — not counted above.
              </div>
            )}

            {groups.length === 0 ? (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-white border border-stone-200 text-center">
                  <div className="text-sm text-stone-600">
                    No invoices cover work in this range.
                  </div>
                  <div className="text-xs text-stone-400 mt-1">
                    {unbilled > 0.005
                      ? "The cleaning happened — it just hasn\u2019t been billed yet, so there\u2019s nothing to compare it against."
                      : "No finished cleanings in this range either."}
                  </div>
                </div>
                {unbilledDetail.length > 0 && (
                  <div className="p-4 rounded-2xl bg-white border border-stone-200">
                    <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2">
                      Uninvoiced labor in this range
                    </div>
                    {unbilledDetail.map((u, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 py-1 text-xs font-mono"
                      >
                        <span className="text-stone-700 truncate">
                          {u.name}
                        </span>
                        <span className="text-stone-500 flex-shrink-0">
                          {u.hours.toFixed(1)}h · {fmtMoney(u.pay)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {invoiceHint.length > 0 && (
                  <div className="p-4 rounded-2xl bg-white border border-stone-200">
                    <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2">
                      Your most recent invoices cover
                    </div>
                    {invoiceHint.map((h, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const s2 = h.period_start || h.invoice_date;
                          const e2 = h.period_end || h.invoice_date;
                          if (s2 && e2) {
                            setStart(s2);
                            setEnd(e2);
                          }
                        }}
                        className="w-full flex items-center justify-between gap-2 py-1.5 text-xs font-mono hover:bg-stone-50 rounded-lg px-1 text-left"
                      >
                        <span className="text-stone-700 truncate">
                          {h.invoice_number ? `#${h.invoice_number} · ` : ""}
                          {h.customer?.name || "Property"}
                        </span>
                        <span className="text-amber-700 flex-shrink-0">
                          {h.period_start && h.period_end
                            ? `${h.period_start} \u2192 ${h.period_end}`
                            : fmtInvoiceDate(h.invoice_date)}
                        </span>
                      </button>
                    ))}
                    <p className="text-[10px] text-stone-400 mt-2">
                      Tap one to jump the date range to it.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* THE GRID. Every invoiced apartment as a row. Hours, Paid and
                 Charged are click-to-edit; Profit is always computed so it
                 can never disagree with the two columns beside it. */
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs uppercase tracking-wider text-stone-500 font-mono">
                    {allRows.length}{" "}
                    {allRows.length === 1 ? "apartment" : "apartments"}
                  </span>
                  <button
                    onClick={copyForExcel}
                    className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-white border border-stone-300 text-stone-700 inline-flex items-center gap-1"
                  >
                    <Copy size={11} /> Copy for Excel
                  </button>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white overflow-x-auto">
                  <table className="w-full text-xs" style={{ minWidth: 860 }}>
                    <thead>
                      <tr className="bg-stone-100 text-stone-500 font-mono text-[10px] uppercase tracking-wider">
                        <th className="text-left px-3 py-2 font-medium">
                          Apartment
                        </th>
                        <th className="text-left px-3 py-2 font-medium">
                          Cleaned
                        </th>
                        <th className="text-left px-3 py-2 font-medium">
                          Cleaner(s)
                        </th>
                        <th className="text-right px-3 py-2 font-medium">
                          Hours
                        </th>
                        <th className="text-right px-3 py-2 font-medium">
                          Paid
                        </th>
                        <th className="text-right px-3 py-2 font-medium">
                          Charged
                        </th>
                        <th className="text-right px-3 py-2 font-medium">
                          Profit
                        </th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {allRows.map((r, idx) => {
                        const p = r.charge - r.paid;
                        const prev = idx > 0 ? allRows[idx - 1] : null;
                        const newProp =
                          !prev || prev.propertyId !== r.propertyId;
                        const editCell = (field, val, edited) =>
                          cell && cell.id === r.id && cell.field === field ? (
                            <input
                              autoFocus
                              type="number"
                              step="0.01"
                              value={cellVal}
                              onChange={(e) => setCellVal(e.target.value)}
                              onBlur={() => commitCell(r, field)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitCell(r, field);
                                if (e.key === "Escape") setCell(null);
                              }}
                              className="w-20 px-1.5 py-1 rounded border border-indigo-400 text-right font-mono text-xs"
                            />
                          ) : (
                            <button
                              onClick={() => beginEdit(r, field)}
                              disabled={savingId === r.id}
                              title="Click to change"
                              className={`w-full text-right px-1.5 py-1 rounded font-mono hover:bg-indigo-50 hover:ring-1 hover:ring-indigo-200 ${edited ? "bg-indigo-50 text-indigo-800 font-medium" : "text-stone-700"}`}
                            >
                              {val}
                            </button>
                          );
                        return (
                          <React.Fragment key={r.id}>
                            {newProp && (
                              <tr>
                                <td
                                  colSpan={8}
                                  className="px-3 pt-3 pb-1 bg-stone-50 border-t border-stone-200"
                                >
                                  <span className="font-serif text-sm text-stone-900">
                                    {r.propertyName}
                                  </span>
                                  {r.invoiceNumber && (
                                    <span className="text-[10px] font-mono text-stone-400 ml-2">
                                      Inv #{r.invoiceNumber}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )}
                            <tr className="border-t border-stone-100 align-top">
                              <td className="px-3 py-2">
                                <button
                                  onClick={() =>
                                    setOpenRow(openRow === r.id ? null : r.id)
                                  }
                                  className="text-left hover:underline"
                                  title="Show what made up this charge"
                                >
                                  <div className="font-mono text-stone-900 flex items-center gap-1">
                                    <ChevronRight
                                      size={11}
                                      className={`text-stone-400 transition-transform ${openRow === r.id ? "rotate-90" : ""}`}
                                    />
                                    {r.label}
                                    {r.isManual && (
                                      <span className="text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 ml-1">
                                        Not invoiced
                                      </span>
                                    )}
                                  </div>
                                </button>
                                {r.serviceType && (
                                  <div className="text-[10px] text-stone-400 ml-4">
                                    {assignmentTypeLabel
                                      ? assignmentTypeLabel(r.serviceType)
                                      : r.serviceType}
                                  </div>
                                )}
                                {r.note && (
                                  <div className="text-[10px] text-stone-500 italic mt-0.5 ml-4">
                                    {r.note}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono text-stone-600 whitespace-nowrap">
                                {r.cleanedDays.length === 0 ? (
                                  <span className="text-stone-400">—</span>
                                ) : r.cleanedDays.length === 1 ? (
                                  fmtDueDate(r.cleanedDays[0])
                                ) : (
                                  `${fmtDueDate(r.cleanedDays[0])} +${r.cleanedDays.length - 1}`
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {r.cleaners.length === 0 ? (
                                  <span className="text-stone-400">
                                    No clocked clean
                                  </span>
                                ) : (
                                  r.cleaners.map((c) => (
                                    <div
                                      key={c.name}
                                      className="font-mono text-stone-700 whitespace-nowrap"
                                    >
                                      {c.name}
                                    </div>
                                  ))
                                )}
                              </td>
                              <td className="px-1 py-2">
                                {r.isManual ? (
                                  <span className="font-mono text-stone-500 block text-right pr-1">
                                    {r.hours.toFixed(2)}
                                  </span>
                                ) : (
                                  editCell(
                                    "hours",
                                    r.hours.toFixed(2),
                                    r.editedHours,
                                  )
                                )}
                              </td>
                              <td className="px-1 py-2">
                                {r.isManual ? (
                                  <span className="font-mono text-stone-500 block text-right pr-1">
                                    {r.paid.toFixed(2)}
                                  </span>
                                ) : (
                                  editCell(
                                    "paid",
                                    r.paid.toFixed(2),
                                    r.editedPaid,
                                  )
                                )}
                              </td>
                              <td className="px-1 py-2">
                                {editCell(
                                  "charge",
                                  r.charge.toFixed(2),
                                  r.editedCharge,
                                )}
                              </td>
                              <td
                                className={`px-3 py-2 text-right font-mono font-medium whitespace-nowrap ${p >= 0 ? "text-emerald-700" : "text-red-600"}`}
                              >
                                {p >= 0 ? "+" : ""}
                                {p.toFixed(2)}
                              </td>
                              <td className="px-2 py-2 text-right">
                                {r.edited && (
                                  <button
                                    onClick={() => resetRow(r)}
                                    disabled={savingId === r.id}
                                    title="Undo my changes to this row"
                                    className="text-[10px] font-mono text-stone-400 hover:text-red-600"
                                  >
                                    reset
                                  </button>
                                )}
                              </td>
                            </tr>
                            {openRow === r.id && (
                              <tr className="bg-stone-50">
                                <td colSpan={8} className="px-6 py-3">
                                  {/* Read-only — this is what the invoice
                                     billed. Change it on the invoice, not here. */}
                                  <div className="text-[10px] uppercase tracking-wider font-mono text-stone-400 mb-2">
                                    What made up the {fmtMoney(r.baseCharge)}{" "}
                                    charge
                                  </div>
                                  {r.subsections.length === 0 ? (
                                    <div className="text-[11px] font-mono text-stone-400">
                                      No item breakdown saved on this line.
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-1">
                                      {r.subsections.map((sub, si) => (
                                        <div
                                          key={si}
                                          className="flex items-center justify-between gap-2 text-[11px] font-mono border-b border-stone-200 pb-0.5"
                                        >
                                          <span
                                            className="text-stone-700 truncate"
                                            title={sub.label}
                                          >
                                            {sub.label}
                                          </span>
                                          <span className="text-stone-500 flex-shrink-0">
                                            {sub.mode === "time" && sub.minutes
                                              ? `${sub.minutes}m · ${fmtMoney(sub.amount)}`
                                              : fmtMoney(sub.amount)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {r.extraAmount > 0 && (
                                    <div className="mt-2 text-[11px] font-mono text-amber-700">
                                      + Extra charge {fmtMoney(r.extraAmount)}
                                      {r.extraNote ? ` — ${r.extraNote}` : ""}
                                    </div>
                                  )}
                                  {r.description && (
                                    <div className="mt-2 text-[11px] text-stone-500 italic">
                                      Prints as: “{r.description}”
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      <tr className="border-t-2 border-stone-300 bg-stone-50 font-medium">
                        <td
                          className="px-3 py-2 font-serif text-stone-900"
                          colSpan={3}
                        >
                          Total
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-stone-700">
                          {allRows
                            .reduce((s2, r) => s2 + r.hours, 0)
                            .toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-stone-900">
                          {totals.pay.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-stone-900">
                          {totals.charge.toFixed(2)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono font-bold ${profitTotal >= 0 ? "text-emerald-700" : "text-red-600"}`}
                        >
                          {profitTotal >= 0 ? "+" : ""}
                          {profitTotal.toFixed(2)}
                        </td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-stone-400 mt-2">
                  Click any Hours, Paid or Charged cell to change it. Enter
                  saves, Esc cancels, blank restores the original. Edits only
                  change this report — the invoice itself is untouched.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =================================================================
// INVOICE PAYMENTS REPORT — every invoice in one place, with paid/unpaid,
// paid date, amount actually collected (can differ from the total), and a
// note (e.g. "negotiated rate"). Read the money at a glance, mark it in.
// =================================================================
function InvoicePaymentsReport({
  employee,
  onSignOut,
  onOpenMessages,
  onLogoClick,
  topToggle,
}) {
  const [invoices, setInvoices] = useState(null);
  const [statusFilter, setStatusFilter] = useState("unpaid"); // all | unpaid | paid
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [viewId, setViewId] = useState(null); // invoice being viewed full-screen
  const [glanceId, setGlanceId] = useState(null); // invoice in the quick-glance popup
  const [draft, setDraft] = useState({
    paid_at: "",
    amount_paid: "",
    payment_note: "",
  });

  const load = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "id, invoice_number, customer_id, created_at, total, status, paid_at, amount_paid, payment_note, customer:customers(name)",
      )
      .order("created_at", { ascending: false });
    if (error) {
      setInvoices([]);
      return;
    }
    setInvoices(data || []);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, []);

  const list = (invoices || []).filter((inv) => {
    if (statusFilter === "unpaid") return inv.status !== "paid";
    if (statusFilter === "paid") return inv.status === "paid";
    return true;
  });
  const outstanding = (invoices || [])
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + (Number(i.total) || 0), 0);
  const collected = (invoices || [])
    .filter((i) => i.status === "paid")
    .reduce(
      (s, i) =>
        s +
        (i.amount_paid != null ? Number(i.amount_paid) : Number(i.total) || 0),
      0,
    );

  const openEdit = (inv) => {
    setEditing(inv.id);
    setDraft({
      paid_at: inv.paid_at
        ? String(inv.paid_at).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      amount_paid:
        inv.amount_paid != null
          ? String(inv.amount_paid)
          : inv.total != null
            ? String(inv.total)
            : "",
      payment_note: inv.payment_note || "",
    });
  };

  const saveMarkPaid = async (inv) => {
    setBusyId(inv.id);
    const { error } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: draft.paid_at
          ? new Date(draft.paid_at + "T12:00:00").toISOString()
          : new Date().toISOString(),
        amount_paid:
          draft.amount_paid === "" ? null : Number(draft.amount_paid),
        payment_note: draft.payment_note || null,
      })
      .eq("id", inv.id);
    setBusyId(null);
    setEditing(null);
    if (error) {
      alert(
        "Could not save: " +
          error.message +
          (/amount_paid|payment_note/.test(error.message || "")
            ? "\n\nRun v51_invoice_payments.sql in Supabase first."
            : ""),
      );
      return;
    }
    load();
  };

  const markPaidQuick = async (inv) => {
    if (
      !confirm(
        `Mark invoice #${inv.invoice_number || "—"} for ${inv.customer?.name || "this property"} (${fmtMoney(inv.total || 0)}) as PAID?\n\nRecords it as paid today for the full amount. Use "Edit payment" if you collected a different amount or need to set the date.`,
      )
    )
      return;
    setBusyId(inv.id);
    const { error } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        amount_paid: inv.total != null ? Number(inv.total) : null,
      })
      .eq("id", inv.id);
    setBusyId(null);
    if (error) {
      alert("Could not mark paid: " + error.message);
      return;
    }
    load();
  };

  const markUnpaid = async (inv) => {
    if (
      !confirm(
        "Mark this invoice unpaid again? It clears the paid date and amount.",
      )
    )
      return;
    setBusyId(inv.id);
    const { error } = await supabase
      .from("invoices")
      .update({ status: "sent", paid_at: null, amount_paid: null })
      .eq("id", inv.id);
    setBusyId(null);
    if (error) {
      alert("Could not update: " + error.message);
      return;
    }
    load();
  };

  const fmtDay = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  // Open the full invoice document (with its own print / mark-sent toolbar).
  if (viewId) {
    return (
      <InvoiceDocument
        invoiceId={viewId}
        onBack={() => {
          setViewId(null);
          load();
        }}
        onChanged={load}
        onEditDraft={null}
      />
    );
  }

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
          Billing
        </div>
        <h1 className="text-4xl font-light text-stone-900 tracking-tight mb-6">
          Invoice{" "}
          <span className="font-serif italic text-amber-700">payments</span>
        </h1>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
            <div className="text-[10px] uppercase tracking-wider text-amber-700 font-mono">
              Outstanding
            </div>
            <div className="text-2xl font-serif text-stone-900 mt-1">
              {fmtMoney(outstanding)}
            </div>
          </div>
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
            <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-mono">
              Collected
            </div>
            <div className="text-2xl font-serif text-stone-900 mt-1">
              {fmtMoney(collected)}
            </div>
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-stone-100 rounded-xl mb-4">
          {["unpaid", "paid", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === f ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
            >
              {f}
            </button>
          ))}
        </div>

        {invoices === null ? (
          <div className="text-center py-12 text-stone-400 text-sm">
            Loading…
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No invoices here.
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((inv) => {
              const paid = inv.status === "paid";
              const amt =
                paid && inv.amount_paid != null
                  ? Number(inv.amount_paid)
                  : Number(inv.total) || 0;
              const isEditing = editing === inv.id;
              return (
                <div
                  key={inv.id}
                  className={`rounded-2xl bg-white border p-4 ${paid ? "border-emerald-200" : "border-stone-200"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-serif text-lg text-stone-900 truncate">
                        {inv.customer?.name || "Property"}
                      </div>
                      <div className="text-xs font-mono text-stone-500 mt-0.5">
                        #{inv.invoice_number || "—"} · {fmtDay(inv.created_at)}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-serif text-lg text-stone-900">
                        {fmtMoney(amt)}
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${paid ? "bg-emerald-600 text-white" : inv.status === "sent" ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-500"}`}
                      >
                        {paid ? "PAID" : (inv.status || "draft").toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {paid && !isEditing && (
                    <div className="mt-2 text-[11px] font-mono text-stone-500 flex flex-wrap gap-x-3 gap-y-1">
                      <span>Paid {fmtDay(inv.paid_at)}</span>
                      {inv.amount_paid != null &&
                        Number(inv.amount_paid) !== Number(inv.total) && (
                          <span className="text-amber-700">
                            collected {fmtMoney(inv.amount_paid)} of{" "}
                            {fmtMoney(inv.total)}
                          </span>
                        )}
                      {inv.payment_note && (
                        <span className="italic">“{inv.payment_note}”</span>
                      )}
                    </div>
                  )}

                  {isEditing ? (
                    <div className="mt-3 pt-3 border-t border-stone-100 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-[11px] font-mono text-stone-500 w-24">
                          Paid date
                        </label>
                        <input
                          type="date"
                          value={draft.paid_at}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, paid_at: e.target.value }))
                          }
                          className="px-2 py-1 rounded border border-stone-300 text-xs font-mono"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-[11px] font-mono text-stone-500 w-24">
                          Amount paid
                        </label>
                        <span className="text-xs text-stone-500 font-mono">
                          $
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.amount_paid}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              amount_paid: e.target.value,
                            }))
                          }
                          placeholder={
                            inv.total != null ? String(inv.total) : "0.00"
                          }
                          className="w-28 px-2 py-1 rounded border border-stone-300 text-xs font-mono"
                        />
                      </div>
                      <div className="flex items-start gap-2 flex-wrap">
                        <label className="text-[11px] font-mono text-stone-500 w-24 pt-1">
                          Note
                        </label>
                        <input
                          type="text"
                          value={draft.payment_note}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              payment_note: e.target.value,
                            }))
                          }
                          placeholder="e.g. negotiated rate, paid by check"
                          className="flex-1 min-w-[12rem] px-2 py-1 rounded border border-stone-300 text-xs"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => saveMarkPaid(inv)}
                          disabled={busyId === inv.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium disabled:opacity-50"
                        >
                          Save as paid
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-600 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <button
                        onClick={() => setGlanceId(inv.id)}
                        className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs flex items-center gap-1.5 hover:bg-stone-50"
                      >
                        <Eye size={12} /> Quick glance
                      </button>
                      <button
                        onClick={() => setViewId(inv.id)}
                        className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs flex items-center gap-1.5 hover:bg-stone-50"
                      >
                        <FileText size={12} /> Open full
                      </button>
                      {!paid ? (
                        <>
                          <button
                            onClick={() => markPaidQuick(inv)}
                            disabled={busyId === inv.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Check size={13} /> Mark paid
                          </button>
                          <button
                            onClick={() => openEdit(inv)}
                            className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs flex items-center gap-1.5 hover:bg-stone-50"
                          >
                            <Edit2 size={12} /> Edit payment
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => openEdit(inv)}
                            className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs flex items-center gap-1.5 hover:bg-stone-50"
                          >
                            <Edit2 size={12} /> Edit payment
                          </button>
                          <button
                            onClick={() => markUnpaid(inv)}
                            disabled={busyId === inv.id}
                            className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs disabled:opacity-50 hover:bg-red-50"
                          >
                            Mark unpaid
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick glance — the invoice in a popup, no navigating away. */}
      {glanceId && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-3"
          onClick={() => setGlanceId(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-200 flex-shrink-0 bg-white">
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">
                Quick glance · tap outside to close
              </span>
              <button
                onClick={() => setGlanceId(null)}
                className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <InvoiceDocument
                invoiceId={glanceId}
                onBack={() => setGlanceId(null)}
                onChanged={load}
                onEditDraft={null}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MoneyView({ employee, onSignOut, onOpenMessages, onLogoClick }) {
  const [subTab, setSubTab] = useState("invoices"); // 'invoices' | 'payroll' | 'reports' | 'profit'

  const ChildView =
    subTab === "invoices"
      ? InvoiceView
      : subTab === "payments"
        ? InvoicePaymentsReport
        : subTab === "payroll"
          ? ExportView
          : subTab === "profit"
            ? ProfitReportView
            : CleaningsReportView;
  return (
    <div>
      <ScreenId id="OW-MONEY" />
      <ChildView
        employee={employee}
        onSignOut={onSignOut}
        onOpenMessages={onOpenMessages}
        onLogoClick={onLogoClick}
        topToggle={
          <div className="px-5 pt-4">
            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl">
              <button
                onClick={() => setSubTab("invoices")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${subTab === "invoices" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                <FileText size={13} /> Invoices
              </button>
              <button
                onClick={() => setSubTab("payments")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${subTab === "payments" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                <Check size={13} /> Payments
              </button>
              <button
                onClick={() => setSubTab("payroll")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${subTab === "payroll" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                <DollarSign size={13} /> Payroll
              </button>
              <button
                onClick={() => setSubTab("reports")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${subTab === "reports" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                <ClipboardList size={13} /> Cleanings
              </button>
              <button
                onClick={() => setSubTab("profit")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${subTab === "profit" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                <DollarSign size={13} /> Profit
              </button>
            </div>
          </div>
        }
      />
    </div>
  );
}

// =================================================================
// DATE RANGE PICKER — one button that opens a calendar; first tap sets
// the start, second tap sets the end (taps before the start swap).
// =================================================================
export function DateRangePicker({ start, end, onChange }) {
  const [open, setOpen] = useState(false);
  const initDate = start ? new Date(start + "T00:00:00") : new Date();
  const [view, setView] = useState(
    new Date(initDate.getFullYear(), initDate.getMonth(), 1),
  );

  const toIso = (d) => {
    const y = d.getFullYear(),
      m = String(d.getMonth() + 1).padStart(2, "0"),
      day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const fmt = (iso) =>
    iso
      ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "";
  const fmtFull = (iso) =>
    iso
      ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";
  const label =
    start && end
      ? `${fmt(start)} – ${fmtFull(end)}`
      : start
        ? `${fmt(start)} – pick end date`
        : "Pick date range";

  const clickDay = (iso) => {
    if (!start || (start && end)) {
      onChange(iso, "");
      return;
    } // begin a new range
    if (iso < start) {
      onChange(iso, start);
      setOpen(false);
    } // tapped before start → swap
    else {
      onChange(start, iso);
      setOpen(false);
    } // set the end
  };

  const today = new Date();
  const todayIso = toIso(today);
  const thisMonthStart = toIso(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const thisMonthEnd = toIso(
    new Date(today.getFullYear(), today.getMonth() + 1, 0),
  );
  const lastMonthStart = toIso(
    new Date(today.getFullYear(), today.getMonth() - 1, 1),
  );
  const lastMonthEnd = toIso(
    new Date(today.getFullYear(), today.getMonth(), 0),
  );
  const last30 = toIso(new Date(Date.now() - 29 * 86400000));
  const setPreset = (s, e) => {
    onChange(s, e);
    setOpen(false);
  };

  const year = view.getFullYear(),
    month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-left flex items-center justify-between hover:border-stone-400"
      >
        <span
          className={`text-sm ${start ? "text-stone-900" : "text-stone-400"}`}
        >
          {label}
        </span>
        <Calendar size={16} className="text-stone-400" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
          />
          <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-auto bg-white rounded-2xl border border-stone-200 shadow-xl p-3">
            <div className="flex gap-1 mb-3 flex-wrap">
              <button
                onClick={() => setPreset(thisMonthStart, thisMonthEnd)}
                className="text-[11px] px-2 py-1 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200"
              >
                This month
              </button>
              <button
                onClick={() => setPreset(lastMonthStart, lastMonthEnd)}
                className="text-[11px] px-2 py-1 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200"
              >
                Last month
              </button>
              <button
                onClick={() => setPreset(last30, todayIso)}
                className="text-[11px] px-2 py-1 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200"
              >
                Last 30 days
              </button>
            </div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setView(new Date(year, month - 1, 1))}
                className="p-1.5 rounded-lg hover:bg-stone-100"
              >
                <ChevronLeft size={16} className="text-stone-600" />
              </button>
              <span className="text-sm font-medium text-stone-800">
                {view.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button
                onClick={() => setView(new Date(year, month + 1, 1))}
                className="p-1.5 rounded-lg hover:bg-stone-100"
              >
                <ChevronRight size={16} className="text-stone-600" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div
                  key={i}
                  className="text-center text-[10px] font-mono text-stone-400"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const iso = toIso(d);
                const st = iso === start,
                  en = iso === end,
                  rng = start && end && iso > start && iso < end;
                const isToday = iso === todayIso;
                return (
                  <button
                    key={i}
                    onClick={() => clickDay(iso)}
                    className={`h-9 text-xs rounded-lg flex items-center justify-center ${
                      st || en
                        ? "bg-stone-900 text-white font-medium"
                        : rng
                          ? "bg-amber-100 text-amber-900"
                          : isToday
                            ? "text-stone-900 font-bold ring-1 ring-stone-300"
                            : "text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between items-center mt-3 pt-2 border-t border-stone-100">
              <span className="text-[11px] font-mono text-stone-400">
                {start
                  ? end
                    ? `${fmt(start)} – ${fmt(end)}`
                    : `${fmt(start)} – pick end`
                  : "pick a start date"}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-xs px-3 py-1.5 rounded-lg bg-stone-900 text-white"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function InvoiceView({
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
  const [properties, setProperties] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [start, setStart] = useState(twoWeeksAgo);
  const [end, setEnd] = useState(today);
  const [invoice, setInvoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showZeros, setShowZeros] = useState(true);
  const [showPriceBook, setShowPriceBook] = useState(false);
  const [draftOn, setDraftOn] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [viewingInvoiceId, setViewingInvoiceId] = useState(null);
  const [mode, setMode] = useState("new"); // 'new' | 'saved'
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("property_type", "multi_unit")
        .eq("active", true)
        .order("name");
      setProperties(visibleProps(data, employee));
    })();
  }, []);
  const generate = async () => {
    if (!selectedId) return;
    setBusy(true);
    const property = properties.find((p) => p.id === selectedId);
    const { data: units } = await supabase
      .from("units")
      .select("*, parties(*)")
      .eq("customer_id", selectedId)
      .order("sort_order")
      .order("label");
    const { data: blocks } = await supabase
      .from("work_blocks")
      .select(
        "*, shift:shifts!inner(employee:employees(name), customer_id), unit:units(label), party:parties(*)",
      )
      .gte("start_time", start + "T00:00:00")
      .lte("start_time", end + "T23:59:59")
      .eq("is_preview", false) // Never bill for preview-mode work
      .not("end_time", "is", null);
    const propBlocks = (blocks || []).filter(
      (b) => b.shift?.customer_id === selectedId,
    );
    const blocksByParty = {};
    propBlocks.forEach((b) => {
      const key = b.party_id || "unassigned";
      if (!blocksByParty[key]) blocksByParty[key] = [];
      blocksByParty[key].push(b);
    });
    const invoiceUnits = (units || []).map((u) => ({
      ...u,
      parties: (u.parties || [])
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((p) => {
          const partyBlocks = blocksByParty[p.id] || [];
          const totalMs = partyBlocks.reduce(
            (sum, b) => sum + (new Date(b.end_time) - new Date(b.start_time)),
            0,
          );
          const hours = totalMs / 1000 / 3600;
          const totalAmount = partyBlocks.reduce((sum, b) => {
            const h =
              (new Date(b.end_time) - new Date(b.start_time)) / 1000 / 3600;
            return (
              sum + h * (b.bill_rate_at_work || property.bill_rate_hourly || 0)
            );
          }, 0);
          return {
            ...p,
            blocks: partyBlocks,
            hours,
            amount: totalAmount,
            hasWork: partyBlocks.length > 0,
          };
        }),
    }));
    const grandTotal = invoiceUnits.reduce(
      (sum, u) => sum + u.parties.reduce((s, p) => s + p.amount, 0),
      0,
    );
    const totalHours = invoiceUnits.reduce(
      (sum, u) => sum + u.parties.reduce((s, p) => s + p.hours, 0),
      0,
    );
    setInvoice({
      property,
      units: invoiceUnits,
      grandTotal,
      totalHours,
      start,
      end,
    });
    setBusy(false);
  };
  // "Edit draft": free this draft's cleanings and reopen the generator for
  // its period through today, so newer cleanings merge into one invoice.
  const [seedInvoice, setSeedInvoice] = useState(null);
  const editDraft = async (inv) => {
    if (!inv) return;
    // Capture the full invoice + its lines BEFORE freeing it, so the
    // reopened editor can restore every price, override, extra and note.
    // The old code deleted first and rebuilt blank — wiping all of it.
    const { data: full } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", inv.id)
      .single();
    const { data: savedLines } = await supabase
      .from("invoice_lines")
      .select("*")
      .eq("invoice_id", inv.id);
    // Free this invoice's targets so they (plus any newer cleanings) flow
    // back into the draft. Await it fully before reopening so the editor's
    // regeneration query sees them as un-invoiced.
    const { error: freeErr } = await supabase
      .from("assignment_targets")
      .update({ invoiced_on: null })
      .eq("invoiced_on", inv.id);
    if (freeErr) {
      alert("Could not reopen: " + freeErr.message);
      return;
    }
    await supabase.from("invoices").delete().eq("id", inv.id);
    setSeedInvoice({ ...(full || inv), lines: savedLines || [] });
    setSelectedId(inv.customer_id);
    setStart(inv.period_start || twoWeeksAgo);
    setEnd(inv.period_end || today);
    setViewingInvoiceId(null);
    setDraftOn(true);
  };
  if (showPriceBook && selectedId) {
    const property = properties.find((p) => p.id === selectedId);
    return (
      <PriceBookEditor
        property={property}
        onBack={() => setShowPriceBook(false)}
      />
    );
  }
  if (viewingInvoiceId) {
    return (
      <InvoiceDocument
        invoiceId={viewingInvoiceId}
        onBack={() => {
          setViewingInvoiceId(null);
          setMode("saved");
        }}
        onChanged={() => {}}
        onEditDraft={editDraft}
      />
    );
  }
  if (draftOn && selectedId) {
    const property = properties.find((p) => p.id === selectedId);
    return (
      <InvoiceDraftEditor
        property={property}
        start={start}
        end={end}
        employee={employee}
        seedInvoice={seedInvoice}
        onBack={() => {
          setDraftOn(false);
          setSeedInvoice(null);
        }}
        onSaved={(inv) => {
          setDraftOn(false);
          setSeedInvoice(null);
          setViewingInvoiceId(inv?.id || null);
        }}
      />
    );
  }
  if (invoice) {
    return (
      <InvoicePreview
        invoice={invoice}
        showZeros={showZeros}
        setShowZeros={setShowZeros}
        onBack={() => setInvoice(null)}
        onPrint={() => window.print()}
      />
    );
  }
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
          Billing
        </div>
        <h1 className="text-4xl font-light text-stone-900 tracking-tight mb-6">
          Generate{" "}
          <span className="font-serif italic text-amber-700">invoice</span>
        </h1>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
              Property
            </label>
            {properties.length === 0 ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                No multi-unit properties yet.
              </div>
            ) : (
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900"
              >
                <option value="">— Pick a property —</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex gap-1 p-1 bg-stone-100 rounded-xl">
            <button
              onClick={() => setMode("new")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${mode === "new" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
            >
              New invoice
            </button>
            <button
              onClick={() => setMode("saved")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${mode === "saved" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
            >
              Saved invoices
            </button>
          </div>

          {mode === "new" ? (
            <>
              <div>
                <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
                  Date range
                </label>
                <DateRangePicker
                  start={start}
                  end={end}
                  onChange={(s, e) => {
                    setStart(s);
                    setEnd(e);
                  }}
                />
              </div>
              <button
                onClick={() => {
                  setSavedMsg("");
                  setDraftOn(true);
                }}
                disabled={!selectedId || !start || !end}
                className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <FileText size={18} /> Generate draft
              </button>
              {selectedId && (
                <button
                  onClick={() => setShowPriceBook(true)}
                  className="w-full py-3 rounded-2xl bg-white border border-stone-300 text-stone-700 text-sm font-medium active:scale-98 flex items-center justify-center gap-2 hover:border-stone-400"
                >
                  <DollarSign size={16} /> Edit subsection prices for this
                  property
                </button>
              )}
              {selectedId && (
                <button
                  onClick={generate}
                  disabled={busy}
                  className="w-full py-2 text-xs font-mono text-stone-400 hover:text-stone-600 disabled:opacity-50"
                >
                  {busy ? "Generating…" : "Old time-based print view"}
                </button>
              )}
            </>
          ) : selectedId ? (
            <InvoiceList
              property={properties.find((p) => p.id === selectedId)}
              onOpen={(id) => setViewingInvoiceId(id)}
              onNew={() => setMode("new")}
            />
          ) : (
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-sm text-stone-500">
              Pick a property above to see its saved invoices.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InvoicePreview({ invoice, showZeros, setShowZeros, onBack, onPrint }) {
  const { property, units, grandTotal, totalHours, start, end } = invoice;
  return (
    <div className="pb-24 bg-stone-50">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .invoice-page { max-width: 100% !important; box-shadow: none !important; border: none !important; }
        }
      `}</style>
      <div className="no-print flex items-center justify-between gap-3 px-5 py-4 border-b border-stone-200 bg-white sticky top-0 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-stone-700 text-sm"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-mono text-stone-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showZeros}
              onChange={(e) => setShowZeros(e.target.checked)}
              className="w-4 h-4 rounded accent-stone-900"
            />
            Show $0
          </label>
          <button
            onClick={onPrint}
            className="ml-2 px-4 py-2 rounded-full bg-stone-900 text-stone-50 text-sm font-medium flex items-center gap-2"
          >
            <Printer size={14} /> Print / PDF
          </button>
        </div>
      </div>
      <div className="invoice-page max-w-3xl mx-auto bg-white border border-stone-200 my-6 mx-4 sm:mx-auto p-8 sm:p-12 rounded-2xl shadow-sm">
        <div className="flex items-start justify-between mb-8 pb-8 border-b border-stone-200">
          <div>
            <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">
              Invoice
            </div>
            <h1 className="font-serif text-3xl text-stone-900 mb-1">
              {property.name}
            </h1>
            {property.address && (
              <div className="text-sm text-stone-600">{property.address}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">
              Period
            </div>
            <div className="font-mono text-sm text-stone-900">
              {fmtDateLong(start)}
            </div>
            <div className="font-mono text-sm text-stone-900">
              to {fmtDateLong(end)}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-8 p-4 bg-stone-50 rounded-xl">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">
              Total hours
            </div>
            <div className="font-serif text-2xl text-stone-900">
              {totalHours.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">
              Rate
            </div>
            <div className="font-serif text-2xl text-stone-900">
              {fmtMoney(property.bill_rate_hourly)}/hr
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">
              Amount due
            </div>
            <div className="font-serif text-2xl text-amber-700">
              {fmtMoney(grandTotal)}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          {units.map((unit) => {
            const visibleParties = unit.parties.filter(
              (p) => showZeros || p.hasWork,
            );
            const unitTotal = unit.parties.reduce(
              (sum, p) => sum + p.amount,
              0,
            );
            const unitHours = unit.parties.reduce((sum, p) => sum + p.hours, 0);
            if (visibleParties.length === 0 && !showZeros) return null;
            return (
              <div key={unit.id}>
                <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-stone-200">
                  <h3 className="font-serif text-xl text-stone-900">
                    {unit.label}
                  </h3>
                  <div className="font-mono text-sm text-stone-700">
                    {unitHours.toFixed(2)} hrs · {fmtMoney(unitTotal)}
                  </div>
                </div>
                {visibleParties.length === 0 ? (
                  <div className="text-sm text-stone-400 italic py-2">
                    No work this period.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider font-mono text-stone-500 text-left">
                        <th className="font-normal pb-2">Bedroom</th>
                        <th className="font-normal pb-2 text-right">Hours</th>
                        <th className="font-normal pb-2 text-right">Rate</th>
                        <th className="font-normal pb-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleParties.map((party) => (
                        <tr
                          key={party.id}
                          className={`border-t border-stone-100 ${!party.hasWork ? "text-stone-400" : ""}`}
                        >
                          <td className="py-2.5">
                            <div className="font-medium">{party.label}</div>
                            {party.full_name && (
                              <div className="text-xs text-stone-500">
                                {party.full_name}
                              </div>
                            )}
                            {party.blocks?.length > 0 && (
                              <div className="text-[10px] text-stone-500 font-mono mt-0.5">
                                {party.blocks.length} block
                                {party.blocks.length === 1 ? "" : "s"} ·{" "}
                                {[
                                  ...new Set(
                                    party.blocks
                                      .map((b) => b.shift?.employee?.name)
                                      .filter(Boolean),
                                  ),
                                ].join(", ")}
                              </div>
                            )}
                            {party.blocks?.[0]?.work_notes && (
                              <div className="text-[10px] text-stone-500 italic mt-0.5">
                                "{party.blocks[0].work_notes}"
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 text-right font-mono">
                            {party.hours.toFixed(2)}
                          </td>
                          <td className="py-2.5 text-right font-mono">
                            {fmtMoney(property.bill_rate_hourly)}
                          </td>
                          <td className="py-2.5 text-right font-mono font-medium">
                            {fmtMoney(party.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-8 pt-6 border-t-2 border-stone-900">
          <div className="flex items-baseline justify-between">
            <div className="font-serif text-xl text-stone-900">Total due</div>
            <div className="font-serif text-3xl text-stone-900">
              {fmtMoney(grandTotal)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// PAYROLL EXPORT
// =================================================================
function ExportView({
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

// =================================================================
// CHANGE PIN MODAL — cleaner changes their own 4-digit PIN
// Three steps: current PIN → new PIN → confirm new PIN.
// Blocks obvious PINs, requires new ≠ current, checks uniqueness.
// =================================================================
const OBVIOUS_PINS = new Set([
  "0000",
  "1111",
  "2222",
  "3333",
  "4444",
  "5555",
  "6666",
  "7777",
  "8888",
  "9999",
  "1234",
  "4321",
  "0123",
  "3210",
  "1212",
  "2121",
  "1010",
  "0101",
  "2580",
  "6969",
  "1004",
  "2000",
  "1313",
]);

// =================================================================
// PORTAL APP — separate flow for property managers and property owners.
// Sign in with a portfolio code → if they have multiple properties,
// pick one. They see only that property's photos, dates, and units.
// No cleaner names, no $ amounts (unless their kind allows it later).
// =================================================================
function PortalApp({
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

function PortalSignIn({ onSignIn }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const tryLogin = async () => {
    if (!code.trim()) return;
    setError("");
    setBusy(true);
    const trimmed = code.trim().toLowerCase();

    // Secure server-side code check (falls back to direct query
    // pre-lockdown so nobody's locked out during migration).
    const user = await securePortalSignIn(trimmed);

    if (user) {
      // Load their properties
      const { data: links } = await supabase
        .from("portal_user_properties")
        .select("property:customers(*)")
        .eq("portal_user_id", user.id);
      const props = (links || [])
        .map((r) => r.property)
        .filter((p) => p && p.active)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setBusy(false);
      if (props.length === 0) {
        setError(
          "Your code is valid but no properties are assigned to you yet. Contact Summit Clean.",
        );
        return;
      }
      onSignIn(user, props);
      return;
    }

    // Backward-compat fallback: try the old per-property codes
    // (in case the v18 migration hasn't been run yet, or wasn't able to migrate this code)
    let { data } = await supabase
      .from("customers")
      .select("*")
      .eq("portal_code", trimmed)
      .eq("active", true)
      .maybeSingle();
    let kind = "pm";
    if (!data) {
      ({ data } = await supabase
        .from("customers")
        .select("*")
        .eq("staff_portal_code", trimmed)
        .eq("active", true)
        .maybeSingle());
      kind = "pm_staff";
    }
    setBusy(false);
    if (!data) {
      setError("That code didn't match. Check with your cleaning company.");
      return;
    }
    // Synthesize a "fake" portal user so the rest of the flow works
    const synthUser = {
      id: "legacy-" + data.id,
      code: trimmed,
      name:
        kind === "pm_staff" ? `PM staff of ${data.name}` : `PM of ${data.name}`,
      kind: kind,
      active: true,
      _legacy: true, // marker so we don't try to update portal_users table for these
    };
    onSignIn(synthUser, [data]);
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Dark brand header band — tightened so content fits on small phones */}
      <div className="flex flex-col items-center py-5 sm:py-8 bg-stone-900">
        <img
          src="https://bbaynvqnbkjyqhzhhypr.supabase.co/storage/v1/object/public/brand/unnamed%20(2).png"
          alt="Summit Clean"
          className="w-28 sm:w-40 h-auto mx-auto"
        />
      </div>

      <div className="flex-1 flex flex-col justify-center items-center px-6 max-w-sm mx-auto w-full py-4 sm:py-8">
        <div className="mb-4 sm:mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.25em] font-mono text-stone-500">
            Welcome
          </p>
          <h2 className="font-serif text-xl sm:text-2xl mt-2 text-stone-900">
            Property manager portal
          </h2>
        </div>

        <div className="w-full">
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Access code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))
            }
            placeholder="e.g. sunset2024"
            onKeyDown={(e) => e.key === "Enter" && tryLogin()}
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono text-lg tracking-wide"
          />

          {error && (
            <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={tryLogin}
            disabled={busy || !code.trim()}
            className="w-full mt-4 py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-xs text-stone-500 mt-6 text-center">
            Don't have a code? Ask Summit Clean for access.
          </p>
        </div>
      </div>
      <div className="text-center pb-6 text-xs text-stone-400 font-mono">
        <button
          onClick={() => {
            // Clear any remembered choice so they get to the landing page
            try {
              localStorage.removeItem("tt_role_choice");
            } catch {}
            window.location.hash = "";
          }}
          className="hover:text-stone-600"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

// =================================================================
// PORTAL PROPERTY PICKER — shown after sign-in when the user has 2+
// properties in their portfolio. Lets them pick which to view.
// =================================================================
function PortalPropertyPicker({ portalUser, properties, onPick, onSignOut }) {
  const kindLabel =
    portalUser.kind === "property_owner"
      ? "Property Owner"
      : portalUser.kind === "pm_staff"
        ? "PM Staff"
        : "Property Manager";
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <div className="bg-stone-900 text-stone-50 px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="https://bbaynvqnbkjyqhzhhypr.supabase.co/storage/v1/object/public/brand/unnamed%20(2).png"
            alt="Summit Clean"
            className="h-10 w-auto object-contain flex-shrink-0"
          />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-mono text-amber-400">
              {kindLabel}
            </div>
            <div className="font-serif text-lg truncate">{portalUser.name}</div>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="text-xs text-stone-300 font-mono hover:text-stone-50 flex-shrink-0 ml-2"
        >
          Sign out
        </button>
      </div>
      <div className="flex-1 px-5 py-8 max-w-md mx-auto w-full">
        <div className="text-center mb-6">
          <h2 className="font-serif text-2xl text-stone-900 mb-1">
            {greetingForTime()},{" "}
            <span className="italic text-amber-700">
              {portalUser.name?.split(" ")[0] || portalUser.name}
            </span>
          </h2>
          <p className="text-sm text-stone-500">
            You{" "}
            {properties.length === 1
              ? "have access to 1 property"
              : `have access to ${properties.length} properties`}
            . Pick one to get started.
          </p>
        </div>
        <div className="space-y-2">
          {properties.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              className="w-full p-4 rounded-2xl bg-white border border-stone-200 hover:border-amber-500 active:scale-[0.99] transition-all text-left flex items-center gap-3"
            >
              <Building2 size={20} className="text-amber-700 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-serif text-lg text-stone-900 truncate">
                  {p.name}
                </div>
                {p.address && (
                  <div className="text-xs text-stone-500">
                    <AddressLink address={p.address} />
                  </div>
                )}
              </div>
              <ChevronRight
                size={18}
                className="text-stone-400 flex-shrink-0"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PortalDashboard({
  property,
  portalKind,
  portalUser,
  properties,
  onSwitchProperty,
  hasMultipleProperties,
  onBackToPicker,
  onSignOut,
  onRefreshProperty,
}) {
  const [view, setView] = useState({ kind: "home" });
  // 'home' (recent activity), 'unit-day' (drill into one unit's day), 'all-photos' (gallery)

  // Where the PM was standing when they drilled into a unit-day. PortalHome
  // unmounts while the day detail is open, so if this state lived inside it
  // Back would drop them on the default History tab instead of the tab they
  // actually left from (the Schedule → Recently done bug).
  const [homeTab, setHomeTab] = useState("history");
  const [homeAsgSub, setHomeAsgSub] = useState("requests");
  const [schedRecentOpen, setSchedRecentOpen] = useState(false);
  const [homeFilter, setHomeFilter] = useState("7d"); // History range: 7d / 30d / 1y

  if (view.kind === "unit-day") {
    return (
      <PortalUnitDay
        property={property}
        unitId={view.unitId}
        date={view.date}
        portalUser={portalUser}
        onBack={() => setView({ kind: "home" })}
      />
    );
  }

  return (
    <PortalHome
      property={property}
      portalKind={portalKind}
      portalUser={portalUser}
      properties={properties}
      onSwitchProperty={onSwitchProperty}
      hasMultipleProperties={hasMultipleProperties}
      onBackToPicker={onBackToPicker}
      onSignOut={onSignOut}
      onRefreshProperty={onRefreshProperty}
      tab={homeTab}
      setTab={setHomeTab}
      asgSub={homeAsgSub}
      setAsgSub={setHomeAsgSub}
      filter={homeFilter}
      setFilter={setHomeFilter}
      schedRecentOpen={schedRecentOpen}
      setSchedRecentOpen={setSchedRecentOpen}
      onOpenUnitDay={(unitId, date) =>
        setView({ kind: "unit-day", unitId, date })
      }
    />
  );
}

// =================================================================
// ASSIGNMENT FORM — bulk multi-file uploader
//
// Lets the owner/manager pick multiple files at once and configure
// each one individually (title, notes, property/unit/party target)
// before saving them all in one batch.
//
// `property` is the *default* property (where they came from). Each
// file can be retargeted to a different property if needed.
// =================================================================
// =================================================================
// QUICK ASSIGNMENT — for properties without the full bedroom/template
// setup (e.g. Bridges, Citifront). Just: apartment number, how many
// bed/bath, and the clean type. Creates the apartment (unit) on the
// fly if it doesn't exist, so a cleaner can pick it up right away.
// =================================================================
// INBOX VIEW — owner/manager review of PM uploads
// Two tabs: Pending assignments + New photos
// =================================================================
export function InboxView({ employee, onBack }) {
  const [tab, setTab] = useState("assignments");
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [reviewedAssignments, setReviewedAssignments] = useState([]);
  const [pendingRechecks, setPendingRechecks] = useState([]); // PM recheck requests waiting for owner
  const [reviewRecheck, setReviewRecheck] = useState(null); // currently-open recheck in review modal
  const [newPhotos, setNewPhotos] = useState([]);
  const [reviewedPhotos, setReviewedPhotos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [reviewAssignment, setReviewAssignment] = useState(null);
  const [reviewPhoto, setReviewPhoto] = useState(null);
  const [togglingAssignmentId, setTogglingAssignmentId] = useState(null);
  // Queue review mode — when on, the inbox auto-opens the first pending
  // assignment as a review modal. After approve / send-back, we
  // immediately advance to the next pending one. When the queue empties
  // we show an "all caught up" prompt + the owner confirms to leave.
  const [queueMode, setQueueMode] = useState(false);
  const [queueDone, setQueueDone] = useState(false);

  // Discard a PM submission straight from the row — soft-delete, so it's
  // recoverable, and reload so it leaves the queue.
  const discardPmAssignment = async (assignment) => {
    if (togglingAssignmentId) return;
    if (
      !confirm(
        `Discard "${assignment.title || "this submission"}"? It won\u2019t be cleaned or billed. This can be undone later.`,
      )
    )
      return;
    setTogglingAssignmentId(assignment.id);
    const { error } = await supabase
      .from("assignments")
      .update({ deleted_at: new Date().toISOString(), deleted_by: employee.id })
      .eq("id", assignment.id);
    setTogglingAssignmentId(null);
    if (error) {
      alert("Could not discard: " + error.message);
      return;
    }
    load();
  };

  // Flip priority on every target of an assignment from the inbox row.
  // Sweep mode: if ANY target is priority, turn all off; otherwise turn
  // all on. Lets owners flag urgent PM submissions without opening the
  // review modal.
  const togglePmAssignmentPriority = async (assignment) => {
    if (togglingAssignmentId) return;
    const targetIds = (assignment.targets || []).map((t) => t.id);
    if (targetIds.length === 0) return;
    const anyPriority = (assignment.targets || []).some((t) => t.priority);
    const newPriority = !anyPriority;
    setTogglingAssignmentId(assignment.id);
    // Optimistic update across both lists (might appear in either)
    const flip = (list) =>
      list.map((a) =>
        a.id === assignment.id
          ? {
              ...a,
              targets: (a.targets || []).map((t) => ({
                ...t,
                priority: newPriority,
              })),
            }
          : a,
      );
    setPendingAssignments((prev) => flip(prev));
    setReviewedAssignments((prev) => flip(prev));
    const { error } = await supabase
      .from("assignment_targets")
      .update({ priority: newPriority })
      .in("id", targetIds);
    setTogglingAssignmentId(null);
    if (error) {
      alert("Could not update priority: " + error.message);
      load();
    }
  };

  const load = async () => {
    setLoaded(false);
    // Pending assignments
    const { data: aData } = await supabase
      .from("assignments")
      .select(
        "*, property:customers(id, name, property_type), targets:assignment_targets(id, priority, unit:units(label), party:parties(label))",
      )
      .eq("source", "pm")
      .eq("pm_status", "pending")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setPendingAssignments(aData || []);

    // Pending recheck requests — PM submissions saying "tenant passed
    // these items on recheck, don't need cleaning anymore". Pull the
    // item rows + assignment context for the review modal.
    const { data: rcData } = await supabase
      .from("recheck_requests")
      .select(
        `
        id, assignment_id, created_at, pm_status, notes,
        assignment:assignments(id, title, customer_id, property:customers(id, name, property_type)),
        items:recheck_request_items(
          id,
          target:assignment_targets(id, status, template_section, template_item_key, status_notes, unit:units(label), party:parties(label))
        )
      `,
      )
      .eq("pm_status", "pending")
      .order("created_at", { ascending: false });
    setPendingRechecks(rcData || []);

    // Already-reviewed PM assignments (approved or rejected) — for the "Reviewed" tab
    const { data: rData } = await supabase
      .from("assignments")
      .select(
        "*, property:customers(id, name, property_type), targets:assignment_targets(id, priority, unit:units(label), party:parties(label))",
      )
      .eq("source", "pm")
      .in("pm_status", ["approved", "rejected"])
      .order("approved_at", { ascending: false, nullsFirst: false })
      .limit(50);
    setReviewedAssignments(rData || []);

    // New photos
    const { data: pData } = await supabase
      .from("pm_photos")
      .select(
        "*, property:customers(id, name), unit:units(label), party:parties(label)",
      )
      .eq("status", "new")
      .order("created_at", { ascending: false });
    setNewPhotos(pData || []);

    // Reviewed photos (seen or archived)
    const { data: rpData } = await supabase
      .from("pm_photos")
      .select(
        "*, property:customers(id, name), unit:units(label), party:parties(label)",
      )
      .in("status", ["seen", "archived"])
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .limit(50);
    setReviewedPhotos(rpData || []);

    setLoaded(true);
  };
  useEffect(() => {
    load();
  }, []);
  useAssignmentSync(load, "inbox-sync");

  // When in queue mode and no modal open, pick the next pending
  // assignment to review. When the list drains, flip to "done" so the
  // owner sees the all-caught-up screen instead of looping.
  useEffect(() => {
    if (!queueMode || reviewAssignment) return;
    if (!loaded) return;
    if (pendingAssignments.length > 0) {
      setReviewAssignment(pendingAssignments[0]);
    } else {
      setQueueDone(true);
    }
  }, [queueMode, reviewAssignment, pendingAssignments, loaded]);

  const markPhotoSeen = async (photo) => {
    await supabase
      .from("pm_photos")
      .update({
        status: "seen",
        reviewed_by: employee.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", photo.id);
    load();
  };
  const archivePhoto = async (photo) => {
    if (!confirm("Archive this photo? It will no longer appear in your inbox."))
      return;
    await supabase
      .from("pm_photos")
      .update({
        status: "archived",
        reviewed_by: employee.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", photo.id);
    load();
  };
  const restorePhoto = async (photo) => {
    await supabase
      .from("pm_photos")
      .update({
        status: "new",
        reviewed_by: null,
        reviewed_at: null,
      })
      .eq("id", photo.id);
    load();
  };
  const deletePhoto = async (photo) => {
    if (!confirm("Permanently delete this photo? This cannot be undone."))
      return;
    if (photo.photo_path)
      await supabase.storage.from(PM_UPLOAD_BUCKET).remove([photo.photo_path]);
    await supabase.from("pm_photos").delete().eq("id", photo.id);
    load();
  };

  return (
    <div className="pb-24">
      <ScreenId id="OW-INBOX" />
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100"
        >
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
            From property managers
          </div>
          <div className="font-serif text-xl text-stone-900">Inbox</div>
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-5 overflow-x-auto">
          <button
            onClick={() => setTab("assignments")}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium whitespace-nowrap ${tab === "assignments" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
          >
            Assignments ({pendingAssignments.length})
          </button>
          <button
            onClick={() => setTab("photos")}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium whitespace-nowrap ${tab === "photos" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
          >
            Photos ({newPhotos.length})
          </button>
          <button
            onClick={() => setTab("reviewed")}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium whitespace-nowrap ${tab === "reviewed" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
          >
            Reviewed
          </button>
        </div>

        {!loaded ? (
          <Splash text="Loading…" />
        ) : tab === "assignments" ? (
          pendingAssignments.length === 0 && pendingRechecks.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              No assignments waiting for review.
            </div>
          ) : (
            <>
              {/* Pending recheck requests from PMs — these are
                 "tenant passed items X, Y, Z" submissions. Approve
                 marks those items done + recheck_passed_at so the
                 cleaning team stops seeing them. Shown above new
                 assignment submissions so they're easy to spot. */}
              {pendingRechecks.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-2">
                    Recheck requests ({pendingRechecks.length})
                  </div>
                  <div className="space-y-2">
                    {pendingRechecks.map((rc) => (
                      <div
                        key={rc.id}
                        onClick={() => setReviewRecheck(rc)}
                        tabIndex={0}
                        role="button"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setReviewRecheck(rc);
                          }
                        }}
                        className="w-full text-left p-4 rounded-2xl bg-white border-2 border-purple-200 hover:border-purple-500 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-mono">
                                RECHECK
                              </span>
                              <span className="font-serif text-base text-stone-900 truncate">
                                {rc.assignment?.title || "Recheck request"}
                              </span>
                            </div>
                            <div className="text-xs text-stone-600 font-mono mt-0.5">
                              {rc.assignment?.property?.name}
                              {" · "}
                              {rc.items?.length || 0}{" "}
                              {(rc.items?.length || 0) === 1 ? "item" : "items"}{" "}
                              the PM says passed
                            </div>
                            <div className="text-xs text-stone-400 font-mono mt-1">
                              Submitted {fmtDate(rc.created_at)}
                            </div>
                          </div>
                          <ChevronRight
                            size={16}
                            className="text-stone-400 flex-shrink-0"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Queue mode CTA — owner taps once, then walks through
                 every pending review one at a time. Approve / send back
                 → auto-advances. When the queue empties we show a
                 confirmation before leaving the queue screen. */}
              {pendingAssignments.length > 0 && (
                <button
                  onClick={() => {
                    setQueueDone(false);
                    setQueueMode(true);
                  }}
                  className="w-full mb-3 py-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-stone-50 font-medium text-sm flex items-center justify-center gap-2 active:scale-98"
                >
                  <Play size={14} /> Review all {pendingAssignments.length} in
                  queue
                </button>
              )}
              <div className="space-y-2">
                {pendingAssignments.map((a) => {
                  const anyPriority = (a.targets || []).some((t) => t.priority);
                  const isToggling = togglingAssignmentId === a.id;
                  return (
                    <div
                      key={a.id}
                      onClick={() => setReviewAssignment(a)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setReviewAssignment(a);
                        }
                      }}
                      className="w-full text-left p-4 rounded-2xl bg-white border-2 border-amber-200 hover:border-amber-500 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {a.file_kind === "pdf" ? (
                              <FileText
                                size={14}
                                className="text-stone-500 flex-shrink-0"
                              />
                            ) : (
                              <ImageIcon
                                size={14}
                                className="text-stone-500 flex-shrink-0"
                              />
                            )}
                            <span className="font-serif text-base text-stone-900 truncate">
                              {a.title}
                            </span>
                          </div>
                          {/* Priority + cleaning-type chips. Priority is a
                           click-to-toggle button right on the capsule —
                           owners can flag urgent PM submissions without
                           opening the review modal. */}
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePmAssignmentPriority(a);
                              }}
                              disabled={isToggling}
                              className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 transition-colors disabled:opacity-50 ${
                                anyPriority
                                  ? "bg-red-100 text-red-800 border-red-300 font-bold hover:bg-red-200"
                                  : "bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200"
                              }`}
                            >
                              <AlertCircle size={10} />{" "}
                              {anyPriority ? "Priority" : "Mark priority"}
                            </button>
                            <AssignmentTypeChip type={a.assignment_type} />
                          </div>
                          <div className="text-xs text-stone-600 font-mono mb-1 flex items-center gap-1.5">
                            <Building2 size={11} /> {a.property?.name}
                          </div>
                          {a.targets?.[0] &&
                            (a.targets[0].unit?.label ||
                              a.targets[0].party?.label) && (
                              <div className="text-xs text-stone-500 font-mono">
                                {a.targets[0].unit?.label}
                                {a.targets[0].party?.label &&
                                  ` · ${a.targets[0].party.label}`}
                              </div>
                            )}
                          <div className="text-xs text-stone-400 font-mono mt-1 flex items-center gap-2">
                            Submitted {fmtDate(a.created_at)}
                            {a.actor_kind === "pm_staff" && (
                              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600">
                                PM staff
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              discardPmAssignment(a);
                            }}
                            disabled={isToggling}
                            title="Discard — not needed at all"
                            className="p-1.5 rounded-lg text-stone-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 size={16} />
                          </button>
                          <ChevronRight size={16} className="text-stone-400" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )
        ) : tab === "photos" ? (
          newPhotos.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              No new photos.
            </div>
          ) : (
            <div className="space-y-3">
              {newPhotos.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-white border-2 border-amber-200"
                >
                  <div className="text-xs text-stone-600 font-mono mb-2 flex items-center gap-1.5">
                    <Building2 size={11} /> {p.property?.name}
                    {p.unit?.label && <span>· {p.unit.label}</span>}
                    {p.party?.label && <span>· {p.party.label}</span>}
                  </div>
                  {p.title && (
                    <div className="font-serif text-base text-stone-900 mb-1">
                      {p.title}
                    </div>
                  )}
                  {p.notes && (
                    <div className="text-sm text-stone-700 mb-2 whitespace-pre-wrap">
                      {p.notes}
                    </div>
                  )}
                  <button
                    onClick={() => setReviewPhoto(p)}
                    className="block w-full rounded-xl overflow-hidden bg-stone-100 mb-3"
                  >
                    <img
                      loading="lazy"
                      src={p.photo_url}
                      alt={p.title || ""}
                      className="w-full max-h-96 object-contain"
                    />
                  </button>
                  <div className="text-[10px] text-stone-400 font-mono mb-3 flex items-center gap-2">
                    Sent {fmtDate(p.created_at)}
                    {p.actor_kind === "pm_staff" && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600">
                        PM staff
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => markPhotoSeen(p)}
                      className="flex-1 py-2 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Check size={14} /> Mark seen
                    </button>
                    <button
                      onClick={() => archivePhoto(p)}
                      className="py-2 px-3 rounded-xl border border-stone-300 text-stone-600 text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <X size={14} /> Archive
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Reviewed tab — combines reviewed photos and reviewed assignments */
          <div className="space-y-6">
            {reviewedPhotos.length === 0 && reviewedAssignments.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                Nothing reviewed yet. Once you review photos or approve/reject
                assignments they show up here.
              </div>
            ) : (
              <>
                {reviewedAssignments.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
                      Reviewed assignments ({reviewedAssignments.length})
                    </div>
                    <div className="space-y-2">
                      {reviewedAssignments.map((a) => {
                        const isApproved = a.pm_status === "approved";
                        return (
                          <div
                            key={a.id}
                            className={`p-4 rounded-2xl border ${isApproved ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}
                          >
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {a.file_kind === "pdf" ? (
                                <FileText
                                  size={14}
                                  className="text-stone-600 flex-shrink-0"
                                />
                              ) : (
                                <ImageIcon
                                  size={14}
                                  className="text-stone-600 flex-shrink-0"
                                />
                              )}
                              <span className="font-serif text-base text-stone-900 truncate flex-1">
                                {a.title}
                              </span>
                              <span
                                className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full ${isApproved ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}
                              >
                                {isApproved ? "Approved" : "Rejected"}
                              </span>
                            </div>
                            <div className="text-xs text-stone-600 font-mono mb-1 flex items-center gap-1.5">
                              <Building2 size={11} /> {a.property?.name}
                            </div>
                            {a.pm_rejection_reason && (
                              <div className="text-xs text-red-700 italic mt-1">
                                "{a.pm_rejection_reason}"
                              </div>
                            )}
                            <div className="flex gap-2 mt-2">
                              {a.file_url && (
                                <a
                                  href={a.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium flex items-center gap-1"
                                >
                                  <Eye size={12} /> Open file
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {reviewedPhotos.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
                      Reviewed photos ({reviewedPhotos.length})
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {reviewedPhotos.map((p) => (
                        <div key={p.id} className="relative">
                          <button
                            onClick={() => setReviewPhoto(p)}
                            className="block w-full aspect-square rounded-xl overflow-hidden bg-stone-100"
                          >
                            <img
                              loading="lazy"
                              src={p.photo_url}
                              alt={p.title || ""}
                              className="w-full h-full object-cover"
                            />
                          </button>
                          <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                            <span
                              className={`text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-full ${p.status === "seen" ? "bg-emerald-600 text-white" : "bg-stone-700 text-white"}`}
                            >
                              {p.status}
                            </span>
                          </div>
                          <div className="mt-1 px-1 text-[10px] font-mono text-stone-500 truncate">
                            {p.property?.name}
                            {p.unit?.label && ` · ${p.unit.label}`}
                          </div>
                          <div className="px-1 flex gap-2 mt-1">
                            <button
                              onClick={() => restorePhoto(p)}
                              className="text-[10px] font-mono text-stone-600 hover:text-stone-900"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => deletePhoto(p)}
                              className="text-[10px] font-mono text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {reviewAssignment && (
        <ReviewAssignmentModal
          assignment={reviewAssignment}
          employee={employee}
          onDone={() => {
            // CRITICAL — optimistically drop the just-handled assignment
            // from local state BEFORE clearing reviewAssignment. The
            // queue-advance useEffect runs the moment reviewAssignment
            // flips to null, and at that instant pendingAssignments is
            // still the stale list including the one we just approved
            // (load() is in flight, hasn't returned yet). Without this
            // optimistic prune, the useEffect picks the same row at
            // index 0 and re-opens the modal with the assignment the
            // user thought they just finished — every other "approve"
            // click ends up being a no-op database update on an
            // already-approved row. End result: 48 clicks → maybe 20
            // real approvals, the rest invisible to cleaners because
            // they were never actually advanced through the queue.
            const id = reviewAssignment.id;
            setPendingAssignments((prev) => prev.filter((a) => a.id !== id));
            setReviewAssignment(null);
            load();
          }}
          onClose={() => {
            // Closing the modal mid-queue also exits queue mode (the
            // owner chose to stop). They can re-enter from the button.
            if (queueMode) setQueueMode(false);
            setReviewAssignment(null);
          }}
        />
      )}
      {reviewRecheck && (
        <ReviewRecheckModal
          recheck={reviewRecheck}
          employee={employee}
          onDone={() => {
            setReviewRecheck(null);
            load();
          }}
          onClose={() => setReviewRecheck(null)}
        />
      )}
      {/* "All caught up" overlay — shown when the queue empties.
         Owner taps to confirm and exits queue mode. */}
      {queueDone && (
        <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
              <Check size={32} />
            </div>
            <div className="font-serif text-2xl text-stone-900 mb-1">
              All caught up
            </div>
            <div className="text-sm text-stone-600 mb-5">
              No more PM submissions waiting for your review.
            </div>
            <button
              onClick={() => {
                setQueueDone(false);
                setQueueMode(false);
              }}
              className="w-full py-3 rounded-2xl bg-stone-900 text-stone-50 font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      )}
      {reviewPhoto && (
        <div className="fixed inset-0 bg-stone-900/95 z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 text-stone-50 bg-stone-900 flex-shrink-0">
            <div className="text-sm font-mono truncate flex-1">
              {reviewPhoto.title || "Photo from PM"}
            </div>
            <button
              onClick={() => setReviewPhoto(null)}
              className="p-2 rounded-full bg-stone-800 ml-2 flex-shrink-0"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <img
              loading="lazy"
              src={reviewPhoto.photo_url}
              alt=""
              className="w-full h-auto rounded-xl"
            />
            {reviewPhoto.notes && (
              <div className="mt-3 p-3 rounded-xl bg-stone-800 text-stone-200 text-sm whitespace-pre-wrap">
                {reviewPhoto.notes}
              </div>
            )}
          </div>
          <div className="p-3 bg-stone-900 flex-shrink-0">
            <a
              href={reviewPhoto.photo_url}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center py-3 rounded-xl bg-stone-50 text-stone-900 text-sm font-medium"
            >
              Open full-size in new tab
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// =================================================================
// MESSAGING — Deploy 1
//
// - Staff DMs (1-to-1 between staff)
// - Property threads (PM ↔ owners/managers, one per portal-enabled property)
// - Photo attachments
// - Realtime delivery via Supabase Realtime
// - Owners can read any DM for oversight; managers cannot
// =================================================================

// ---- Main Messages tab (staff side) ----
export function StaffMessagesTab({ employee, onClose }) {
  const [view, setView] = useState({ kind: "list" });

  if (view.kind === "thread") {
    return (
      <MessageThread
        conversationId={view.conversationId}
        otherName={view.otherName}
        asEmployee={employee}
        isPropertyThread={view.isPropertyThread}
        propertyName={view.propertyName}
        onBack={() => setView({ kind: "list" })}
      />
    );
  }

  if (view.kind === "new-dm") {
    return (
      <NewDmPicker
        employee={employee}
        onBack={() => setView({ kind: "list" })}
        onPicked={(conversationId, otherName) =>
          setView({
            kind: "thread",
            conversationId,
            otherName,
            isPropertyThread: false,
          })
        }
      />
    );
  }

  if (view.kind === "new-property-thread") {
    return (
      <NewPropertyThreadPicker
        employee={employee}
        onBack={() => setView({ kind: "list" })}
        onPicked={(conversationId, propertyName) =>
          setView({
            kind: "thread",
            conversationId,
            otherName: propertyName,
            isPropertyThread: true,
            propertyName,
          })
        }
      />
    );
  }

  return (
    <ConversationList
      employee={employee}
      onOpen={(c) => setView({ kind: "thread", ...c })}
      onNewDm={() => setView({ kind: "new-dm" })}
      onNewPropertyThread={() => setView({ kind: "new-property-thread" })}
      onClose={onClose}
    />
  );
}

function ConversationList({
  employee,
  onOpen,
  onNewDm,
  onNewPropertyThread,
  onClose,
}) {
  const [dms, setDms] = useState([]);
  const [threads, setThreads] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const canSeeThreads =
    employee.role === "owner" || employee.role === "manager";

  const load = async () => {
    setLoaded(false);
    // DMs the employee is a participant in
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select(
        "conversation_id, last_read_at, conversation:conversations!inner(id, kind, last_message_at, last_message_preview)",
      )
      .eq("employee_id", employee.id);
    const dmConvs = (parts || []).filter(
      (p) => p.conversation?.kind === "staff_dm",
    );
    // For each, find the OTHER participant's name
    const dmList = [];
    for (const p of dmConvs) {
      const { data: others } = await supabase
        .from("conversation_participants")
        .select("employee:employees(id, name)")
        .eq("conversation_id", p.conversation_id)
        .neq("employee_id", employee.id);
      const other = others?.[0]?.employee;
      if (other) {
        // Compute unread for this convo
        const since = p.last_read_at || "1970-01-01";
        const { count: unread } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", p.conversation_id)
          .gt("created_at", since)
          .neq("sender_employee_id", employee.id);
        dmList.push({
          conversationId: p.conversation_id,
          otherId: other.id,
          otherName: other.name,
          lastMessageAt: p.conversation.last_message_at,
          preview: p.conversation.last_message_preview,
          unread: unread || 0,
        });
      }
    }
    // Sort: unread first (highest count), then by recency
    dmList.sort((a, b) => {
      if (a.unread > 0 !== b.unread > 0) return a.unread > 0 ? -1 : 1;
      return (b.lastMessageAt || "").localeCompare(a.lastMessageAt || "");
    });
    setDms(dmList);

    // Property threads (only owners/managers see these)
    if (canSeeThreads) {
      const { data: convs } = await supabase
        .from("conversations")
        .select(
          "id, customer_id, last_message_at, last_message_preview, customer:customers(name)",
        )
        .eq("kind", "property_thread")
        .order("last_message_at", { ascending: false, nullsFirst: false });
      // Per-thread unread tracking via conversation_participants
      const threadList = [];
      for (const c of convs || []) {
        let unread = 0;
        if (c.last_message_at) {
          const { data: myRead } = await supabase
            .from("conversation_participants")
            .select("last_read_at")
            .eq("conversation_id", c.id)
            .eq("employee_id", employee.id)
            .maybeSingle();
          const since = myRead?.last_read_at || "1970-01-01";
          if (c.last_message_at > since) {
            const { count: cc } = await supabase
              .from("messages")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", c.id)
              .gt("created_at", since)
              .eq("sender_is_pm", true);
            unread = cc || 0;
          }
        }
        threadList.push({
          conversationId: c.id,
          customerId: c.customer_id,
          propertyName: c.customer?.name || "Unknown",
          lastMessageAt: c.last_message_at,
          preview: c.last_message_preview,
          unread,
        });
      }
      // Sort: unread first, then by recency
      threadList.sort((a, b) => {
        if (a.unread > 0 !== b.unread > 0) return a.unread > 0 ? -1 : 1;
        return (b.lastMessageAt || "").localeCompare(a.lastMessageAt || "");
      });
      setThreads(threadList);
    }
    setLoaded(true);
  };

  useEffect(() => {
    load();
  }, [employee.id]);

  // Realtime: refresh on any new message
  useEffect(() => {
    const channel = supabase
      .channel("msg-list-" + employee.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [employee.id]);

  return (
    <div className="pb-24">
      {onClose ? (
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200 bg-white">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-stone-100"
          >
            <ArrowLeft size={20} className="text-stone-700" />
          </button>
          <div className="font-serif text-xl text-stone-900">Messages</div>
        </div>
      ) : (
        <Header
          name={employee.name}
          onSignOut={() => {}}
          role={employee.role}
        />
      )}
      <div className="px-5 pt-6 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          {!onClose && (
            <h2 className="font-serif text-2xl text-stone-900">Messages</h2>
          )}
          <div className={`relative ${onClose ? "ml-auto" : ""}`}>
            <button
              onClick={() =>
                canSeeThreads ? setShowNewMenu((s) => !s) : onNewDm()
              }
              className="px-3 py-2 rounded-full bg-stone-900 text-stone-50 text-xs font-mono flex items-center gap-1.5"
            >
              <Plus size={14} /> New
            </button>
            {canSeeThreads && showNewMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNewMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-2xl bg-white border border-stone-200 shadow-lg overflow-hidden">
                  <button
                    onClick={() => {
                      setShowNewMenu(false);
                      onNewDm();
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-stone-50 flex items-start gap-2.5 border-b border-stone-100"
                  >
                    <User
                      size={16}
                      className="text-stone-500 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <div className="text-sm font-medium text-stone-900">
                        Message a teammate
                      </div>
                      <div className="text-[11px] text-stone-500">
                        Direct message to cleaners, managers
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setShowNewMenu(false);
                      onNewPropertyThread && onNewPropertyThread();
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-stone-50 flex items-start gap-2.5"
                  >
                    <Building2
                      size={16}
                      className="text-amber-700 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <div className="text-sm font-medium text-stone-900">
                        Message a property
                      </div>
                      <div className="text-[11px] text-stone-500">
                        Reach PMs and owners at a property
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {!loaded ? (
          <Splash text="Loading…" />
        ) : (
          <>
            {canSeeThreads && threads.length > 0 && (
              <div className="mb-6">
                <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-2">
                  Property threads
                </div>
                <div className="space-y-2">
                  {threads.map((t) => (
                    <button
                      key={t.conversationId}
                      onClick={() =>
                        onOpen({
                          conversationId: t.conversationId,
                          otherName: t.propertyName,
                          isPropertyThread: true,
                          propertyName: t.propertyName,
                        })
                      }
                      className="w-full text-left p-3 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Building2
                              size={14}
                              className="text-amber-700 flex-shrink-0"
                            />
                            <span
                              className={`font-serif text-base text-stone-900 truncate ${t.unread > 0 ? "font-bold" : ""}`}
                            >
                              {t.propertyName}
                            </span>
                            {t.unread > 0 && (
                              <span
                                className="w-2 h-2 rounded-full bg-amber-600 flex-shrink-0"
                                title={`${t.unread} unread`}
                              />
                            )}
                          </div>
                          {t.preview && (
                            <div
                              className={`text-xs truncate mt-1 ${t.unread > 0 ? "text-stone-900 font-medium" : "text-stone-600"}`}
                            >
                              {t.preview}
                            </div>
                          )}
                          {t.lastMessageAt && (
                            <div className="text-[10px] font-mono text-stone-400 mt-0.5">
                              {fmtDate(t.lastMessageAt)}
                            </div>
                          )}
                        </div>
                        <ChevronRight
                          size={14}
                          className="text-stone-400 flex-shrink-0"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-2">
                Direct messages
              </div>
              {dms.length === 0 ? (
                <div className="text-center py-10 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                  No direct messages yet. Tap "New" to start one.
                </div>
              ) : (
                <div className="space-y-2">
                  {dms.map((d) => (
                    <button
                      key={d.conversationId}
                      onClick={() =>
                        onOpen({
                          conversationId: d.conversationId,
                          otherName: d.otherName,
                          isPropertyThread: false,
                        })
                      }
                      className="w-full text-left p-3 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <User
                              size={14}
                              className="text-stone-500 flex-shrink-0"
                            />
                            <span
                              className={`font-serif text-base text-stone-900 truncate ${d.unread > 0 ? "font-bold" : ""}`}
                            >
                              {d.otherName}
                            </span>
                            {d.unread > 0 && (
                              <span
                                className="w-2 h-2 rounded-full bg-amber-600 flex-shrink-0"
                                title={`${d.unread} unread`}
                              />
                            )}
                          </div>
                          {d.preview && (
                            <div
                              className={`text-xs truncate mt-1 ${d.unread > 0 ? "text-stone-900 font-medium" : "text-stone-600"}`}
                            >
                              {d.preview}
                            </div>
                          )}
                          {d.lastMessageAt && (
                            <div className="text-[10px] font-mono text-stone-400 mt-0.5">
                              {fmtDate(d.lastMessageAt)}
                            </div>
                          )}
                        </div>
                        <ChevronRight
                          size={14}
                          className="text-stone-400 flex-shrink-0"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NewDmPicker({ employee, onBack, onPicked }) {
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, name, role, active")
        .eq("active", true)
        .neq("id", employee.id)
        .order("name");
      setStaff(data || []);
    })();
  }, [employee.id]);

  const startDm = async (other) => {
    setBusy(true);
    try {
      // See if a DM already exists between these two
      const { data: myParts } = await supabase
        .from("conversation_participants")
        .select("conversation_id, conversation:conversations!inner(kind)")
        .eq("employee_id", employee.id);
      const myDmConvIds = (myParts || [])
        .filter((p) => p.conversation?.kind === "staff_dm")
        .map((p) => p.conversation_id);
      let foundConvId = null;
      if (myDmConvIds.length > 0) {
        const { data: theirParts } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("employee_id", other.id)
          .in("conversation_id", myDmConvIds);
        if (theirParts && theirParts.length > 0)
          foundConvId = theirParts[0].conversation_id;
      }
      if (foundConvId) {
        onPicked(foundConvId, other.name);
        return;
      }
      // Create a new conversation
      const { data: conv, error } = await supabase
        .from("conversations")
        .insert({ kind: "staff_dm" })
        .select()
        .single();
      if (error) throw error;
      await supabase.from("conversation_participants").insert([
        { conversation_id: conv.id, employee_id: employee.id },
        { conversation_id: conv.id, employee_id: other.id },
      ]);
      onPicked(conv.id, other.name);
    } catch (e) {
      alert("Could not start DM: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const filtered = search
    ? staff.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : staff;

  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100"
        >
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div className="font-serif text-xl text-stone-900">
          New direct message
        </div>
      </div>
      <div className="px-5 pt-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search staff…"
          className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white mb-4"
        />
        <div className="space-y-1">
          {filtered.map((s) => (
            <button
              key={s.id}
              disabled={busy}
              onClick={() => startDm(s)}
              className="w-full text-left px-4 py-3 rounded-xl hover:bg-stone-50 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-sm font-medium text-stone-700">
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-stone-900">{s.name}</div>
                  <div className="text-xs text-stone-500 font-mono uppercase tracking-wider">
                    {s.role}
                  </div>
                </div>
              </div>
              <ChevronRight size={16} className="text-stone-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =================================================================
// NEW PROPERTY THREAD PICKER — owner/manager picks a property to
// start a property_thread conversation. If a thread already exists
// for that property, opens it; otherwise creates a fresh one.
// =================================================================
function NewPropertyThreadPicker({ employee, onBack, onPicked }) {
  const [properties, setProperties] = useState([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name, address")
        .eq("active", true)
        .order("name");
      setProperties(visibleProps(data, employee));
      setLoaded(true);
    })();
  }, []);

  const startThread = async (property) => {
    setBusy(true);
    try {
      // Check if a property_thread already exists for this property
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("kind", "property_thread")
        .eq("customer_id", property.id)
        .maybeSingle();
      let convId = existing?.id;
      if (!convId) {
        // Create a new property_thread conversation
        const { data: conv, error } = await supabase
          .from("conversations")
          .insert({ kind: "property_thread", customer_id: property.id })
          .select()
          .single();
        if (error) throw error;
        convId = conv.id;
        // Add the current employee as a participant (so last_read_at tracks for them)
        await supabase.from("conversation_participants").insert({
          conversation_id: convId,
          employee_id: employee.id,
        });
      } else {
        // Make sure the current employee is a participant
        const { data: part } = await supabase
          .from("conversation_participants")
          .select("id")
          .eq("conversation_id", convId)
          .eq("employee_id", employee.id)
          .maybeSingle();
        if (!part) {
          await supabase.from("conversation_participants").insert({
            conversation_id: convId,
            employee_id: employee.id,
          });
        }
      }
      onPicked(convId, property.name);
    } catch (e) {
      alert("Could not start thread: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const filtered = search
    ? properties.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
      )
    : properties;

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100"
          disabled={busy}
        >
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
            New thread
          </div>
          <div className="font-serif text-xl text-stone-900">
            Pick a property
          </div>
        </div>
      </div>

      <div className="px-5 pt-6 max-w-2xl mx-auto w-full">
        {properties.length >= 6 && (
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${properties.length} properties…`}
            className="w-full mb-4 px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 text-sm"
          />
        )}

        {!loaded ? (
          <Splash text="Loading…" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            {search ? `No properties match "${search}".` : "No properties yet."}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => startThread(p)}
                disabled={busy}
                className="w-full text-left p-4 rounded-2xl bg-white border border-stone-200 hover:border-amber-500 transition-colors active:scale-[0.99] disabled:opacity-50 flex items-center gap-3"
              >
                <Building2 size={18} className="text-amber-700 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-base text-stone-900 truncate">
                    {p.name}
                  </div>
                  {p.address && (
                    <div className="text-xs text-stone-500">
                      <AddressLink address={p.address} />
                    </div>
                  )}
                </div>
                <ChevronRight
                  size={16}
                  className="text-stone-400 flex-shrink-0"
                />
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-stone-500 mt-6 text-center">
          Messages here are visible to all PMs &amp; property owners assigned to
          this property.
        </p>
      </div>
    </div>
  );
}

// ---- The conversation/thread view ----
function MessageThread({
  conversationId,
  otherName,
  asEmployee = null,
  asPmCustomer = null,
  pmActorKind = null,
  isPropertyThread = false,
  propertyName,
  onBack,
}) {
  const [messages, setMessages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [zoomPhoto, setZoomPhoto] = useState(null);
  const [urgent, setUrgent] = useState(false); // urgent flag for next message
  const scrollRef = useRef(null);

  const load = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*, sender:employees(id, name)")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    setLoaded(true);
    // Mark conversation as read for this person
    if (asEmployee) {
      // For DMs they're already a participant. For property threads, owners/managers
      // may not have a row yet — upsert so the read state actually persists.
      const nowIso = new Date().toISOString();
      const { error: updErr } = await supabase
        .from("conversation_participants")
        .update({ last_read_at: nowIso })
        .eq("conversation_id", conversationId)
        .eq("employee_id", asEmployee.id);
      // If no row was updated (property thread, first time opening), insert one
      if (isPropertyThread) {
        await supabase.from("conversation_participants").upsert(
          {
            conversation_id: conversationId,
            employee_id: asEmployee.id,
            last_read_at: nowIso,
          },
          { onConflict: "conversation_id,employee_id" },
        );
      }
    } else if (asPmCustomer) {
      await supabase
        .from("customers")
        .update({ pm_last_read_at: new Date().toISOString() })
        .eq("id", asPmCustomer.id);
    }
    setTimeout(
      () =>
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        }),
      50,
    );
  };

  useEffect(() => {
    load();
  }, [conversationId]);

  // Realtime subscription for new messages in this conversation
  useEffect(() => {
    const channel = supabase
      .channel("msg-" + conversationId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => load(),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const send = async () => {
    if (sending) return;
    if (!text.trim() && !photoFile) {
      setError("Type a message or attach a photo.");
      return;
    }
    setError("");
    setSending(true);
    try {
      let photoUrl = null,
        photoPath = null;
      if (photoFile) {
        const r = await uploadMessagePhoto(photoFile, conversationId);
        photoUrl = r.publicUrl;
        photoPath = r.path;
      }
      const insert = {
        conversation_id: conversationId,
        content: text.trim() || null,
        photo_url: photoUrl,
        photo_path: photoPath,
        urgent: !!urgent,
      };
      if (asEmployee) {
        insert.sender_employee_id = asEmployee.id;
        insert.sender_is_pm = false;
      } else {
        insert.sender_employee_id = null;
        insert.sender_is_pm = true;
        insert.pm_actor_kind = pmActorKind || "pm";
      }
      const { error: e } = await supabase.from("messages").insert(insert);
      if (e) throw e;
      // Bell notification for a 1-on-1 staff DM — tell the OTHER participant
      // there's a new message. (Property threads are a broadcast with a
      // lazily-built participant list, so those aren't notified here; the
      // existing unread badge still covers them.)
      if (asEmployee) {
        try {
          const { data: conv } = await supabase
            .from("conversations")
            .select("kind")
            .eq("id", conversationId)
            .maybeSingle();
          if (conv?.kind === "staff_dm") {
            const { data: parts } = await supabase
              .from("conversation_participants")
              .select("employee_id")
              .eq("conversation_id", conversationId);
            (parts || []).forEach((p) => {
              if (p.employee_id && p.employee_id !== asEmployee.id)
                createNotification({
                  to: { employeeId: p.employee_id },
                  kind: "message",
                  title: `New message from ${asEmployee.name}`,
                  body: (text.trim() || (photoUrl ? "📷 Photo" : "")).slice(
                    0,
                    120,
                  ),
                  linkKind: "conversation",
                  linkId: conversationId,
                  createdBy: asEmployee.id,
                });
            });
          }
        } catch (notifyErr) {
          console.warn("[notify] dm notify skipped", notifyErr);
        }
      }
      setText("");
      setPhotoFile(null);
      setUrgent(false);
      // load() will be triggered by realtime, but call it anyway for instant response
      load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (m) => {
    if (!confirm("Delete this message? This cannot be undone.")) return;
    if (m.photo_path) await deleteMessagePhoto(m.photo_path);
    await supabase.from("messages").delete().eq("id", m.id);
    // Realtime will refresh
  };

  // Decide who counts as "me" for bubble alignment
  const isMine = (m) => {
    if (asEmployee) return m.sender_employee_id === asEmployee.id;
    if (asPmCustomer) return m.sender_is_pm === true;
    return false;
  };

  // Decide the displayed sender name
  const senderName = (m) => {
    if (m.sender_is_pm) {
      return m.pm_actor_kind === "pm_staff"
        ? "Property manager · staff"
        : "Property manager";
    }
    if (!isPropertyThread) return m.sender?.name || "Unknown";
    // Property thread + staff sender → show as Summit Clean to the PM
    if (asPmCustomer) return "Summit Clean";
    // Property thread + viewing as staff → show real name
    return m.sender?.name || "Summit Clean";
  };

  return (
    <div
      className="flex flex-col bg-stone-50"
      style={{ height: "100dvh", maxHeight: "100dvh" }}
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200 bg-white flex-shrink-0">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100"
        >
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div className="flex-1 min-w-0">
          {isPropertyThread && (
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              Property thread
            </div>
          )}
          <div className="font-serif text-xl text-stone-900 truncate">
            {otherName}
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ minHeight: 0 }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
          {!loaded ? (
            <div className="text-center text-stone-400 text-sm">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-stone-400 text-sm py-12">
              No messages yet. Say hi!
            </div>
          ) : (
            messages.map((m) => {
              const mine = isMine(m);
              const isUrgent = !!m.urgent;
              const bubbleClass = isUrgent
                ? mine
                  ? "bg-amber-600 text-white border border-amber-700"
                  : "bg-amber-50 border-2 border-amber-400 text-amber-950"
                : mine
                  ? "bg-stone-900 text-stone-50"
                  : "bg-white border border-stone-200 text-stone-900";
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col`}
                  >
                    {!mine && (
                      <div className="text-[10px] font-mono text-stone-500 mb-0.5 px-1">
                        {senderName(m)}
                      </div>
                    )}
                    {isUrgent && (
                      <div
                        className={`flex items-center gap-1 mb-0.5 px-1 text-[10px] font-mono uppercase tracking-wider ${mine ? "text-amber-700" : "text-amber-700"}`}
                      >
                        <AlertCircle size={10} /> Urgent
                      </div>
                    )}
                    <div className={`px-3 py-2 rounded-2xl ${bubbleClass}`}>
                      {m.photo_url && (
                        <button
                          onClick={() => setZoomPhoto(m.photo_url)}
                          className="block mb-1"
                        >
                          <img
                            src={m.photo_url}
                            alt=""
                            loading="lazy"
                            className="rounded-xl max-w-full max-h-60 object-cover"
                          />
                        </button>
                      )}
                      {m.content && (
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {m.content}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 px-1">
                      <div className="text-[10px] font-mono text-stone-400">
                        {fmtClock(m.created_at)}
                      </div>
                      {mine && (
                        <button
                          onClick={() => deleteMessage(m)}
                          className="text-[10px] font-mono text-stone-400 hover:text-red-600"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-sm flex items-center gap-2 flex-shrink-0">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {photoFile && (
        <div className="px-4 py-2 bg-stone-100 border-t border-stone-200 flex items-center gap-2 flex-shrink-0">
          <ImageIcon size={16} className="text-stone-600" />
          <span className="text-xs text-stone-700 flex-1 truncate">
            {photoFile.name}
          </span>
          <button
            onClick={() => setPhotoFile(null)}
            className="p-1 rounded-full hover:bg-stone-200"
          >
            <X size={14} className="text-stone-600" />
          </button>
        </div>
      )}

      <div
        className="border-t border-stone-200 bg-white flex-shrink-0"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {urgent && (
          <div className="px-4 py-2 bg-amber-100 border-t border-amber-200 flex items-center gap-2 flex-shrink-0">
            <AlertCircle size={14} className="text-amber-700 flex-shrink-0" />
            <span className="text-xs text-amber-900 flex-1">
              This message will be sent as{" "}
              <span className="font-bold">urgent</span>.
            </span>
            <button
              onClick={() => setUrgent(false)}
              className="text-[10px] text-amber-700 hover:text-amber-900 font-mono uppercase tracking-wider"
            >
              Cancel
            </button>
          </div>
        )}
        <div className="px-4 py-3 max-w-2xl mx-auto flex items-end gap-2">
          <label className="p-2 rounded-full hover:bg-stone-100 cursor-pointer flex-shrink-0">
            <Camera size={20} className="text-stone-600" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPhotoFile(f);
              }}
            />
          </label>
          <button
            onClick={() => setUrgent((u) => !u)}
            type="button"
            title={
              urgent
                ? "Urgent flag enabled — tap to turn off"
                : "Mark this message as urgent"
            }
            className={`p-2 rounded-full flex-shrink-0 transition-colors ${urgent ? "bg-amber-600 hover:bg-amber-700 text-white" : "hover:bg-stone-100 text-stone-600"}`}
          >
            <AlertCircle size={20} />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            placeholder={
              urgent ? "Type your urgent message…" : "Type a message…"
            }
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            onFocus={(e) => {
              // Scroll the input into view after the iOS keyboard animation
              setTimeout(() => {
                try {
                  e.target.scrollIntoView({ block: "end", behavior: "smooth" });
                } catch {}
              }, 300);
            }}
            style={{ fontSize: 16 }}
            className={`flex-1 px-3 py-2 rounded-xl border bg-white resize-none max-h-32 ${urgent ? "border-amber-400 focus:border-amber-600" : "border-stone-300"}`}
          />
          <button
            onClick={send}
            disabled={sending || (!text.trim() && !photoFile)}
            className={`p-2.5 rounded-full text-stone-50 disabled:opacity-40 flex-shrink-0 ${urgent ? "bg-amber-600 hover:bg-amber-700" : "bg-stone-900"}`}
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-stone-50 border-t-transparent rounded-full animate-spin" />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>
        </div>
      </div>

      {zoomPhoto && (
        <div
          className="fixed inset-0 bg-stone-900/95 z-50 flex flex-col"
          onClick={() => setZoomPhoto(null)}
        >
          <div className="flex justify-end p-4">
            <button className="p-2 rounded-full bg-stone-800">
              <X size={20} className="text-stone-50" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <img src={zoomPhoto} alt="" className="w-full h-auto rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}

// ---- PM-side Messages tab ----
export function PortalMessagesTab({
  property,
  portalKind,
  onClose,
  onPropertyRefresh,
}) {
  const [conversationId, setConversationId] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      // Find or create the property thread for this property
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("customer_id", property.id)
        .eq("kind", "property_thread")
        .maybeSingle();
      if (existing) {
        setConversationId(existing.id);
      } else {
        const { data: created } = await supabase
          .from("conversations")
          .insert({ kind: "property_thread", customer_id: property.id })
          .select()
          .single();
        if (created) setConversationId(created.id);
      }
      setLoaded(true);
    })();
  }, [property.id]);

  if (!loaded)
    return (
      <div className="px-5 pt-6">
        <Splash text="Loading…" />
      </div>
    );
  if (!conversationId)
    return (
      <div className="px-5 pt-6 text-stone-400">Could not load messages.</div>
    );

  const handleBack =
    onClose || (() => onPropertyRefresh && onPropertyRefresh());

  return (
    <MessageThread
      conversationId={conversationId}
      otherName="Summit Clean team"
      asPmCustomer={property}
      pmActorKind={portalKind || "pm"}
      isPropertyThread={true}
      propertyName={property.name}
      onBack={handleBack}
    />
  );
}
