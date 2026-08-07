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
  isoToLocalInput,
  localInputToISO,
  shiftBillableAmount,
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
  readPhotoTakenAt,
  sharePhotos,
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
import { resolveItemLabel } from "../../../lib/pickerLabels.js";
import { generatePortalUserCode } from "../../../lib/portal.js";
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
import { DateRangePicker } from "../../../components/DateRangePicker.jsx";
import { InvoiceDocument } from "../shared/InvoiceDocument.jsx";
import { InvoiceDraftEditor } from "./InvoiceDraftEditor.jsx";
import { InvoiceList } from "./InvoiceList.jsx";
import { InvoicePreview } from "./InvoicePreview.jsx";
import { PriceBookEditor } from "../priceBook/PriceBookEditor.jsx";

export function InvoiceView({
  employee,
  onSignOut,
  onOpenMessages,
  onLogoClick,
  topToggle,
}) {
  const today = new Date().toISOString().split("T")[0];
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const [properties, setProperties] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [start, setStart] = useState(twoWeeksAgo);
  const [end, setEnd] = useState(today);
  const [invoice, setInvoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showZeros, setShowZeros] = useState(true);
  const [showPriceBook, setShowPriceBook] = useState(false);
  const [draftOn, setDraftOn] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [viewingInvoiceId, setViewingInvoiceId] = useState(null);
  const [mode, setMode] = useState("new"); // 'new' | 'saved'
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("property_type", "multi_unit")
        .eq("active", true)
        .order("name");
      setProperties(visibleProps(data, employee));
    })();
  }, []);
  const generate = async () => {
    if (!selectedId) return;
    setBusy(true);
    const property = properties.find((p) => p.id === selectedId);
    const { data: units } = await supabase
      .from("units")
      .select("*, parties(*)")
      .eq("customer_id", selectedId)
      .order("sort_order")
      .order("label");
    const { data: blocks } = await supabase
      .from("work_blocks")
      .select(
        "*, shift:shifts!inner(employee:employees(name), customer_id), unit:units(label), party:parties(*)",
      )
      .gte("start_time", start + "T00:00:00")
      .lte("start_time", end + "T23:59:59")
      .eq("is_preview", false) // Never bill for preview-mode work
      .not("end_time", "is", null);
    const propBlocks = (blocks || []).filter(
      (b) => b.shift?.customer_id === selectedId,
    );
    const blocksByParty = {};
    propBlocks.forEach((b) => {
      const key = b.party_id || "unassigned";
      if (!blocksByParty[key]) blocksByParty[key] = [];
      blocksByParty[key].push(b);
    });
    const invoiceUnits = (units || []).map((u) => ({
      ...u,
      parties: (u.parties || [])
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((p) => {
          const partyBlocks = blocksByParty[p.id] || [];
          const totalMs = partyBlocks.reduce(
            (sum, b) => sum + (new Date(b.end_time) - new Date(b.start_time)),
            0,
          );
          const hours = totalMs / 1000 / 3600;
          const totalAmount = partyBlocks.reduce((sum, b) => {
            const h =
              (new Date(b.end_time) - new Date(b.start_time)) / 1000 / 3600;
            return (
              sum + h * (b.bill_rate_at_work || property.bill_rate_hourly || 0)
            );
          }, 0);
          return {
            ...p,
            blocks: partyBlocks,
            hours,
            amount: totalAmount,
            hasWork: partyBlocks.length > 0,
          };
        }),
    }));
    const grandTotal = invoiceUnits.reduce(
      (sum, u) => sum + u.parties.reduce((s, p) => s + p.amount, 0),
      0,
    );
    const totalHours = invoiceUnits.reduce(
      (sum, u) => sum + u.parties.reduce((s, p) => s + p.hours, 0),
      0,
    );
    setInvoice({
      property,
      units: invoiceUnits,
      grandTotal,
      totalHours,
      start,
      end,
    });
    setBusy(false);
  };
  // "Edit draft": free this draft's cleanings and reopen the generator for
  // its period through today, so newer cleanings merge into one invoice.
  const [seedInvoice, setSeedInvoice] = useState(null);
  const editDraft = async (inv) => {
    if (!inv) return;
    // Capture the full invoice + its lines BEFORE freeing it, so the
    // reopened editor can restore every price, override, extra and note.
    // The old code deleted first and rebuilt blank — wiping all of it.
    const { data: full } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", inv.id)
      .single();
    const { data: savedLines } = await supabase
      .from("invoice_lines")
      .select("*")
      .eq("invoice_id", inv.id);
    // Free this invoice's targets so they (plus any newer cleanings) flow
    // back into the draft. Await it fully before reopening so the editor's
    // regeneration query sees them as un-invoiced.
    const { error: freeErr } = await supabase
      .from("assignment_targets")
      .update({ invoiced_on: null })
      .eq("invoiced_on", inv.id);
    if (freeErr) {
      alert("Could not reopen: " + freeErr.message);
      return;
    }
    await supabase.from("invoices").delete().eq("id", inv.id);
    setSeedInvoice({ ...(full || inv), lines: savedLines || [] });
    setSelectedId(inv.customer_id);
    setStart(inv.period_start || twoWeeksAgo);
    setEnd(inv.period_end || today);
    setViewingInvoiceId(null);
    setDraftOn(true);
  };
  if (showPriceBook && selectedId) {
    const property = properties.find((p) => p.id === selectedId);
    return (
      <PriceBookEditor
        property={property}
        onBack={() => setShowPriceBook(false)}
      />
    );
  }
  if (viewingInvoiceId) {
    return (
      <InvoiceDocument
        invoiceId={viewingInvoiceId}
        onBack={() => {
          setViewingInvoiceId(null);
          setMode("saved");
        }}
        onChanged={() => {}}
        onEditDraft={editDraft}
      />
    );
  }
  if (draftOn && selectedId) {
    const property = properties.find((p) => p.id === selectedId);
    return (
      <InvoiceDraftEditor
        property={property}
        start={start}
        end={end}
        employee={employee}
        seedInvoice={seedInvoice}
        onBack={() => {
          setDraftOn(false);
          setSeedInvoice(null);
        }}
        onSaved={(inv) => {
          setDraftOn(false);
          setSeedInvoice(null);
          setViewingInvoiceId(inv?.id || null);
        }}
      />
    );
  }
  if (invoice) {
    return (
      <InvoicePreview
        invoice={invoice}
        showZeros={showZeros}
        setShowZeros={setShowZeros}
        onBack={() => setInvoice(null)}
        onPrint={() => window.print()}
      />
    );
  }
  return (
    <div className="pb-24">
      <Header
        name={employee.name}
        onSignOut={onSignOut}
        role={employee.role}
        employee={employee}
        onOpenMessages={onOpenMessages}
        onLogoClick={onLogoClick}
      />
      {topToggle}
      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-3">
          Billing
        </div>
        <h1 className="text-4xl font-light text-stone-900 tracking-tight mb-6">
          Generate{" "}
          <span className="font-serif italic text-amber-700">invoice</span>
        </h1>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
              Property
            </label>
            {properties.length === 0 ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                No multi-unit properties yet.
              </div>
            ) : (
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900"
              >
                <option value="">— Pick a property —</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex gap-1 p-1 bg-stone-100 rounded-xl">
            <button
              onClick={() => setMode("new")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${mode === "new" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
            >
              New invoice
            </button>
            <button
              onClick={() => setMode("saved")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${mode === "saved" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
            >
              Saved invoices
            </button>
          </div>

          {mode === "new" ? (
            <>
              <div>
                <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
                  Date range
                </label>
                <DateRangePicker
                  start={start}
                  end={end}
                  onChange={(s, e) => {
                    setStart(s);
                    setEnd(e);
                  }}
                />
              </div>
              <button
                onClick={() => {
                  setSavedMsg("");
                  setDraftOn(true);
                }}
                disabled={!selectedId || !start || !end}
                className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <FileText size={18} /> Generate draft
              </button>
              {selectedId && (
                <button
                  onClick={() => setShowPriceBook(true)}
                  className="w-full py-3 rounded-2xl bg-white border border-stone-300 text-stone-700 text-sm font-medium active:scale-98 flex items-center justify-center gap-2 hover:border-stone-400"
                >
                  <DollarSign size={16} /> Edit subsection prices for this
                  property
                </button>
              )}
              {selectedId && (
                <button
                  onClick={generate}
                  disabled={busy}
                  className="w-full py-2 text-xs font-mono text-stone-400 hover:text-stone-600 disabled:opacity-50"
                >
                  {busy ? "Generating…" : "Old time-based print view"}
                </button>
              )}
            </>
          ) : selectedId ? (
            <InvoiceList
              property={properties.find((p) => p.id === selectedId)}
              onOpen={(id) => setViewingInvoiceId(id)}
              onNew={() => setMode("new")}
            />
          ) : (
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-sm text-stone-500">
              Pick a property above to see its saved invoices.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
