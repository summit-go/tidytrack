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
import { ChangePortalCodeModal } from "./ChangePortalCodeModal.jsx";
import { PortalAssignmentsTab } from "./PortalAssignmentsTab.jsx";
import { PortalHistoryTab } from "./PortalHistoryTab.jsx";
import { PortalInvoicesTab } from "./PortalInvoicesTab.jsx";
import { PortalLangToggle } from "./PortalLangToggle.jsx";
import { PortalMenuSheet } from "./PortalMenuSheet.jsx";
import { PortalMessagesTab } from "../../features/messaging/PortalMessagesTab.jsx";
import { PortalPhotoUploadTab } from "./PortalPhotoUploadTab.jsx";
import { PortalScheduleTab } from "./PortalScheduleTab.jsx";
import { PortalTeamModal } from "./PortalTeamModal.jsx";
import { WelcomeModal } from "../cross-cutting/WelcomeModal.jsx";

export function PortalHome({
  property,
  portalKind,
  portalUser,
  properties,
  onSwitchProperty,
  hasMultipleProperties,
  onBackToPicker,
  onSignOut,
  onRefreshProperty,
  onOpenUnitDay,
  tab: tabProp,
  setTab: setTabProp,
  asgSub: asgSubProp,
  setAsgSub: setAsgSubProp,
  filter: filterProp,
  setFilter: setFilterProp,
  schedRecentOpen,
  setSchedRecentOpen,
}) {
  // Tab state is owned by PortalDashboard when it passes it down, so a trip
  // into a unit-day and back returns the PM to where they were. The local
  // fallbacks keep this component standalone if it's ever mounted directly.
  const [ownTab, setOwnTab] = useState("history"); // 'history' | 'assignments'
  const [ownAsgSub, setOwnAsgSub] = useState("requests"); // 'requests' | 'schedule' | 'concerns'
  const tab = tabProp !== undefined ? tabProp : ownTab;
  const setTab = setTabProp || setOwnTab;
  const asgSub = asgSubProp !== undefined ? asgSubProp : ownAsgSub;
  const setAsgSub = setAsgSubProp || setOwnAsgSub;
  // Per-PM invoice access. Owners/managers viewing the portal (preview) and
  // anyone with the can_view_invoices flag get the Invoices tab. A previewing
  // owner (__preview) always sees it so they can check what a PM would.
  const canViewInvoices =
    !!portalUser?.can_view_invoices || !!portalUser?.__preview;
  // If invoices was the persisted tab but this user can't see it, fall back.
  useEffect(() => {
    if (tab === "invoices" && !canViewInvoices) setTab("history");
    /* eslint-disable-next-line */
  }, [tab, canViewInvoices]);
  const [groups, setGroups] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [ownFilter, setOwnFilter] = useState("7d");
  const filter = filterProp !== undefined ? filterProp : ownFilter;
  const setFilter = setFilterProp || setOwnFilter;
  const [showWelcome, setShowWelcome] = useState(false);
  const [showChangeCode, setShowChangeCode] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const pmUnread = useUnreadCount({ customer: property });
  const isPmStaff = portalKind === "pm_staff";

  // Show welcome modal on first sign-in for this property.
  // We track per-property since one PM might manage multiple properties.
  useEffect(() => {
    try {
      const key = `tt_pm_welcomed_${property.id}`;
      if (!localStorage.getItem(key)) setShowWelcome(true);
    } catch {}
  }, [property.id]);

  const dismissWelcome = () => {
    try {
      localStorage.setItem(`tt_pm_welcomed_${property.id}`, "1");
    } catch {}
    setShowWelcome(false);
  };

  useEffect(() => {
    (async () => {
      if (tab !== "history") return;
      setLoaded(false);
      const days = filter === "7d" ? 7 : filter === "30d" ? 30 : 365;
      let since = new Date(
        Date.now() - days * 24 * 60 * 60 * 1000,
      ).toISOString();
      if (property.portal_start_date) {
        const portalStart = `${property.portal_start_date}T00:00:00Z`;
        if (portalStart > since) since = portalStart;
      }
      console.log(
        "[Portal] filtering from:",
        since,
        "| portal_start_date:",
        property.portal_start_date,
      );

      if (property.property_type === "multi_unit") {
        // Pull both: work_blocks in window, AND the current status of every
        // assignment_target for this property. PMs should only see units
        // where (a) real work happened (at least one task or photo) AND
        // (b) the assignment for that unit/bedroom is currently in 'done'
        // status. Reset back to pending → instantly removed from PM view.
        // Scope the done-targets query to THIS property's units and paginate
        // it — otherwise PostgREST's 1000-row cap on a global done-targets
        // query drops this property's cleans (they fall past the cap when a
        // busy property has thousands of done checklist items).
        const { data: propUnits } = await supabase
          .from("units")
          .select("id")
          .eq("customer_id", property.id);
        const propUnitIds = (propUnits || []).map((u) => u.id);
        const fetchDoneTargets = async () => {
          let rows = [];
          if (propUnitIds.length) {
            const PAGE = 1000;
            for (let from = 0; ; from += PAGE) {
              const { data, error } = await supabase
                .from("assignment_targets")
                .select(
                  "unit_id, party_id, completed_at, unit:units(id, label), assignment:assignments!inner(customer_id, active, deleted_at)",
                )
                .eq("status", "done")
                .in("unit_id", propUnitIds)
                .range(from, from + PAGE - 1);
              if (error || !data) break;
              rows = rows.concat(data);
              if (data.length < PAGE) break;
              if (from > 100000) break;
            }
          }
          // Whole-property (null-unit) done assignments — few, unscoped is fine.
          const { data: plData } = await supabase
            .from("assignment_targets")
            .select(
              "unit_id, party_id, completed_at, unit:units(id, label), assignment:assignments!inner(customer_id, active, deleted_at)",
            )
            .eq("status", "done")
            .is("unit_id", null);
          return rows.concat(plData || []);
        };
        const [{ data: blocks }, doneTargets] = await Promise.all([
          supabase
            .from("work_blocks")
            .select(
              "id, start_time, end_time, unit_id, party_id, unit:units(id, label), shift:shifts!inner(customer_id), tasks(id, photos(kind, resolved_at))",
            )
            .gte("start_time", since)
            .order("start_time", { ascending: false }),
          fetchDoneTargets(),
        ]);

        // Build a Set of "unit_id:party_id" keys that are currently Done.
        // Property-level Done assignments (no unit/party) cover everything
        // under that property, so we track those separately. This is only a
        // gate — history entries themselves come from real work blocks below,
        // so a unit appears on a date only if it was actually cleaned then
        // (not merely marked "done" without anyone clocking in).
        const doneUnitParty = new Set();
        let propertyLevelDone = false;
        (doneTargets || []).forEach((t) => {
          if (t.assignment?.customer_id !== property.id) return;
          if (t.assignment?.active === false || t.assignment?.deleted_at)
            return;
          if (!t.unit_id && !t.party_id) {
            propertyLevelDone = true;
            return;
          }
          doneUnitParty.add(`${t.unit_id || ""}:${t.party_id || ""}`);
          if (t.unit_id && t.party_id) doneUnitParty.add(`${t.unit_id}:`); // also unit-level match
        });

        const byDate = {};

        // Enrich with photos/damage from work blocks for units that are Done.
        const filtered = (blocks || []).filter((b) => {
          if (b.shift?.customer_id !== property.id || !b.unit) return false;
          if (propertyLevelDone) return true;
          const key1 = `${b.unit_id || ""}:${b.party_id || ""}`;
          const key2 = `${b.unit_id || ""}:`;
          return doneUnitParty.has(key1) || doneUnitParty.has(key2);
        });
        filtered.forEach((b) => {
          const date = new Date(b.start_time).toISOString().split("T")[0];
          if (!byDate[date]) byDate[date] = {};
          const u = b.unit;
          if (!byDate[date][u.id])
            byDate[date][u.id] = {
              unitId: u.id,
              label: u.label,
              photoCount: 0,
              hasDamage: false,
              hasResolvedDamage: false,
              hasCannot: false,
              hasResolvedCannot: false,
            };
          (b.tasks || []).forEach((t) =>
            (t.photos || []).forEach((p) => {
              // Track active and resolved damage separately. Active damage drives
              // the red badge; resolved damage powers the "past damage" sub-view.
              if (p.kind === "damage") {
                if (p.resolved_at) byDate[date][u.id].hasResolvedDamage = true;
                else byDate[date][u.id].hasDamage = true;
              }
              if (p.kind === KIND_CANNOT) {
                if (p.resolved_at) byDate[date][u.id].hasResolvedCannot = true;
                else byDate[date][u.id].hasCannot = true;
              }
              byDate[date][u.id].photoCount++;
            }),
          );
        });
        const out = Object.entries(byDate)
          .map(([date, byUnit]) => ({
            date,
            units: Object.values(byUnit).sort((a, b) =>
              naturalCompare(a.label, b.label),
            ),
          }))
          .sort((a, b) => b.date.localeCompare(a.date));
        setGroups(out);
      } else {
        // Simple property — same dual filter (real work + Done assignment),
        // but there's no unit/party granularity so any Done assignment for
        // this property qualifies.
        const [{ data: shifts }, { data: doneTargets }] = await Promise.all([
          supabase
            .from("shifts")
            .select(
              "id, start_time, end_time, tasks(id, photos(kind, resolved_at))",
            )
            .eq("customer_id", property.id)
            .eq("is_preview", false)
            .gte("start_time", since)
            .order("start_time", { ascending: false }),
          supabase
            .from("assignment_targets")
            .select("id, assignment:assignments!inner(customer_id, active)")
            .eq("status", "done"),
        ]);
        const hasDoneAssignment = (doneTargets || []).some(
          (t) =>
            t.assignment?.customer_id === property.id &&
            t.assignment?.active !== false,
        );
        const out = (shifts || [])
          .filter((s) => {
            const hasWork =
              (s.tasks || []).some((t) => (t.photos || []).length > 0) ||
              (s.tasks || []).length > 0;
            return hasWork && hasDoneAssignment;
          })
          .map((s) => {
            let photoCount = 0,
              hasDamage = false,
              hasResolvedDamage = false,
              hasCannot = false,
              hasResolvedCannot = false;
            (s.tasks || []).forEach((t) =>
              (t.photos || []).forEach((p) => {
                photoCount++;
                if (p.kind === "damage") {
                  if (p.resolved_at) hasResolvedDamage = true;
                  else hasDamage = true;
                }
                if (p.kind === KIND_CANNOT) {
                  if (p.resolved_at) hasResolvedCannot = true;
                  else hasCannot = true;
                }
              }),
            );
            return {
              date: new Date(s.start_time).toISOString().split("T")[0],
              units: [
                {
                  unitId: null,
                  label: "Cleaning visit",
                  photoCount,
                  hasDamage,
                  hasResolvedDamage,
                  hasCannot,
                  hasResolvedCannot,
                },
              ],
            };
          });
        setGroups(out);
      }
      setLoaded(true);
    })();
  }, [property.id, filter, tab]);

  // Messages overlay — takes over the whole screen when active
  if (showMessages) {
    return (
      <PortalMessagesTab
        property={property}
        portalKind={portalKind}
        onClose={() => setShowMessages(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-12">
      <div className="bg-stone-900 text-stone-50 px-5 pt-5 pb-6">
        <div className="flex items-center justify-between mb-4 gap-2">
          <button
            onClick={() => setTab("history")}
            className="flex items-center gap-3 active:scale-95 transition-transform min-w-0"
            title="Home"
          >
            <img
              src="https://bbaynvqnbkjyqhzhhypr.supabase.co/storage/v1/object/public/brand/unnamed%20(2).png"
              alt="Summit Clean"
              className="h-10 w-auto object-contain flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs text-stone-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
                {portalKind === "property_owner"
                  ? "Property Owner"
                  : portalKind === "pm_staff"
                    ? "PM Staff"
                    : "Property Manager"}
              </div>
              <div className="text-sm font-serif truncate">{property.name}</div>
            </div>
          </button>
          <div className="flex items-center gap-2 flex-shrink-0">
            <PortalLangToggle portalUser={portalUser} />
            <button
              onClick={() => setShowMessages(true)}
              className="relative p-2 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-50"
              title="Messages"
            >
              <MessageCircle size={16} />
              {pmUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-600 text-white text-[10px] font-mono font-bold flex items-center justify-center border-2 border-stone-900">
                  {pmUnread > 99 ? "99+" : pmUnread}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowMenu(true)}
              className="p-2 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-50"
              title="Menu"
            >
              <Menu size={16} />
            </button>
          </div>
        </div>
        {portalUser?.name && (
          <div className="text-xs text-stone-300 mt-2 font-mono">
            {greetingForTime()},{" "}
            <span className="text-amber-400">
              {portalUser.name.split(" ")[0]}
            </span>
          </div>
        )}
        <h1 className="text-3xl font-light tracking-tight mt-1">
          {property.name}
        </h1>
        {hasMultipleProperties &&
          Array.isArray(properties) &&
          properties.length > 1 &&
          onSwitchProperty && (
            <div className="mt-2 relative inline-flex items-center">
              <select
                value={property.id}
                onChange={(e) => {
                  const p = properties.find((x) => x.id === e.target.value);
                  if (p && p.id !== property.id) onSwitchProperty(p);
                }}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-stone-100 border border-stone-300 text-stone-900 text-xs font-mono cursor-pointer"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <span className="absolute right-2.5 text-stone-500 pointer-events-none text-[10px]">
                ▾
              </span>
            </div>
          )}
        {property.address && (
          <div className="text-sm text-stone-300 mt-1">
            <AddressLink
              address={property.address}
              className="text-amber-400"
            />
          </div>
        )}
        {property.portal_start_date && (
          <div className="text-xs text-amber-400 font-mono mt-2">
            Showing cleanings from{" "}
            {new Date(
              property.portal_start_date + "T12:00:00",
            ).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}{" "}
            forward
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="px-5 pt-4">
        <div className="flex gap-1 bg-stone-100 p-1 rounded-xl">
          <button
            onClick={() => setTab("history")}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium ${tab === "history" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
          >
            History
          </button>
          <button
            onClick={() => setTab("assignments")}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium ${tab === "assignments" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
          >
            Assignments
          </button>
          {canViewInvoices && (
            <button
              onClick={() => setTab("invoices")}
              className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium ${tab === "invoices" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
            >
              Invoices
            </button>
          )}
        </div>
      </div>

      {tab === "history" && (
        <PortalHistoryTab
          property={property}
          groups={groups}
          loaded={loaded}
          filter={filter}
          setFilter={setFilter}
          onOpenUnitDay={onOpenUnitDay}
        />
      )}
      {tab === "assignments" && (
        <div>
          <div className="px-5 pt-3">
            <div className="flex gap-1 bg-stone-100 p-1 rounded-xl">
              <button
                onClick={() => setAsgSub("requests")}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium ${asgSub === "requests" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                Assignments
              </button>
              <button
                onClick={() => setAsgSub("schedule")}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium ${asgSub === "schedule" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                Schedule
              </button>
              <button
                onClick={() => setAsgSub("concerns")}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium ${asgSub === "concerns" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                Concerns
              </button>
            </div>
            <p className="text-[11px] text-stone-400 font-mono mt-2 px-1">
              {asgSub === "requests"
                ? "Request a cleaning for the team."
                : asgSub === "schedule"
                  ? "What's coming up for your property, and what was done recently."
                  : "Send us photos or a message — e.g. a resident complaint or something that needs attention."}
            </p>
          </div>
          {asgSub === "requests" ? (
            <PortalAssignmentsTab
              property={property}
              portalKind={portalKind}
              portalUser={portalUser}
            />
          ) : asgSub === "schedule" ? (
            <PortalScheduleTab
              property={property}
              onOpenUnitDay={onOpenUnitDay}
              recentOpen={schedRecentOpen}
              setRecentOpen={setSchedRecentOpen}
            />
          ) : (
            <PortalPhotoUploadTab property={property} portalKind={portalKind} />
          )}
        </div>
      )}

      {tab === "invoices" && canViewInvoices && (
        <PortalInvoicesTab property={property} />
      )}

      {showWelcome && (
        <WelcomeModal propertyName={property.name} onClose={dismissWelcome} />
      )}
      {showMenu && (
        <PortalMenuSheet
          portalUser={portalUser}
          property={property}
          hasMultipleProperties={hasMultipleProperties}
          portalKind={portalKind}
          isPmStaff={isPmStaff}
          onClose={() => setShowMenu(false)}
          onSwitchProperty={() => {
            setShowMenu(false);
            onBackToPicker && onBackToPicker();
          }}
          onShowWelcome={() => {
            setShowMenu(false);
            setShowWelcome(true);
          }}
          onChangeCode={() => {
            setShowMenu(false);
            setShowChangeCode(true);
          }}
          onShowTeam={() => {
            setShowMenu(false);
            setShowTeam(true);
          }}
          onSignOut={() => {
            setShowMenu(false);
            onSignOut && onSignOut();
          }}
        />
      )}
      {showTeam && (
        <PortalTeamModal
          property={property}
          portalUser={portalUser}
          onClose={() => setShowTeam(false)}
        />
      )}
      {showChangeCode && portalUser && (
        <ChangePortalCodeModal
          portalUser={portalUser}
          onClose={() => setShowChangeCode(false)}
          onSaved={() => {
            setShowChangeCode(false);
            onRefreshProperty && onRefreshProperty();
          }}
        />
      )}
    </div>
  );
}
