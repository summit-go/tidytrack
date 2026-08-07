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
  isLead,
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

export function PortalAssignmentForm({
  property,
  assignment,
  portalKind,
  onCancel,
  onSaved,
}) {
  const isMulti = property.property_type === "multi_unit";
  const isEdit = !!assignment;
  const [title, setTitle] = useState(assignment?.title || "");
  const [notes, setNotes] = useState(assignment?.notes || "");
  // Empty default forces the user to actively pick a type
  const [assignmentType, setAssignmentType] = useState(
    assignment?.assignment_type || "",
  );
  const [scheduledDate, setScheduledDate] = useState(
    assignment?.scheduled_date || "",
  );
  const [file, setFile] = useState(null); // a NEW file (replaces existing)
  const [keepExistingFile, setKeepExistingFile] = useState(isEdit);
  // Priority — PMs can flag urgent submissions. Carries through to the
  // cleaner's view once the owner approves. Owner can still un-flag
  // during approval if they disagree with the urgency.
  const [priority, setPriority] = useState(false);
  // Scope: 'specific' (single bedroom), 'multiple' (several bedrooms),
  // 'property' (whole property). Multi mode added to mirror the owner-side
  // form so PMs can fan out one assignment to many bedrooms at once.
  const [scope, setScope] = useState(isMulti ? "specific" : "property");
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState("");
  const [partyId, setPartyId] = useState("");
  const [parties, setParties] = useState([]);
  // Multi-target state — array of { unitId, partyId } pairs
  const [multipleTargets, setMultipleTargets] = useState([]);
  const [unitSearch, setUnitSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  // On edit, load priority from any of the existing targets
  // (all targets of one assignment share priority in practice)
  useEffect(() => {
    if (!isEdit || !assignment?.id) return;
    (async () => {
      const { data } = await supabase
        .from("assignment_targets")
        .select("priority")
        .eq("assignment_id", assignment.id)
        .limit(1)
        .maybeSingle();
      if (data?.priority) setPriority(true);
    })();
  }, [isEdit, assignment?.id]);

  const toggleTarget = (uId, pId) => {
    setMultipleTargets((prev) => {
      const exists = prev.some(
        (t) => t.unitId === uId && (t.partyId || null) === (pId || null),
      );
      return exists
        ? prev.filter(
            (t) => !(t.unitId === uId && (t.partyId || null) === (pId || null)),
          )
        : [...prev, { unitId: uId, partyId: pId || null }];
    });
  };

  const toggleAllInUnit = (unit) => {
    setMultipleTargets((prev) => {
      const activeParties = (unit.parties || []).filter((p) => p.active);
      const allSelected =
        activeParties.length > 0 &&
        activeParties.every((p) =>
          prev.some(
            (t) => t.unitId === unit.id && (t.partyId || null) === p.id,
          ),
        );
      return allSelected
        ? prev.filter((t) => t.unitId !== unit.id)
        : [
            ...prev.filter((t) => t.unitId !== unit.id),
            ...activeParties.map((p) => ({ unitId: unit.id, partyId: p.id })),
          ];
    });
  };

  // Load units for multi-unit properties
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
      // Common areas (clubhouse, gym) first, then everything else alphabetical
      setUnits(
        (data || []).slice().sort((a, b) => {
          const aCommon = a.kind === "common_area";
          const bCommon = b.kind === "common_area";
          if (aCommon && !bCommon) return -1;
          if (!aCommon && bCommon) return 1;
          return naturalCompare(a.label, b.label);
        }),
      );
    })();
  }, [property.id, isMulti]);

  // If editing, load all existing targets and pre-populate the right
  // scope (single vs multiple bedrooms vs whole property).
  useEffect(() => {
    if (!isEdit || !assignment) return;
    (async () => {
      const { data } = await supabase
        .from("assignment_targets")
        .select("unit_id, party_id")
        .eq("assignment_id", assignment.id);
      const targets = data || [];
      if (targets.length === 0) return;
      // Whole property → single row with null unit/party
      if (targets.length === 1 && !targets[0].unit_id && !targets[0].party_id) {
        setScope("property");
        return;
      }
      // Multiple targets → multi mode
      if (targets.length > 1) {
        setScope("multiple");
        setMultipleTargets(
          targets.map((t) => ({ unitId: t.unit_id, partyId: t.party_id })),
        );
        return;
      }
      // Single specific target
      const t = targets[0];
      setScope("specific");
      if (t.unit_id) setUnitId(t.unit_id);
      if (t.party_id) setPartyId(t.party_id);
    })();
  }, [isEdit, assignment]);

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

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isOk = f.type === "application/pdf" || f.type.startsWith("image/");
    if (!isOk) {
      setError("Only PDFs and images.");
      return;
    }
    setFile(f);
    setKeepExistingFile(false);
    setError("");
  };

  const save = async (submitForApproval) => {
    setError("");
    if (!keepExistingFile && !file) {
      setError("Pick a PDF or image first.");
      return;
    }
    if (!assignmentType) {
      setError("Pick a cleaning type.");
      return;
    }
    if (isMulti) {
      if (scope === "specific" && (!unitId || !partyId)) {
        setError("Pick a unit and bedroom.");
        return;
      }
      if (scope === "multiple" && multipleTargets.length === 0) {
        setError("Pick at least one bedroom.");
        return;
      }
    }
    setBusy(true);
    try {
      let filePayload = null;
      if (file) {
        setProgress("Uploading file…");
        const { path, publicUrl, kind } = await uploadPmFile(file, property.id);
        filePayload = { file_path: path, file_url: publicUrl, file_kind: kind };
      }

      const newStatus = submitForApproval ? "pending" : "draft";

      if (isEdit) {
        setProgress("Saving changes…");
        const patch = {
          title: title.trim() || assignmentTypeLabel(assignmentType),
          notes: notes.trim() || null,
          assignment_type: assignmentType,
          scheduled_date: scheduledDate || null,
          pm_status: newStatus,
          pm_rejection_reason: null, // clear any prior rejection note on resubmit
        };
        if (filePayload) {
          // delete the old file before replacing
          if (assignment.file_path) await deletePmFile(assignment.file_path);
          Object.assign(patch, filePayload);
          // Reset translation status — we'll re-translate the new file
          patch.translation_status = "pending";
          patch.extracted_text = null;
          patch.spanish_translation = null;
          patch.translation_error = null;
        }
        const { error: e1 } = await supabase
          .from("assignments")
          .update(patch)
          .eq("id", assignment.id);
        if (e1) throw e1;

        // If the file was replaced, kick off auto-translation for the new file
        if (filePayload?.file_url && filePayload?.file_kind) {
          autoTranslateAssignment(
            assignment.id,
            filePayload.file_url,
            filePayload.file_kind,
          );
        }

        // Replace targets with the new selection
        await supabase
          .from("assignment_targets")
          .delete()
          .eq("assignment_id", assignment.id);
        let targetRows;
        if (!isMulti || scope === "property") {
          targetRows = [
            {
              assignment_id: assignment.id,
              unit_id: null,
              party_id: null,
              status: "pending",
              priority,
            },
          ];
        } else if (scope === "multiple") {
          targetRows = multipleTargets.map((t) => ({
            assignment_id: assignment.id,
            unit_id: t.unitId,
            party_id: t.partyId,
            status: "pending",
            priority,
          }));
        } else {
          targetRows = [
            {
              assignment_id: assignment.id,
              unit_id: unitId,
              party_id: partyId,
              status: "pending",
              priority,
            },
          ];
        }
        const { error: e2 } = await supabase
          .from("assignment_targets")
          .insert(targetRows);
        if (e2) throw e2;
      } else {
        // Build the list of targets we'll create assignments for. In
        // multi mode each gets its own assignments row with a per-bedroom
        // title like "B1-101-1" so each cleaner sees their own clean
        // identifier; the file URL is shared across all of them.
        const targets = (() => {
          if (!isMulti || scope === "property") {
            return [
              {
                unit_id: null,
                party_id: null,
                title: title.trim() || assignmentTypeLabel(assignmentType),
              },
            ];
          }
          if (scope === "multiple") {
            return multipleTargets.map((t) => {
              const u = units.find((uu) => uu.id === t.unitId);
              const p = (u?.parties || []).find((pp) => pp.id === t.partyId);
              return {
                unit_id: t.unitId,
                party_id: t.partyId,
                title:
                  buildTargetTitle(u?.label, p?.label) ||
                  assignmentTypeLabel(assignmentType),
              };
            });
          }
          return [
            {
              unit_id: unitId,
              party_id: partyId,
              title: title.trim() || assignmentTypeLabel(assignmentType),
            },
          ];
        })();

        let firstCreatedId = null;
        for (let t = 0; t < targets.length; t++) {
          const target = targets[t];
          setProgress(
            targets.length > 1
              ? `Creating assignment ${t + 1} of ${targets.length}…`
              : "Creating assignment…",
          );
          const { data: created, error: e1 } = await supabase
            .from("assignments")
            .insert({
              customer_id: property.id,
              title: target.title,
              notes: notes.trim() || null,
              assignment_type: assignmentType,
              scheduled_date: scheduledDate || null,
              source: "pm",
              pm_status: newStatus,
              active: true,
              actor_kind: portalKind || "pm",
              ...filePayload,
            })
            .select()
            .single();
          if (e1) throw e1;

          // Fire translation once for the first sibling (file is shared)
          if (t === 0 && filePayload?.file_url && filePayload?.file_kind) {
            autoTranslateAssignment(
              created.id,
              filePayload.file_url,
              filePayload.file_kind,
            );
            firstCreatedId = created.id;
          }

          const { error: e2 } = await supabase
            .from("assignment_targets")
            .insert({
              assignment_id: created.id,
              unit_id: target.unit_id,
              party_id: target.party_id,
              status: "pending",
              priority,
            });
          if (e2) throw e2;
        }
      }
      if (submitForApproval) {
        createNotification({
          to: { scope: "owner" },
          kind: "pm_assignment",
          title: `New assignment to approve`,
          body: `${property.name} · ${title.trim() || assignmentTypeLabel(assignmentType)}${isEdit ? " (resubmitted)" : ""}`,
          linkKind: "assignment",
          linkId: isEdit ? assignment.id : null,
        });
      }
      onSaved();
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-12">
      <ScreenId id="PM-ASGN-NEW" />
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
            {isEdit ? "Edit assignment" : "New assignment"}
          </div>
        </div>
      </div>

      <div className="px-5 pt-6 space-y-5">
        {/* File first — the user wants this to be the very first thing
           they handle, matching the owner-side flow. */}
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            File (PDF or image){" "}
            <span className="text-red-600 normal-case">*</span>
          </label>
          {keepExistingFile && assignment?.file_url && (
            <div className="mb-2 p-3 rounded-xl bg-stone-100 flex items-center gap-2 text-sm">
              {assignment.file_kind === "pdf" ? (
                <FileText size={16} />
              ) : (
                <ImageIcon size={16} />
              )}
              <span className="flex-1 truncate text-stone-700">
                Existing file
              </span>
              <a
                href={assignment.file_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-amber-700 font-mono"
              >
                View
              </a>
              <button
                type="button"
                onClick={() => setKeepExistingFile(false)}
                className="text-xs text-stone-500 font-mono"
              >
                Replace
              </button>
            </div>
          )}
          {!keepExistingFile && (
            <label
              className={`block w-full p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer ${file ? "border-emerald-300 bg-emerald-50" : "border-stone-300"}`}
            >
              {file ? (
                <>
                  <Check size={24} className="mx-auto mb-1 text-emerald-600" />
                  <div className="text-sm text-stone-900">{file.name}</div>
                  <div className="text-xs text-stone-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                </>
              ) : (
                <>
                  <FileText size={24} className="mx-auto mb-1 text-stone-400" />
                  <div className="text-sm text-stone-700">
                    Choose PDF or image
                  </div>
                </>
              )}
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={handleFile}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Type — empty default forces an active pick */}
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Type <span className="text-red-600 normal-case">*</span>
          </label>
          <select
            value={assignmentType}
            onChange={(e) => setAssignmentType(e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border bg-white ${assignmentType ? "border-stone-300" : "border-amber-400"}`}
          >
            <option value="">Pick a type…</option>
            {ASSIGNMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Scheduled for{" "}
            <span className="text-stone-400 normal-case">(optional)</span>
          </label>
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white"
          />
          <div className="text-[11px] text-stone-500 mt-1">
            The Summit Clean team can adjust this if needed.
          </div>
        </div>

        {/* Priority toggle — PM flags urgency. Owner can un-flag during
           approval if they disagree. */}
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Urgency
          </label>
          <button
            type="button"
            onClick={() => setPriority((p) => !p)}
            className={`w-full px-4 py-3 rounded-xl border text-sm flex items-center justify-center gap-2 transition-colors ${priority ? "border-red-400 bg-red-50 text-red-800" : "border-stone-300 bg-white text-stone-600"}`}
          >
            {priority ? <AlertCircle size={14} /> : null}
            {priority
              ? "Marked as priority — please do first"
              : "Mark as priority (optional)"}
          </button>
          <div className="text-[11px] text-stone-500 mt-1">
            Use sparingly. The team gets a red badge on priority items and they
            sort to the top.
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Title{" "}
            <span className="text-stone-400 normal-case">
              {scope === "multiple"
                ? "(auto-filled per bedroom)"
                : "(optional)"}
            </span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              scope === "multiple"
                ? "Auto-filled per bedroom on save"
                : "Pick a unit + bedroom to auto-fill"
            }
            disabled={scope === "multiple"}
            className={`w-full px-4 py-3 rounded-xl border border-stone-300 bg-white ${scope === "multiple" ? "opacity-60 bg-stone-50" : ""}`}
          />
          {assignmentType && (
            <div className="mt-1.5 text-[11px] font-mono text-stone-500">
              Cleaning type:{" "}
              <span className="text-amber-700 font-medium">
                {assignmentTypeLabel(assignmentType)}
              </span>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            Notes / instructions
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="What needs to be done…"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white resize-none"
          />
        </div>

        {isMulti && (
          <>
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
                Where?
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setScope("specific");
                    setMultipleTargets([]);
                  }}
                  className={`p-3 rounded-xl border-2 text-left ${scope === "specific" ? "border-stone-900 bg-white" : "border-stone-200 bg-white/50"}`}
                >
                  <div className="font-medium text-xs">One bedroom</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScope("multiple");
                    setUnitId("");
                    setPartyId("");
                  }}
                  className={`p-3 rounded-xl border-2 text-left ${scope === "multiple" ? "border-stone-900 bg-white" : "border-stone-200 bg-white/50"}`}
                >
                  <div className="font-medium text-xs">Multiple bedrooms</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScope("property");
                    setUnitId("");
                    setPartyId("");
                    setMultipleTargets([]);
                  }}
                  className={`p-3 rounded-xl border-2 text-left ${scope === "property" ? "border-stone-900 bg-white" : "border-stone-200 bg-white/50"}`}
                >
                  <div className="font-medium text-xs">Whole property</div>
                </button>
              </div>
            </div>
            {scope === "specific" && (
              <>
                <div>
                  <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
                    Unit
                  </label>
                  <SearchableUnitPicker
                    units={units}
                    value={unitId}
                    placeholder="— Pick a unit —"
                    onChange={(newUnitId) => {
                      setUnitId(newUnitId);
                      setPartyId("");
                      const u = units.find((x) => x.id === newUnitId);
                      // Auto-fill title only if it's empty or matches the
                      // previous auto value (so we don't clobber custom edits).
                      const prevU = units.find((x) => x.id === unitId);
                      const prevP = (prevU?.parties || []).find(
                        (x) => x.id === partyId,
                      );
                      const prevAuto = buildTargetTitle(
                        prevU?.label,
                        prevP?.label,
                      );
                      if (!title || title === prevAuto) {
                        setTitle(buildTargetTitle(u?.label, ""));
                      }
                    }}
                  />
                </div>
                {unitId && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
                      Bedroom
                    </label>
                    <select
                      value={partyId}
                      onChange={(e) => {
                        const newPartyId = e.target.value;
                        setPartyId(newPartyId);
                        const u = units.find((x) => x.id === unitId);
                        const p = (u?.parties || []).find(
                          (x) => x.id === newPartyId,
                        );
                        const prevP = (u?.parties || []).find(
                          (x) => x.id === partyId,
                        );
                        const prevAuto = buildTargetTitle(
                          u?.label,
                          prevP?.label,
                        );
                        if (!title || title === prevAuto) {
                          setTitle(buildTargetTitle(u?.label, p?.label));
                        }
                      }}
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
              </>
            )}
            {scope === "multiple" && (
              <div>
                <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
                  Pick bedrooms
                </label>
                <div className="space-y-1.5 max-h-72 overflow-y-auto border border-stone-200 rounded-xl p-2 bg-stone-50">
                  <input
                    type="text"
                    value={unitSearch}
                    onChange={(e) => setUnitSearch(e.target.value)}
                    placeholder="Filter units…"
                    className="w-full px-2 py-1.5 rounded-lg border border-stone-300 bg-white text-xs mb-1"
                  />
                  {(() => {
                    const q = unitSearch.trim().toLowerCase();
                    const filteredUnits = q
                      ? units.filter((u) =>
                          (u.label || "").toLowerCase().includes(q),
                        )
                      : units;
                    if (filteredUnits.length === 0) {
                      return (
                        <div className="text-center py-3 text-stone-400 text-xs italic">
                          {units.length === 0
                            ? "No units in this property."
                            : "No units match your search."}
                        </div>
                      );
                    }
                    return filteredUnits.map((u) => {
                      const activeParties = (u.parties || [])
                        .filter((p) => p.active)
                        .sort(
                          (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
                        );
                      const allSelected =
                        activeParties.length > 0 &&
                        activeParties.every((p) =>
                          multipleTargets.some(
                            (t) =>
                              t.unitId === u.id && (t.partyId || null) === p.id,
                          ),
                        );
                      const someSelected = activeParties.some((p) =>
                        multipleTargets.some(
                          (t) =>
                            t.unitId === u.id && (t.partyId || null) === p.id,
                        ),
                      );
                      return (
                        <div
                          key={u.id}
                          className="bg-white rounded-lg border border-stone-200 p-2"
                        >
                          <button
                            type="button"
                            onClick={() => toggleAllInUnit(u)}
                            className="w-full flex items-center gap-2 mb-1 text-left"
                          >
                            <div
                              className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${allSelected ? "border-amber-600 bg-amber-600" : someSelected ? "border-amber-600 bg-amber-100" : "border-stone-300"}`}
                            >
                              {allSelected && (
                                <Check size={11} className="text-white" />
                              )}
                              {!allSelected && someSelected && (
                                <div className="w-2 h-2 bg-amber-600 rounded-sm" />
                              )}
                            </div>
                            <span className="text-xs font-medium text-stone-900">
                              {u.label}
                            </span>
                            <span className="text-[10px] font-mono text-stone-400 ml-auto">
                              {activeParties.length} bedroom
                              {activeParties.length === 1 ? "" : "s"}
                            </span>
                          </button>
                          {activeParties.length > 0 && (
                            <div className="ml-6 grid grid-cols-2 gap-1">
                              {activeParties.map((p) => {
                                const checked = multipleTargets.some(
                                  (t) =>
                                    t.unitId === u.id &&
                                    (t.partyId || null) === p.id,
                                );
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => toggleTarget(u.id, p.id)}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-left border ${checked ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white hover:border-stone-400"}`}
                                  >
                                    <div
                                      className={`w-3.5 h-3.5 rounded border-2 flex-shrink-0 flex items-center justify-center ${checked ? "border-amber-600 bg-amber-600" : "border-stone-300"}`}
                                    >
                                      {checked && (
                                        <Check
                                          size={9}
                                          className="text-white"
                                        />
                                      )}
                                    </div>
                                    <span className="text-[11px] text-stone-900 truncate">
                                      {p.label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                  {multipleTargets.length > 0 &&
                    (() => {
                      const generated = multipleTargets.map((t) => {
                        const u = units.find((uu) => uu.id === t.unitId);
                        const p = (u?.parties || []).find(
                          (pp) => pp.id === t.partyId,
                        );
                        return buildTargetTitle(u?.label, p?.label);
                      });
                      const preview = generated.slice(0, 4).join(", ");
                      const more =
                        generated.length > 4
                          ? `, +${generated.length - 4} more`
                          : "";
                      return (
                        <div className="text-[10px] font-mono text-amber-700 px-1 pt-1 border-t border-stone-200">
                          <div>
                            Creating {multipleTargets.length} assignment
                            {multipleTargets.length === 1 ? "" : "s"}:
                          </div>
                          <div className="text-amber-900 mt-0.5">
                            {preview}
                            {more}
                          </div>
                          {assignmentType && (
                            <div className="text-stone-500 mt-0.5">
                              Type:{" "}
                              <span className="text-amber-700">
                                {assignmentTypeLabel(assignmentType)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                </div>
              </div>
            )}
          </>
        )}

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

        <div className="space-y-2 pt-2">
          <button
            onClick={() => save(true)}
            disabled={busy}
            className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium disabled:opacity-50"
          >
            {busy ? "Working…" : "Submit for approval"}
          </button>
          <button
            onClick={() => save(false)}
            disabled={busy}
            className="w-full py-3 rounded-2xl bg-stone-100 text-stone-700 text-sm font-medium disabled:opacity-50"
          >
            Save as draft
          </button>
        </div>
        <p className="text-xs text-stone-500 text-center">
          Drafts can be edited freely. Once you submit for approval, you can't
          edit until the owner reviews.
        </p>
      </div>
    </div>
  );
}
