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

export function AssignmentWorkHistory({
  propertyId,
  unitId,
  partyId,
  employee,
  defaultOpen = false,
  onReopen = null,
}) {
  const [rows, setRows] = useState([]);
  const [loose, setLoose] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [show, setShow] = useState(defaultOpen);
  const [reopening, setReopening] = useState(null);

  useEffect(() => {
    if (!show || !unitId) return;
    let cancelled = false;
    (async () => {
      const [tRes, bRes] = await Promise.all([
        supabase
          .from("assignment_targets")
          .select(
            "id, status, completed_at, assignment_id, assignment:assignments(id, assignment_type, title, created_at, deleted_at)",
          )
          .eq("unit_id", unitId)
          .eq("party_id", partyId),
        supabase
          .from("work_blocks")
          .select(
            "id, start_time, end_time, unit_id, party_id, assignment_id, shift:shifts!inner(customer_id, employee:employees(id, name)), tasks(*, photos(*))",
          )
          .eq("unit_id", unitId)
          .eq("party_id", partyId)
          .order("start_time", { ascending: false }),
      ]);
      if (cancelled) return;
      const targets = (tRes.data || []).filter(
        (t) => t.assignment && !t.assignment.deleted_at,
      );
      const blocks = (bRes.data || []).filter(
        (b) => b.shift?.customer_id === propertyId,
      );

      // One row per assignment.
      const byAsg = new Map();
      targets.forEach((t) => {
        const a = t.assignment;
        if (!byAsg.has(a.id)) {
          byAsg.set(a.id, {
            id: a.id,
            type: a.assignment_type || "",
            title: a.title || "",
            createdAt: a.created_at,
            total: 0,
            done: 0,
            lastDone: null,
            blocks: [],
          });
        }
        const r = byAsg.get(a.id);
        r.total++;
        if (t.status === "done") {
          r.done++;
          if (t.completed_at && (!r.lastDone || t.completed_at > r.lastDone))
            r.lastDone = t.completed_at;
        }
      });
      const list = Array.from(byAsg.values());

      // Attach each session to its assignment. Prefer the REAL link: a block
      // tagged with assignment_id goes straight to that assignment — no
      // guessing, so a trash-out and a move-out at the same bedroom never
      // merge. Only blocks with no tag (legacy, pre-v64) fall back to the old
      // time-window match.
      const byId = new Map(list.map((r) => [r.id, r]));
      const unmatched = [];
      blocks.forEach((b) => {
        if (b.assignment_id && byId.has(b.assignment_id)) {
          byId.get(b.assignment_id).blocks.push(b);
          return;
        }
        if (b.assignment_id && !byId.has(b.assignment_id)) {
          // Tagged, but that assignment has no targets at this bedroom in the
          // current set (deleted or filtered) — don't cross-attribute it.
          unmatched.push(b);
          return;
        }
        // Legacy untagged block: fall back to the time window.
        const t = new Date(b.start_time).getTime();
        const hit = list.find((r) => {
          const from = new Date(r.createdAt).getTime();
          const to = r.lastDone
            ? new Date(r.lastDone).getTime() + 86400000
            : Date.now();
          return t >= from && t <= to;
        });
        if (hit) hit.blocks.push(b);
        else unmatched.push(b);
      });
      list.sort(
        (a, b) =>
          new Date(b.lastDone || b.createdAt) -
          new Date(a.lastDone || a.createdAt),
      );
      setRows(list);
      setLoose(unmatched);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [show, unitId, partyId, propertyId]);

  const photosOf = (b) =>
    (b.tasks || []).flatMap((t) =>
      (t.photos || []).filter((p) => !p.deleted_at),
    );
  // Photos already carry a kind. Dumping them in one grid throws that
  // away — and before/after IS the point when you're deciding whether a
  // bedroom needs redoing.
  const PHOTO_GROUPS = [
    { key: "before", label: "Before", cls: "bg-stone-200 text-stone-700" },
    { key: "after", label: "After", cls: "bg-emerald-100 text-emerald-800" },
    { key: "damage", label: "Damage", cls: "bg-red-100 text-red-700" },
    {
      key: KIND_CANNOT,
      label: "Couldn't clean",
      cls: "bg-yellow-100 text-yellow-800",
    },
  ];
  const photoGrid = (pics) => {
    const groups = PHOTO_GROUPS.map((g) => ({
      ...g,
      items: pics.filter((p) => p.kind === g.key),
    })).filter((g) => g.items.length > 0);
    const tagged = groups.reduce((n, g) => n + g.items.length, 0);
    const untagged = pics.filter(
      (p) => !PHOTO_GROUPS.some((g) => g.key === p.kind),
    );
    if (untagged.length)
      groups.push({
        key: "other",
        label: "Untagged",
        cls: "bg-stone-100 text-stone-500",
        items: untagged,
      });
    return groups.map((g) => (
      <div key={g.key} className="mt-2">
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${g.cls}`}
          >
            {g.label}
          </span>
          <span className="text-[10px] font-mono text-stone-400">
            {g.items.length}
          </span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
          {g.items.map((p) => (
            <a
              key={p.id}
              href={p.public_url}
              target="_blank"
              rel="noopener noreferrer"
              className="aspect-square rounded-lg overflow-hidden bg-stone-200 block relative"
            >
              <img
                loading="lazy"
                src={p.public_url}
                alt={g.label}
                className="w-full h-full object-cover"
              />
              <span
                className={`absolute top-0.5 left-0.5 text-[8px] font-mono px-1 rounded ${g.cls}`}
              >
                {g.label[0]}
              </span>
            </a>
          ))}
        </div>
      </div>
    ));
  };
  const peopleOf = (r) => [
    ...new Set(r.blocks.map((b) => b.shift?.employee?.name).filter(Boolean)),
  ];

  const renderBlocks = (blocks) =>
    blocks.map((b) => {
      const pics = photosOf(b);
      const running = !b.end_time;
      const ms = b.end_time
        ? new Date(b.end_time) - new Date(b.start_time)
        : Date.now() - new Date(b.start_time);
      return (
        <div
          key={b.id}
          className="mt-2 p-3 rounded-xl bg-stone-50 border border-stone-200"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-mono text-stone-700 flex items-center gap-1.5">
              {running && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
              {b.shift?.employee?.name || "?"}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-stone-400">
                {fmtDateWithDay(b.start_time)} · {fmtClock(b.start_time)}
                {b.end_time ? `–${fmtClock(b.end_time)}` : " · running"} ·{" "}
                {fmtTimeShort(ms)}
              </span>
              {/* Reopen this exact session. Closed blocks (incl. ones the app
               force-closed on sign-out) can be reopened one by one — the
               cleaner picks which, nothing is guessed. A running block
               shows a live dot instead of a button. */}
              {onReopen &&
                (running ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                    <Pause size={9} /> Open now
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setReopening(b.id);
                      onReopen(b);
                    }}
                    disabled={reopening === b.id}
                    title="Reopen this session — add photos, notes and tasks to it"
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-900 text-white inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <Play size={9} />{" "}
                    {reopening === b.id ? "Opening…" : "Reopen"}
                  </button>
                ))}
            </span>
          </div>
          <div className="text-[10px] font-mono text-stone-400 mt-1">
            {(b.tasks || []).length}{" "}
            {(b.tasks || []).length === 1 ? "task" : "tasks"} · {pics.length}{" "}
            {pics.length === 1 ? "photo" : "photos"}
            {(() => {
              const bef = pics.filter((p) => p.kind === "before").length;
              const aft = pics.filter((p) => p.kind === "after").length;
              return bef || aft ? ` · ${bef} before, ${aft} after` : "";
            })()}
          </div>
          {pics.length > 0 && photoGrid(pics)}
          {(b.tasks || []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {(b.tasks || []).map((t) => (
                <span
                  key={t.id}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-stone-200 text-stone-600"
                >
                  {t.name || t.template_item_key || "Task"}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    });

  return (
    <div className="mt-4">
      <button
        onClick={() => setShow((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-white border border-stone-200 active:scale-98 transition-transform"
      >
        <span className="text-xs uppercase tracking-wider font-mono text-stone-500 flex items-center gap-2">
          <Camera size={13} /> Bedroom history
        </span>
        <ChevronRight
          size={15}
          className={`text-stone-400 transition-transform ${show ? "rotate-90" : ""}`}
        />
      </button>

      {show && (
        <div className="mt-2 space-y-2">
          {!loaded ? (
            <div className="text-center py-6 text-stone-400 text-sm">
              Loading…
            </div>
          ) : rows.length === 0 && loose.length === 0 ? (
            <div className="text-center py-6 text-stone-400 text-sm">
              Nothing has been cleaned here yet.
            </div>
          ) : (
            <>
              {rows.map((r) => {
                const open = openId === r.id;
                const people = peopleOf(r);
                const pics = r.blocks.flatMap(photosOf).length;
                const running = r.blocks.some((b) => !b.end_time);
                const isDone = r.total > 0 && r.done >= r.total;
                return (
                  <div
                    key={r.id}
                    className="rounded-2xl bg-white border border-stone-200 overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenId(open ? null : r.id)}
                      className="w-full text-left p-3.5 hover:bg-stone-50"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                              running
                                ? "bg-emerald-100 text-emerald-800"
                                : isDone
                                  ? "bg-stone-900 text-white"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {running
                              ? "In progress"
                              : isDone
                                ? "Done"
                                : "Not finished"}
                          </span>
                          {r.type && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                              {assignmentTypeLabel(r.type)}
                            </span>
                          )}
                        </span>
                        <ChevronRight
                          size={14}
                          className={`text-stone-400 transition-transform ${open ? "rotate-90" : ""}`}
                        />
                      </div>
                      <div className="text-xs font-mono text-stone-600 mt-1.5">
                        {isDone && r.lastDone
                          ? `Completed ${fmtDateWithDay(r.lastDone)}`
                          : running
                            ? "Being cleaned right now"
                            : `Started ${fmtDateWithDay(r.createdAt)}`}
                      </div>
                      <div className="text-[10px] font-mono text-stone-400 mt-0.5">
                        {people.length > 0
                          ? people.join(", ")
                          : "Nobody clocked in"}{" "}
                        · {r.done}/{r.total} items · {pics}{" "}
                        {pics === 1 ? "photo" : "photos"}
                      </div>
                    </button>
                    {open && (
                      <div className="px-3.5 pb-3.5 border-t border-stone-100">
                        {r.blocks.length === 0 ? (
                          <div className="text-[11px] text-stone-400 mt-2">
                            No clocked sessions on this one.
                          </div>
                        ) : (
                          renderBlocks(r.blocks)
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {loose.length > 0 && (
                <div className="rounded-2xl bg-white border border-stone-200 p-3.5">
                  <div className="text-[10px] uppercase tracking-wider font-mono text-stone-400">
                    Other sessions at this bedroom
                  </div>
                  {renderBlocks(loose)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
