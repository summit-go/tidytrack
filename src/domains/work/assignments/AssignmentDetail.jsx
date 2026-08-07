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
import { buildTargetTitle, unitSizeLabel, shortenBedroom, partyDisplay, unitPartyLabel } from "../../../lib/labels.js";
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
import { DeleteConfirmModal } from "../dashboard/DeleteConfirmModal.jsx";
import { SpanishTranslationPanel } from "../cross-cutting/SpanishTranslationPanel.jsx";

export function AssignmentDetail({
  property,
  assignment: assignmentInit,
  employee,
  onBack,
}) {
  const [assignment, setAssignment] = useState(assignmentInit);
  const [targets, setTargets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const reload = async () => {
    const { data: a } = await supabase
      .from("assignments")
      .select("*")
      .eq("id", assignmentInit.id)
      .maybeSingle();
    if (a) setAssignment(a);
    const { data: ts, error: tErr } = await supabase
      .from("assignment_targets")
      .select(
        "*, unit:units(label), party:parties(label, full_name), completer:employees!completed_by(name), assignedTo:employees!assigned_to(id, name)",
      )
      .eq("assignment_id", assignmentInit.id);
    if (tErr) console.error("[AssignmentDetail] targets load error:", tErr);
    setTargets(ts || []);
    // Load employees for the assign-to dropdown (active only)
    const { data: emps } = await supabase
      .from("employees")
      .select("id, name, role")
      .eq("active", true)
      .in("role", ["employee", "manager"])
      .order("name");
    setEmployees(emps || []);
    setLoaded(true);
  };

  // Toggle priority on a single target — instant DB write + local update.
  const togglePriority = async (target) => {
    const next = !target.priority;
    setTargets((prev) =>
      prev.map((t) => (t.id === target.id ? { ...t, priority: next } : t)),
    );
    const { error } = await supabase
      .from("assignment_targets")
      .update({ priority: next })
      .eq("id", target.id);
    if (error) {
      alert("Could not update priority: " + error.message);
      setTargets((prev) =>
        prev.map((t) => (t.id === target.id ? { ...t, priority: !next } : t)),
      );
    }
  };

  // Change assignee on a single target. Empty string = unassign (anyone).
  const updateAssignee = async (target, employeeId) => {
    const newAssigneeId = employeeId || null;
    const newAssignee = newAssigneeId
      ? employees.find((e) => e.id === newAssigneeId)
      : null;
    setTargets((prev) =>
      prev.map((t) =>
        t.id === target.id
          ? {
              ...t,
              assigned_to: newAssigneeId,
              assignedTo: newAssignee || null,
            }
          : t,
      ),
    );
    const { error } = await supabase
      .from("assignment_targets")
      .update({ assigned_to: newAssigneeId })
      .eq("id", target.id);
    if (error) {
      alert("Could not update assignee: " + error.message);
      reload(); // rollback by reloading
    }
  };
  useEffect(() => {
    reload(); /* eslint-disable-next-line */
  }, []);
  useAssignmentSync(reload, "asgn-detail");

  const deleteAssignment = async () => {
    setBusy(true);
    // SOFT delete — stamp deleted_at/deleted_by instead of removing the
    // row, so a mistaken delete can be undone. We intentionally do NOT
    // remove the storage file or the target rows; a restore just clears
    // deleted_at. A future purge job hard-deletes old soft-deleted ones.
    const { error } = await supabase
      .from("assignments")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: employee?.id || null,
      })
      .eq("id", assignment.id);
    setBusy(false);
    if (error) {
      alert("Could not delete: " + error.message);
      return;
    }
    onBack();
  };

  const sortedTargets = (targets || []).slice().sort((a, b) => {
    const ua = a.unit?.label || "";
    const ub = b.unit?.label || "";
    if (ua !== ub) return naturalCompare(ua, ub);
    return naturalCompare(a.party?.label || "", b.party?.label || "");
  });

  return (
    <div className="pb-24">
      <ScreenId id="OW-ASGN-DET" />
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100"
        >
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono truncate">
            {property.name}
          </div>
          <div className="font-serif text-xl text-stone-900 truncate">
            {assignment.title}
          </div>
        </div>
      </div>
      {(assignment.assignment_type || assignment.scheduled_date) && (
        <div className="flex gap-2 flex-wrap px-5 pt-3">
          <AssignmentTypeChip type={assignment.assignment_type} />
          {assignment.scheduled_date && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-200 text-stone-800 text-xs font-mono">
              <Calendar size={11} /> {fmtDateWithDay(assignment.scheduled_date)}
            </span>
          )}
        </div>
      )}
      <div className="px-5 pt-4 space-y-2">
        <SpanishTranslationPanel
          assignment={assignment}
          viewerRole={employee?.role}
        />
        <TranslateButton
          texts={
            assignment.extracted_text && assignment.extracted_text.trim()
              ? [
                  assignment.title,
                  assignment.notes,
                  assignment.extracted_text,
                ].filter(Boolean)
              : [assignment.title, assignment.notes].filter(Boolean)
          }
        />
      </div>
      <div className="px-5 pt-4 space-y-5">
        {/* Document preview/link */}
        <div className="p-4 rounded-2xl bg-white border border-stone-200">
          <div className="flex items-center gap-3 mb-3">
            {assignment.file_kind === "pdf" ? (
              <FileText size={20} className="text-stone-600" />
            ) : (
              <ImageIcon size={20} className="text-stone-600" />
            )}
            <div className="flex-1">
              <div className="font-serif text-base text-stone-900">
                Assignment file
              </div>
              <div className="text-xs text-stone-500 font-mono">
                {assignment.file_kind?.toUpperCase()} · uploaded{" "}
                {fmtDate(assignment.created_at)}
              </div>
            </div>
          </div>
          {assignment.file_kind === "image" && (
            <img
              loading="lazy"
              src={assignment.file_url}
              alt=""
              className="w-full max-h-[60vh] object-contain rounded-xl mb-3 bg-stone-100"
            />
          )}
          <a
            href={assignment.file_url}
            target="_blank"
            rel="noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium"
          >
            <Eye size={14} /> Open in new tab
          </a>
        </div>

        {/* Notes */}
        {assignment.notes && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="text-xs uppercase tracking-wider font-mono text-amber-700 mb-1">
              Notes
            </div>
            <div className="text-sm text-stone-800 whitespace-pre-wrap">
              {assignment.notes}
            </div>
          </div>
        )}

        {/* Targets list */}
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
            Targets ({targets.length})
          </div>
          {!loaded ? (
            <Splash text="Loading…" />
          ) : sortedTargets.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              No targets.
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTargets.map((t) => {
                const s =
                  ASSIGNMENT_STATUSES[t.status] || ASSIGNMENT_STATUSES.pending;
                return (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-white border border-stone-200"
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="font-serif text-base text-stone-900">
                          {t.unit?.label ? (
                            <>
                              {t.unit.label}
                              {t.party?.label ? ` · ${t.party.label}` : ""}
                            </>
                          ) : (
                            "Whole property"
                          )}
                        </div>
                        {t.party?.full_name && (
                          <div className="text-xs text-stone-500">
                            {t.party.full_name}
                          </div>
                        )}
                        {t.status_notes && (
                          <div className="text-xs text-stone-600 italic mt-1">
                            "{t.status_notes}"
                          </div>
                        )}
                        {t.completed_at && (
                          <div className="text-xs text-stone-500 font-mono mt-1">
                            Done {fmtDateWithDay(t.completed_at)}
                            {t.completer?.name && ` by ${t.completer.name}`}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded-full border ${s.color}`}
                      >
                        {s.label}
                      </span>
                    </div>
                    {/* Owner controls for priority + assignee. Hidden when
                       the target is already done (no point flagging done
                       work as priority). */}
                    {t.status !== "done" && (
                      <div className="mt-2 pt-2 border-t border-stone-100 flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => togglePriority(t)}
                          className={`text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded-full inline-flex items-center gap-1 transition-colors ${t.priority ? "bg-red-100 text-red-800 border border-red-300 font-bold" : "bg-stone-100 text-stone-500 border border-stone-200 hover:bg-stone-200"}`}
                        >
                          <AlertCircle size={10} />{" "}
                          {t.priority ? "Priority" : "Mark priority"}
                        </button>
                        <select
                          value={t.assigned_to || ""}
                          onChange={(e) => updateAssignee(t, e.target.value)}
                          className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded-full bg-white border border-stone-300 text-stone-700"
                        >
                          <option value="">Assign to: Anyone</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name}
                              {emp.role === "manager" ? " (manager)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delete — gated behind the manage_assignments_admin
           capability. Owners always have it; others need it granted
           in their permissions. Soft delete, so it's recoverable. */}
        {can(employee, "manage_assignments_admin") && (
          <div className="pt-4 border-t border-stone-200">
            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-700 text-sm font-medium flex items-center justify-center gap-2"
              >
                <Trash2 size={14} /> Delete this assignment
              </button>
            ) : (
              <DeleteConfirmModal
                title="Delete this assignment?"
                description="This hides the assignment from cleaners and the assignments list. It's recoverable — nothing is permanently erased, so you can restore it later if this was a mistake."
                itemSummary={assignment.title}
                busy={busy}
                onConfirm={deleteAssignment}
                onClose={() => setConfirmingDelete(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
