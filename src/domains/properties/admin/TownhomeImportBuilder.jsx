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

export function TownhomeImportBuilder({ property, onSaved }) {
  const [text, setText] = useState("");
  const [defaultBedrooms, setDefaultBedrooms] = useState(0); // 0 = single party (family); 1+ = per-bedroom
  const [rows, setRows] = useState([]); // [{ label, bedrooms, error }]
  const [parsed, setParsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  // Parse the raw text input. Accepts CSV (commas), TSV (tabs from Excel),
  // and one-per-line. Each row can be just a label, or "label, bedrooms".
  const parse = () => {
    setError("");
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) {
      setError("No rows to import.");
      setRows([]);
      setParsed(false);
      return;
    }
    // Detect if the first line looks like a header
    const HEADER_HINTS =
      /^(label|name|unit|townhome|address|house|number|bedrooms?|beds)\b/i;
    const startIdx = HEADER_HINTS.test(lines[0]) ? 1 : 0;
    const dataLines = lines.slice(startIdx);

    const parsedRows = dataLines.map((line, i) => {
      // Split by tab first (Excel paste), then comma
      const cells = line.includes("\t") ? line.split("\t") : line.split(",");
      const label = (cells[0] || "").trim();
      let bedrooms = defaultBedrooms;
      if (cells[1] !== undefined && cells[1].trim() !== "") {
        const n = parseInt(cells[1].trim(), 10);
        if (!isNaN(n) && n >= 0 && n <= 20) bedrooms = n;
      }
      let rowError = null;
      if (!label) rowError = "Empty label";
      return { lineNum: i + startIdx + 1, label, bedrooms, error: rowError };
    });

    // Check for duplicate labels within the file
    const seen = new Map();
    parsedRows.forEach((r) => {
      if (!r.label || r.error) return;
      if (seen.has(r.label.toLowerCase())) {
        r.error = `Duplicate of row ${seen.get(r.label.toLowerCase())}`;
      } else {
        seen.set(r.label.toLowerCase(), r.lineNum);
      }
    });

    setRows(parsedRows);
    setParsed(true);
  };

  // Auto-parse when text changes (debounced via React's batching)
  useEffect(() => {
    if (text.trim()) parse();
    else {
      setRows([]);
      setParsed(false);
    }
    // eslint-disable-next-line
  }, [text, defaultBedrooms]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large (max 5MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = ev.target.result;
        // For CSV-like text, just use it. For .xlsx binary, we can't parse
        // without an Excel library — but most users save as CSV anyway.
        if (file.name.match(/\.xlsx?$/i)) {
          setError(
            "Excel files (.xlsx) aren't directly supported. Save as CSV from Excel (File → Save As → CSV) and try again. Or copy-paste rows directly into the box below.",
          );
          return;
        }
        setText(typeof result === "string" ? result : "");
      } catch (err) {
        setError("Could not read file: " + (err.message || "unknown error"));
      }
    };
    reader.onerror = () => setError("File read failed.");
    reader.readAsText(file);
  };

  const validRows = rows.filter((r) => !r.error);
  const errorRows = rows.filter((r) => r.error);
  const totalUnits = validRows.length;
  const totalParties = validRows.reduce(
    (s, r) => s + Math.max(1, r.bedrooms),
    0,
  );

  const create = async () => {
    if (totalUnits === 0) return;
    if (
      !confirm(
        `Create ${totalUnits} townhome${totalUnits === 1 ? "" : "s"} and ${totalParties} bedrooms/parties under "${property.name}"? This can't be undone in bulk.`,
      )
    )
      return;

    setBusy(true);
    setError("");
    setProgress("Creating townhomes…");

    // Insert units in chunks
    const CHUNK = 50;
    const unitRows = validRows.map((r, i) => ({
      customer_id: property.id,
      label: r.label,
      kind: "townhome",
      sort_order: i,
      active: true,
    }));

    const createdUnits = [];
    for (let i = 0; i < unitRows.length; i += CHUNK) {
      const slice = unitRows.slice(i, i + CHUNK);
      setProgress(
        `Creating townhomes ${i + 1}–${Math.min(i + CHUNK, unitRows.length)} of ${unitRows.length}…`,
      );
      const { data, error: e } = await supabase
        .from("units")
        .insert(slice)
        .select();
      if (e) {
        setBusy(false);
        setError(`Failed at townhome batch ${i + 1}: ${e.message}`);
        return;
      }
      createdUnits.push(...(data || []));
    }

    // For each townhome, create the right number of parties.
    // bedrooms === 0 → 1 "Main" party (family housing, single cleaning task)
    // bedrooms >= 1 → that many "Bedroom N" parties (student housing style)
    const partyRows = [];
    createdUnits.forEach((u, idx) => {
      const r = validRows[idx];
      if (!r) return;
      if (r.bedrooms === 0) {
        partyRows.push({
          unit_id: u.id,
          label: "Main",
          sort_order: 1,
          active: true,
        });
      } else {
        for (let p = 1; p <= r.bedrooms; p++) {
          partyRows.push({
            unit_id: u.id,
            label: `Bedroom ${p}`,
            sort_order: p,
            active: true,
          });
        }
      }
    });

    for (let i = 0; i < partyRows.length; i += CHUNK) {
      const slice = partyRows.slice(i, i + CHUNK);
      setProgress(
        `Creating parties ${i + 1}–${Math.min(i + CHUNK, partyRows.length)} of ${partyRows.length}…`,
      );
      const { error: e } = await supabase.from("parties").insert(slice);
      if (e) {
        setBusy(false);
        setError(`Failed at party batch ${i + 1}: ${e.message}`);
        return;
      }
    }

    setBusy(false);
    onSaved();
  };

  return (
    <div className="px-5 pt-2 space-y-5">
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900 space-y-2">
        <div>
          <strong>How it works:</strong> upload a CSV or paste rows directly
          from Excel.
        </div>
        <div className="text-xs text-amber-800 space-y-1">
          <div>
            <strong>One column:</strong> just the townhome label (one per line).
            Each will be a single unit with however many bedrooms you set as the
            default below.
          </div>
          <div>
            <strong>Two columns:</strong> label, bedrooms (per row). Example:{" "}
            <code className="font-mono bg-white/60 px-1 rounded">204, 3</code> =
            townhome "204" with 3 bedrooms. Use{" "}
            <code className="font-mono bg-white/60 px-1 rounded">0</code> for
            family housing (one cleaning unit, not split by bedrooms).
          </div>
          <div>
            <strong>Headers:</strong> first row is auto-detected if it looks
            like a header (e.g. "label", "address", "bedrooms").
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
          Default bedrooms per townhome (if not specified in CSV)
        </label>
        <div className="grid grid-cols-6 gap-2">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setDefaultBedrooms(n)}
              type="button"
              className={`py-3 rounded-xl border-2 font-mono text-sm transition-all ${defaultBedrooms === n ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-200 bg-white text-stone-700"}`}
            >
              {n === 0 ? "Family" : n}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-stone-500 mt-1.5">
          {defaultBedrooms === 0
            ? "Family housing — each townhome is one cleaning unit (no per-bedroom split)."
            : `Each townhome will have ${defaultBedrooms} bedrooms unless the CSV specifies otherwise.`}
        </p>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
          Upload CSV file
        </label>
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={handleFileUpload}
          className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 bg-white"
        />
        <p className="text-[11px] text-stone-500 mt-1">
          From Excel: File → Save As → CSV. Or copy rows directly into the box
          below.
        </p>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
          Or paste rows here
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={`204\n206\n208, 3\n210, 4`}
          className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono text-sm resize-y"
        />
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {parsed && rows.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              Preview
            </div>
            <div className="text-xs font-mono text-stone-500">
              {totalUnits} valid · {errorRows.length} error
              {errorRows.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto border border-stone-200 rounded-xl bg-white">
            {rows.map((r, i) => (
              <div
                key={i}
                className={`px-3 py-2 text-sm border-b border-stone-100 last:border-b-0 flex items-center justify-between gap-2 ${r.error ? "bg-red-50" : ""}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono text-stone-400 w-6 flex-shrink-0">
                    {r.lineNum}
                  </span>
                  <span
                    className={`font-mono ${r.error ? "text-red-700 line-through" : "text-stone-900"}`}
                  >
                    {r.label || "(empty)"}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.error ? (
                    <span className="text-[10px] text-red-600 font-mono">
                      {r.error}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-stone-500">
                      {r.bedrooms === 0
                        ? "family (1 party)"
                        : `${r.bedrooms} bedroom${r.bedrooms === 1 ? "" : "s"}`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {totalUnits > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-stone-100 text-xs text-stone-700 font-mono">
              Total: {totalUnits} townhomes · {totalParties} parties
            </div>
          )}
        </div>
      )}

      {busy && progress && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm">
          {progress}
        </div>
      )}

      <button
        onClick={create}
        disabled={busy || totalUnits === 0}
        className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
      >
        {busy
          ? "Creating…"
          : totalUnits > 0
            ? `Create ${totalUnits} townhome${totalUnits === 1 ? "" : "s"} & ${totalParties} parties`
            : "Add some rows first"}
      </button>

      <p className="text-xs text-stone-500 text-center">
        ⚠️ Errors above will be skipped. Duplicate labels with existing units
        will fail — pick fresh names.
      </p>
    </div>
  );
}
