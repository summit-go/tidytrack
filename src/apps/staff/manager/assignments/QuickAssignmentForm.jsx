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
import {ASSIGNMENT_TYPES,
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
  QUICK_TYPES,
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
import { AssignmentForm } from "../assignments/AssignmentForm.jsx";

export function QuickAssignmentForm({
  property,
  employee,
  portalUser = null,
  portalKind = null,
  onCancel,
  onSaved,
}) {
  const isPM = portalKind === "pm" || !!portalUser; // PMs: no cleaner picker, saves as a draft for owner approval
  const [apt, setApt] = useState("");
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(2);
  const [cleanType, setCleanType] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [priority, setPriority] = useState(false);
  const [notes, setNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [cleaners, setCleaners] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isPM) return; // PMs don't assign cleaners
    (async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, name, role")
        .eq("active", true)
        .order("name");
      setCleaners((data || []).filter((e) => e.role !== "owner"));
    })();
  }, [isPM]);

  const step = (setter, val, delta, min = 0, max = 12) =>
    setter(Math.max(min, Math.min(max, (parseInt(val, 10) || 0) + delta)));

  const submit = async () => {
    const label = apt.trim();
    if (!label) {
      setError("Enter an apartment number.");
      return;
    }
    if (!cleanType) {
      setError("Pick a clean type.");
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const br = parseInt(bedrooms, 10) || 0;
      const ba = parseInt(bathrooms, 10) || 0;
      // Find the apartment (unit), else create it.
      const { data: existing } = await supabase
        .from("units")
        .select("*")
        .eq("customer_id", property.id)
        .ilike("label", label)
        .limit(1);
      let unit = (existing && existing[0]) || null;
      if (!unit) {
        const { data: created, error: ue } = await supabase
          .from("units")
          .insert({
            customer_id: property.id,
            label,
            kind: "townhome",
            bedrooms: br,
            bathrooms: ba,
            active: true,
            sort_order: 0,
          })
          .select()
          .single();
        if (ue) throw ue;
        unit = created;
      } else {
        await supabase
          .from("units")
          .update({ bedrooms: br, bathrooms: ba })
          .eq("id", unit.id);
      }
      // Ensure a party to attach the job to (whole-apartment "Main").
      const { data: parties } = await supabase
        .from("parties")
        .select("*")
        .eq("unit_id", unit.id)
        .eq("active", true)
        .order("sort_order");
      let party =
        (parties || []).find((p) => (p.label || "").toLowerCase() === "main") ||
        (parties || [])[0] ||
        null;
      if (!party) {
        const { data: cp, error: pe } = await supabase
          .from("parties")
          .insert({
            unit_id: unit.id,
            label: "Main",
            sort_order: 1,
            active: true,
          })
          .select()
          .single();
        if (pe) throw pe;
        party = cp;
      }
      // Create the assignment + one target.
      const typeLabel =
        (QUICK_TYPES.find((t) => t.key === cleanType) || {}).label || cleanType;
      const title = `Apt ${label} · ${br}BR/${ba}BA · ${typeLabel}`;
      // Route this property through the multi-unit cleaner flow (property →
      // pick apartment → clean), like Carriage — otherwise a cleaner
      // clocking in jumps straight into one clean with no apartment shown.
      if (property.property_type !== "multi_unit") {
        await supabase
          .from("customers")
          .update({ property_type: "multi_unit" })
          .eq("id", property.id);
      }
      const { data: asg, error: ae } = await supabase
        .from("assignments")
        .insert({
          customer_id: property.id,
          title,
          notes: notes.trim() || null,
          uploaded_by: isPM ? null : employee.id,
          active: true,
          assignment_type: cleanType,
          scheduled_date: scheduledDate || null,
          ...(isPM ? { source: "pm", pm_status: "pending" } : {}),
        })
        .select()
        .single();
      if (ae) throw ae;
      const { error: te } = await supabase.from("assignment_targets").insert({
        assignment_id: asg.id,
        unit_id: unit.id,
        party_id: party.id,
        status: "pending",
        priority: isPM ? false : !!priority,
        assigned_to: isPM ? null : assignedTo || null,
      });
      if (te) throw te;
      // Notify owners for approval when a PM created this (the fuller
      // PortalAssignmentForm already does this; the Quick form must too, or
      // PM quick-adds never hit the bell).
      if (isPM) {
        createNotification({
          to: { scope: "owner" },
          kind: "pm_assignment",
          title: "New assignment to approve",
          body: `${property.name} · ${title}`,
          linkKind: "assignment",
          linkId: asg.id,
        });
      }
      setBusy(false);
      onSaved();
    } catch (e) {
      setBusy(false);
      setError(e.message || String(e));
    }
  };

  const Stepper = ({ label, value, setter }) => (
    <div className="flex-1">
      <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => step(setter, value, -1)}
          className="w-10 h-10 rounded-xl border border-stone-300 bg-white text-stone-700 text-lg font-medium active:scale-95"
        >
          –
        </button>
        <div className="flex-1 text-center text-lg font-mono text-stone-900 py-2 rounded-xl bg-stone-100">
          {value}
        </div>
        <button
          onClick={() => step(setter, value, 1)}
          className="w-10 h-10 rounded-xl border border-stone-300 bg-white text-stone-700 text-lg font-medium active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      <ScreenId id={isPM ? "PM-QUICK" : "OW-QUICK"} />
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200 sticky top-0 bg-stone-50 z-10">
        <button
          onClick={onCancel}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100"
        >
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
            {property.name}
          </div>
          <div className="font-serif text-xl text-stone-900">
            Quick assignment
          </div>
        </div>
      </div>

      <div className="px-5 pt-6 space-y-5 max-w-md mx-auto">
        <p className="text-sm text-stone-600">
          Just clean an apartment — no checklist needed. We'll create the
          apartment if it's not in the system yet.
        </p>

        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Apartment number
          </label>
          <input
            value={apt}
            onChange={(e) => setApt(e.target.value)}
            placeholder="e.g. 302"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-stone-900"
          />
        </div>

        <div className="flex gap-3">
          <Stepper label="Bedrooms" value={bedrooms} setter={setBedrooms} />
          <Stepper label="Bathrooms" value={bathrooms} setter={setBathrooms} />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Clean type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setCleanType(t.key)}
                className={`px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${cleanType === t.key ? "bg-amber-50 border-amber-500 text-amber-900" : "bg-white border-stone-200 text-stone-700 hover:border-stone-400"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Target date (optional)
          </label>
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-stone-900"
          />
        </div>

        {!isPM && (
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
              Assign to (optional)
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm"
            >
              <option value="">Anyone (unassigned)</option>
              {cleaners.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-stone-500 mt-1 font-mono">
              Assign it to a specific cleaner — it shows up in their list.
            </div>
          </div>
        )}

        {/* Urgent is an internal scheduling lever — PMs don't get it,
           otherwise every request comes in flagged urgent. Owner/staff
           still see it here. */}
        {!isPM && (
          <button
            onClick={() => setPriority((p) => !p)}
            className={`w-full px-4 py-3 rounded-xl border-2 text-sm font-medium flex items-center justify-between transition-colors ${priority ? "bg-red-50 border-red-400 text-red-800" : "bg-white border-stone-200 text-stone-600"}`}
          >
            <span>Mark urgent (sorts to top for cleaners)</span>
            <span
              className={`w-5 h-5 rounded-md flex items-center justify-center ${priority ? "bg-red-600 text-white" : "border-2 border-stone-300"}`}
            >
              {priority && <Check size={12} />}
            </span>
          </button>
        )}

        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything the cleaner should know…"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm"
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy || !apt.trim() || !cleanType}
          className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Plus size={18} /> {busy ? "Creating…" : "Create assignment"}
        </button>
      </div>
    </div>
  );
}
