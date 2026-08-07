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
  isoToLocalInput,
  localInputToISO,
  shiftBillableAmount,
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
  readPhotoTakenAt,
  sharePhotos,
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
import {
  buildTargetTitle,
  unitSizeLabel,
  shortenBedroom,
  partyDisplay,
  unitPartyLabel,
  bathroomNumberForBedroom,
} from "../../../../lib/labels.js";
import { resolveItemLabel } from "../../../../lib/pickerLabels.js";
import { generatePortalUserCode } from "../../../../lib/portal.js";
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

export function InvoiceDocument({
  invoiceId,
  data,
  preview,
  onBack,
  onChanged,
  onEditDraft,
  saving = false,
  onSaveDraft,
  onSaveSent,
  onSavePaid,
  readOnly = false,
}) {
  const [inv, setInv] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: invData } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();
    const { data: lineData } = await supabase
      .from("invoice_lines")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("sort_order");
    setInv(invData || null);
    setLines(lineData || []);
    setLoading(false);
  };
  useEffect(() => {
    if (data) {
      setInv(data.inv);
      setLines(data.lines || []);
      setLoading(false);
      return;
    }
    load();
    /* eslint-disable-next-line */
  }, [invoiceId, data]);

  const setStatus = async (status) => {
    setWorking(true);
    const patch = { status };
    if (status === "sent") patch.sent_at = new Date().toISOString();
    if (status === "paid") patch.paid_at = new Date().toISOString();
    await supabase.from("invoices").update(patch).eq("id", invoiceId);
    setWorking(false);
    await load();
    onChanged && onChanged();
  };
  const del = async () => {
    if (!confirm("Delete this invoice? Its items become billable again."))
      return;
    setWorking(true);
    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", invoiceId);
    setWorking(false);
    if (error) {
      alert("Could not delete: " + error.message);
      return;
    }
    onChanged && onChanged();
    onBack && onBack();
  };

  if (loading) return <Splash text="Loading invoice…" />;
  if (!inv)
    return (
      <div className="p-6">
        <button
          onClick={onBack}
          className="text-sm text-stone-600 flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="mt-4 text-stone-500">Invoice not found.</div>
      </div>
    );

  // The printed/PM-facing invoice only shows lines the property is billed
  // for. Non-billable lines (comps/redos the owner ate) are tracked in the
  // data but never appear on the document or in its totals.
  const billableLines = lines.filter((l) => !l.non_billable);
  const total = billableLines.reduce(
    (s, l) => s + (parseFloat(l.amount) || 0),
    0,
  );
  const extraTotal = billableLines.reduce(
    (s, l) => s + (parseFloat(l.extra_amount) || 0),
    0,
  );
  const baseTotal = billableLines.reduce((s, l) => {
    const amt = parseFloat(l.amount) || 0;
    const x = parseFloat(l.extra_amount) || 0;
    return (
      s + (l.base_amount != null ? parseFloat(l.base_amount) || 0 : amt - x)
    );
  }, 0);

  return (
    <div className="pb-28 bg-stone-100 min-h-screen">
      {/* Action bar — hidden when printing */}
      <div className="print:hidden flex items-center justify-between gap-2 px-5 py-3 border-b border-stone-200 bg-white sticky top-0 z-10 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-stone-700 text-sm"
        >
          <ArrowLeft size={16} /> {preview ? "Back to draft" : "Back"}
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {!readOnly && preview && (
            <>
              <span className="text-xs font-mono text-amber-700 px-2 py-1 rounded bg-amber-50">
                Preview
              </span>
              {onSaveDraft && (
                <button
                  onClick={onSaveDraft}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-700 text-xs font-medium disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save draft"}
                </button>
              )}
              {onSaveSent && (
                <button
                  onClick={onSaveSent}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium disabled:opacity-50"
                >
                  Save & mark sent
                </button>
              )}
              {onSavePaid && (
                <button
                  onClick={onSavePaid}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium disabled:opacity-50"
                >
                  Save & mark paid
                </button>
              )}
            </>
          )}
          {!readOnly && !preview && inv.status === "draft" && onEditDraft && (
            <button
              onClick={() => {
                if (
                  confirm(
                    "Reopen this invoice to edit? Your prices, overrides and notes are kept, and any newer cleanings in the period merge in.",
                  )
                )
                  onEditDraft(inv);
              }}
              disabled={working}
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium disabled:opacity-50"
            >
              Edit / add cleanings
            </button>
          )}
          {!readOnly && !preview && inv.status !== "sent" && (
            <button
              onClick={() => setStatus("sent")}
              disabled={working}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium disabled:opacity-50"
            >
              Mark sent
            </button>
          )}
          {!readOnly && !preview && inv.status !== "paid" && (
            <button
              onClick={() => setStatus("paid")}
              disabled={working}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium disabled:opacity-50"
            >
              Mark paid
            </button>
          )}
          {!readOnly && !preview && inv.status !== "draft" && (
            <button
              onClick={() => setStatus("draft")}
              disabled={working}
              className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-600 text-xs"
            >
              Back to draft
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium flex items-center gap-1.5"
          >
            <FileText size={13} />{" "}
            {readOnly ? "Download / print" : "Print / PDF"}
          </button>
          {!readOnly && !preview && (
            <button
              onClick={del}
              disabled={working}
              className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* The sheet */}
      <div
        className="max-w-[800px] mx-auto bg-white my-4 print:my-0 shadow-sm print:shadow-none px-8 py-8 text-stone-800"
        style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-6 pb-6 border-b border-stone-200">
          <img
            src={SUMMIT_LOGO_URL}
            alt="Summit Clean"
            className="w-28 h-28 object-contain bg-stone-900 rounded-lg p-2"
          />
          <div className="text-right">
            <div className="text-3xl font-light tracking-tight text-stone-900">
              INVOICE
            </div>
            {inv.title && (
              <div className="text-sm text-stone-500 mt-0.5">{inv.title}</div>
            )}
            <div className="mt-3 text-xs text-stone-600 leading-relaxed">
              <div className="font-semibold text-stone-800">
                {SUMMIT_COMPANY.name}
              </div>
              {SUMMIT_COMPANY.lines.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
              <div className="mt-2">{SUMMIT_COMPANY.url}</div>
            </div>
          </div>
        </div>

        {/* Bill to + meta */}
        <div className="flex items-start justify-between gap-6 py-6">
          <div className="text-xs text-stone-600 leading-relaxed">
            <div className="text-stone-400 uppercase tracking-wider text-[10px] mb-1">
              Bill to
            </div>
            {inv.bill_to_org && (
              <div className="font-semibold text-stone-800">
                {inv.bill_to_org}
              </div>
            )}
            {inv.bill_to_contact && <div>{inv.bill_to_contact}</div>}
            {inv.bill_to_address && (
              <div className="whitespace-pre-line">{inv.bill_to_address}</div>
            )}
            {inv.bill_to_phone && (
              <div className="mt-1">{inv.bill_to_phone}</div>
            )}
            {inv.bill_to_email && <div>{inv.bill_to_email}</div>}
          </div>
          <div className="text-xs min-w-[220px]">
            <div className="flex justify-between py-1">
              <span className="text-stone-500">Invoice Number:</span>
              <span className="font-medium text-stone-800">
                {inv.invoice_number || "—"}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-stone-500">Invoice Date:</span>
              <span className="text-stone-800">
                {fmtInvoiceDate(inv.invoice_date)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-stone-500">Payment Due:</span>
              <span className="text-stone-800">
                {fmtInvoiceDate(inv.due_date)}
              </span>
            </div>
            <div className="flex justify-between py-2 mt-1 px-2 bg-stone-100 rounded">
              <span className="text-stone-600 font-medium">
                Amount Due (USD):
              </span>
              <span className="font-semibold text-stone-900">
                ${total.toFixed(2)}
              </span>
            </div>
            <div className="mt-2 text-right">
              <span
                className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${INVOICE_STATUS_STYLE[inv.status] || "bg-stone-100 text-stone-600"}`}
              >
                {inv.status}
              </span>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="text-xs text-stone-800">
          {/* Header */}
          <div
            className="flex text-white font-medium px-3 py-2"
            style={{
              background: "#44403c",
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
          >
            <div className="flex-1">Items</div>
            <div className="text-right" style={{ width: 110 }}>
              Amount
            </div>
          </div>
          {billableLines.map((l, i) => {
            const amount = parseFloat(l.amount) || 0;
            const xtra = parseFloat(l.extra_amount) || 0;
            // base_amount is backfilled by v58; fall back for any line
            // written before that migration ran.
            const base =
              l.base_amount != null
                ? parseFloat(l.base_amount) || 0
                : amount - xtra;
            const n = i + 1;
            return (
              <div key={l.id}>
                <div
                  className="flex px-3 py-2.5"
                  style={{
                    background: i % 2 === 0 ? "#ffffff" : "#f5f2ec",
                    WebkitPrintColorAdjust: "exact",
                    printColorAdjust: "exact",
                  }}
                >
                  <div className="flex-1 flex" style={{ gap: 9 }}>
                    <div
                      style={{
                        color: "#2563eb",
                        fontWeight: 600,
                        fontSize: 13,
                        lineHeight: 1.35,
                        minWidth: 12,
                        WebkitPrintColorAdjust: "exact",
                        printColorAdjust: "exact",
                      }}
                    >
                      {n}
                    </div>
                    <div>
                      <div className="font-semibold text-stone-800">
                        {INVOICE_TYPE_LABEL[l.service_type] || "Cleaning"}
                      </div>
                      <div className="text-stone-700">{l.label}</div>
                      {l.description && (
                        <div className="text-stone-500">{l.description}</div>
                      )}
                      {/* Show the PM what they're paying for rather than one
                         lump sum they have to take on faith. */}
                      {xtra > 0 && (
                        <div
                          className="mt-1 text-stone-600"
                          style={{ fontSize: 11 }}
                        >
                          <div>Base clean — ${base.toFixed(2)}</div>
                          <div>
                            Additional work — ${xtra.toFixed(2)}
                            {l.extra_mode === "time" &&
                              parseFloat(l.extra_minutes) > 0 && (
                                <span className="text-stone-500">
                                  {" "}
                                  ({parseFloat(l.extra_minutes)} min @ $
                                  {(parseFloat(l.extra_rate) || 0).toFixed(2)}
                                  /hr)
                                </span>
                              )}
                          </div>
                          {l.extra_note && (
                            <div className="text-stone-500 italic">
                              {l.extra_note}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right align-top" style={{ width: 110 }}>
                    ${amount.toFixed(2)}
                  </div>
                </div>
                {/* Divider that runs to the end and turns up into a numbered arrow */}
                <div
                  style={{
                    position: "relative",
                    height: 1,
                    background: "#a8a29e",
                    WebkitPrintColorAdjust: "exact",
                    printColorAdjust: "exact",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      right: 2,
                      bottom: 0,
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 5,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#2563eb",
                        lineHeight: 1,
                        transform: "translateY(-1px)",
                        WebkitPrintColorAdjust: "exact",
                        printColorAdjust: "exact",
                      }}
                    >
                      {n}
                    </span>
                    <svg
                      width="7"
                      height="15"
                      viewBox="0 0 7 15"
                      style={{ display: "block" }}
                    >
                      <path
                        d="M3.5 15 L3.5 3.5 M1 5.5 L3.5 2.5 L6 5.5"
                        stroke="#2563eb"
                        fill="none"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals — Base / Extra / Total when anything on this invoice
           carries an extra, otherwise just the total as before. */}
        <div className="flex justify-end mt-4">
          <div className="w-64 text-sm">
            {extraTotal > 0 && (
              <>
                <div className="flex justify-between py-1 border-t border-stone-300">
                  <span className="text-stone-600">Base cleaning:</span>
                  <span className="text-stone-800">
                    ${baseTotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-600">Additional work:</span>
                  <span className="text-stone-800">
                    ${extraTotal.toFixed(2)}
                  </span>
                </div>
              </>
            )}
            <div
              className={`flex justify-between py-2 ${extraTotal > 0 ? "border-t border-stone-300" : "border-t border-stone-300"}`}
            >
              <span className="text-stone-600">Total:</span>
              <span className="font-medium text-stone-900">
                ${total.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between py-2 px-2 bg-stone-100 rounded">
              <span className="text-stone-700 font-medium">
                Amount Due (USD):
              </span>
              <span className="font-bold text-stone-900">
                ${total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
