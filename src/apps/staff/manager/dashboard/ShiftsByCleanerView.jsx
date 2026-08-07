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
import { buildTargetTitle, unitSizeLabel, shortenBedroom } from "../../../../lib/labels.js";
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

export function ShiftsByCleanerView({
  shifts,
  showMoney,
  selectedCleanerId,
  onSelectCleaner,
  onOpenShift,
  currentEmployee,
  onReload,
}) {
  const [expandedDays, setExpandedDays] = useState(new Set());
  const toggleDay = (k) =>
    setExpandedDays((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  // Pay tracking. One row per cleaner per work day PER PROPERTY (v60) —
  // pay terms differ by property (Carriage Cove is hourly, Bridges and
  // Citifront are a flat rate per cleaning), so a single bundled day
  // total couldn't represent what's actually owed.
  const [payDays, setPayDays] = useState({}); // `${empId}:${dateKey}:${custId}` -> row
  const [payBusy, setPayBusy] = useState(null);
  const [adjusting, setAdjusting] = useState(null); // day key being edited
  const [adjH, setAdjH] = useState("");
  const [adjM, setAdjM] = useState("");
  const [settingPay, setSettingPay] = useState(null); // day key having a flat $ set
  const [payAmt, setPayAmt] = useState("");
  const monthStart = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();
  const payKey = (empId, dateKey, custId, asgId = null, unitId = null) =>
    `${empId}:${dateKey}:${custId}:${asgId || ""}:${unitId || ""}`;
  // Split one day's shifts by property. Every shift carries exactly one
  // customer_id, so these groups never overlap.
  const groupByProperty = (dayShifts) => {
    const m = new Map();
    (dayShifts || []).forEach((s) => {
      const cid = s.customer?.id || s.customer_id;
      if (!cid) return;
      if (!m.has(cid))
        m.set(cid, {
          id: cid,
          name: s.customer?.name || "Property",
          shifts: [],
        });
      m.get(cid).shifts.push(s);
    });
    return Array.from(m.values()).sort((a, b) =>
      naturalCompare(a.name, b.name),
    );
  };

  // Flat pay for a whole day / a property / a single assignment — overrides
  // hours x rate. Empty clears it. assignmentId set = a per-assignment line
  // (flat-rate properties); null = the old whole-day or per-property row.
  const saveFlatPay = async (
    empId,
    dateKey,
    custId,
    amount,
    assignmentId = null,
    unitId = null,
  ) => {
    if (!empId) {
      alert("No cleaner id — could not save pay.");
      return;
    }
    const key = payKey(empId, dateKey, custId, assignmentId, unitId);
    const existing = payDays[key];
    // Pre-split day rows (custId null) are still fully editable — they're
    // updated by row id, so they never need a property. Only creating a
    // brand-new row requires one.
    if (!custId && !existing?.id) {
      alert("No property on these shifts — could not save pay.");
      return;
    }
    const val = amount === "" || amount == null ? null : Number(amount);
    if (val != null && (isNaN(val) || val < 0)) {
      setSettingPay(null);
      return;
    }
    setPayBusy(key);
    let error;
    if (existing?.id) {
      ({ error } = await supabase
        .from("employee_pay_days")
        .update({ flat_amount: val })
        .eq("id", existing.id));
    } else {
      // No local row. A matching row could still exist server-side (e.g.
      // from Mark paid) — look it up by the full key rather than relying on
      // onConflict, since our uniqueness is an expression index that
      // PostgREST upsert can't target. Update if found, else insert.
      let q = supabase
        .from("employee_pay_days")
        .select("id")
        .eq("employee_id", empId)
        .eq("work_date", dateKey);
      q = custId ? q.eq("customer_id", custId) : q.is("customer_id", null);
      q = assignmentId
        ? q.eq("assignment_id", assignmentId)
        : q.is("assignment_id", null);
      q = unitId ? q.eq("unit_id", unitId) : q.is("unit_id", null);
      const { data: found } = await q.maybeSingle();
      if (found?.id) {
        ({ error } = await supabase
          .from("employee_pay_days")
          .update({ flat_amount: val })
          .eq("id", found.id));
      } else {
        ({ error } = await supabase.from("employee_pay_days").insert({
          employee_id: empId,
          work_date: dateKey,
          customer_id: custId,
          assignment_id: assignmentId,
          unit_id: unitId,
          flat_amount: val,
          created_by: currentEmployee?.id || null,
        }));
      }
    }
    setPayBusy(null);
    setSettingPay(null);
    if (error) {
      const missingCol =
        /flat_amount|customer_id|assignment_id|unit_id/.test(
          error.message || "",
        ) ||
        error.code === "42703" ||
        error.code === "PGRST204" ||
        error.code === "42P10";
      alert(
        "Could not save pay: " +
          (error.message || "unknown error") +
          (missingCol
            ? "\n\nPer-assignment pay isn't fully set up in your database yet. Run v65 and v66 in Supabase, then try again."
            : ""),
      );
      return;
    }
    await loadPay();
  };

  const loadPay = async () => {
    const { data, error } = await supabase
      .from("employee_pay_days")
      .select("*")
      .gte("work_date", monthStart);
    if (error) return; // table not created yet
    const m = {};
    (data || []).forEach((r) => {
      m[
        payKey(
          r.employee_id,
          r.work_date,
          r.customer_id,
          r.assignment_id,
          r.unit_id,
        )
      ] = r;
    });
    setPayDays(m);
  };
  useEffect(() => {
    loadPay(); /* eslint-disable-next-line */
  }, []);

  const payOwed = (dayShifts) => {
    const rate = Number(dayShifts[0]?.employee?.pay_rate_hourly) || 0;
    if (!rate) return 0;
    const ms = dayShifts
      .filter((s) => s.end_time)
      .reduce((sum, s) => sum + shiftBillableMs(s), 0);
    return (ms / 3600000) * rate;
  };
  const togglePaid = async (
    empId,
    dateKey,
    custId,
    amount,
    assignmentId = null,
    unitId = null,
  ) => {
    const key = payKey(empId, dateKey, custId, assignmentId, unitId);
    const existing = payDays[key];
    if (!custId && !existing?.id) {
      alert("No property on these shifts — could not save pay.");
      return;
    }
    setPayBusy(key);
    let error;
    if (existing?.paid_at) {
      ({ error } = await supabase
        .from("employee_pay_days")
        .update({ paid_at: null })
        .eq("id", existing.id));
    } else if (existing?.id) {
      ({ error } = await supabase
        .from("employee_pay_days")
        .update({ paid_at: new Date().toISOString(), amount })
        .eq("id", existing.id));
    } else {
      let q = supabase
        .from("employee_pay_days")
        .select("id")
        .eq("employee_id", empId)
        .eq("work_date", dateKey);
      q = custId ? q.eq("customer_id", custId) : q.is("customer_id", null);
      q = assignmentId
        ? q.eq("assignment_id", assignmentId)
        : q.is("assignment_id", null);
      q = unitId ? q.eq("unit_id", unitId) : q.is("unit_id", null);
      const { data: found } = await q.maybeSingle();
      if (found?.id) {
        ({ error } = await supabase
          .from("employee_pay_days")
          .update({ paid_at: new Date().toISOString(), amount })
          .eq("id", found.id));
      } else {
        ({ error } = await supabase.from("employee_pay_days").insert({
          employee_id: empId,
          work_date: dateKey,
          customer_id: custId,
          assignment_id: assignmentId,
          unit_id: unitId,
          paid_at: new Date().toISOString(),
          amount,
          created_by: currentEmployee?.id || null,
        }));
      }
    }
    setPayBusy(null);
    if (error) {
      const missingCol =
        /assignment_id|unit_id|customer_id|paid_at/.test(error.message || "") ||
        error.code === "42703" ||
        error.code === "PGRST204";
      alert(
        "Could not mark paid: " +
          (error.message || "unknown error") +
          (missingCol
            ? "\n\nYour database may be missing a pay column. Run v65 and v66 in Supabase, then try again."
            : ""),
      );
      return;
    }
    await loadPay();
  };
  // Set the TOTAL worked time for a whole day. manual_adjustment_seconds
  // is an OFFSET added to raw clocked time, so to make the day total the
  // target we solve for the offset instead of storing the target itself.
  // The offset lands on the day's longest finished shift; any other
  // shifts that day keep their own raw time, so the day sums to the target.
  const saveAdjust = async (dayShifts, hours, mins) => {
    const h = parseFloat(hours) || 0;
    const m = parseFloat(mins) || 0;
    if (hours === "" && mins === "") {
      setAdjusting(null);
      return;
    }
    const targetSec = Math.round(h * 3600 + m * 60);
    if (targetSec < 0) {
      setAdjusting(null);
      return;
    }
    if (!dayShifts.length) {
      setAdjusting(null);
      return;
    }

    // Force the WHOLE DAY to `targetSec`, however many shifts there are.
    // The old code only nudged the single longest shift, which can't work
    // when 19 shifts each carry ~13h — one negative offset can't cancel
    // 240h spread across the others (it clamps at zero). Instead:
    //   • the FIRST shift becomes the anchor and carries the full target
    //     (closed at start + target if it was open),
    //   • every other shift is zeroed — closed at its own start_time with
    //     adjustment 0, so it contributes nothing,
    //   • open work blocks under any of them get closed.
    // Net: the day reads exactly what you typed, and nothing keeps ticking.
    const anyOpen = dayShifts.some((s) => !s.end_time);
    if (
      anyOpen &&
      !confirm(
        "Some of these shifts were never clocked out. Set the whole day to the hours you entered and close them?",
      )
    ) {
      setAdjusting(null);
      return;
    }
    setPayBusy("adj");
    const ordered = dayShifts
      .slice()
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    const anchor = ordered[0];
    const anchorRawSec = anchor.end_time
      ? Math.max(
          0,
          (new Date(anchor.end_time) - new Date(anchor.start_time)) / 1000 -
            (anchor.idle_seconds || 0),
        )
      : 0;
    // If the anchor is still open, close it at start + target and use no
    // offset; if it's closed, keep its end_time and use an offset to reach
    // the target exactly.
    if (anchor.end_time) {
      await supabase
        .from("shifts")
        .update({
          manual_adjustment_seconds: Math.round(targetSec - anchorRawSec),
        })
        .eq("id", anchor.id);
    } else {
      const anchorEnd = new Date(
        new Date(anchor.start_time).getTime() + targetSec * 1000,
      ).toISOString();
      await supabase
        .from("shifts")
        .update({
          end_time: anchorEnd,
          manual_adjustment_seconds: 0,
          idle_seconds: 0,
        })
        .eq("id", anchor.id);
      await supabase
        .from("work_blocks")
        .update({ end_time: anchorEnd })
        .eq("shift_id", anchor.id)
        .is("end_time", null);
    }
    // Zero out every other shift on the day.
    for (const s of ordered.slice(1)) {
      await supabase
        .from("shifts")
        .update({
          end_time: s.start_time,
          manual_adjustment_seconds: 0,
          idle_seconds: 0,
        })
        .eq("id", s.id);
      await supabase
        .from("work_blocks")
        .update({ end_time: s.start_time })
        .eq("shift_id", s.id)
        .is("end_time", null);
    }
    setPayBusy(null);
    setAdjusting(null);
    onReload && onReload();
  };
  const isUnpaidStale = (dateKey, paid) => {
    if (paid) return false;
    if (dateKey < monthStart) return false; // don't chase old history
    return (
      Date.now() - new Date(dateKey + "T00:00:00").getTime() > 7 * 86400000
    );
  };

  // The cleaner list + inline detail render together at the bottom now
  // (accordion). renderCleanerDetail (below) handles one cleaner's days.

  // ---- One cleaner's day-by-day detail, rendered INLINE under their card in
  // the accordion below. Hoisted so the cleaner list can call it. -----------
  function renderCleanerDetail(cShifts) {
    const empId = cShifts[0]?.employee?.id;
    if (!cShifts.length) {
      return (
        <div className="text-center py-6 text-stone-400 text-xs border-2 border-dashed border-stone-200 rounded-2xl">
          No shifts in the selected dates.
        </div>
      );
    }
    const byDay = new Map();
    cShifts.forEach((s) => {
      const k = localDayKey(s.start_time);
      if (!byDay.has(k))
        byDay.set(k, { key: k, date: new Date(s.start_time), shifts: [] });
      byDay.get(k).shifts.push(s);
    });
    const days = Array.from(byDay.values()).sort((a, b) => b.date - a.date);
    return (
      <div className="space-y-2 pt-3 mt-3 border-t border-stone-100">
        {days.map((d) => {
          const totalMs = d.shifts
            .filter((s) => s.end_time)
            .reduce((sum, s) => sum + shiftBillableMs(s), 0);
          const billable = d.shifts.reduce(
            (sum, s) => sum + shiftBillableAmount(s, showMoney),
            0,
          );
          const blocks = d.shifts.reduce(
            (n, s) => n + (s.work_blocks?.length || 0),
            0,
          );
          const active = d.shifts.some((s) => !s.end_time);
          const multi = d.shifts.length > 1;
          const expanded = expandedDays.has(d.key);
          const props = Array.from(
            new Set(d.shifts.map((s) => s.customer?.name).filter(Boolean)),
          );
          return (
            <div
              key={d.key}
              className="rounded-2xl bg-white border border-stone-200 overflow-hidden"
            >
              <button
                onClick={() => {
                  if (multi) toggleDay(d.key);
                  else onOpenShift(d.shifts[0]);
                }}
                className="w-full text-left p-4 hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {active && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                    <span className="font-serif text-lg text-stone-900">
                      {d.date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {multi ? (
                    <ChevronRight
                      size={15}
                      className={`text-stone-400 transition-transform ${expanded ? "rotate-90" : ""}`}
                    />
                  ) : (
                    <ChevronRight size={15} className="text-stone-400" />
                  )}
                </div>
                {props.length > 0 && (
                  <div className="text-xs text-amber-700 font-mono mb-1.5 flex items-center gap-1.5">
                    <Building2 size={11} /> {props.join(" · ")}
                  </div>
                )}
                {/* Still-running shifts on a PAST day = forgotten clock-outs.
                   They tick forever and blow up the total (the 246h you saw).
                   Flag it and point at the fix. */}
                {(() => {
                  const stillOpen = d.shifts.filter((s) => !s.end_time).length;
                  const isToday =
                    d.key === new Date().toISOString().slice(0, 10);
                  const dayHrs = totalMs / 3600000;
                  // A single person can't bill much over ~16h in a day.
                  // Flag either still-running shifts OR a closed day whose
                  // total is impossibly long (forgotten clock-outs that got
                  // closed days later still read as huge).
                  const runaway = dayHrs > 16;
                  if ((stillOpen === 0 && !runaway) || isToday) return null;
                  return (
                    <div className="text-[11px] font-mono text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1 mb-1.5">
                      {stillOpen > 0
                        ? `${stillOpen} shift${stillOpen === 1 ? "" : "s"} never clocked out — still counting.`
                        : `${dayHrs.toFixed(0)}h on one day is almost certainly a forgotten clock-out.`}{" "}
                      Use Adjust hours to set the real time.
                    </div>
                  );
                })()}
                {/* What they actually cleaned, and when. The blocks were
                   already loaded with their unit/party labels — the card
                   just never showed them, so "3 blocks" was all you got. */}
                {(() => {
                  // One line per ASSIGNMENT, not per work block. A cleaner who
                  // clocks into the same job several times (start, step away,
                  // come back) made multiple blocks for ONE assignment — those
                  // collapse to a single line so E109 doesn't read as two jobs.
                  // Two genuinely different jobs at the same unit (a move-out
                  // AND a trash-out) have different assignment_ids, so they
                  // correctly stay as two lines, each labelled with its type.
                  // Legacy blocks with no assignment_id fall back to grouping
                  // by unit:party so nothing old collapses wrongly.
                  const allBlocks = d.shifts
                    .flatMap((s) =>
                      (s.work_blocks || []).map((b) => ({
                        ...b,
                        propName: s.customer?.name || "",
                      })),
                    )
                    .filter((b) => b.start_time);
                  if (allBlocks.length === 0) return null;
                  const groups = new Map();
                  allBlocks.forEach((b) => {
                    const key =
                      b.assignment_id ||
                      `${b.unit?.label || ""}:${b.party?.label || ""}`;
                    if (!groups.has(key)) {
                      groups.set(key, {
                        key,
                        label:
                          unitPartyLabel(b.unit?.label, b.party?.label) ||
                          "No bedroom set",
                        type: b.assignment?.assignment_type || "",
                        size: unitSizeLabel(b.unit),
                        firstStart: b.start_time,
                        lastEnd: b.end_time,
                        running: !b.end_time,
                        ms: 0,
                        visits: 0,
                      });
                    }
                    const g = groups.get(key);
                    g.visits += 1;
                    if (b.start_time < g.firstStart)
                      g.firstStart = b.start_time;
                    if (!b.end_time) g.running = true;
                    else if (!g.lastEnd || b.end_time > g.lastEnd)
                      g.lastEnd = b.end_time;
                    if (b.end_time)
                      g.ms += new Date(b.end_time) - new Date(b.start_time);
                  });
                  const lines = Array.from(groups.values()).sort(
                    (a, b) => new Date(a.firstStart) - new Date(b.firstStart),
                  );
                  const show = lines.slice(0, 6);
                  return (
                    <div className="mb-1.5 space-y-0.5">
                      {show.map((g) => (
                        <div
                          key={g.key}
                          className="flex items-center justify-between gap-2 text-[11px] font-mono"
                        >
                          <span className="text-stone-700 truncate">
                            {g.label}
                            {g.size ? (
                              <span className="text-stone-400">
                                {" "}
                                · {g.size}
                              </span>
                            ) : (
                              ""
                            )}
                            {g.type ? (
                              <span className="text-stone-400">
                                {" "}
                                · {assignmentTypeLabel(g.type)}
                              </span>
                            ) : (
                              ""
                            )}
                            {g.visits > 1 ? (
                              <span className="text-stone-400">
                                {" "}
                                · {g.visits} visits
                              </span>
                            ) : (
                              ""
                            )}
                          </span>
                          <span className="text-stone-400 flex-shrink-0">
                            {fmtClock(g.firstStart)}
                            {g.running
                              ? " · running"
                              : g.lastEnd
                                ? `–${fmtClock(g.lastEnd)}`
                                : ""}
                            {!g.running && g.ms > 0
                              ? ` · ${fmtTimeShort(g.ms)}`
                              : ""}
                          </span>
                        </div>
                      ))}
                      {lines.length > show.length && (
                        <div className="text-[10px] font-mono text-stone-400">
                          +{lines.length - show.length} more — open the day to
                          see them
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className="flex items-center justify-between text-xs text-stone-500 font-mono">
                  <span>
                    {d.shifts.length}{" "}
                    {d.shifts.length === 1 ? "shift" : "shifts"} · {blocks}{" "}
                    {blocks === 1 ? "block" : "blocks"} ·{" "}
                    {fmtTimeShort(totalMs)}
                  </span>
                  {showMoney && billable > 0 && (
                    <span className="text-emerald-700 font-medium">
                      {fmtMoney(billable)}
                    </span>
                  )}
                </div>
              </button>
              {showMoney &&
                (() => {
                  // Pay terms differ per property — Carriage Cove is hourly,
                  // Bridges and Citifront are a flat rate per cleaning — so the
                  // day is split into one payable strip per property instead of
                  // a single bundled total. Each strip is set and marked paid
                  // independently; the day total at the bottom just adds them up.
                  // A day that already has a pre-split pay row keeps the old
                  // bundled strip. Per-property pay starts from days that have
                  // no record yet — nothing historical is rewritten or hidden.
                  const legacyRow = payDays[payKey(empId, d.key, null)];
                  if (legacyRow) {
                    const hasFlat = legacyRow.flat_amount != null;
                    const owed = hasFlat
                      ? Number(legacyRow.flat_amount)
                      : payOwed(d.shifts);
                    const paid = !!legacyRow.paid_at;
                    const key = payKey(empId, d.key, null);
                    const stale = isUnpaidStale(d.key, paid);
                    return (
                      <div
                        className={`px-4 py-2.5 border-t ${stale ? "bg-amber-50 border-amber-200" : "border-stone-100"}`}
                      >
                        {/* Same top-row shape as the per-property strips: label on
                         the left, amount on the right, actions underneath. Keeps
                         "You owe" in one place down the whole cleaner card. */}
                        <div className="flex items-start justify-between gap-2 mb-1.5 flex-wrap">
                          <div className="min-w-0">
                            <div className="text-xs font-mono text-stone-600">
                              Whole day
                            </div>
                            <div className="text-[10px] font-mono text-stone-400 mt-0.5">
                              recorded before per-property pay
                            </div>
                          </div>
                          <div className="text-xs font-mono flex items-center gap-1.5 flex-shrink-0">
                            {!paid && owed > 0 && (
                              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-bold">
                                Owed
                              </span>
                            )}
                            <span>
                              <span className="text-stone-500">
                                {paid ? "Paid " : "You owe "}
                              </span>
                              <span className="text-stone-900 font-bold">
                                {owed > 0 ? fmtMoney(owed) : "—"}
                              </span>
                              {hasFlat && (
                                <span className="text-amber-700"> · flat</span>
                              )}
                              {stale && (
                                <span className="text-amber-700">
                                  {" "}
                                  · unpaid 7+ days
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {settingPay === key ? (
                            <span className="flex items-center gap-1">
                              <span className="text-[11px] text-stone-500 font-mono">
                                $
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                autoFocus
                                value={payAmt}
                                onChange={(e) => setPayAmt(e.target.value)}
                                placeholder="0.00"
                                className="w-20 px-1.5 py-0.5 rounded border border-stone-300 text-xs font-mono"
                              />
                              <button
                                onClick={() =>
                                  saveFlatPay(empId, d.key, null, payAmt)
                                }
                                disabled={payBusy === key}
                                className="text-[11px] px-2 py-0.5 rounded bg-stone-900 text-white"
                              >
                                Save
                              </button>
                              {hasFlat && (
                                <button
                                  onClick={() =>
                                    saveFlatPay(empId, d.key, null, "")
                                  }
                                  disabled={payBusy === key}
                                  className="text-[11px] px-1.5 text-red-600"
                                >
                                  Clear
                                </button>
                              )}
                              <button
                                onClick={() => setSettingPay(null)}
                                className="text-[11px] px-1 text-stone-500"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : adjusting === key ? (
                            <span className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                autoFocus
                                value={adjH}
                                onChange={(e) => setAdjH(e.target.value)}
                                placeholder="h"
                                className="w-12 px-1.5 py-0.5 rounded border border-stone-300 text-xs font-mono"
                              />
                              <span className="text-[10px] text-stone-400">
                                h
                              </span>
                              <input
                                type="number"
                                min="0"
                                max="59"
                                value={adjM}
                                onChange={(e) => setAdjM(e.target.value)}
                                placeholder="m"
                                className="w-12 px-1.5 py-0.5 rounded border border-stone-300 text-xs font-mono"
                              />
                              <span className="text-[10px] text-stone-400">
                                m
                              </span>
                              <button
                                onClick={() => saveAdjust(d.shifts, adjH, adjM)}
                                disabled={payBusy === "adj"}
                                className="text-[11px] px-2 py-0.5 rounded bg-stone-900 text-white"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setAdjusting(null)}
                                className="text-[11px] px-1 text-stone-500"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setSettingPay(key);
                                  setPayAmt(
                                    hasFlat
                                      ? String(legacyRow.flat_amount)
                                      : "",
                                  );
                                }}
                                className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 flex items-center gap-1"
                              >
                                <DollarSign size={10} />{" "}
                                {hasFlat ? "Edit pay" : "Set pay"}
                              </button>
                              <button
                                onClick={() => {
                                  setAdjusting(key);
                                  const cur = Math.round(totalMs / 60000);
                                  setAdjH(String(Math.floor(cur / 60)));
                                  setAdjM(String(cur % 60));
                                }}
                                className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 flex items-center gap-1"
                              >
                                <Clock size={10} /> Adjust hours
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => togglePaid(empId, d.key, null, owed)}
                            disabled={payBusy === key}
                            className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full flex items-center gap-1 disabled:opacity-50 ${paid ? "bg-emerald-600 text-white" : "bg-white border border-stone-300 text-stone-600"}`}
                          >
                            {paid ? (
                              <>
                                <Check size={10} /> Paid
                              </>
                            ) : (
                              "Mark paid"
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  }
                  const propGroups = groupByProperty(d.shifts);
                  if (propGroups.length === 0) {
                    return (
                      <div className="px-4 py-2.5 border-t border-stone-100 text-[11px] font-mono text-stone-400">
                        No property on these shifts — pay can't be split.
                      </div>
                    );
                  }
                  let dayOwed = 0,
                    dayPaid = 0;
                  const strips = [];
                  propGroups.forEach((pg) => {
                    const sample = pg.shifts[0];
                    const isHourly = sample?.customer?.bill_mode === "hourly";
                    // Hourly property (Carriage Cove): keep ONE grouped strip for
                    // the whole property, priced by hours — unchanged behavior.
                    if (isHourly) {
                      const key = payKey(empId, d.key, pg.id, null);
                      const row = payDays[key];
                      const hasFlat = row?.flat_amount != null;
                      const owed = hasFlat
                        ? Number(row.flat_amount)
                        : payOwed(pg.shifts);
                      const paid = !!row?.paid_at;
                      if (paid) dayPaid += owed;
                      else dayOwed += owed;
                      const pMs = pg.shifts
                        .filter((s) => s.end_time)
                        .reduce((sum, s) => sum + shiftBillableMs(s), 0);
                      const pBlocks = pg.shifts.reduce(
                        (n, s) => n + (s.work_blocks?.length || 0),
                        0,
                      );
                      const apts = new Set();
                      pg.shifts.forEach((s) =>
                        (s.work_blocks || []).forEach((b) => {
                          if (b.unit?.label) apts.add(b.unit.label);
                        }),
                      );
                      strips.push({
                        pg,
                        assignmentId: null,
                        title: pg.name,
                        sub: null,
                        key,
                        row,
                        hasFlat,
                        owed,
                        paid,
                        pMs,
                        pBlocks,
                        aptCount: apts.size,
                        hourly: true,
                        stale: isUnpaidStale(d.key, paid),
                      });
                      return;
                    }
                    // Flat-rate property (Bridges, Citifront): ONE strip per
                    // ASSIGNMENT. Group this property's blocks by assignment_id
                    // (legacy null blocks fall back to a per-unit:party key so
                    // they still show, just not merged across jobs).
                    const byAsg = new Map();
                    pg.shifts.forEach((s) =>
                      (s.work_blocks || []).forEach((b) => {
                        const aId = b.assignment_id || null;
                        const gkey =
                          aId ||
                          `legacy:${b.unit?.label || ""}:${b.party?.label || ""}`;
                        if (!byAsg.has(gkey)) {
                          byAsg.set(gkey, {
                            assignmentId: aId,
                            unitId: b.unit_id || null,
                            unitLabel: b.unit?.label || "",
                            size: unitSizeLabel(b.unit),
                            type: b.assignment?.assignment_type || "",
                            ms: 0,
                            blocks: 0,
                          });
                        }
                        const g = byAsg.get(gkey);
                        g.blocks += 1;
                        if (b.end_time)
                          g.ms += new Date(b.end_time) - new Date(b.start_time);
                      }),
                    );
                    // Fold untagged (legacy) blocks into a unit's tagged line when
                    // that unit has exactly ONE tagged assignment — the untagged
                    // blocks are almost certainly older clock-ins of the same job,
                    // so E109 shouldn't show as "E109 · Move-out" AND a separate
                    // untagged "E109". If a unit has TWO+ tagged assignments we
                    // can't know which the untagged blocks belong to, so we leave
                    // them as their own line rather than guess wrong.
                    {
                      const groupsArr = Array.from(byAsg.entries()); // [gkey, g]
                      // tagged assignment count per unit label
                      const taggedByUnit = new Map();
                      groupsArr.forEach(([, g]) => {
                        if (g.assignmentId) {
                          const u = g.unitLabel || "";
                          taggedByUnit.set(u, (taggedByUnit.get(u) || 0) + 1);
                        }
                      });
                      groupsArr.forEach(([gkey, g]) => {
                        if (g.assignmentId) return; // only fold legacy lines
                        const u = g.unitLabel || "";
                        if (taggedByUnit.get(u) !== 1) return; // 0 tagged → keep as own; 2+ → ambiguous, keep
                        // find that unit's single tagged line and merge into it
                        const target = groupsArr.find(
                          ([, t]) =>
                            t.assignmentId && (t.unitLabel || "") === u,
                        );
                        if (!target) return;
                        target[1].blocks += g.blocks;
                        target[1].ms += g.ms;
                        byAsg.delete(gkey);
                      });
                    }
                    const asgList = Array.from(byAsg.values()).sort(
                      (a, b) =>
                        naturalCompare(a.unitLabel, b.unitLabel) ||
                        naturalCompare(a.type, b.type),
                    );
                    asgList.forEach((g) => {
                      // Assignment-tagged lines key by assignment_id. Legacy
                      // blocks with no assignment_id key by UNIT instead, so two
                      // untagged apartments (D108, F404) are separate pay rows
                      // and separate edit states — not one shared row.
                      const asgId = g.assignmentId;
                      const unitKeyId = asgId ? null : g.unitId || null;
                      const key = payKey(empId, d.key, pg.id, asgId, unitKeyId);
                      const row = payDays[key];
                      const hasFlat = row?.flat_amount != null;
                      const owed = hasFlat ? Number(row.flat_amount) : 0; // flat: no auto amount, you enter it
                      const paid = !!row?.paid_at;
                      if (paid) dayPaid += owed;
                      else dayOwed += owed;
                      const title = g.unitLabel || pg.name;
                      const subParts = [
                        g.size,
                        g.type ? assignmentTypeLabel(g.type) : null,
                      ].filter(Boolean);
                      strips.push({
                        pg,
                        assignmentId: asgId,
                        unitId: unitKeyId,
                        title,
                        sub:
                          subParts.join(" · ") +
                          (g.blocks > 1 ? ` · ${g.blocks} visits` : ""),
                        key,
                        row,
                        hasFlat,
                        owed,
                        paid,
                        pMs: g.ms,
                        pBlocks: g.blocks,
                        aptCount: 1,
                        hourly: false,
                        legacy: !asgId,
                        stale: isUnpaidStale(d.key, paid),
                      });
                    });
                  });
                  return (
                    <div className="border-t border-stone-100">
                      {strips.map((st) => (
                        <div
                          key={st.key}
                          className={`px-4 py-2.5 border-b last:border-b-0 ${st.stale ? "bg-amber-50 border-amber-200" : "border-stone-100"}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5 flex-wrap">
                            <div className="min-w-0">
                              <div className="text-xs font-mono text-amber-800 flex items-center gap-1.5">
                                <Building2
                                  size={11}
                                  className="flex-shrink-0"
                                />
                                <span className="truncate">{st.title}</span>
                              </div>
                              <div className="text-[10px] font-mono text-stone-400 mt-0.5">
                                {st.sub ? <span>{st.sub} · </span> : null}
                                {fmtTimeShort(st.pMs)}
                                {st.hourly &&
                                  st.aptCount > 0 &&
                                  ` · ${st.aptCount} ${st.aptCount === 1 ? "apartment" : "apartments"}`}
                                {` · ${st.pBlocks} ${st.pBlocks === 1 ? "block" : "blocks"}`}
                              </div>
                            </div>
                            <div className="text-xs font-mono flex items-center gap-1.5 flex-shrink-0">
                              {!st.paid && st.owed > 0 && (
                                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-bold">
                                  Owed
                                </span>
                              )}
                              <span>
                                <span className="text-stone-500">
                                  {st.paid ? "Paid " : "You owe "}
                                </span>
                                <span className="text-stone-900 font-bold">
                                  {st.owed > 0 ? fmtMoney(st.owed) : "—"}
                                </span>
                                {st.hasFlat ? (
                                  <span className="text-amber-700">
                                    {" "}
                                    · flat
                                  </span>
                                ) : st.hourly && st.owed > 0 ? (
                                  <span className="text-stone-400">
                                    {" "}
                                    · hourly
                                  </span>
                                ) : null}
                                {st.owed === 0 && !st.hasFlat && (
                                  <span className="text-stone-400">
                                    {" "}
                                    {st.hourly
                                      ? "(set a rate or flat pay)"
                                      : "(enter what you owe)"}
                                  </span>
                                )}
                                {st.stale && (
                                  <span className="text-amber-700">
                                    {" "}
                                    · unpaid 7+ days
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {settingPay === st.key ? (
                              <span className="flex items-center gap-1">
                                <span className="text-[11px] text-stone-500 font-mono">
                                  $
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  autoFocus
                                  value={payAmt}
                                  onChange={(e) => setPayAmt(e.target.value)}
                                  placeholder="0.00"
                                  className="w-20 px-1.5 py-0.5 rounded border border-stone-300 text-xs font-mono"
                                />
                                <button
                                  onClick={() =>
                                    saveFlatPay(
                                      empId,
                                      d.key,
                                      st.pg.id,
                                      payAmt,
                                      st.assignmentId,
                                      st.unitId,
                                    )
                                  }
                                  disabled={payBusy === st.key}
                                  className="text-[11px] px-2 py-0.5 rounded bg-stone-900 text-white"
                                >
                                  Save
                                </button>
                                {st.hasFlat && (
                                  <button
                                    onClick={() =>
                                      saveFlatPay(
                                        empId,
                                        d.key,
                                        st.pg.id,
                                        "",
                                        st.assignmentId,
                                        st.unitId,
                                      )
                                    }
                                    disabled={payBusy === st.key}
                                    className="text-[11px] px-1.5 text-red-600"
                                  >
                                    Clear
                                  </button>
                                )}
                                <button
                                  onClick={() => setSettingPay(null)}
                                  className="text-[11px] px-1 text-stone-500"
                                >
                                  Cancel
                                </button>
                              </span>
                            ) : adjusting === st.key ? (
                              <span className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  autoFocus
                                  value={adjH}
                                  onChange={(e) => setAdjH(e.target.value)}
                                  placeholder="h"
                                  className="w-12 px-1.5 py-0.5 rounded border border-stone-300 text-xs font-mono"
                                />
                                <span className="text-[10px] text-stone-400">
                                  h
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  value={adjM}
                                  onChange={(e) => setAdjM(e.target.value)}
                                  placeholder="m"
                                  className="w-12 px-1.5 py-0.5 rounded border border-stone-300 text-xs font-mono"
                                />
                                <span className="text-[10px] text-stone-400">
                                  m
                                </span>
                                <button
                                  onClick={() =>
                                    saveAdjust(st.pg.shifts, adjH, adjM)
                                  }
                                  disabled={payBusy === "adj"}
                                  className="text-[11px] px-2 py-0.5 rounded bg-stone-900 text-white"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setAdjusting(null)}
                                  className="text-[11px] px-1 text-stone-500"
                                >
                                  Cancel
                                </button>
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setSettingPay(st.key);
                                    setPayAmt(
                                      st.hasFlat
                                        ? String(st.row.flat_amount)
                                        : "",
                                    );
                                  }}
                                  className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 flex items-center gap-1"
                                >
                                  <DollarSign size={10} />{" "}
                                  {st.hasFlat ? "Edit pay" : "Set pay"}
                                </button>
                                <button
                                  onClick={() => {
                                    setAdjusting(st.key);
                                    const cur = Math.round(st.pMs / 60000);
                                    setAdjH(String(Math.floor(cur / 60)));
                                    setAdjM(String(cur % 60));
                                  }}
                                  className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 flex items-center gap-1"
                                >
                                  <Clock size={10} /> Adjust hours
                                </button>
                              </>
                            )}
                            <button
                              onClick={() =>
                                togglePaid(
                                  empId,
                                  d.key,
                                  st.pg.id,
                                  st.owed,
                                  st.assignmentId,
                                  st.unitId,
                                )
                              }
                              disabled={payBusy === st.key}
                              className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full flex items-center gap-1 disabled:opacity-50 ${st.paid ? "bg-emerald-600 text-white" : "bg-white border border-stone-300 text-stone-600"}`}
                            >
                              {st.paid ? (
                                <>
                                  <Check size={10} /> Paid
                                </>
                              ) : (
                                "Mark paid"
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                      {strips.length > 1 && (
                        <div className="px-4 py-2 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-2 text-xs font-mono">
                          <span className="text-[10px] uppercase tracking-wider text-stone-500">
                            Day total · {strips.length} properties
                          </span>
                          <span className="flex items-center gap-2">
                            {dayPaid > 0 && (
                              <span className="text-emerald-700">
                                Paid {fmtMoney(dayPaid)}
                              </span>
                            )}
                            <span
                              className={
                                dayOwed > 0
                                  ? "text-stone-900 font-bold"
                                  : "text-stone-400"
                              }
                            >
                              {dayOwed > 0
                                ? `Owe ${fmtMoney(dayOwed)}`
                                : "All paid"}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

              {multi && expanded && (
                <div className="border-t border-stone-100 divide-y divide-stone-100">
                  {d.shifts
                    .slice()
                    .sort(
                      (a, b) => new Date(a.start_time) - new Date(b.start_time),
                    )
                    .map((s) => {
                      const dur = s.end_time
                        ? shiftBillableMs(s)
                        : new Date() - new Date(s.start_time);
                      const sb = shiftBillableAmount(s, showMoney);
                      return (
                        <div
                          key={s.id}
                          className="w-full px-4 py-2.5 hover:bg-stone-50 flex items-center justify-between text-xs font-mono text-stone-600 gap-2"
                        >
                          <button
                            onClick={() => onOpenShift(s)}
                            className="flex-1 text-left min-w-0 truncate"
                          >
                            {fmtClock(s.start_time)}{" "}
                            {s.end_time
                              ? `— ${fmtClock(s.end_time)}`
                              : "— active"}{" "}
                            · {fmtTimeShort(dur)}
                          </button>
                          <span className="flex items-center gap-2 flex-shrink-0">
                            {showMoney && sb > 0 && (
                              <span className="text-emerald-700">
                                {fmtMoney(sb)}
                              </span>
                            )}
                            <button
                              onClick={() => onOpenShift(s)}
                              title="Open shift"
                            >
                              <ChevronRight
                                size={13}
                                className="text-stone-400"
                              />
                            </button>
                            {(currentEmployee?.role === "owner" ||
                              currentEmployee?.role === "manager") && (
                              <button
                                onClick={async () => {
                                  if (
                                    !confirm(
                                      `Delete this shift (${fmtClock(s.start_time)}${s.end_time ? `–${fmtClock(s.end_time)}` : ""})?\n\nUse this only for a fake or mistaken shift. It can't be undone.`,
                                    )
                                  )
                                    return;
                                  const { error } = await supabase
                                    .from("shifts")
                                    .delete()
                                    .eq("id", s.id);
                                  if (error) {
                                    alert(
                                      "Could not delete shift: " +
                                        error.message +
                                        "\n\n(If it has work blocks, those may need removing first.)",
                                    );
                                    return;
                                  }
                                  if (onReload) onReload();
                                }}
                                title="Delete this shift (fake / mistaken)"
                                className="w-6 h-6 rounded flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-700"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ---- Accordion: all cleaner cards; the selected one expands INLINE so the
  // others stay visible (no more drilling into a hidden detail page). --------
  const byCleaner = new Map();
  shifts.forEach((s) => {
    const id = s.employee?.id;
    if (!id) return;
    if (!byCleaner.has(id))
      byCleaner.set(id, { id, name: s.employee?.name || "—", shifts: [] });
    byCleaner.get(id).shifts.push(s);
  });
  const cleaners = Array.from(byCleaner.values()).sort((a, b) =>
    naturalCompare(a.name, b.name),
  );
  return (
    <div className="px-5">
      <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
        Cleaners ({cleaners.length})
      </div>
      {cleaners.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
          No one worked in this period.
        </div>
      ) : (
        <div className="space-y-3">
          {cleaners.map((c) => {
            const dayKeys = new Set(
              c.shifts.map((s) => localDayKey(s.start_time)),
            );
            const totalMs = c.shifts
              .filter((s) => s.end_time)
              .reduce((sum, s) => sum + shiftBillableMs(s), 0);
            const active = c.shifts.some((s) => !s.end_time);
            const sorted = c.shifts
              .map((s) => new Date(s.start_time))
              .sort((a, b) => a - b);
            const dayCount = dayKeys.size;
            const rangeLabel =
              dayCount <= 1
                ? fmtDate(sorted[0])
                : `${fmtDate(sorted[0])} – ${fmtDate(sorted[sorted.length - 1])}`;
            const expanded = selectedCleanerId === c.id;
            // Owe / Paid totals — recomputed live from payDays, so marking a
            // day paid instantly moves that amount from Owe to Paid.
            let cOwe = 0,
              cPaid = 0;
            if (showMoney) {
              // Sum the same per-property buckets the detail view pays out of,
              // so the header number always equals the strips underneath it.
              const cDayMap = {};
              c.shifts.forEach((s) => {
                const k = localDayKey(s.start_time);
                (cDayMap[k] = cDayMap[k] || []).push(s);
              });
              Object.entries(cDayMap).forEach(([k, ds]) => {
                const legacy = payDays[payKey(c.id, k, null)];
                if (legacy) {
                  const amt =
                    legacy.flat_amount != null
                      ? Number(legacy.flat_amount)
                      : payOwed(ds);
                  if (legacy.paid_at) cPaid += amt;
                  else cOwe += amt;
                  return;
                }
                groupByProperty(ds).forEach((pg) => {
                  const row = payDays[payKey(c.id, k, pg.id)];
                  const amt =
                    row?.flat_amount != null
                      ? Number(row.flat_amount)
                      : payOwed(pg.shifts);
                  if (row?.paid_at) cPaid += amt;
                  else cOwe += amt;
                });
              });
            }
            return (
              <div
                key={c.id}
                className={`rounded-2xl bg-white shadow-sm border-2 transition-colors ${expanded ? "border-stone-800" : "border-stone-200"}`}
              >
                <button
                  onClick={() => onSelectCleaner(expanded ? null : c.id)}
                  className="w-full text-left p-4 hover:bg-stone-50 rounded-2xl transition-colors"
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {active && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                      )}
                      <span className="font-serif text-xl text-stone-900 truncate">
                        {c.name}
                      </span>
                    </div>
                    <ChevronRight
                      size={18}
                      className={`text-stone-400 transition-transform flex-shrink-0 ${expanded ? "rotate-90" : ""}`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-stone-500 font-mono gap-2 flex-wrap">
                    <span>
                      {rangeLabel} · {c.shifts.length}{" "}
                      {c.shifts.length === 1 ? "shift" : "shifts"} · {dayCount}{" "}
                      {dayCount === 1 ? "day" : "days"} ·{" "}
                      {fmtTimeShort(totalMs)}
                    </span>
                    {showMoney && (
                      <span className="flex items-center gap-2 flex-shrink-0">
                        {cPaid > 0 && (
                          <span className="text-emerald-700 font-medium">
                            Paid {fmtMoney(cPaid)}
                          </span>
                        )}
                        <span
                          className={
                            cOwe > 0
                              ? "text-amber-700 font-bold"
                              : "text-stone-400"
                          }
                        >
                          Owe {fmtMoney(cOwe)}
                        </span>
                      </span>
                    )}
                  </div>
                </button>
                {expanded && (
                  <div className="px-4 pb-4">
                    {renderCleanerDetail(c.shifts)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
