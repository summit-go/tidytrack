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
} from "../../../lib/supabase.js";
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
} from "../../../lib/constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "../../../lib/permissions.js";
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
} from "../../../lib/format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "../../../lib/compare.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
} from "../../../lib/photos.js";
import { sessionStore } from "../../auth/sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "../../../lib/translation.js";
import {
  buildTargetTitle,
  unitSizeLabel,
  shortenBedroom,
  partyDisplay,
  unitPartyLabel,
  bathroomNumberForBedroom,
} from "../../../lib/labels.js";
import { splitTaskName } from "../../../lib/tasks.js";
import { useAssignmentSync } from "../../../hooks/useAssignmentSync.js";
import { useIdleDetector } from "../../../hooks/useIdleDetector.js";
import { usePagePersistence } from "../../../hooks/usePagePersistence.js";
import { useItemLabelOverrides } from "../../../hooks/useItemLabelOverrides.js";
import { useTick } from "../../../hooks/useTick.js";
import { useUnreadCount } from "../../../hooks/useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "../../../hooks/useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "../../../contexts/LocaleContext.jsx";
import { PreviewContext } from "../../../contexts/PreviewContext.jsx";
import { AssignmentTypeChip } from "../../../components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "../../../components/chips/PriorityChip.jsx";
import { Splash } from "../../../components/Splash.jsx";
import { ScreenId } from "../../../components/ScreenId.jsx";
import { OwnerOnly } from "../../../components/OwnerOnly.jsx";
import { DueDateEditor } from "../../../components/DueDateEditor.jsx";
import { ProgressBar } from "../../../components/ProgressBar.jsx";
import { CleanerProgressBar } from "../../../components/CleanerProgressBar.jsx";
import { ConfirmModal } from "../../../components/ConfirmModal.jsx";
import { AddressLink } from "../../../components/AddressLink.jsx";
import { TranslatableText } from "../../../components/TranslatableText.jsx";
import { PhotoModal } from "../../../components/PhotoModal.jsx";
import { NotificationBell } from "../../../components/NotificationBell.jsx";
import { Header } from "../../../components/Header.jsx";
import { TeamClockIcon } from "../../../components/TeamClockIcon.jsx";
import { TabButton } from "../../../components/TabButton.jsx";
import { PhotoZoomViewer } from "../../../components/PhotoZoomViewer.jsx";
import { TranslateButton } from "../../../components/TranslateButton.jsx";
import { ZoomableImage } from "../../../components/ZoomableImage.jsx";
import { SearchableUnitPicker } from "../../../apps/internal/cleaner/SearchableUnitPicker.jsx";

export function PortalPhotoUploadTab({ property, portalKind }) {
  const isMulti = property.property_type === "multi_unit";
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState("");
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [zoomPhoto, setZoomPhoto] = useState(null);

  useEffect(() => {
    if (!isMulti) return;
    (async () => {
      const { data } = await supabase
        .from("units")
        .select("*, parties(id, label, full_name, active, sort_order)")
        .eq("customer_id", property.id)
        .eq("active", true)
        .order("sort_order")
        .order("label");
      setUnits(
        (data || []).slice().sort((a, b) => naturalCompare(a.label, b.label)),
      );
    })();
  }, [property.id, isMulti]);

  useEffect(() => {
    if (!unitId) {
      setParties([]);
      return;
    }
    const u = units.find((x) => x.id === unitId);
    setParties(
      (u?.parties || [])
        .filter((p) => p.active)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    );
  }, [unitId, units]);

  // Load history of PM photos for this property
  const loadHistory = async () => {
    const { data } = await supabase
      .from("pm_photos")
      .select("*, unit:units(label), party:parties(label)")
      .eq("customer_id", property.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory(data || []);
  };
  useEffect(() => {
    loadHistory();
  }, [property.id]);

  const reset = () => {
    setTitle("");
    setNotes("");
    setFile(null);
    setUnitId("");
    setPartyId("");
    setError("");
    setProgress("");
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f && !f.type.startsWith("image/")) {
      setError("Please choose an image file (JPG, PNG, etc).");
      return;
    }
    setFile(f || null);
    setError("");
  };

  const save = async () => {
    setError("");
    if (!file) {
      setError("Choose a photo first.");
      return;
    }
    setBusy(true);
    try {
      setProgress("Uploading photo…");
      const { path, publicUrl } = await uploadPmFile(file, property.id);
      setProgress("Saving…");
      const { error: e } = await supabase.from("pm_photos").insert({
        customer_id: property.id,
        unit_id: unitId || null,
        party_id: partyId || null,
        title: title.trim() || null,
        notes: notes.trim() || null,
        photo_url: publicUrl,
        photo_path: path,
        status: "new",
        actor_kind: portalKind || "pm",
      });
      if (e) throw e;
      setSuccess(true);
      reset();
      loadHistory();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <div className="px-5 pt-6 space-y-5">
      <ScreenId id="PM-PHOTOS" />
      <div>
        <h2 className="font-serif text-2xl text-stone-900 mb-1">
          Send a photo
        </h2>
        <p className="text-sm text-stone-600">
          Upload photos you want the cleaning team to see — damage, items left
          behind, anything worth flagging.
        </p>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
          Title (optional)
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Damage in master bath"
          maxLength={120}
          className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-stone-900"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Add any context the cleaners should know…"
          className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-stone-900 resize-none"
        />
      </div>

      {isMulti && (
        <>
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
              Unit (optional)
            </label>
            <SearchableUnitPicker
              units={units}
              value={unitId}
              placeholder="— Whole property —"
              onChange={(newUnitId) => {
                setUnitId(newUnitId);
                setPartyId("");
                const u = units.find((x) => x.id === newUnitId);
                if (u) {
                  const stripped = title.replace(/^[^—]+ — /, "");
                  setTitle(`${u.label} — ${stripped}`);
                }
              }}
            />
            {unitId && (
              <button
                type="button"
                onClick={() => {
                  setUnitId("");
                  setPartyId("");
                }}
                className="text-xs font-mono text-stone-500 mt-1 hover:text-stone-900"
              >
                ← Clear (apply to whole property)
              </button>
            )}
          </div>
          {unitId && parties.length > 0 && (
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
                Bedroom (optional)
              </label>
              <select
                value={partyId}
                onChange={(e) => {
                  const newPartyId = e.target.value;
                  setPartyId(newPartyId);
                  const u = units.find((x) => x.id === unitId);
                  const p = (u?.parties || []).find((x) => x.id === newPartyId);
                  if (u) {
                    const stripped = title.replace(/^[^—]+ — /, "");
                    setTitle(
                      `${u.label}${p ? ` · ${p.label}` : ""} — ${stripped}`,
                    );
                  }
                }}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white"
              >
                <option value="">— Any —</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                    {p.full_name ? ` (${p.full_name})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      <div>
        <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
          Photo
        </label>
        <label
          className={`block w-full p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-colors ${file ? "border-emerald-300 bg-emerald-50" : "border-stone-300 hover:border-stone-900"}`}
        >
          {file ? (
            <>
              <Check size={28} className="mx-auto mb-2 text-emerald-600" />
              <div className="text-stone-900 font-medium text-sm">
                {file.name}
              </div>
              <div className="text-xs text-stone-500 mt-0.5">
                {(file.size / 1024).toFixed(1)} KB · tap to change
              </div>
            </>
          ) : (
            <>
              <Camera size={28} className="mx-auto mb-2 text-stone-400" />
              <div className="text-stone-700 font-medium text-sm">
                Choose a photo
              </div>
              <div className="text-xs text-stone-500 mt-0.5">
                Max {ASSIGNMENT_MAX_SIZE_MB}MB
              </div>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {busy && progress && (
        <div className="p-3 rounded-xl bg-stone-100 text-stone-700 text-sm font-mono flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-stone-700 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          {progress}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <Check size={16} /> Photo sent. The cleaning team will see it.
        </div>
      )}

      <button
        onClick={save}
        disabled={busy || !file}
        className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send photo"}
      </button>

      {/* Recent uploads */}
      {history.length > 0 && (
        <div className="pt-6 border-t border-stone-200">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
            Recently sent ({history.length})
          </div>
          <div className="space-y-3">
            {history.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-2xl bg-white border border-stone-200"
              >
                <div className="flex gap-3">
                  <button
                    onClick={() => setZoomPhoto(p)}
                    className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-stone-100"
                  >
                    <img
                      loading="lazy"
                      src={p.photo_url}
                      alt={p.title || ""}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    {p.title && (
                      <div className="font-serif text-sm text-stone-900 truncate mb-0.5">
                        {p.title}
                      </div>
                    )}
                    {(p.unit?.label || p.party?.label) && (
                      <div className="text-[10px] font-mono text-stone-500 mb-1">
                        {p.unit?.label}
                        {p.party?.label && ` · ${p.party.label}`}
                      </div>
                    )}
                    {p.notes && (
                      <div className="text-xs text-stone-600 line-clamp-2 mb-1">
                        {p.notes}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-stone-400">
                        {fmtDate(p.created_at)}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full ${p.status === "seen" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                      >
                        {p.status === "seen"
                          ? "Seen by owner"
                          : "Awaiting review"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photo zoom modal */}
      {zoomPhoto && (
        <div className="fixed inset-0 bg-stone-900/95 z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 text-stone-50 bg-stone-900 flex-shrink-0">
            <div className="text-sm font-mono truncate flex-1">
              {zoomPhoto.title || "Photo"}
            </div>
            <button
              onClick={() => setZoomPhoto(null)}
              className="p-2 rounded-full bg-stone-800 ml-2 flex-shrink-0"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <img
              loading="lazy"
              src={zoomPhoto.photo_url}
              alt=""
              className="w-full h-auto rounded-xl"
            />
            {zoomPhoto.notes && (
              <div className="mt-3 p-3 rounded-xl bg-stone-800 text-stone-200 text-sm whitespace-pre-wrap">
                {zoomPhoto.notes}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
