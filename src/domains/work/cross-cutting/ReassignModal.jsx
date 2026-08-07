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

export function ReassignModal({ target, propertyId, onSaved, onClose }) {
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState(target.unit_id || "");
  const [partyId, setPartyId] = useState(target.party_id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("units")
        .select("*, parties(id, label, full_name, active, sort_order)")
        .eq("customer_id", propertyId)
        .eq("active", true)
        .order("sort_order")
        .order("label");
      setUnits(
        (data || []).slice().sort((a, b) => naturalCompare(a.label, b.label)),
      );
    })();
  }, [propertyId]);

  const parties = (units.find((u) => u.id === unitId)?.parties || [])
    .filter((p) => p.active)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const save = async () => {
    if (!unitId || !partyId) {
      setError("Pick a unit and a party.");
      return;
    }
    if (unitId === target.unit_id && partyId === target.party_id) {
      setError("That's already where this is assigned. Pick a different spot.");
      return;
    }
    setBusy(true);
    try {
      const newUnit = units.find((u) => u.id === unitId);
      const newParty = (newUnit?.parties || []).find((p) => p.id === partyId);
      const newUnitLabel = newUnit?.label || "";
      const newPartyLabel = newParty?.label || "";

      // Move EVERY target belonging to this assignment — not just the
      // single target row behind the tapped card. A cleaning-check has
      // 8-16 targets at one bedroom; updating only one left the rest
      // behind, which is why a reassign looked like it "didn't work"
      // and needed 2-3 tries. We scope by assignment_id when available,
      // falling back to the (unit,party) pair for legacy rows.
      const asgnId = target.assignment_id || target.assignment?.id;
      let upd = supabase
        .from("assignment_targets")
        .update({ unit_id: unitId, party_id: partyId });
      if (asgnId) {
        upd = upd.eq("assignment_id", asgnId);
      } else {
        upd = upd.eq("unit_id", target.unit_id).eq("party_id", target.party_id);
      }
      const { error: e } = await upd;
      if (e) {
        setError(e.message);
        setBusy(false);
        return;
      }

      // Rewrite the assignment title's location so it reflects the new
      // apartment + bedroom instead of keeping the stale old name (#4a).
      // Titles follow the pattern "<Type> · <Unit> · <Bedroom>". We
      // rebuild from the assignment_type + new labels when we can; if
      // the title doesn't match that shape we leave it alone to avoid
      // clobbering a custom name.
      if (asgnId) {
        const { data: asgn } = await supabase
          .from("assignments")
          .select("id, title, assignment_type")
          .eq("id", asgnId)
          .maybeSingle();
        if (asgn) {
          const typeLabel = (asgn.assignment_type || "")
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          // Only auto-rewrite titles that look auto-generated (contain
          // " · "). Custom titles without that separator are preserved.
          if ((asgn.title || "").includes(" · ")) {
            const newTitle = [
              typeLabel || "Assignment",
              newUnitLabel,
              newPartyLabel,
            ]
              .filter(Boolean)
              .join(" · ");
            await supabase
              .from("assignments")
              .update({ title: newTitle })
              .eq("id", asgnId);
          }
        }
      }
      setBusy(false);
      onSaved();
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div>
            <div className="font-serif text-xl text-stone-900">Reassign</div>
            <div className="text-xs text-stone-500 font-mono mt-0.5 truncate">
              {target.assignment?.title}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-100"
          >
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-stone-600">
            Currently assigned to{" "}
            <strong>
              {target.unit?.label || "?"}
              {target.party?.label && ` · ${target.party.label}`}
            </strong>
            . Pick where this should go instead:
          </p>
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
              Unit
            </label>
            <select
              value={unitId}
              onChange={(e) => {
                setUnitId(e.target.value);
                setPartyId("");
              }}
              className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white"
            >
              <option value="">— Pick a unit —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          {unitId && (
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
                Bedroom
              </label>
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white"
              >
                <option value="">— Pick a bedroom —</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                    {p.full_name ? ` (${p.full_name})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="p-5 border-t border-stone-200 flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-3 rounded-2xl bg-stone-100 text-stone-700 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="flex-1 py-3 rounded-2xl bg-stone-900 text-stone-50 font-medium disabled:opacity-50"
          >
            {busy ? "Saving…" : "Reassign"}
          </button>
        </div>
      </div>
    </div>
  );
}
