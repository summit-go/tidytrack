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
import { buildTargetTitle, unitSizeLabel, shortenBedroom, partyDisplay, unitPartyLabel } from "../../../../lib/labels.js";
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
import { ItemsDropdown } from "../../cleaner/ItemsDropdown.jsx";
import { SearchableUnitPicker } from "../../cleaner/SearchableUnitPicker.jsx";

export function AssignmentForm({ property, employee, onCancel, onSaved }) {
  // Each row: { id, file, title, notes, propertyId, scope, unitId, partyId, multipleTargets }
  const [rows, setRows] = useState([]);
  const [allProperties, setAllProperties] = useState([]);
  // Active employees for the "Assign to" dropdown — managers and
  // owners shouldn't get assigned cleaning work, so we limit to role=employee.
  const [employees, setEmployees] = useState([]);
  // Cache of units per property: { [propertyId]: [{id, label, parties:[...]}] }
  const [unitsByProperty, setUnitsByProperty] = useState({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("active", true)
        .order("name");
      setAllProperties(visibleProps(data, employee));
      const { data: emps } = await supabase
        .from("employees")
        .select("id, name, role")
        .eq("active", true)
        .in("role", ["employee", "manager"])
        .order("name");
      setEmployees(emps || []);
    })();
  }, []);

  // Load units for a property on demand (and cache)
  const ensureUnitsLoaded = async (propertyId) => {
    if (unitsByProperty[propertyId]) return unitsByProperty[propertyId];
    const { data } = await supabase
      .from("units")
      .select("*, parties(id, label, full_name, active, sort_order)")
      .eq("customer_id", propertyId)
      .eq("active", true)
      .order("sort_order")
      .order("label");
    // Sort: common areas (clubhouse, gym, etc) first, then everything else alphabetical.
    // Common areas are typically the kind of thing assignments get uploaded for
    // (clubhouse cleanings) so surfacing them at the top saves scrolling.
    const sorted = (data || []).slice().sort((a, b) => {
      const aCommon = a.kind === "common_area";
      const bCommon = b.kind === "common_area";
      if (aCommon && !bCommon) return -1;
      if (!aCommon && bCommon) return 1;
      return naturalCompare(a.label, b.label);
    });
    setUnitsByProperty((prev) => ({ ...prev, [propertyId]: sorted }));
    return sorted;
  };

  // When a property is set/changed on a row, prefetch its units
  useEffect(() => {
    const ids = [...new Set(rows.map((r) => r.propertyId).filter(Boolean))];
    ids.forEach((id) => {
      if (!unitsByProperty[id]) ensureUnitsLoaded(id);
    });
    // eslint-disable-next-line
  }, [rows]);

  const addFiles = (files) => {
    const newRows = Array.from(files).map((f) => {
      const defaultProperty = property?.id || allProperties[0]?.id || "";
      return {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        // Start empty so picking a unit + bedroom auto-fills the title.
        // (Previously we pre-filled from the filename; that meant the
        // title was never "empty" and the auto-fill wouldn't replace it,
        // breaking the auto-population behavior the user expects.)
        title: "",
        notes: "",
        propertyId: defaultProperty,
        scope: "single",
        unitId: "",
        partyId: "",
        multipleTargets: [], // [{ unitId, partyId }]
        // Cleaning type (Standard / Deep / Move-out check / etc) — empty
        // default so the owner has to actively pick. Validation enforces.
        assignmentType: "",
        // Optional target date for when this assignment should be done
        scheduledDate: "",
        // Priority flag — flagged assignments sort to the top of the
        // cleaner's list and show with a red urgent badge.
        priority: false,
        // Optional employee ID — when set, this assignment shows as
        // assigned to a specific cleaner. Others can still see it but
        // it surfaces with their name attached as a recommendation.
        assignedTo: "",
      };
    });
    setRows((prev) => [...prev, ...newRows]);
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = ""; // reset so picking the same file again re-fires
    }
  };

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Auto-build a title prefix from the target selection, e.g. "B3-205 · Bedroom 2 — "
  // Called when unit/party changes on a row. Replaces any existing auto-prefix but
  // keeps anything the user manually typed after it.
  // When the user picks a unit/party in single mode, set the title to
  // a compact identifier like "B1-103-1". If they've manually edited
  // the title to something custom that doesn't match the auto-format,
  // we don't clobber it — only update when the title is empty or
  // matches the previous auto-built pattern.
  const autoPrefixFor = (rowId, unitIdNew, partyIdNew) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const units = unitsByProperty[r.propertyId] || [];
        const unit = units.find((u) => u.id === unitIdNew);
        const party = (unit?.parties || []).find((p) => p.id === partyIdNew);
        const newAutoTitle = buildTargetTitle(unit?.label, party?.label);
        // Compute what the OLD auto title would have been, so we can detect
        // whether the current title is still the auto value (safe to replace)
        // vs custom (preserve).
        const oldUnit = units.find((u) => u.id === r.unitId);
        const oldParty = (oldUnit?.parties || []).find(
          (p) => p.id === r.partyId,
        );
        const oldAutoTitle = buildTargetTitle(oldUnit?.label, oldParty?.label);
        // Also strip legacy " — " prefixed manual edits so they get refreshed
        const legacyPrefixMatch = r.title.match(/^[^—]+ — (.*)$/);
        const titleIsAuto =
          r.title === oldAutoTitle ||
          r.title === "" ||
          (legacyPrefixMatch && legacyPrefixMatch[1] === "");
        const nextTitle = titleIsAuto ? newAutoTitle : r.title;
        return {
          ...r,
          unitId: unitIdNew,
          partyId: partyIdNew,
          title: nextTitle,
        };
      }),
    );
  };

  // When the property on a row changes, reset its scope/targets
  const changeRowProperty = (id, newPropId) => {
    updateRow(id, {
      propertyId: newPropId,
      scope: "single",
      unitId: "",
      partyId: "",
      multipleTargets: [],
    });
  };

  const toggleTarget = (rowId, uId, pId) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const exists = r.multipleTargets.some(
          (t) => t.unitId === uId && (t.partyId || null) === (pId || null),
        );
        const next = exists
          ? r.multipleTargets.filter(
              (t) =>
                !(t.unitId === uId && (t.partyId || null) === (pId || null)),
            )
          : [...r.multipleTargets, { unitId: uId, partyId: pId || null }];
        return { ...r, multipleTargets: next };
      }),
    );
  };

  // Select / deselect every active party inside a unit, for one row
  const toggleAllInUnit = (rowId, unit) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const activeParties = (unit.parties || []).filter((p) => p.active);
        const allSelected = activeParties.every((p) =>
          r.multipleTargets.some(
            (t) => t.unitId === unit.id && (t.partyId || null) === p.id,
          ),
        );
        const next = allSelected
          ? r.multipleTargets.filter((t) => t.unitId !== unit.id)
          : [
              ...r.multipleTargets.filter((t) => t.unitId !== unit.id),
              ...activeParties.map((p) => ({ unitId: unit.id, partyId: p.id })),
            ];
        return { ...r, multipleTargets: next };
      }),
    );
  };

  // Per-row search text for the multi-select
  const [unitSearches, setUnitSearches] = useState({}); // { [rowId]: 'searchString' }
  const setUnitSearch = (rowId, q) =>
    setUnitSearches((prev) => ({ ...prev, [rowId]: q }));

  const validateRows = () => {
    if (rows.length === 0) return "Add at least one file.";
    for (const r of rows) {
      if (!r.propertyId) return `One of the files has no property set.`;
      const prop = allProperties.find((p) => p.id === r.propertyId);
      const isMulti = prop?.property_type === "multi_unit";
      // Title check: required only in single mode (multi auto-generates per target)
      if (!(isMulti && r.scope === "multiple") && !r.title.trim()) {
        return `One of the files is missing a title. Pick the unit + bedroom to auto-fill, or type one.`;
      }
      if (!r.assignmentType)
        return `"${r.title || r.file.name}" needs a cleaning type picked.`;
      if (isMulti) {
        if (r.scope === "multiple") {
          if (!r.multipleTargets || r.multipleTargets.length === 0) {
            return `"${r.title || r.file.name}" needs at least one bedroom selected.`;
          }
        } else {
          if (!r.unitId || !r.partyId) {
            return `"${r.title || r.file.name}" needs a unit and bedroom.`;
          }
        }
      }
    }
    return null;
  };

  const saveAll = async () => {
    setError("");
    const v = validateRows();
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    try {
      let totalCreated = 0;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        setProgress(`Uploading file ${i + 1} of ${rows.length}…`);
        const { path, publicUrl, kind } = await uploadAssignmentFile(
          r.file,
          r.propertyId,
        );

        const prop = allProperties.find((p) => p.id === r.propertyId);
        const isMulti = prop?.property_type === "multi_unit";
        const units = unitsByProperty[r.propertyId] || [];

        // Build the list of (target, generated title) pairs we'll create
        // assignments for. In multi mode each target becomes its own
        // assignments row with a per-bedroom title like "B1-101-1", so
        // each cleaner sees their own clean identifier. The file URL is
        // shared across all of them since they reference the same PDF.
        const targets = (() => {
          if (!isMulti) {
            return [{ unit_id: null, party_id: null, title: r.title.trim() }];
          }
          if (r.scope === "multiple") {
            return r.multipleTargets.map((t) => {
              const u = units.find((uu) => uu.id === t.unitId);
              const p = (u?.parties || []).find((pp) => pp.id === t.partyId);
              return {
                unit_id: t.unitId,
                party_id: t.partyId,
                title: buildTargetTitle(u?.label, p?.label) || r.title.trim(),
              };
            });
          }
          return [
            { unit_id: r.unitId, party_id: r.partyId, title: r.title.trim() },
          ];
        })();

        for (let t = 0; t < targets.length; t++) {
          const target = targets[t];
          if (targets.length > 1) {
            setProgress(
              `Creating assignment ${t + 1} of ${targets.length} for file ${i + 1}…`,
            );
          }
          const { data: created, error: e } = await supabase
            .from("assignments")
            .insert({
              customer_id: r.propertyId,
              title: target.title,
              notes: r.notes.trim() || null,
              file_path: path,
              file_url: publicUrl,
              file_kind: kind,
              uploaded_by: employee.id,
              active: true,
              assignment_type: r.assignmentType,
              scheduled_date: r.scheduledDate || null,
            })
            .select()
            .single();
          if (e) throw e;

          // Fire-and-forget auto-translation for the first one only; siblings
          // sharing the same file will read the translation from any sibling
          // since file_url is identical. (Keeps API costs down for big batches.)
          if (t === 0) {
            autoTranslateAssignment(created.id, publicUrl, kind);
          }

          const { error: te } = await supabase
            .from("assignment_targets")
            .insert({
              assignment_id: created.id,
              unit_id: target.unit_id,
              party_id: target.party_id,
              status: "pending",
              priority: !!r.priority,
              assigned_to: r.assignedTo || null,
            });
          if (te) throw te;
          totalCreated++;
        }
      }
      setProgress(
        `Done — ${totalCreated} assignment${totalCreated === 1 ? "" : "s"} created.`,
      );
      setTimeout(() => onSaved(), 400);
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200 sticky top-0 bg-stone-50 z-10">
        <button
          onClick={onCancel}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100"
        >
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
            New assignments
          </div>
          <div className="font-serif text-xl text-stone-900">
            Upload &amp; assign
          </div>
        </div>
      </div>

      <div className="px-5 pt-6">
        {/* File picker — always available, can add more */}
        <label className="block w-full p-6 border-2 border-dashed border-stone-300 rounded-2xl text-center cursor-pointer hover:border-stone-900 transition-colors mb-4">
          <Plus size={28} className="mx-auto mb-2 text-stone-500" />
          <div className="text-stone-700 font-medium text-sm">
            {rows.length === 0
              ? "Pick one or more PDFs / images"
              : "Add more files"}
          </div>
          <div className="text-xs text-stone-500 mt-0.5">
            You can configure each one below before saving
          </div>
          <input
            type="file"
            accept="application/pdf,image/*"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
        </label>

        {rows.length === 0 && (
          <div className="text-center py-8 text-stone-400 text-sm">
            No files yet. Pick some files to get started.
          </div>
        )}

        {/* Per-file configuration rows */}
        <div className="space-y-3">
          {rows.map((row, idx) => {
            const prop = allProperties.find((p) => p.id === row.propertyId);
            const isMulti = prop?.property_type === "multi_unit";
            const units = unitsByProperty[row.propertyId] || [];
            const rowParties = (
              units.find((u) => u.id === row.unitId)?.parties || []
            )
              .filter((p) => p.active)
              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            const isPdf =
              row.file.type === "application/pdf" ||
              /\.pdf$/i.test(row.file.name);

            return (
              <div
                key={row.id}
                className="p-4 rounded-2xl bg-white border border-stone-200"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center">
                    {isPdf ? (
                      <FileText size={18} className="text-stone-600" />
                    ) : (
                      <ImageIcon size={18} className="text-stone-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-stone-500 truncate">
                      {row.file.name}
                    </div>
                    <div className="text-[10px] font-mono text-stone-400">
                      {(row.file.size / 1024).toFixed(0)} KB · #{idx + 1}
                    </div>
                  </div>
                  <button
                    onClick={() => removeRow(row.id)}
                    disabled={busy}
                    className="p-2 rounded-full hover:bg-stone-100 text-stone-500"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Cleaning type — empty default forces an active pick.
                     Sits at the top of the config since user wants this
                     decision early in the flow. */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1 block">
                        Cleaning type <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={row.assignmentType}
                        onChange={(e) =>
                          updateRow(row.id, { assignmentType: e.target.value })
                        }
                        className={`w-full px-3 py-2 rounded-lg border bg-white text-sm ${row.assignmentType ? "border-stone-300" : "border-amber-400"}`}
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
                      <label className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1 block">
                        Due date{" "}
                        <span className="text-stone-400 normal-case">
                          (optional)
                        </span>
                      </label>
                      <input
                        type="date"
                        value={row.scheduledDate}
                        onChange={(e) =>
                          updateRow(row.id, { scheduledDate: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm"
                      />
                    </div>
                  </div>

                  {/* Priority + Assignee — both optional. Priority sorts to
                     top of cleaner lists and shows urgent badge. Assignee
                     pins to a specific cleaner (others can still see it). */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1 block">
                        Priority
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          updateRow(row.id, { priority: !row.priority })
                        }
                        className={`w-full px-3 py-2 rounded-lg border text-sm flex items-center justify-center gap-1.5 transition-colors ${row.priority ? "border-red-400 bg-red-50 text-red-800" : "border-stone-300 bg-white text-stone-500"}`}
                      >
                        {row.priority ? <AlertCircle size={14} /> : null}
                        {row.priority
                          ? "Priority — do first"
                          : "Mark as priority"}
                      </button>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1 block">
                        Assign to{" "}
                        <span className="text-stone-400 normal-case">
                          (optional)
                        </span>
                      </label>
                      <select
                        value={row.assignedTo}
                        onChange={(e) =>
                          updateRow(row.id, { assignedTo: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm"
                      >
                        <option value="">Anyone</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                            {e.role === "manager" ? " (manager)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1 block">
                      Title
                    </label>
                    <input
                      type="text"
                      value={row.title}
                      onChange={(e) =>
                        updateRow(row.id, { title: e.target.value })
                      }
                      placeholder={
                        row.scope === "multiple"
                          ? "Auto-filled per bedroom on save"
                          : "Pick a unit + bedroom to auto-fill"
                      }
                      disabled={row.scope === "multiple"}
                      className={`w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm ${row.scope === "multiple" ? "opacity-60 bg-stone-50" : ""}`}
                    />
                    {row.assignmentType && (
                      <div className="mt-1 text-[10px] font-mono text-stone-500">
                        Cleaning type:{" "}
                        <span className="text-amber-700 font-medium">
                          {assignmentTypeLabel(row.assignmentType)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1 block">
                      Notes (optional)
                    </label>
                    <textarea
                      value={row.notes}
                      onChange={(e) =>
                        updateRow(row.id, { notes: e.target.value })
                      }
                      rows={2}
                      placeholder="Standing instructions or context…"
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1 block">
                      Property
                    </label>
                    <select
                      value={row.propertyId}
                      onChange={(e) =>
                        changeRowProperty(row.id, e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm"
                    >
                      {allProperties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.property_type === "multi_unit"
                            ? " (multi-unit)"
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isMulti && (
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1 block">
                        Send to
                      </label>
                      {/* Scope toggle: single bedroom vs multiple. Switching
                         resets the OTHER side's state to avoid confusion
                         when saving. */}
                      <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl mb-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateRow(row.id, {
                              scope: "single",
                              multipleTargets: [],
                            })
                          }
                          className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors ${(row.scope || "single") === "single" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
                        >
                          Single bedroom
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateRow(row.id, {
                              scope: "multiple",
                              unitId: "",
                              partyId: "",
                            })
                          }
                          className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors ${row.scope === "multiple" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
                        >
                          Multiple bedrooms
                        </button>
                      </div>

                      {(row.scope || "single") === "single" ? (
                        <div className="grid grid-cols-2 gap-2">
                          <SearchableUnitPicker
                            units={units}
                            value={row.unitId}
                            placeholder="Pick a unit…"
                            onChange={(newUnitId) =>
                              autoPrefixFor(row.id, newUnitId, "")
                            }
                          />
                          <select
                            value={row.partyId}
                            onChange={(e) =>
                              autoPrefixFor(row.id, row.unitId, e.target.value)
                            }
                            disabled={!row.unitId}
                            className="px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm disabled:opacity-50"
                          >
                            <option value="">Bedroom…</option>
                            {rowParties.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        // Multi mode: tree of units → bedrooms with
                        // checkboxes. "Select all" per unit makes it
                        // easy to assign one PDF to every bedroom in a
                        // building.
                        <div className="space-y-1.5 max-h-72 overflow-y-auto border border-stone-200 rounded-xl p-2 bg-stone-50">
                          {/* Search box to filter units */}
                          <input
                            type="text"
                            value={unitSearches[row.id] || ""}
                            onChange={(e) =>
                              setUnitSearch(row.id, e.target.value)
                            }
                            placeholder="Filter units…"
                            className="w-full px-2 py-1.5 rounded-lg border border-stone-300 bg-white text-xs mb-1"
                          />
                          {(() => {
                            const q = (unitSearches[row.id] || "")
                              .trim()
                              .toLowerCase();
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
                                  (a, b) =>
                                    (a.sort_order || 0) - (b.sort_order || 0),
                                );
                              const allSelected =
                                activeParties.length > 0 &&
                                activeParties.every((p) =>
                                  row.multipleTargets.some(
                                    (t) =>
                                      t.unitId === u.id &&
                                      (t.partyId || null) === p.id,
                                  ),
                                );
                              const someSelected = activeParties.some((p) =>
                                row.multipleTargets.some(
                                  (t) =>
                                    t.unitId === u.id &&
                                    (t.partyId || null) === p.id,
                                ),
                              );
                              return (
                                <div
                                  key={u.id}
                                  className="bg-white rounded-lg border border-stone-200 p-2"
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleAllInUnit(row.id, u)}
                                    className="w-full flex items-center gap-2 mb-1 text-left"
                                  >
                                    <div
                                      className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${allSelected ? "border-amber-600 bg-amber-600" : someSelected ? "border-amber-600 bg-amber-100" : "border-stone-300"}`}
                                    >
                                      {allSelected && (
                                        <Check
                                          size={11}
                                          className="text-white"
                                        />
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
                                        const checked =
                                          row.multipleTargets.some(
                                            (t) =>
                                              t.unitId === u.id &&
                                              (t.partyId || null) === p.id,
                                          );
                                        return (
                                          <button
                                            key={p.id}
                                            type="button"
                                            onClick={() =>
                                              toggleTarget(row.id, u.id, p.id)
                                            }
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
                          {row.multipleTargets.length > 0 &&
                            (() => {
                              // Compute the generated titles so the user sees
                              // exactly what each assignment will be named.
                              const generated = row.multipleTargets.map((t) => {
                                const u = units.find(
                                  (uu) => uu.id === t.unitId,
                                );
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
                                    Creating {row.multipleTargets.length}{" "}
                                    assignment
                                    {row.multipleTargets.length === 1
                                      ? ""
                                      : "s"}
                                    :
                                  </div>
                                  <div className="text-amber-900 mt-0.5">
                                    {preview}
                                    {more}
                                  </div>
                                  {row.assignmentType && (
                                    <div className="text-stone-500 mt-0.5">
                                      Type:{" "}
                                      <span className="text-amber-700">
                                        {assignmentTypeLabel(
                                          row.assignmentType,
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Inline submit area at bottom of the page (NOT fixed — avoids overlap with the manager nav bar) */}
        {rows.length > 0 && (
          <div className="mt-6 space-y-3">
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
            <button
              onClick={saveAll}
              disabled={busy}
              className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium disabled:opacity-50"
            >
              {busy
                ? "Uploading…"
                : `Save ${rows.length} assignment${rows.length === 1 ? "" : "s"}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
