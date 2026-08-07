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

export function TranslationOverridesModal({ employee, onClose }) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const load = async () => {
    setLoaded(false);
    // Pull every override + the property name + who edited it. We
    // don't restrict by property here — owner sees all their data.
    const { data } = await supabase
      .from("item_label_overrides")
      .select(
        `
        id, property_id, template_item_key, locale, label, edited_at,
        property:customers(id, name),
        editor:employees!edited_by(id, name)
      `,
      )
      .order("edited_at", { ascending: false });
    setRows(data || []);
    setLoaded(true);
  };
  useEffect(() => {
    load();
  }, []);

  const revert = async (row) => {
    if (!confirm(`Revert "${row.label}" back to the default Spanish label?`))
      return;
    setBusy(true);
    const { error } = await supabase
      .from("item_label_overrides")
      .delete()
      .eq("id", row.id);
    setBusy(false);
    if (error) {
      alert("Could not revert: " + error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  // Inline editing — the owner can rewrite an override's label directly
  // (previously the only option was Revert, which threw the edit away).
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const saveEdit = async (row) => {
    const label = editVal.trim();
    if (!label || busy) return;
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("item_label_overrides")
      .update({ label, edited_by: employee?.id || null, edited_at: now })
      .eq("id", row.id);
    setBusy(false);
    if (error) {
      alert("Could not save: " + error.message);
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, label, edited_at: now } : r)),
    );
    setEditId(null);
  };

  // Derive default Spanish label (from the static dictionary) so the
  // owner can see what we'd fall back to after a revert.
  const dictionaryLabelFor = (key) => PICKER_ES?.[key] || null;
  // Friendly English fallback for context
  const englishFor = (key) => {
    if (!key) return "";
    return key
      .replace(/^[a-z_]+:/, "")
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase());
  };

  // Group rows by property for tidier display
  const grouped = (() => {
    const m = new Map();
    const q = filter.trim().toLowerCase();
    rows
      .filter((r) => {
        if (!q) return true;
        return (
          r.label?.toLowerCase().includes(q) ||
          r.template_item_key?.toLowerCase().includes(q) ||
          r.property?.name?.toLowerCase().includes(q) ||
          r.editor?.name?.toLowerCase().includes(q)
        );
      })
      .forEach((r) => {
        const key = r.property?.id || "_none";
        if (!m.has(key))
          m.set(key, {
            name: r.property?.name || "Unknown property",
            rows: [],
          });
        m.get(key).rows.push(r);
      });
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-stone-900/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-50 w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl flex flex-col max-h-[90vh]"
      >
        <div className="p-5 border-b border-stone-200 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              Admin
            </div>
            <div className="font-serif text-xl text-stone-900">
              Spanish label overrides
            </div>
            <div className="text-xs text-stone-500 mt-0.5">
              Per-property item labels cleaners have edited from the default
              Spanish translation.
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-100 flex-shrink-0"
          >
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="px-5 pt-3">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by property, item, or editor…"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!loaded ? (
            <div className="text-center py-12 text-stone-400 text-sm">
              Loading…
            </div>
          ) : grouped.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              {rows.length === 0
                ? "No label overrides yet."
                : "Nothing matches that filter."}
            </div>
          ) : (
            grouped.map((g, gi) => (
              <div
                key={gi}
                className="rounded-2xl bg-white border border-stone-200 overflow-hidden"
              >
                <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200 flex items-center gap-2">
                  <Building2 size={14} className="text-stone-500" />
                  <span className="font-serif text-base text-stone-900">
                    {g.name}
                  </span>
                  <span className="text-[10px] font-mono text-stone-500">
                    ({g.rows.length})
                  </span>
                </div>
                <div className="divide-y divide-stone-100">
                  {g.rows.map((r) => {
                    const defLabel = dictionaryLabelFor(r.template_item_key);
                    const enLabel = englishFor(r.template_item_key);
                    return (
                      <div
                        key={r.id}
                        className="px-4 py-3 flex items-start gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-mono text-stone-500 mb-0.5 truncate">
                            {r.template_item_key}
                          </div>
                          {editId === r.id ? (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-stone-500 text-sm flex-shrink-0">
                                {enLabel}
                              </span>
                              <span className="text-stone-300 flex-shrink-0">
                                →
                              </span>
                              <input
                                autoFocus
                                type="text"
                                value={editVal}
                                onChange={(e) => setEditVal(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit(r);
                                  if (e.key === "Escape") setEditId(null);
                                }}
                                className="flex-1 min-w-0 px-2 py-1 rounded-lg border-2 border-stone-400 text-sm text-stone-900 focus:outline-none focus:border-stone-900"
                              />
                            </div>
                          ) : (
                            <div className="text-sm text-stone-900 truncate">
                              <span className="text-stone-500">{enLabel}</span>
                              <span className="text-stone-300 mx-1.5">→</span>
                              <span className="font-medium">{r.label}</span>
                            </div>
                          )}
                          <div className="text-[10px] font-mono text-stone-400 mt-0.5 truncate">
                            {r.editor?.name || "someone"} ·{" "}
                            {fmtDate(r.edited_at)}
                            {defLabel && defLabel !== r.label && (
                              <span>
                                {" "}
                                · Default:{" "}
                                <span className="text-stone-600">
                                  {defLabel}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                        {editId === r.id ? (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => saveEdit(r)}
                              disabled={busy || !editVal.trim()}
                              className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 disabled:opacity-50"
                            >
                              <Check size={11} /> Save
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              disabled={busy}
                              className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => {
                                setEditId(r.id);
                                setEditVal(r.label);
                              }}
                              disabled={busy}
                              className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center gap-1 disabled:opacity-50"
                            >
                              <Edit2 size={11} /> Edit
                            </button>
                            <button
                              onClick={() => revert(r)}
                              disabled={busy}
                              className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded-full bg-stone-100 hover:bg-red-100 hover:text-red-800 text-stone-700 flex items-center gap-1 disabled:opacity-50"
                            >
                              <Delete size={11} /> Revert
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
