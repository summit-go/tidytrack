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
import { ItemsDropdown } from "../../../apps/internal/cleaner/ItemsDropdown.jsx";
import { LeaveWorkblockModal } from "./LeaveWorkblockModal.jsx";

export function MoveBlockModalInline({
  block,
  propertyId,
  shiftId,
  currentEmployeeId,
  mode = "bedroom",
  onSave,
  onSaveMulti,
  onClose,
}) {
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState("");
  const [partyId, setPartyId] = useState("");
  // Source-side block selection (NEW).
  // 'bedroom' mode  — auto-include EVERY block at the current
  //                   (unit_id, party_id). No picker shown.
  // 'workblock' mode — load every block at the current UNIT (any
  //                    bedroom) and let the cleaner pick which to
  //                    move. Pre-checked: the current active block.
  const [sourceBlocks, setSourceBlocks] = useState([]); // candidates
  const [selectedBlockIds, setSelectedBlockIds] = useState(new Set([block.id]));
  // Any assignment_targets at the OLD bedroom that this cleaner has
  // touched (started or completed) — those are the ones that, after
  // the move, would point at a bedroom they didn't actually work.
  // We surface them so the cleaner can opt-in to resetting them.
  // Default differs by mode:
  //   'bedroom'   — cleaner is in the wrong bedroom physically; their
  //                 progress is still real work and should follow. Don't
  //                 reset by default.
  //   'workblock' — wrong workblock; the cleaner shouldn't have touched
  //                 items at the source. Reset by default.
  const [touchedAssignments, setTouchedAssignments] = useState([]);
  const [resetOldAssignments, setResetOldAssignments] = useState(
    mode === "workblock",
  );
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

  // Load candidate source blocks based on mode.
  useEffect(() => {
    if (!shiftId || !block.unit_id) return;
    (async () => {
      // Mode bedroom = same (unit, party). Mode workblock = same unit
      // any bedroom. Both restricted to this shift so we don't move
      // other cleaners' blocks accidentally.
      let q = supabase
        .from("work_blocks")
        .select(
          "id, unit_id, party_id, start_time, end_time, unit:units(label), party:parties(label)",
        )
        .eq("shift_id", shiftId)
        .eq("unit_id", block.unit_id);
      if (mode === "bedroom") q = q.eq("party_id", block.party_id);
      const { data } = await q.order("start_time");
      const blocks = data || [];
      setSourceBlocks(blocks);
      if (mode === "bedroom") {
        // Auto-include every block at this bedroom
        setSelectedBlockIds(new Set(blocks.map((b) => b.id)));
      } else {
        // Workblock mode — default: only the current active block ticked
        setSelectedBlockIds(new Set([block.id]));
      }
    })();
  }, [shiftId, block.unit_id, block.party_id, block.id, mode]);

  // When this modal opens, check if there are assignments at the OLD
  // bedroom that the current cleaner has touched (started_by or
  // completed_by). If yes, offer to reset them to Pending after the
  // move. Default checked depends on mode (see state init).
  useEffect(() => {
    if (!block.unit_id || !block.party_id || !currentEmployeeId) {
      setTouchedAssignments([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("assignment_targets")
        .select("id, status, assignment:assignments(title)")
        .eq("unit_id", block.unit_id)
        .eq("party_id", block.party_id)
        .or(
          `started_by.eq.${currentEmployeeId},completed_by.eq.${currentEmployeeId}`,
        )
        .in("status", ["in_progress", "paused", "done"]);
      setTouchedAssignments(data || []);
    })();
  }, [block.unit_id, block.party_id, currentEmployeeId]);

  const parties = (units.find((u) => u.id === unitId)?.parties || [])
    .filter((p) => p.active)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const toggleBlockSelected = (id) => {
    setSelectedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!unitId || !partyId) {
      setError("Pick a unit and a bedroom.");
      return;
    }
    if (selectedBlockIds.size === 0) {
      setError("Pick at least one workblock to move.");
      return;
    }
    const newUnit = units.find((u) => u.id === unitId);
    const newParty = (newUnit?.parties || []).find((p) => p.id === partyId);
    setBusy(true);
    try {
      const resetIds =
        resetOldAssignments && touchedAssignments.length > 0
          ? touchedAssignments.map((t) => t.id)
          : [];
      const ids = Array.from(selectedBlockIds);
      // Multi-block path preferred when available (handles 1 or more
      // blocks uniformly). Falls back to legacy single-block onSave if
      // the parent didn't wire onSaveMulti.
      if (onSaveMulti && ids.length > 0) {
        await onSaveMulti(ids, newUnit, newParty, resetIds);
      } else {
        await onSave(newUnit, newParty, resetIds);
      }
    } catch (e) {
      setError(e.message || String(e));
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div>
            <div className="font-serif text-xl text-stone-900">
              {mode === "bedroom"
                ? "Move this bedroom\u2019s work"
                : "Move workblocks"}
            </div>
            <div className="text-xs text-stone-500 font-mono mt-0.5 truncate">
              {mode === "bedroom" ? (
                <>
                  Moving {sourceBlocks.length || 1} block
                  {(sourceBlocks.length || 1) === 1 ? "" : "s"} at{" "}
                  {block.unit?.label}
                  {block.party?.label && ` · ${block.party.label}`}
                </>
              ) : (
                <>From unit {block.unit?.label}</>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-100"
          >
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Source picker — only in workblock mode. Lets the cleaner
             tick which workblocks within the current unit to move.
             Bedroom mode auto-includes everything at the bedroom. */}
          {mode === "workblock" && sourceBlocks.length > 0 && (
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
                Workblocks to move
              </label>
              <div className="space-y-1.5">
                {sourceBlocks.map((b) => {
                  const checked = selectedBlockIds.has(b.id);
                  return (
                    <button
                      type="button"
                      key={b.id}
                      onClick={() => toggleBlockSelected(b.id)}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border-2 text-left ${checked ? "border-amber-500 bg-amber-50" : "border-stone-200 bg-white hover:border-stone-400"}`}
                    >
                      <div
                        className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${checked ? "border-amber-600 bg-amber-600" : "border-stone-300"}`}
                      >
                        {checked && <Check size={11} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-stone-900">
                          {b.unit?.label}
                          {b.party?.label && (
                            <span>
                              {" "}
                              ·{" "}
                              <span className="italic text-amber-800">
                                {b.party.label}
                              </span>
                            </span>
                          )}
                          {b.id === block.id && (
                            <span className="ml-1 text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-full bg-stone-200 text-stone-700">
                              active
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                          Started {fmtClock(b.start_time)}
                          {b.end_time
                            ? ` — ${fmtClock(b.end_time)}`
                            : " · open"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            {mode === "bedroom"
              ? "All work at this bedroom (notes, tasks, photos) will move with it. The old bedroom will be left untouched."
              : "Selected workblocks (and their notes, tasks, photos) will move. Other workblocks stay put."}
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
              Move to unit
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

          {/* If the cleaner has touched assignments at the OLD bedroom,
             offer to reset them to Pending after the move. Default
             on — usually they want this; the work was at the wrong
             bedroom and the assignment status reflects that mistake. */}
          {touchedAssignments.length > 0 && (
            <label className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200 cursor-pointer">
              <input
                type="checkbox"
                checked={resetOldAssignments}
                onChange={(e) => setResetOldAssignments(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-blue-400 text-blue-600 focus:ring-blue-500 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-blue-900 font-medium">
                  Also reset {touchedAssignments.length} assignment
                  {touchedAssignments.length === 1 ? "" : "s"} at the old
                  bedroom to Pending
                </div>
                <div className="text-[11px] text-blue-800 mt-0.5">
                  {touchedAssignments
                    .slice(0, 3)
                    .map((t) => t.assignment?.title || "—")
                    .join(", ")}
                  {touchedAssignments.length > 3 &&
                    ` +${touchedAssignments.length - 3} more`}
                </div>
                <div className="text-[11px] text-blue-700 mt-1 italic">
                  Recommended — these were marked started/done because of work
                  that's now moving to the new bedroom. Resetting them keeps the
                  assignment status honest.
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
            {busy ? "Moving…" : "Move work here"}
          </button>
        </div>
      </div>
    </div>
  );
}
