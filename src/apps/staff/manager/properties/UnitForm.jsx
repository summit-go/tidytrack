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
import { BedBathPicker } from "../../cleaner/BedBathPicker.jsx";

export function UnitForm({ property, unit, onCancel, onSaved }) {
  const isNew = !unit;
  const [label, setLabel] = useState(unit?.label || "");
  const [notes, setNotes] = useState(unit?.notes || "");
  const [active, setActive] = useState(unit?.active ?? true);
  const [kind, setKind] = useState(unit?.kind || "apartment");
  const [partyCount, setPartyCount] = useState(4);
  const [bedrooms, setBedrooms] = useState(unit?.bedrooms ?? null);
  const [bathrooms, setBathrooms] = useState(unit?.bathrooms ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    if (!label.trim()) {
      setError("Label is required");
      return;
    }
    setBusy(true);
    if (isNew) {
      const { data: created, error: e } = await supabase
        .from("units")
        .insert({
          customer_id: property.id,
          label: label.trim(),
          notes: notes.trim() || null,
          active,
          kind,
          bedrooms: kind === "townhome" ? bedrooms : null,
          bathrooms: kind === "townhome" ? bathrooms : null,
        })
        .select()
        .single();
      if (e) {
        setBusy(false);
        setError(e.message);
        return;
      }
      // For common areas with 0 parties, auto-create a "Main" party so cleaners can clock into it.
      // For apartments/townhomes with 0 parties, respect the choice (no auto-create).
      let effectivePartyCount = partyCount;
      let partyLabels = null;
      if (kind === "common_area") {
        if (partyCount === 0) {
          partyLabels = ["Main"];
        } else {
          partyLabels = Array.from(
            { length: partyCount },
            (_, i) => `Area ${i + 1}`,
          );
        }
      } else if (partyCount > 0) {
        partyLabels = Array.from(
          { length: partyCount },
          (_, i) => `Bedroom ${i + 1}`,
        );
      }
      if (partyLabels && partyLabels.length > 0) {
        const parties = partyLabels.map((lbl, i) => ({
          unit_id: created.id,
          label: lbl,
          sort_order: i + 1,
        }));
        await supabase.from("parties").insert(parties);
      }
    } else {
      const { error: e } = await supabase
        .from("units")
        .update({
          label: label.trim(),
          notes: notes.trim() || null,
          active,
          kind,
          bedrooms: kind === "townhome" ? bedrooms : null,
          bathrooms: kind === "townhome" ? bathrooms : null,
        })
        .eq("id", unit.id);
      if (e) {
        setBusy(false);
        setError(e.message);
        return;
      }
    }
    setBusy(false);
    onSaved();
  };
  const remove = async () => {
    if (!confirm(`Delete "${unit.label}"?`)) return;
    setBusy(true);
    const { error: e } = await supabase
      .from("units")
      .delete()
      .eq("id", unit.id);
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
            {property.name}
          </div>
          <div className="font-serif text-xl text-stone-900">
            {isNew ? "New unit" : `Edit ${unit.label}`}
          </div>
        </div>
      </div>
      <div className="px-5 pt-6 space-y-5">
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Unit label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={
              kind === "common_area"
                ? "e.g. Clubhouse"
                : kind === "townhome"
                  ? "e.g. 204"
                  : "e.g. Apt 101"
            }
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Kind
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setKind("apartment")}
              className={`py-3 px-2 rounded-xl border-2 text-sm font-medium transition-all ${kind === "apartment" ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-200 bg-white text-stone-600"}`}
            >
              Apartment
            </button>
            <button
              type="button"
              onClick={() => setKind("townhome")}
              className={`py-3 px-2 rounded-xl border-2 text-sm font-medium transition-all ${kind === "townhome" ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-200 bg-white text-stone-600"}`}
            >
              Townhome
            </button>
            <button
              type="button"
              onClick={() => setKind("common_area")}
              className={`py-3 px-2 rounded-xl border-2 text-sm font-medium transition-all ${kind === "common_area" ? "border-amber-600 bg-amber-100 text-amber-900" : "border-stone-200 bg-white text-stone-600"}`}
            >
              Common area
            </button>
          </div>
          <p className="text-[11px] text-stone-500 mt-2">
            {kind === "common_area" &&
              'For clubhouses, gyms, lobbies, pools, etc. Pick "0" parties below if cleaned as one area, or 2+ for sub-areas like bathroom/kitchen.'}
            {kind === "townhome" &&
              "For townhomes. Pick 0 parties if cleaned as one unit (family housing), or 2+ for student housing with bedrooms."}
            {kind === "apartment" &&
              "Standard apartment. Pick how many bedrooms (parties) to auto-create below."}
          </p>
        </div>
        {isNew && (
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
              {kind === "common_area"
                ? "Auto-create how many sub-areas?"
                : "Auto-create how many parties?"}
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[0, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setPartyCount(n)}
                  type="button"
                  className={`py-3 rounded-xl border-2 font-mono text-sm transition-all ${partyCount === n ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-200 bg-white text-stone-700"}`}
                >
                  {n === 0 ? "—" : n}
                </button>
              ))}
            </div>
            {kind === "common_area" && partyCount === 0 && (
              <p className="text-[11px] text-stone-500 mt-2">
                A "Main" sub-area will be auto-created so cleaners can clock
                into this common area.
              </p>
            )}
          </div>
        )}
        {kind === "townhome" && (
          <div className="p-4 rounded-2xl bg-white border border-stone-200">
            <div className="flex items-center gap-2 mb-3">
              <Home size={14} className="text-stone-500" />
              <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
                Layout
              </div>
            </div>
            <p className="text-[11px] text-stone-500 -mt-2 mb-3">
              Cleaners will see this before they start so they know what to
              expect.
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
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Gate code, parking…"
            rows={2}
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 resize-none"
          />
        </div>
        <div className="p-4 rounded-2xl bg-white border border-stone-200">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium text-stone-900 text-sm">Active</div>
              <div className="text-xs text-stone-500">
                Inactive units don't show in the picker
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
          {busy ? "Saving…" : isNew ? "Add unit" : "Save changes"}
        </button>
        {!isNew && (
          <button
            onClick={remove}
            disabled={busy}
            className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Trash2 size={14} /> Delete unit
          </button>
        )}
      </div>
    </div>
  );
}
