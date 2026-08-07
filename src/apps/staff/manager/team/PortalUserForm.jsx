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

export function PortalUserForm({ employee, user, allProperties, onCancel, onSaved }) {
  const isNew = !user;
  const [name, setName] = useState(user?.name || "");
  const [kind, setKind] = useState(user?.kind || "pm");
  const [code, setCode] = useState(user?.code || generatePortalUserCode());
  const [phone, setPhone] = useState(user?.phone || "");
  const [notes, setNotes] = useState(user?.notes || "");
  const [active, setActive] = useState(user?.active !== false);
  // Per-PM permission: when ON, the PM can use the legacy file-upload
  // assignment flow. Default OFF — we steer PMs toward the new
  // structured checklist wizard.
  const [allowLegacyUploads, setAllowLegacyUploads] = useState(
    !!user?.allow_legacy_uploads,
  );
  // Per-PM permission: when ON, this user sees the Invoices tab in the
  // portal and can view/download the invoices the owner has marked sent.
  // Default OFF — invoices are money info, so it's opt-in per person.
  const [canViewInvoices, setCanViewInvoices] = useState(
    !!user?.can_view_invoices,
  );
  const [assignedPropIds, setAssignedPropIds] = useState(
    new Set((user?.properties || []).map((p) => p.id)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const validateCode = (c) => {
    if (c.length < 6) return "Code must be at least 6 characters.";
    if (!/[a-z]/i.test(c)) return "Code must contain at least one letter.";
    if (!/\d/.test(c)) return "Code must contain at least one number.";
    if (!/^[a-z0-9]+$/i.test(c))
      return "Code can only contain letters and numbers.";
    return null;
  };

  const toggleProp = (pid) => {
    setAssignedPropIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const save = async () => {
    setError("");
    if (!name.trim()) {
      setError("Please enter a name.");
      return;
    }
    const cleanCode = code.trim().toLowerCase();
    const v = validateCode(cleanCode);
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);

    // Check code uniqueness (against other portal users + legacy customer codes)
    const { data: dupe } = await supabase
      .from("portal_users")
      .select("id")
      .eq("code", cleanCode)
      .maybeSingle();
    if (dupe && dupe.id !== user?.id) {
      setBusy(false);
      setError("That code is already in use by another portal user.");
      return;
    }

    let savedId;
    if (isNew) {
      const { data, error: e } = await supabase
        .from("portal_users")
        .insert({
          name: name.trim(),
          code: cleanCode,
          kind,
          phone: phone.trim() || null,
          notes: notes.trim() || null,
          active,
          allow_legacy_uploads: allowLegacyUploads,
          can_view_invoices: canViewInvoices,
          created_by: employee.id,
        })
        .select()
        .single();
      if (e) {
        setBusy(false);
        setError("Could not save: " + e.message);
        return;
      }
      savedId = data.id;
    } else {
      const { error: e } = await supabase
        .from("portal_users")
        .update({
          name: name.trim(),
          code: cleanCode,
          kind,
          phone: phone.trim() || null,
          notes: notes.trim() || null,
          active,
          allow_legacy_uploads: allowLegacyUploads,
          can_view_invoices: canViewInvoices,
        })
        .eq("id", user.id);
      if (e) {
        setBusy(false);
        setError("Could not save: " + e.message);
        return;
      }
      savedId = user.id;
    }

    // Hash the access code server-side so it survives table lockdown.
    if (savedId && cleanCode) {
      await secureSetCredential("portal", savedId, cleanCode);
    }

    // Sync property assignments: delete existing then insert current set
    await supabase
      .from("portal_user_properties")
      .delete()
      .eq("portal_user_id", savedId);
    if (assignedPropIds.size > 0) {
      const rows = Array.from(assignedPropIds).map((pid) => ({
        portal_user_id: savedId,
        property_id: pid,
      }));
      await supabase.from("portal_user_properties").insert(rows);
    }

    setBusy(false);
    onSaved();
  };

  const sortedProps = [...allProperties].sort((a, b) =>
    (a.name || "").localeCompare(b.name || ""),
  );

  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button
          onClick={onCancel}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100"
          disabled={busy}
        >
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
            Portal user
          </div>
          <h1 className="font-serif text-xl text-stone-900 truncate">
            {isNew ? "New portal user" : user.name}
          </h1>
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
            placeholder="e.g. John Smith"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white"
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Role
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setKind("pm")}
              className={`py-3 rounded-xl border-2 text-sm font-medium ${kind === "pm" ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-200 bg-white text-stone-600"}`}
            >
              PM
            </button>
            <button
              type="button"
              onClick={() => setKind("property_owner")}
              className={`py-3 rounded-xl border-2 text-sm font-medium ${kind === "property_owner" ? "border-amber-600 bg-amber-100 text-amber-900" : "border-stone-200 bg-white text-stone-600"}`}
            >
              Owner
            </button>
            <button
              type="button"
              onClick={() => setKind("pm_staff")}
              className={`py-3 rounded-xl border-2 text-sm font-medium ${kind === "pm_staff" ? "border-stone-700 bg-stone-200 text-stone-800" : "border-stone-200 bg-white text-stone-600"}`}
            >
              PM staff
            </button>
          </div>
          <p className="text-xs text-stone-500 mt-2">
            {kind === "pm" &&
              "Property managers can submit assignments and view cleanings."}
            {kind === "property_owner" &&
              "Property owners can submit assignments, view cleanings, and detach PMs from their properties."}
            {kind === "pm_staff" &&
              'PM staff have the same view as PMs; their actions are tagged "PM staff".'}
          </p>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              Portfolio access code
            </label>
            <button
              type="button"
              onClick={() => setCode(generatePortalUserCode())}
              className="text-xs font-mono text-amber-700 hover:text-amber-800"
            >
              Generate
            </button>
          </div>
          <input
            type="text"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))
            }
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white font-mono"
          />
          <p className="text-xs text-stone-500 mt-2">
            Share this with {name || "them"}. They sign in at{" "}
            <code className="font-mono bg-stone-100 px-1.5 py-0.5 rounded">
              /#/portal
            </code>{" "}
            with this code.
          </p>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Phone (optional)
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 555-123-4567"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white"
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Internal notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Private notes only you can see…"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white resize-none text-sm"
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Properties they can access ({assignedPropIds.size})
          </label>
          {sortedProps.length === 0 ? (
            <div className="text-sm text-stone-500 italic">
              No active properties exist yet.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto rounded-xl border border-stone-200 bg-white p-2">
              {sortedProps.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-stone-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={assignedPropIds.has(p.id)}
                    onChange={() => toggleProp(p.id)}
                    className="w-4 h-4 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-900 truncate">
                      {p.name}
                    </div>
                    {p.address && (
                      <div className="text-xs text-stone-500 truncate">
                        {p.address}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <label className="flex items-center gap-3 p-3 rounded-xl bg-stone-50">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <div>
            <div className="text-sm font-medium text-stone-900">Active</div>
            <div className="text-xs text-stone-500">
              Inactive users can't sign in. Their data is preserved.
            </div>
          </div>
        </label>

        {/* Legacy upload permission — owner toggles per-PM. We default to
           OFF so PMs use the new structured checklist wizard. Owners can
           flip this on per PM if they specifically need the older
           file/photo upload path. */}
        {kind !== "tenant" && (
          <label className="flex items-center gap-3 p-3 rounded-xl bg-stone-50">
            <input
              type="checkbox"
              checked={allowLegacyUploads}
              onChange={(e) => setAllowLegacyUploads(e.target.checked)}
            />
            <div>
              <div className="text-sm font-medium text-stone-900">
                Allow legacy file uploads
              </div>
              <div className="text-xs text-stone-500">
                When off (default), this user only sees the new checklist wizard
                and the legacy file-upload button is greyed out. Turn this on
                only if this PM specifically needs the old file/photo workflow.
              </div>
            </div>
          </label>
        )}

        {/* Invoice access — owner toggles per person. Off by default since
           invoices are financial. When on, this PM gets the Invoices tab and
           can view/download every invoice marked sent for their properties. */}
        {kind !== "tenant" && (
          <label className="flex items-center gap-3 p-3 rounded-xl bg-stone-50">
            <input
              type="checkbox"
              checked={canViewInvoices}
              onChange={(e) => setCanViewInvoices(e.target.checked)}
            />
            <div>
              <div className="text-sm font-medium text-stone-900">
                View invoices
              </div>
              <div className="text-xs text-stone-500">
                When on, this user sees an Invoices tab in their portal with
                every invoice you've marked sent for their properties — view and
                download only, they can't change anything. Off by default.
              </div>
            </div>
          </label>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-3 rounded-2xl bg-stone-100 text-stone-700 font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="flex-1 py-3 rounded-2xl bg-stone-900 text-stone-50 font-medium disabled:opacity-50"
          >
            {busy ? "Saving…" : isNew ? "Create user" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
