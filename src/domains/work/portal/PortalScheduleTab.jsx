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

export function PortalScheduleTab({
  property,
  onOpenUnitDay,
  recentOpen,
  setRecentOpen,
}) {
  const [rows, setRows] = useState(null);
  // Whether "Recently done" is expanded is owned by PortalDashboard when
  // provided, so opening a job from that list and pressing Back reopens the
  // list instead of collapsing it.
  const [ownRecent, setOwnRecent] = useState(false);
  const showRecent = recentOpen !== undefined ? recentOpen : ownRecent;
  const toggleRecent = () =>
    setRecentOpen ? setRecentOpen(!showRecent) : setOwnRecent((v) => !v);
  const [attach, setAttach] = useState(null); // { url, kind, title } being viewed
  const todayKey = localTodayKey();

  const load = async () => {
    // This query used to have no ORDER BY, no .range() and no .limit(),
    // which meant PostgREST silently capped it at its max-rows setting and
    // returned an ARBITRARY slice of this property's assignments. Without a
    // sort key Postgres makes no promise about which rows come back, so the
    // same job could be present on one load and missing on the next with
    // nobody touching it — and re-creating it made it reappear. Ordered and
    // paginated now, so every assignment for the property is always loaded.
    const PAGE = 1000;
    let all = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("assignments")
        .select(
          "id, title, assignment_type, scheduled_date, file_url, file_kind, targets:assignment_targets(id, status, completed_at, template_section, unit_id, unit:units(label, bedrooms, bathrooms), party:parties(label))",
        )
        .eq("customer_id", property.id)
        .is("deleted_at", null)
        .order("scheduled_date", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true }) // tiebreak so paging can't skip or repeat
        .range(from, from + PAGE - 1);
      if (error) {
        console.error("[schedule] load failed", error);
        break;
      }
      all = all.concat(data || []);
      if (!data || data.length < PAGE) break;
    }
    setRows(all);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [property.id]);

  const fmtDay = (key) => {
    if (!key) return "";
    const [y, m, d] = String(key).slice(0, 10).split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const label = (unit, party) =>
    unitPartyLabel(unit?.label, party?.label) || "Job";

  // An assignment counts as still open if anything on it isn't done. A job
  // with no targets at all is treated as open too — it used to fall through
  // `.some()` returning false on an empty array and vanish from every list.
  const stillOpen = (a) => {
    const ts = a.targets || [];
    return ts.length === 0 || ts.some((t) => t.status !== "done");
  };

  // Overdue: open work whose date has already passed. Without this, a job
  // scheduled for today silently disappeared the moment the date rolled
  // over — too old for Upcoming, not finished so not in Recently done.
  const overdue = [];
  // Upcoming: assignments with a due date today-or-later, still open.
  const upcomingByDate = {};
  (rows || []).forEach((a) => {
    if (!a.scheduled_date) return;
    const k = String(a.scheduled_date).slice(0, 10);
    if (!stillOpen(a)) return;
    if (k < todayKey) {
      overdue.push(a);
      return;
    }
    (upcomingByDate[k] = upcomingByDate[k] || []).push(a);
  });
  const upcomingDates = Object.keys(upcomingByDate).sort();
  overdue.sort((a, b) =>
    String(a.scheduled_date).localeCompare(String(b.scheduled_date)),
  );
  const daysLate = (key) => {
    const [y, m, d] = String(key).slice(0, 10).split("-").map(Number);
    const [ty, tm, td] = todayKey.split("-").map(Number);
    return Math.round(
      (new Date(ty, tm - 1, td) - new Date(y, m - 1, d)) / 86400000,
    );
  };

  // Recently done: bedrooms fully finished in the last 3 days (one per job).
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 3);
  const recent = [];
  (rows || []).forEach((a) => {
    const ts = a.targets || [];
    if (ts.length === 0 || !ts.every((t) => t.status === "done")) return;
    const times = ts
      .map((t) => t.completed_at)
      .filter(Boolean)
      .map((x) => new Date(x));
    if (!times.length) return;
    const last = new Date(Math.max(...times));
    if (last < cutoff) return;
    recent.push({
      id: a.id,
      title: label(ts[0]?.unit, ts[0]?.party) || a.title || "Job",
      size: unitSizeLabel(ts[0]?.unit),
      type: a.assignment_type,
      when: last,
      items: ts.length,
      unitId: ts[0]?.unit_id || null,
      dayKey: localDayKey(last),
    });
  });
  recent.sort((x, y) => y.when - x.when);

  // One upcoming/overdue job card. Shared by both lists so the overdue
  // section can't drift from Upcoming.
  const renderJobCard = (a, late = 0) => {
    const ts = a.targets || [];
    const title = label(ts[0]?.unit, ts[0]?.party) || a.title || "Job";
    const size = unitSizeLabel(ts[0]?.unit);
    const byCat = {};
    const secLabel = {
      bedroom: "Bedroom",
      vanity: "Vanity",
      bathroom: "Bathroom",
      general: "General",
    };
    ts.forEach((t) => {
      const l =
        secLabel[t.template_section] ||
        (t.template_section
          ? t.template_section.charAt(0).toUpperCase() +
            t.template_section.slice(1)
          : "Other");
      byCat[l] = (byCat[l] || 0) + 1;
    });
    const cats = Object.entries(byCat);
    return (
      <div
        key={a.id}
        className={`rounded-2xl p-4 border ${late > 0 ? "bg-amber-50 border-amber-300" : "bg-white border-stone-200"}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-serif text-lg text-stone-900">{title}</span>
              {size && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200 flex-shrink-0">
                  {size}
                </span>
              )}
            </div>
            <div className="text-[11px] text-stone-500 font-mono mt-0.5">
              {a.assignment_type
                ? assignmentTypeLabel(a.assignment_type)
                : "Clean"}{" "}
              · {ts.length} item{ts.length === 1 ? "" : "s"}
            </div>
          </div>
          <span className="flex flex-col items-end gap-1 flex-shrink-0">
            {late > 0 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold">
                {late} day{late === 1 ? "" : "s"} late
              </span>
            )}
            {a.assignment_type && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                {assignmentTypeLabel(a.assignment_type)}
              </span>
            )}
          </span>
        </div>
        {cats.length > 0 && (
          <div className="mt-2.5 grid grid-cols-2 gap-x-8 gap-y-1 text-[11px] font-mono max-w-[16rem]">
            {cats.map(([l, n]) => (
              <div
                key={l}
                className="flex items-center justify-between border-b border-stone-100 pb-0.5"
              >
                <span className="text-stone-500">{l}</span>
                <span className="text-stone-800 font-semibold">{n}</span>
              </div>
            ))}
          </div>
        )}
        {a.file_url && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() =>
                setAttach({ url: a.file_url, kind: a.file_kind, title })
              }
              className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium flex items-center gap-1.5"
            >
              {a.file_kind === "pdf" ? (
                <FileText size={12} />
              ) : (
                <ImageIcon size={12} />
              )}{" "}
              View attachment
            </button>
          </div>
        )}
      </div>
    );
  };

  if (rows === null)
    return (
      <div className="px-5 py-10 text-center text-stone-400 text-sm">
        Loading…
      </div>
    );

  return (
    <div className="px-5 pt-5 pb-24 space-y-5">
      <ScreenId id="PM-SCHED" />
      <div>
        <h2 className="font-serif text-2xl text-stone-900 mb-1">Upcoming</h2>
        <p className="text-sm text-stone-600">
          Scheduled work for {property.name}.
        </p>
      </div>

      {overdue.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <AlertCircle size={16} className="text-amber-700 flex-shrink-0" />
            <span className="text-base font-bold text-amber-900">
              Overdue · {overdue.length}
            </span>
          </div>
          <p className="text-xs text-stone-600 mb-2.5">
            Past its date and not finished yet.
          </p>
          <div className="space-y-2">
            {overdue.map((a) => renderJobCard(a, daysLate(a.scheduled_date)))}
          </div>
        </div>
      )}

      {upcomingDates.length === 0 ? (
        <div className="text-center py-10 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
          Nothing scheduled ahead right now.
        </div>
      ) : (
        <div className="space-y-4">
          {upcomingDates.map((dk) => (
            <div key={dk}>
              <div className="flex items-center gap-2 mb-2.5">
                <span
                  className={`w-1 h-5 rounded-full flex-shrink-0 ${dk === todayKey ? "bg-emerald-600" : "bg-stone-300"}`}
                />
                <span
                  className={`text-base font-bold uppercase tracking-wide font-mono ${dk === todayKey ? "text-emerald-700" : "text-stone-800"}`}
                >
                  {dk === todayKey ? "Today · " : ""}
                  {fmtDay(dk)}
                </span>
              </div>
              <div className="space-y-2">
                {upcomingByDate[dk].map((a) => renderJobCard(a))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recently done — collapsed by default so it doesn't compete with History. */}
      <button
        onClick={toggleRecent}
        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-stone-100 text-stone-700 text-sm font-medium"
      >
        <span>
          Recently done · last 3 days
          {recent.length ? ` (${recent.length})` : ""}
        </span>
        <ChevronRight
          size={16}
          className={`transition-transform ${showRecent ? "rotate-90" : ""}`}
        />
      </button>
      {showRecent &&
        (recent.length === 0 ? (
          <div className="text-center py-6 text-stone-400 text-xs">
            Nothing completed in the last 3 days.
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((r) => {
              const canOpen = !!(onOpenUnitDay && r.unitId);
              return (
                <button
                  key={r.id}
                  onClick={() => canOpen && onOpenUnitDay(r.unitId, r.dayKey)}
                  disabled={!canOpen}
                  className={`w-full text-left rounded-xl bg-white border border-stone-200 px-4 py-3 flex items-center justify-between gap-2 ${canOpen ? "hover:border-stone-400 active:scale-[0.99] transition" : ""}`}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="font-serif text-sm text-stone-900 truncate">
                        {r.title}
                      </span>
                      {r.size && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200 flex-shrink-0">
                          {r.size}
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] font-mono text-stone-500 mt-0.5">
                      {r.type ? assignmentTypeLabel(r.type) : "Clean"} ·{" "}
                      {r.items} item{r.items === 1 ? "" : "s"}
                      {canOpen && (
                        <span className="text-stone-400">
                          {" "}
                          · tap for photos & details
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[11px] font-mono text-emerald-700 flex items-center gap-1">
                      <Check size={11} />{" "}
                      {r.when.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {canOpen && (
                      <ChevronRight size={14} className="text-stone-400" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      {/* Attachment viewer — the file tied to an upcoming assignment. */}
      {attach && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-3"
          onClick={() => setAttach(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-200">
              <span className="font-serif text-base text-stone-900 truncate">
                {attach.title}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={attach.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-mono text-stone-500 underline"
                >
                  Open
                </a>
                <button
                  onClick={() => setAttach(null)}
                  className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="overflow-auto flex-1 bg-stone-100 flex items-start justify-center">
              {attach.kind === "pdf" ? (
                <iframe
                  src={attach.url}
                  title="Attachment"
                  className="w-full h-[80vh]"
                />
              ) : (
                <img src={attach.url} alt="Attachment" className="max-w-full" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
