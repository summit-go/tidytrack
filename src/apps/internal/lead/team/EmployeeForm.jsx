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
import { ROLE_LEAD, can, canSeeMoney, isLeadOrOwnerRole, isLeadRole, isOwner, normalizeRole, roleForDb, visibleProps } from "../../../../lib/permissions.js";
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

export function EmployeeForm({
  employee,
  currentUserId,
  currentUserRole,
  onCancel,
  onSaved,
}) {
  const isNew = !employee;
  // Build the initial responsibilities map: existing row's value, or defaults based on role.
  const defaultRespForRole = (r) => {
    const all = {};
    CAPABILITIES.forEach((c) => {
      all[c.key] = isLeadRole(r) || r === "owner";
    });
    return all;
  };
  const initialResp = (() => {
    const existing = employee?.responsibilities || {};
    const defaults = defaultRespForRole(employee?.role || "employee");
    return { ...defaults, ...existing };
  })();

  const [name, setName] = useState(employee?.name || "");
  // PIN is never pre-filled — once the table is locked the app can't read
  // it, and showing existing PINs is itself an exposure. Blank on an edit
  // means "leave the PIN unchanged".
  const [pin, setPin] = useState("");
  const [role, setRole] = useState(normalizeRole(employee?.role || "employee"));
  const [active, setActive] = useState(employee?.active ?? true);
  const [phone, setPhone] = useState(employee?.phone || "");
  const [payRate, setPayRate] = useState(
    employee?.pay_rate_hourly != null ? String(employee.pay_rate_hourly) : "",
  );
  const [showPin, setShowPin] = useState(false); // owner reveal of the current PIN
  const [smsOptIn, setSmsOptIn] = useState(employee?.sms_opt_in || false);
  const [notifyMessages, setNotifyMessages] = useState(
    employee?.notification_prefs?.messages !== false,
  );
  const [responsibilities, setResponsibilities] = useState(initialResp);
  // Track whether the user manually edited any toggle, so we don't clobber
  // their choices when they switch roles back and forth.
  const [respDirty, setRespDirty] = useState(false);
  // Remember the role this employee was loaded with, so we can detect
  // when the user actually changes it. Without this, the role-defaults
  // effect would fire on mount and overwrite saved capabilities with
  // empty defaults — which was a real bug that hid existing toggles.
  const initialRoleRef = useRef(normalizeRole(employee?.role || "employee"));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isSelf = employee?.id === currentUserId;
  const canEditOwner = currentUserRole === "owner";
  // Only owners + leads benefit from notification settings (cleaners use the app directly)
  const showNotificationSettings = isLeadOrOwnerRole(role);

  // When the user actually changes the role (and hasn't manually edited
  // toggles), reset the responsibilities to that role's defaults. Skips
  // the initial mount — the loaded values from the row are authoritative
  // on open. Without this guard, opening an employee with custom caps
  // would wipe them on render.
  useEffect(() => {
    if (role === initialRoleRef.current) return; // mount or back-to-original
    if (respDirty) return; // user has already customized
    setResponsibilities(defaultRespForRole(role));
    // eslint-disable-next-line
  }, [role]);

  const toggleResp = (key) => {
    setRespDirty(true);
    setResponsibilities((r) => ({ ...r, [key]: !r[key] }));
  };

  const save = async () => {
    setError("");
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    // New employees must set a PIN; edits may leave it blank to keep the
    // existing one. A provided PIN must be 4 digits.
    const pinProvided = pin.length > 0;
    if (isNew && !pinProvided) {
      setError("Set a 4-digit PIN");
      return;
    }
    if (pinProvided && !/^\d{4}$/.test(pin)) {
      setError("PIN must be exactly 4 digits");
      return;
    }
    // Phone validation: if SMS opt-in, phone is required and must look like a phone number
    const cleanPhone = phone.trim();
    if (smsOptIn && !cleanPhone) {
      setError("Phone number is required to enable SMS notifications.");
      return;
    }
    if (cleanPhone && !/^[\d\s\-\+\(\)\.]{7,20}$/.test(cleanPhone)) {
      setError(
        "Phone number format looks off. Use numbers, +, -, spaces, parens only.",
      );
      return;
    }
    setBusy(true);

    // The row payload no longer includes the PIN — credentials are set
    // server-side by the Edge Function (which hashes and checks
    // uniqueness), so the browser never writes a plaintext PIN.
    const payload = {
      name: name.trim(),
      role: roleForDb(role),
      active,
      phone: cleanPhone || null,
      sms_opt_in: smsOptIn,
      notification_prefs: { messages: notifyMessages },
      responsibilities,
      ...(canEditOwner
        ? { pay_rate_hourly: payRate.trim() ? parseFloat(payRate) : null }
        : {}),
    };
    let empId = employee?.id;
    if (isNew) {
      const { data: created, error: e } = await supabase
        .from("employees")
        .insert(payload)
        .select("id")
        .single();
      if (e) {
        setBusy(false);
        setError(e.message);
        return;
      }
      empId = created?.id;
    } else {
      const { error: e } = await supabase
        .from("employees")
        .update(payload)
        .eq("id", employee.id);
      if (e) {
        setBusy(false);
        setError(e.message);
        return;
      }
    }
    // Set the PIN through the function if one was provided. It hashes and
    // enforces uniqueness server-side; a 409 means the PIN is taken.
    if (pinProvided && empId) {
      const res = await secureSetCredential("employee", empId, pin);
      if (res?.error) {
        setBusy(false);
        setError(
          res.error.includes("in use")
            ? "That PIN is already in use. Pick a different one."
            : res.error,
        );
        return;
      }
    }
    setBusy(false);
    onSaved();
  };
  const remove = async () => {
    if (isSelf) {
      alert("You can't delete your own account.");
      return;
    }
    if (
      !confirm(
        `Delete ${employee.name}? This will also delete all shift history.`,
      )
    )
      return;
    setBusy(true);
    const { error: e } = await supabase
      .from("employees")
      .delete()
      .eq("id", employee.id);
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
            {isNew ? "Add" : "Edit"} employee
          </div>
          <div className="font-serif text-xl text-stone-900">
            {isNew ? "New person" : employee.name}
          </div>
        </div>
      </div>
      <div className="px-5 pt-6 space-y-5">
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Maria S."
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900"
          />
        </div>
        {!isNew && canEditOwner && employee?.pin && (
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
              Current PIN
            </label>
            <div className="flex items-center gap-3">
              <span
                className={`font-mono text-2xl tracking-widest ${showPin ? "text-stone-900" : "text-stone-400"}`}
              >
                {showPin ? employee.pin : "••••"}
              </span>
              <button
                type="button"
                onClick={() => setShowPin((s) => !s)}
                className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center gap-1.5"
              >
                {showPin ? (
                  <>
                    <EyeOff size={12} /> Hide
                  </>
                ) : (
                  <>
                    <Eye size={12} /> Show
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-stone-500 mt-1 font-mono">
              If they forget it, read it back to them here. Or set a new one
              below.
            </p>
          </div>
        )}
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            {isNew ? "4-digit PIN" : "New PIN — leave blank to keep current"}
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder={isNew ? "0000" : "••••"}
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono text-2xl tracking-widest"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Role
          </label>
          <div
            className={`grid gap-2 ${canEditOwner ? "grid-cols-3" : "grid-cols-2"}`}
          >
            <button
              onClick={() => setRole("employee")}
              type="button"
              className={`p-3 rounded-xl border-2 text-left ${role === "employee" ? "border-stone-900 bg-white" : "border-stone-200 bg-white/50"}`}
            >
              <div className="font-medium text-stone-900 text-sm">Employee</div>
            </button>
            <button
              onClick={() => setRole(ROLE_LEAD)}
              type="button"
              className={`p-3 rounded-xl border-2 text-left ${isLeadRole(role) ? "border-stone-900 bg-white" : "border-stone-200 bg-white/50"}`}
            >
              <div className="font-medium text-stone-900 text-sm">Lead</div>
            </button>
            {canEditOwner && (
              <button
                onClick={() => setRole("owner")}
                type="button"
                className={`p-3 rounded-xl border-2 text-left ${role === "owner" ? "border-amber-700 bg-amber-50" : "border-stone-200 bg-white/50"}`}
              >
                <div className="font-medium text-stone-900 text-sm">Owner</div>
              </button>
            )}
          </div>
          {role === "owner" && (
            <p className="text-xs text-amber-700 mt-2">
              ⚠ Owners have full admin access including bill rates and pay info.
            </p>
          )}
        </div>

        {canEditOwner && (
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-1.5">
              Pay rate
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                $
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={payRate}
                onChange={(e) => setPayRate(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-16 py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 text-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">
                / hour
              </span>
            </div>
            <div className="text-[11px] text-stone-500 mt-1 font-mono">
              What you pay this person hourly (owner-only). Used in the
              profit/loss report.
            </div>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-white border border-stone-200 space-y-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <Settings size={14} className="text-stone-500" />
              <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
                Responsibilities
              </div>
            </div>
            {/* Running tally so the user can see at a glance how many caps
               are on without scanning every checkbox. Owners are always
               full so we just say "Full access". */}
            {role === "owner" ? (
              <span className="text-[10px] uppercase tracking-wider font-mono text-amber-700 flex items-center gap-1">
                <Check size={10} /> Full access
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                {
                  Object.values(responsibilities).filter((v) => v === true)
                    .length
                }{" "}
                of {CAPABILITIES.length}
              </span>
            )}
          </div>
          {role === "owner" ? (
            <p className="text-[11px] text-stone-500 -mt-2">
              Owners have every capability automatically. Toggles below are
              shown for reference but can't be turned off.
            </p>
          ) : isLeadRole(role) ? (
            <p className="text-[11px] text-stone-500 -mt-2">
              Leads default to all capabilities on. Turn off anything they
              shouldn't have.
            </p>
          ) : (
            <p className="text-[11px] text-stone-500 -mt-2">
              Employees default to no extra capabilities. Turn on what this
              person should be allowed to do.
            </p>
          )}

          <div className="space-y-2 pt-1">
            {CAPABILITIES.map((c) => {
              const isOn = role === "owner" ? true : !!responsibilities[c.key];
              const disabled = role === "owner";
              return (
                <label
                  key={c.key}
                  className={`flex items-start justify-between gap-3 p-3 rounded-xl cursor-pointer ${disabled ? "bg-amber-50 cursor-not-allowed" : "bg-stone-50 hover:bg-stone-100"}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-900">
                      {c.label}
                    </div>
                    <div className="text-[11px] text-stone-500">{c.hint}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isOn}
                    disabled={disabled}
                    onChange={() => toggleResp(c.key)}
                    className="w-5 h-5 rounded accent-stone-900 flex-shrink-0 mt-0.5 disabled:opacity-60"
                  />
                </label>
              );
            })}
          </div>
        </div>

        {showNotificationSettings && (
          <div className="p-4 rounded-2xl bg-white border border-stone-200 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle size={14} className="text-stone-500" />
              <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
                Notifications (SMS)
              </div>
            </div>
            <p className="text-[11px] text-stone-500 -mt-2">
              Coming soon: text-message alerts when cleaners or PMs message you.
              Fill in phone & opt-in below — SMS will activate once we connect
              the SMS provider.
            </p>

            <div>
              <label className="text-xs text-stone-700 font-medium mb-1.5 block">
                Phone number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. (801) 555-0123"
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 text-sm"
              />
            </div>

            <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 cursor-pointer">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-stone-900">
                  Allow SMS notifications
                </div>
                <div className="text-[11px] text-stone-500">
                  Required to receive any text alerts. You can opt out anytime.
                </div>
              </div>
              <input
                type="checkbox"
                checked={smsOptIn}
                onChange={(e) => setSmsOptIn(e.target.checked)}
                className="w-5 h-5 rounded accent-stone-900 flex-shrink-0"
              />
            </label>

            {smsOptIn && (
              <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 cursor-pointer">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-stone-900">
                    New messages
                  </div>
                  <div className="text-[11px] text-stone-500">
                    Text when a teammate or PM sends you a message.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyMessages}
                  onChange={(e) => setNotifyMessages(e.target.checked)}
                  className="w-5 h-5 rounded accent-stone-900 flex-shrink-0"
                />
              </label>
            )}
          </div>
        )}

        <div className="p-4 rounded-2xl bg-white border border-stone-200">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium text-stone-900 text-sm">Active</div>
              <div className="text-xs text-stone-500">
                Inactive employees can't sign in
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
          {busy ? "Saving…" : isNew ? "Add employee" : "Save changes"}
        </button>
        {!isNew && !isSelf && (
          <button
            onClick={remove}
            disabled={busy}
            className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Trash2 size={14} /> Delete employee
          </button>
        )}
      </div>
    </div>
  );
}
