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
import { InvoiceDocument } from "./InvoiceDocument.jsx";

export function InvoicePaymentsReport({
  employee,
  onSignOut,
  onOpenMessages,
  onLogoClick,
  topToggle,
}) {
  const [invoices, setInvoices] = useState(null);
  const [statusFilter, setStatusFilter] = useState("unpaid"); // all | unpaid | paid
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [viewId, setViewId] = useState(null); // invoice being viewed full-screen
  const [glanceId, setGlanceId] = useState(null); // invoice in the quick-glance popup
  const [draft, setDraft] = useState({
    paid_at: "",
    amount_paid: "",
    payment_note: "",
  });

  const load = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "id, invoice_number, customer_id, created_at, total, status, paid_at, amount_paid, payment_note, customer:customers(name)",
      )
      .order("created_at", { ascending: false });
    if (error) {
      setInvoices([]);
      return;
    }
    setInvoices(data || []);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, []);

  const list = (invoices || []).filter((inv) => {
    if (statusFilter === "unpaid") return inv.status !== "paid";
    if (statusFilter === "paid") return inv.status === "paid";
    return true;
  });
  const outstanding = (invoices || [])
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + (Number(i.total) || 0), 0);
  const collected = (invoices || [])
    .filter((i) => i.status === "paid")
    .reduce(
      (s, i) =>
        s +
        (i.amount_paid != null ? Number(i.amount_paid) : Number(i.total) || 0),
      0,
    );

  const openEdit = (inv) => {
    setEditing(inv.id);
    setDraft({
      paid_at: inv.paid_at
        ? String(inv.paid_at).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      amount_paid:
        inv.amount_paid != null
          ? String(inv.amount_paid)
          : inv.total != null
            ? String(inv.total)
            : "",
      payment_note: inv.payment_note || "",
    });
  };

  const saveMarkPaid = async (inv) => {
    setBusyId(inv.id);
    const { error } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: draft.paid_at
          ? new Date(draft.paid_at + "T12:00:00").toISOString()
          : new Date().toISOString(),
        amount_paid:
          draft.amount_paid === "" ? null : Number(draft.amount_paid),
        payment_note: draft.payment_note || null,
      })
      .eq("id", inv.id);
    setBusyId(null);
    setEditing(null);
    if (error) {
      alert(
        "Could not save: " +
          error.message +
          (/amount_paid|payment_note/.test(error.message || "")
            ? "\n\nRun v51_invoice_payments.sql in Supabase first."
            : ""),
      );
      return;
    }
    load();
  };

  const markPaidQuick = async (inv) => {
    if (
      !confirm(
        `Mark invoice #${inv.invoice_number || "—"} for ${inv.customer?.name || "this property"} (${fmtMoney(inv.total || 0)}) as PAID?\n\nRecords it as paid today for the full amount. Use "Edit payment" if you collected a different amount or need to set the date.`,
      )
    )
      return;
    setBusyId(inv.id);
    const { error } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        amount_paid: inv.total != null ? Number(inv.total) : null,
      })
      .eq("id", inv.id);
    setBusyId(null);
    if (error) {
      alert("Could not mark paid: " + error.message);
      return;
    }
    load();
  };

  const markUnpaid = async (inv) => {
    if (
      !confirm(
        "Mark this invoice unpaid again? It clears the paid date and amount.",
      )
    )
      return;
    setBusyId(inv.id);
    const { error } = await supabase
      .from("invoices")
      .update({ status: "sent", paid_at: null, amount_paid: null })
      .eq("id", inv.id);
    setBusyId(null);
    if (error) {
      alert("Could not update: " + error.message);
      return;
    }
    load();
  };

  const fmtDay = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  // Open the full invoice document (with its own print / mark-sent toolbar).
  if (viewId) {
    return (
      <InvoiceDocument
        invoiceId={viewId}
        onBack={() => {
          setViewId(null);
          load();
        }}
        onChanged={load}
        onEditDraft={null}
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
          Invoice{" "}
          <span className="font-serif italic text-amber-700">payments</span>
        </h1>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
            <div className="text-[10px] uppercase tracking-wider text-amber-700 font-mono">
              Outstanding
            </div>
            <div className="text-2xl font-serif text-stone-900 mt-1">
              {fmtMoney(outstanding)}
            </div>
          </div>
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
            <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-mono">
              Collected
            </div>
            <div className="text-2xl font-serif text-stone-900 mt-1">
              {fmtMoney(collected)}
            </div>
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-stone-100 rounded-xl mb-4">
          {["unpaid", "paid", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === f ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
            >
              {f}
            </button>
          ))}
        </div>

        {invoices === null ? (
          <div className="text-center py-12 text-stone-400 text-sm">
            Loading…
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No invoices here.
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((inv) => {
              const paid = inv.status === "paid";
              const amt =
                paid && inv.amount_paid != null
                  ? Number(inv.amount_paid)
                  : Number(inv.total) || 0;
              const isEditing = editing === inv.id;
              return (
                <div
                  key={inv.id}
                  className={`rounded-2xl bg-white border p-4 ${paid ? "border-emerald-200" : "border-stone-200"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-serif text-lg text-stone-900 truncate">
                        {inv.customer?.name || "Property"}
                      </div>
                      <div className="text-xs font-mono text-stone-500 mt-0.5">
                        #{inv.invoice_number || "—"} · {fmtDay(inv.created_at)}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-serif text-lg text-stone-900">
                        {fmtMoney(amt)}
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${paid ? "bg-emerald-600 text-white" : inv.status === "sent" ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-500"}`}
                      >
                        {paid ? "PAID" : (inv.status || "draft").toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {paid && !isEditing && (
                    <div className="mt-2 text-[11px] font-mono text-stone-500 flex flex-wrap gap-x-3 gap-y-1">
                      <span>Paid {fmtDay(inv.paid_at)}</span>
                      {inv.amount_paid != null &&
                        Number(inv.amount_paid) !== Number(inv.total) && (
                          <span className="text-amber-700">
                            collected {fmtMoney(inv.amount_paid)} of{" "}
                            {fmtMoney(inv.total)}
                          </span>
                        )}
                      {inv.payment_note && (
                        <span className="italic">“{inv.payment_note}”</span>
                      )}
                    </div>
                  )}

                  {isEditing ? (
                    <div className="mt-3 pt-3 border-t border-stone-100 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-[11px] font-mono text-stone-500 w-24">
                          Paid date
                        </label>
                        <input
                          type="date"
                          value={draft.paid_at}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, paid_at: e.target.value }))
                          }
                          className="px-2 py-1 rounded border border-stone-300 text-xs font-mono"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-[11px] font-mono text-stone-500 w-24">
                          Amount paid
                        </label>
                        <span className="text-xs text-stone-500 font-mono">
                          $
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.amount_paid}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              amount_paid: e.target.value,
                            }))
                          }
                          placeholder={
                            inv.total != null ? String(inv.total) : "0.00"
                          }
                          className="w-28 px-2 py-1 rounded border border-stone-300 text-xs font-mono"
                        />
                      </div>
                      <div className="flex items-start gap-2 flex-wrap">
                        <label className="text-[11px] font-mono text-stone-500 w-24 pt-1">
                          Note
                        </label>
                        <input
                          type="text"
                          value={draft.payment_note}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              payment_note: e.target.value,
                            }))
                          }
                          placeholder="e.g. negotiated rate, paid by check"
                          className="flex-1 min-w-[12rem] px-2 py-1 rounded border border-stone-300 text-xs"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => saveMarkPaid(inv)}
                          disabled={busyId === inv.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium disabled:opacity-50"
                        >
                          Save as paid
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-600 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <button
                        onClick={() => setGlanceId(inv.id)}
                        className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs flex items-center gap-1.5 hover:bg-stone-50"
                      >
                        <Eye size={12} /> Quick glance
                      </button>
                      <button
                        onClick={() => setViewId(inv.id)}
                        className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs flex items-center gap-1.5 hover:bg-stone-50"
                      >
                        <FileText size={12} /> Open full
                      </button>
                      {!paid ? (
                        <>
                          <button
                            onClick={() => markPaidQuick(inv)}
                            disabled={busyId === inv.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Check size={13} /> Mark paid
                          </button>
                          <button
                            onClick={() => openEdit(inv)}
                            className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs flex items-center gap-1.5 hover:bg-stone-50"
                          >
                            <Edit2 size={12} /> Edit payment
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => openEdit(inv)}
                            className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs flex items-center gap-1.5 hover:bg-stone-50"
                          >
                            <Edit2 size={12} /> Edit payment
                          </button>
                          <button
                            onClick={() => markUnpaid(inv)}
                            disabled={busyId === inv.id}
                            className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs disabled:opacity-50 hover:bg-red-50"
                          >
                            Mark unpaid
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick glance — the invoice in a popup, no navigating away. */}
      {glanceId && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-3"
          onClick={() => setGlanceId(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-200 flex-shrink-0 bg-white">
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">
                Quick glance · tap outside to close
              </span>
              <button
                onClick={() => setGlanceId(null)}
                className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <InvoiceDocument
                invoiceId={glanceId}
                onBack={() => setGlanceId(null)}
                onChanged={load}
                onEditDraft={null}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
