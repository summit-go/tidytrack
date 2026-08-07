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
import { sessionStore } from "../../../lib/sessionStore.js";
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
import { ItemsDropdown } from "./ItemsDropdown.jsx";
import { LeaveWorkblockModal } from "./LeaveWorkblockModal.jsx";

export function RequestItemsModal({
  section,
  templateSetId,
  bathroomVariant,
  generalVariant,
  assignmentType,
  onClose,
  onSubmit,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  // Cleaner-typed items that aren't on the sheet (e.g. "Bathtub"). Kept
  // separate and submitted as free-text item keys alongside template picks.
  const [customItems, setCustomItems] = useState([]); // array of strings
  const [customDraft, setCustomDraft] = useState("");

  // Move-out checks make the tenant responsible for the WHOLE bathroom, not
  // just a tub/toilet split — so for that type we show every bathroom variant
  // rather than filtering to one. Cleaning checks keep the assigned split.
  const wholeBathroom =
    section === "bathroom" && assignmentType === "move_out_check";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (!templateSetId) {
        setItems([]);
        setLoading(false);
        return;
      }
      const { data: variants } = await supabase
        .from("section_template_variants")
        .select("id, section_key, variant_key")
        .eq("set_id", templateSetId)
        .eq("section_key", section);
      let pickedVariants = variants || [];
      // 'all' = whole bathroom (one cleaner does everything, e.g. move-outs).
      // Move-out checks always show the whole bathroom regardless of the
      // stored split. Otherwise filter to the assigned responsibility.
      if (
        section === "bathroom" &&
        !wholeBathroom &&
        bathroomVariant &&
        bathroomVariant !== "all"
      ) {
        pickedVariants = pickedVariants.filter(
          (v) => v.variant_key === bathroomVariant.toLowerCase(),
        );
      } else if (section === "general" && generalVariant) {
        pickedVariants = pickedVariants.filter(
          (v) => v.variant_key === generalVariant.toLowerCase(),
        );
      }
      if (pickedVariants.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }
      const { data: tItems } = await supabase
        .from("section_template_items")
        .select("id, item_key, variant_id, sort_order")
        .in(
          "variant_id",
          pickedVariants.map((v) => v.id),
        )
        .order("sort_order", { ascending: true });
      // De-dupe by item_key when showing the whole bathroom (the same item
      // can appear under more than one variant).
      let list = tItems || [];
      if (wholeBathroom) {
        const seen = new Set();
        const out = [];
        list.forEach((it) => {
          if (!seen.has(it.item_key)) {
            seen.add(it.item_key);
            out.push(it);
          }
        });
        list = out;
      }
      setItems(list);
      setLoading(false);
    };
    load();
  }, [section, templateSetId, bathroomVariant, generalVariant, wholeBathroom]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addCustom = () => {
    const v = customDraft.trim();
    if (!v) return;
    // Store as a custom: item key so it's distinguishable and readable.
    const key = `custom:${v
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")}`;
    if (customItems.some((c) => c.key === key)) {
      setCustomDraft("");
      return;
    }
    setCustomItems((prev) => [...prev, { key, label: v }]);
    setCustomDraft("");
  };
  const removeCustom = (key) =>
    setCustomItems((prev) => prev.filter((c) => c.key !== key));

  const sectionLabel = section
    ? section.charAt(0).toUpperCase() + section.slice(1)
    : "";
  const humanize = (key) =>
    (key || "")
      .replace(/^[a-z]+:/, "")
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase());

  const totalPicked = selected.size + customItems.length;
  const handleSubmit = async () => {
    if (totalPicked === 0 || submitting) return;
    setSubmitting(true);
    const picked = items.filter((i) => selected.has(i.id));
    const keys = [
      ...picked.map((i) => i.item_key),
      ...customItems.map((c) => c.key),
    ];
    await onSubmit(keys);
    setSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 bg-stone-900/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div className="min-w-0 flex-1">
            <div className="font-serif text-xl text-stone-900">
              Request items in {sectionLabel}
            </div>
            <div className="text-xs text-stone-500 font-mono mt-0.5">
              Pick what needs cleaning that's not on the sheet
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-100 flex-shrink-0"
          >
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="p-5 flex-1 overflow-y-auto">
          {loading && (
            <div className="text-center text-sm text-stone-500 py-8">
              Loading items…
            </div>
          )}
          {!loading && items.length === 0 && customItems.length === 0 && (
            <div className="rounded-2xl bg-stone-100 border border-stone-200 p-4 text-sm text-stone-600 leading-relaxed">
              No template items found for this section's assigned variant.
              {section === "bathroom" &&
                !bathroomVariant &&
                !wholeBathroom &&
                " (Bathroom variant not set on assignment.)"}
              {section === "general" &&
                !generalVariant &&
                " (General variant not set on assignment.)"}
              <div className="text-xs text-stone-500 mt-2">
                You can still add an item by name below.
              </div>
            </div>
          )}
          {wholeBathroom && !loading && items.length > 0 && (
            <div className="mb-2 text-[11px] font-mono text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
              Move-out check — showing the whole bathroom
            </div>
          )}
          {!loading && items.length > 0 && (
            <div className="space-y-1.5">
              {items.map((item) => {
                const checked = selected.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 text-left transition-all ${checked ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white hover:border-stone-400"}`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${checked ? "border-amber-600 bg-amber-600" : "border-stone-300"}`}
                    >
                      {checked && <Check size={13} className="text-white" />}
                    </div>
                    <span className="text-sm text-stone-900">
                      {PICKER_EN[`${section}:${item.item_key}`] ||
                        humanize(item.item_key)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Add your own item — for anything not on the sheet (e.g. a bathtub
             that wasn't a listed request option). Requested as free text. */}
          <div className="mt-4 pt-4 border-t border-stone-200">
            <div className="text-[11px] uppercase tracking-wider font-mono text-stone-400 mb-1.5">
              Add your own
            </div>
            {customItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {customItems.map((c) => (
                  <span
                    key={c.key}
                    className="inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200"
                  >
                    {c.label}
                    <button
                      onClick={() => removeCustom(c.key)}
                      className="text-amber-600 hover:text-amber-900"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="e.g. Bathtub"
                className="flex-1 px-3 py-2 rounded-xl border-2 border-stone-200 text-sm focus:border-stone-400 outline-none"
              />
              <button
                onClick={addCustom}
                disabled={!customDraft.trim()}
                className="px-3 py-2 rounded-xl bg-stone-200 text-stone-700 text-sm font-medium disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-stone-200 space-y-2">
          <button
            onClick={handleSubmit}
            disabled={totalPicked === 0 || submitting || loading}
            className="w-full py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-50 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting
              ? "Submitting…"
              : `Request ${totalPicked} item${totalPicked === 1 ? "" : "s"}`}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl text-stone-600 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
