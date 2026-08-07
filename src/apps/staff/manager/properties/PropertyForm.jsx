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
import { BedBathPicker } from "../../../../App.jsx";
import { PortalUserAssignmentSection } from "../properties/PortalUserAssignmentSection.jsx";

export function PropertyForm({
  property,
  currentUserRole,
  onCancel,
  onSaved,
  onManageAssignments,
}) {
  const isNew = !property;
  const [name, setName] = useState(property?.name || "");
  const [address, setAddress] = useState(property?.address || "");
  const [notes, setNotes] = useState(property?.notes || "");
  const [type, setType] = useState(property?.property_type || "simple");
  const [billMode, setBillMode] = useState(property?.bill_mode || "hourly");
  const [hourlyRate, setHourlyRate] = useState(
    property?.bill_rate_hourly?.toString() || "",
  );
  const [flatAmount, setFlatAmount] = useState(
    property?.flat_rate_amount?.toString() || "",
  );
  const [portalCode, setPortalCode] = useState(property?.portal_code || "");
  const [staffPortalCode, setStaffPortalCode] = useState(
    property?.staff_portal_code || "",
  );
  const [portalStartDate, setPortalStartDate] = useState(
    property?.portal_start_date || "",
  );
  const [active, setActive] = useState(property?.active ?? true);
  const [bedrooms, setBedrooms] = useState(property?.bedrooms ?? null);
  const [bathrooms, setBathrooms] = useState(property?.bathrooms ?? null);
  // Which assignment-upload styles THIS property's PM can see in their portal.
  const [pmMethods, setPmMethods] = useState(
    property?.pm_upload_methods || {
      quick: false,
      checklist: true,
      legacy: false,
    },
  );
  const togglePmMethod = (k) =>
    setPmMethods((m) => ({ ...(m || {}), [k]: !(m || {})[k] }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canEditMoney = currentUserRole === "owner";

  // Portal user assignment: load all portal users + which ones are
  // currently assigned to this property (for edit mode). For new
  // properties, the set starts empty.
  const [allPortalUsers, setAllPortalUsers] = useState([]);
  const [assignedPortalUserIds, setAssignedPortalUserIds] = useState(new Set());
  const [portalSearch, setPortalSearch] = useState("");
  const [portalLoaded, setPortalLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: users } = await supabase
        .from("portal_users")
        .select("id, name, kind, active, code")
        .order("name");
      if (cancelled) return;
      setAllPortalUsers(users || []);
      if (property?.id) {
        const { data: links } = await supabase
          .from("portal_user_properties")
          .select("portal_user_id")
          .eq("property_id", property.id);
        if (cancelled) return;
        setAssignedPortalUserIds(
          new Set((links || []).map((l) => l.portal_user_id)),
        );
      }
      setPortalLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [property?.id]);

  const togglePortalUser = (pid) => {
    setAssignedPortalUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };
  useEffect(() => {
    // No restriction — both bill modes are valid for both property types.
  }, [type, billMode]);

  // Generate a memorable portal code: word + 4 digits
  const generatePortalCode = () => {
    const words = [
      "sunset",
      "meadow",
      "cedar",
      "river",
      "maple",
      "ridge",
      "vista",
      "grove",
      "summit",
      "aspen",
      "willow",
      "birch",
    ];
    const w = words[Math.floor(Math.random() * words.length)];
    const n = String(Math.floor(1000 + Math.random() * 9000));
    setPortalCode(`${w}${n}`);
  };
  const generateStaffCode = () => {
    const words = [
      "team",
      "crew",
      "squad",
      "help",
      "support",
      "assist",
      "field",
      "site",
      "staff",
      "group",
    ];
    const w = words[Math.floor(Math.random() * words.length)];
    const n = String(Math.floor(1000 + Math.random() * 9000));
    setStaffPortalCode(`${w}${n}`);
  };
  const save = async () => {
    setError("");
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    const cleanPortal = portalCode.trim().toLowerCase() || null;
    const cleanStaff = staffPortalCode.trim().toLowerCase() || null;
    // Sanity: codes can't equal each other on the same property
    if (cleanPortal && cleanStaff && cleanPortal === cleanStaff) {
      setError("PM code and staff code must be different.");
      return;
    }
    setBusy(true);
    const payload = {
      name: name.trim(),
      address: address.trim() || null,
      notes: notes.trim() || null,
      property_type: type,
      bill_mode: billMode,
      bill_rate_hourly:
        billMode === "hourly" && hourlyRate ? parseFloat(hourlyRate) : null,
      flat_rate_amount:
        billMode === "flat" && flatAmount ? parseFloat(flatAmount) : null,
      portal_code: cleanPortal,
      staff_portal_code: cleanStaff,
      portal_start_date: portalStartDate || null,
      bedrooms: type === "simple" ? bedrooms : null,
      bathrooms: type === "simple" ? bathrooms : null,
      pm_upload_methods: pmMethods,
      active,
    };
    let savedRow = null;
    if (isNew) {
      const { data, error: e } = await supabase
        .from("customers")
        .insert(payload)
        .select()
        .single();
      if (e) {
        setBusy(false);
        setError(
          e.message.includes("duplicate") &&
            (e.message.includes("portal_code") ||
              e.message.includes("staff_portal_code"))
            ? "That code is already in use by another property — pick another."
            : e.message,
        );
        return;
      }
      savedRow = data;
    } else {
      const { error: e } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", property.id);
      if (e) {
        setBusy(false);
        setError(
          e.message.includes("duplicate") &&
            (e.message.includes("portal_code") ||
              e.message.includes("staff_portal_code"))
            ? "That code is already in use by another property — pick another."
            : e.message,
        );
        return;
      }
      savedRow = { ...property, ...payload };
    }

    // Sync portal user assignments: insert all checked links, delete unchecked ones.
    // For new properties: just insert. For edits: clear then re-insert (idempotent + simple).
    if (savedRow?.id) {
      try {
        await supabase
          .from("portal_user_properties")
          .delete()
          .eq("property_id", savedRow.id);
        if (assignedPortalUserIds.size > 0) {
          const rows = Array.from(assignedPortalUserIds).map((uid) => ({
            portal_user_id: uid,
            property_id: savedRow.id,
          }));
          await supabase.from("portal_user_properties").insert(rows);
        }
      } catch (linkErr) {
        // Property saved fine, but portal links failed — log and continue
        console.warn("[PropertyForm] portal user link sync failed:", linkErr);
      }
    }

    setBusy(false);
    onSaved(savedRow);
  };
  const remove = async () => {
    if (
      !confirm(
        `Delete "${property.name}"? All units, parties, and shift history will be removed.`,
      )
    )
      return;
    setBusy(true);
    const { error: e } = await supabase
      .from("customers")
      .delete()
      .eq("id", property.id);
    setBusy(false);
    if (e) {
      alert("Could not delete: " + e.message);
      return;
    }
    onSaved();
  };
  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button
          onClick={onCancel}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100"
        >
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
            {isNew ? "Add" : "Edit"} property
          </div>
          <div className="font-serif text-xl text-stone-900">
            {isNew ? "New property" : property.name}
          </div>
        </div>
      </div>
      <div className="px-5 pt-6 space-y-5">
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Property name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sunset Apartments"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setType("simple")}
              type="button"
              className={`p-3 rounded-xl border-2 text-left ${type === "simple" ? "border-stone-900 bg-white" : "border-stone-200 bg-white/50"}`}
            >
              <div className="font-medium text-stone-900 text-sm">Simple</div>
              <div className="text-xs text-stone-500">One bill, one place</div>
            </button>
            <button
              onClick={() => setType("multi_unit")}
              type="button"
              className={`p-3 rounded-xl border-2 text-left ${type === "multi_unit" ? "border-stone-900 bg-white" : "border-stone-200 bg-white/50"}`}
            >
              <div className="font-medium text-stone-900 text-sm">
                Multi-unit
              </div>
              <div className="text-xs text-stone-500">
                Apartments with bedrooms
              </div>
            </button>
          </div>
        </div>
        {type === "simple" && (
          <div className="p-4 rounded-2xl bg-white border border-stone-200">
            <div className="flex items-center gap-2 mb-3">
              <Home size={14} className="text-stone-500" />
              <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
                Layout
              </div>
            </div>
            <p className="text-[11px] text-stone-500 -mt-2 mb-3">
              Helps cleaners know what they're walking into. Skip if you'll set
              this per-unit later.
            </p>
            <BedBathPicker
              bedrooms={bedrooms}
              bathrooms={bathrooms}
              onChange={({ bedrooms: bd, bathrooms: ba }) => {
                setBedrooms(bd);
                setBathrooms(ba);
              }}
            />
          </div>
        )}

        <PortalUserAssignmentSection
          portalUsers={allPortalUsers}
          assignedIds={assignedPortalUserIds}
          loaded={portalLoaded}
          search={portalSearch}
          setSearch={setPortalSearch}
          onToggle={togglePortalUser}
          onUserCreated={(user) => {
            // Add the new user to the list AND auto-check them
            setAllPortalUsers((prev) =>
              [...prev, user].sort((a, b) =>
                (a.name || "").localeCompare(b.name || ""),
              ),
            );
            setAssignedPortalUserIds((prev) => new Set(prev).add(user.id));
          }}
        />

        {canEditMoney && (
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
              Bill mode
            </label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => setBillMode("hourly")}
                type="button"
                className={`p-3 rounded-xl border-2 text-left ${billMode === "hourly" ? "border-stone-900 bg-white" : "border-stone-200 bg-white/50"}`}
              >
                <div className="font-medium text-stone-900 text-sm">Hourly</div>
              </button>
              <button
                onClick={() => setBillMode("flat")}
                type="button"
                className={`p-3 rounded-xl border-2 text-left ${billMode === "flat" ? "border-stone-900 bg-white" : "border-stone-200 bg-white/50"}`}
              >
                <div className="font-medium text-stone-900 text-sm">
                  Flat rate
                </div>
              </button>
            </div>
            {billMode === "hourly" ? (
              <div>
                <label className="text-xs text-stone-600 mb-1 block">
                  $ per hour
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="47.50"
                  className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs text-stone-600 mb-1 block">
                  Flat amount per shift
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={flatAmount}
                  onChange={(e) => setFlatAmount(e.target.value)}
                  placeholder="200.00"
                  className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono"
                />
              </div>
            )}
          </div>
        )}
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Pine St, Draper, UT"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Gate code, contact info…"
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 resize-none"
          />
        </div>

        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
          <div className="flex items-baseline justify-between mb-2">
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              Property manager portal code
            </label>
            <button
              type="button"
              onClick={generatePortalCode}
              className="text-xs font-mono text-amber-700 hover:text-amber-800"
            >
              Generate
            </button>
          </div>
          <input
            type="text"
            value={portalCode}
            onChange={(e) =>
              setPortalCode(
                e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""),
              )
            }
            placeholder="e.g. sunset2024 (lowercase letters & numbers only)"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono"
          />
          <p className="text-xs text-stone-500 mt-2">
            {portalCode ? (
              <>
                Share this code with the property manager. They can sign in at{" "}
                <code className="font-mono bg-white px-1.5 py-0.5 rounded">
                  /#/portal
                </code>{" "}
                to see cleaning photos. Leave empty to disable portal access.
              </>
            ) : (
              <>
                Optional. If set, the property manager can sign in at{" "}
                <code className="font-mono bg-white px-1.5 py-0.5 rounded">
                  /#/portal
                </code>{" "}
                with this code to see cleaning photos for this property only.
              </>
            )}
          </p>

          {/* Portal start date — only show if portal is enabled */}
          {portalCode && (
            <div className="mt-4 pt-4 border-t border-stone-200">
              <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
                Portal start date (optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={portalStartDate}
                  onChange={(e) => setPortalStartDate(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono"
                />
                {portalStartDate && (
                  <button
                    type="button"
                    onClick={() => setPortalStartDate("")}
                    className="px-3 rounded-xl border border-stone-300 bg-white text-stone-500 text-sm hover:bg-stone-100"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-2">
                {portalStartDate ? (
                  <>
                    The property manager will only see cleanings from{" "}
                    <strong>
                      {new Date(
                        portalStartDate + "T12:00:00",
                      ).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </strong>{" "}
                    forward.
                  </>
                ) : (
                  <>
                    If set, only cleanings from this date forward will be
                    visible to the property manager. Useful for hiding old test
                    data or starting fresh with a new client.
                  </>
                )}
              </p>
            </div>
          )}

          {/* Which upload styles this property's PM sees in their portal. */}
          {portalCode && (
            <div className="mt-4 pt-4 border-t border-stone-200">
              <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-1 block">
                PM assignment uploads
              </label>
              <p className="text-xs text-stone-500 mb-2">
                Pick which ways this property's PM can create assignments in
                their portal. Off = hidden from them.
              </p>
              <div className="space-y-2">
                {[
                  {
                    k: "quick",
                    label: "Quick assignment",
                    desc: "Fast builder — no cleaner picker. Lands as a draft for your approval.",
                  },
                  {
                    k: "checklist",
                    label: "Checklist wizard",
                    desc: 'The structured "New assignment" with bedroom items.',
                  },
                  {
                    k: "legacy",
                    label: "Legacy file upload",
                    desc: "Upload a file or photo as the source.",
                  },
                ].map((m) => (
                  <button
                    type="button"
                    key={m.k}
                    onClick={() => togglePmMethod(m.k)}
                    className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 text-left transition-colors ${pmMethods?.[m.k] ? "border-emerald-400 bg-emerald-50" : "border-stone-200 bg-white"}`}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-stone-900">
                        {m.label}
                      </span>
                      <span className="block text-[11px] text-stone-500">
                        {m.desc}
                      </span>
                    </span>
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border-2 ${pmMethods?.[m.k] ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-stone-300"}`}
                    >
                      {pmMethods?.[m.k] && <Check size={13} />}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PM staff code — separate sign-in for the PM's assistants */}
          {portalCode && (
            <div className="mt-4 pt-4 border-t border-stone-200">
              <div className="flex items-baseline justify-between mb-2">
                <label className="text-xs uppercase tracking-wider text-stone-500 font-mono">
                  PM staff code (optional)
                </label>
                <button
                  type="button"
                  onClick={generateStaffCode}
                  className="text-xs font-mono text-amber-700 hover:text-amber-800"
                >
                  Generate
                </button>
              </div>
              <input
                type="text"
                value={staffPortalCode}
                onChange={(e) =>
                  setStaffPortalCode(
                    e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""),
                  )
                }
                placeholder="e.g. team1234 (lowercase letters & numbers only)"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono"
              />
              <p className="text-xs text-stone-500 mt-2">
                {staffPortalCode ? (
                  <>
                    Share this with the PM's staff/assistants. They sign in the
                    same way but their actions are tagged "PM staff" in your
                    inbox.
                  </>
                ) : (
                  <>
                    Optional. If set, the PM's assistants can sign in to the
                    same property portal with this separate code. Their actions
                    are tagged "PM staff" so you can tell who did what.
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium text-stone-900 text-sm">Active</div>
              <div className="text-xs text-stone-500">
                Inactive properties don't show in the picker
              </div>
            </div>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-5 h-5 rounded accent-stone-900"
            />
          </label>
        </div>
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <button
          onClick={save}
          disabled={busy}
          className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 disabled:opacity-50"
        >
          {busy ? "Saving…" : isNew ? "Add property" : "Save changes"}
        </button>
        {!isNew && type === "multi_unit" && (
          <button
            onClick={() => onSaved()}
            className="w-full py-3 rounded-2xl bg-amber-100 text-amber-900 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Layers size={14} /> Manage units &amp; parties
          </button>
        )}
        {!isNew && onManageAssignments && (
          <button
            onClick={onManageAssignments}
            className="w-full py-3 rounded-2xl bg-white border-2 border-stone-300 text-stone-800 text-sm font-medium flex items-center justify-center gap-2 hover:border-stone-900"
          >
            <FileText size={14} /> Manage assignments
          </button>
        )}
        {!isNew && (
          <button
            onClick={remove}
            disabled={busy}
            className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Trash2 size={14} /> Delete property
          </button>
        )}
      </div>
    </div>
  );
}
