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
import { DateRangePicker } from "./DateRangePicker.jsx";

export function ProfitReportView({
  employee,
  onSignOut,
  onOpenMessages,
  onLogoClick,
  topToggle,
}) {
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // Remember the range across refreshes. Re-picking dates and hitting Run
  // again after every reload is pure friction — the report is derived
  // data, so it can just rebuild itself.
  const SAVED_RANGE_KEY = "tidytrack_profit_range";
  const savedRange = (() => {
    try {
      return JSON.parse(localStorage.getItem(SAVED_RANGE_KEY) || "null");
    } catch {
      return null;
    }
  })();
  const [start, setStart] = useState(
    savedRange?.start || iso(new Date(Date.now() - 29 * 86400000)),
  );
  const [end, setEnd] = useState(savedRange?.end || iso(new Date()));
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState(null);
  const [totals, setTotals] = useState({ charge: 0, pay: 0 });
  const [savingId, setSavingId] = useState(null);
  const [cell, setCell] = useState(null); // { id, field } being edited
  const [cellVal, setCellVal] = useState("");
  const [openRow, setOpenRow] = useState(null); // row showing its item breakdown
  const [unbilled, setUnbilled] = useState(0);
  const [unbilledDetail, setUnbilledDetail] = useState([]); // per-property uninvoiced labor
  const [invoiceHint, setInvoiceHint] = useState([]); // what ranges DO have invoices
  const [runaway, setRunaway] = useState({ count: 0, pay: 0, hours: 0 }); // forgotten clock-outs

  const num = (v) => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };

  const run = async () => {
    if (!start || !end) return;
    try {
      localStorage.setItem(SAVED_RANGE_KEY, JSON.stringify({ start, end }));
    } catch {
      /* private mode */
    }
    setLoading(true);
    setCell(null);
    try {
      // 1. Invoices whose covered period overlaps the range. Older
      //    invoices predate period_start/period_end, so fall back to
      //    invoice_date for those.
      const { data: invs, error: invErr } = await supabase
        .from("invoices")
        .select(
          "id, customer_id, invoice_date, period_start, period_end, invoice_number, status, customer:customers(id, name)",
        )
        .or(
          `and(period_start.lte.${end},period_end.gte.${start}),and(period_start.is.null,invoice_date.gte.${start},invoice_date.lte.${end})`,
        );
      if (invErr) throw invErr;
      const invoices = invs || [];

      // Labor fetch, reused below. Always runs, even with zero invoices —
      // "no invoices cover this range" and "nobody worked this range" are
      // very different answers and the screen has to tell them apart.
      const fetchBlocks = async (winStart, winEnd) => {
        let out = [];
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("work_blocks")
            .select(
              "id, unit_id, party_id, start_time, end_time, unit:units(label), shift:shifts!inner(customer_id, is_preview, employee:employees(id, name, pay_rate_hourly), customer:customers(id, name))",
            )
            .gte("start_time", winStart + "T00:00:00")
            .lte("start_time", winEnd + "T23:59:59")
            .not("end_time", "is", null)
            .range(from, from + PAGE - 1);
          if (error || !data) break;
          out = out.concat(data);
          if (data.length < PAGE) break;
          if (from > 100000) break;
        }
        return out.filter((b) => b.shift && !b.shift.is_preview && b.unit_id);
      };
      const blockPay = (b) => {
        const hrs = (new Date(b.end_time) - new Date(b.start_time)) / 3600000;
        if (hrs <= 0) return { hrs: 0, pay: 0 };
        return { hrs, pay: hrs * num(b.shift.employee?.pay_rate_hourly) };
      };
      // Split off the forgotten clock-outs before any money is added up.
      // A block longer than MAX_BLOCK_HOURS isn't a long clean, it's a
      // block nobody closed — counting it as labor turns a normal week
      // into a fake five-figure loss.
      const runawayOf = (list) =>
        list.filter((b) => blockPay(b).hrs > MAX_BLOCK_HOURS);
      const sensibleOf = (list) =>
        list.filter((b) => {
          const h = blockPay(b).hrs;
          return h > 0 && h <= MAX_BLOCK_HOURS;
        });

      if (invoices.length === 0) {
        // Nothing bills this range. Show the labor that's sitting
        // uninvoiced, and tell them which ranges DO have invoices, so the
        // fix is "pick the right dates" not "guess".
        const loose = await fetchBlocks(start, end);
        const runaways = runawayOf(loose);
        setRunaway({
          count: runaways.length,
          pay: runaways.reduce((s, b) => s + blockPay(b).pay, 0),
          hours: runaways.reduce((s, b) => s + blockPay(b).hrs, 0),
        });
        const byProp = {};
        let sum = 0;
        sensibleOf(loose).forEach((b) => {
          const { hrs, pay } = blockPay(b);
          if (hrs <= 0) return;
          sum += pay;
          const cid = b.shift.customer_id || "none";
          byProp[cid] = byProp[cid] || {
            name: b.shift.customer?.name || "No property",
            hours: 0,
            pay: 0,
          };
          byProp[cid].hours += hrs;
          byProp[cid].pay += pay;
        });
        const { data: recent } = await supabase
          .from("invoices")
          .select(
            "invoice_number, invoice_date, period_start, period_end, customer:customers(name)",
          )
          .order("invoice_date", { ascending: false })
          .limit(5);
        setUnbilledDetail(Object.values(byProp).sort((a, b) => b.pay - a.pay));
        setInvoiceHint(recent || []);
        setGroups([]);
        setTotals({ charge: 0, pay: 0 });
        setUnbilled(sum);
        setLoading(false);
        return;
      }
      setInvoiceHint([]);
      setUnbilledDetail([]);

      // 2. Their lines. Paginated — a busy month easily clears 1000 lines.
      const invIds = invoices.map((i) => i.id);
      let lines = [];
      for (let i = 0; i < invIds.length; i += 50) {
        const chunk = invIds.slice(i, i + 50);
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("invoice_lines")
            .select(
              "id, invoice_id, unit_id, party_id, label, service_type, description, amount, base_amount, extra_amount, extra_note, subsections",
            )
            .in("invoice_id", chunk)
            .range(from, from + PAGE - 1);
          if (error || !data) break;
          lines = lines.concat(data);
          if (data.length < PAGE) break;
          if (from > 100000) break;
        }
      }

      // 2b. Real unit + bedroom labels. invoice_lines.label is cosmetic —
      //     the draft builder strips the building prefix off it (B2-233
      //     becomes "233"), which is fine on a bill to one property but
      //     useless in a report spanning several. Join to units/parties
      //     for the real thing.
      const lineUnitIds = [
        ...new Set(lines.map((l) => l.unit_id).filter(Boolean)),
      ];
      const linePartyIds = [
        ...new Set(lines.map((l) => l.party_id).filter(Boolean)),
      ];
      const unitLabelById = {};
      for (let i = 0; i < lineUnitIds.length; i += 200) {
        const { data } = await supabase
          .from("units")
          .select("id, label")
          .in("id", lineUnitIds.slice(i, i + 200));
        (data || []).forEach((u) => {
          unitLabelById[u.id] = u.label;
        });
      }
      const partyLabelById = {};
      for (let i = 0; i < linePartyIds.length; i += 200) {
        const { data } = await supabase
          .from("parties")
          .select("id, label")
          .in("id", linePartyIds.slice(i, i + 200));
        (data || []).forEach((pt) => {
          partyLabelById[pt.id] = pt.label;
        });
      }

      // 3. Corrections. No PostgREST embed — plain read, joined in JS.
      let reviews = [];
      const lineIds = lines.map((l) => l.id);
      for (let i = 0; i < lineIds.length; i += 200) {
        const { data } = await supabase
          .from("profit_line_reviews")
          .select(
            "invoice_line_id, charged_override, paid_override, hours_override, note",
          )
          .in("invoice_line_id", lineIds.slice(i, i + 200));
        reviews = reviews.concat(data || []);
      }
      const reviewByLine = Object.fromEntries(
        reviews.map((r) => [r.invoice_line_id, r]),
      );

      // 4. Labor. One window wide enough to cover every invoice period
      //    touched, then matched per line to that invoice's own period.
      const winStart = invoices.reduce((m, i) => {
        const s = i.period_start || i.invoice_date || start;
        return s < m ? s : m;
      }, start);
      const winEnd = invoices.reduce((m, i) => {
        const e = i.period_end || i.invoice_date || end;
        return e > m ? e : m;
      }, end);
      const allBlocks = await fetchBlocks(winStart, winEnd);
      {
        // Same guard on the invoiced path. Restricted to the report's own
        // range so the count matches what's on screen.
        const inRange = allBlocks.filter((b) => {
          const d = String(b.start_time).slice(0, 10);
          return d >= start && d <= end;
        });
        const runaways = runawayOf(inRange);
        setRunaway({
          count: runaways.length,
          pay: runaways.reduce((s, b) => s + blockPay(b).pay, 0),
          hours: runaways.reduce((s, b) => s + blockPay(b).hrs, 0),
        });
      }
      const liveBlocks = sensibleOf(allBlocks);

      // 5. Build a row per invoice line.
      const invById = Object.fromEntries(invoices.map((i) => [i.id, i]));
      const usedBlockIds = new Set();
      const rows = lines.map((l) => {
        const inv = invById[l.invoice_id];
        const pStart = inv?.period_start || inv?.invoice_date || start;
        const pEnd = inv?.period_end || inv?.invoice_date || end;
        // Match blocks at the SAME apartment inside the invoice's own
        // period. Match on party too when the line names one, so two
        // bedrooms billed separately don't both absorb the same labor.
        const mine = liveBlocks.filter((b) => {
          if (b.unit_id !== l.unit_id) return false;
          if (l.party_id && b.party_id && b.party_id !== l.party_id)
            return false;
          const d = String(b.start_time).slice(0, 10);
          return d >= pStart && d <= pEnd;
        });
        const byPerson = {};
        // The dates the work actually happened. The invoice PERIOD is a
        // billing window, not a clean date — showing only the period made
        // it impossible to tell when this apartment was done.
        const cleanedDays = [
          ...new Set(mine.map((b) => String(b.start_time).slice(0, 10))),
        ].sort();
        let pay = 0,
          hours = 0;
        mine.forEach((b) => {
          usedBlockIds.add(b.id);
          const hrs = (new Date(b.end_time) - new Date(b.start_time)) / 3600000;
          if (hrs <= 0) return;
          const emp = b.shift.employee;
          if (!emp) return;
          const rate = num(emp.pay_rate_hourly);
          hours += hrs;
          pay += hrs * rate;
          byPerson[emp.id] = byPerson[emp.id] || {
            name: emp.name,
            hours: 0,
            pay: 0,
          };
          byPerson[emp.id].hours += hrs;
          byPerson[emp.id].pay += hrs * rate;
        });
        const rev = reviewByLine[l.id];
        const baseCharge = num(l.amount);
        const charge =
          rev && rev.charged_override != null
            ? num(rev.charged_override)
            : baseCharge;
        const paid =
          rev && rev.paid_override != null ? num(rev.paid_override) : pay;
        const hoursEff =
          rev && rev.hours_override != null ? num(rev.hours_override) : hours;
        return {
          id: l.id,
          propertyId: inv?.customer_id,
          propertyName: inv?.customer?.name || "Property",
          invoiceNumber: inv?.invoice_number,
          invoiceStatus: inv?.status,
          periodLabel:
            inv?.period_start && inv?.period_end
              ? `${inv.period_start} → ${inv.period_end}`
              : fmtInvoiceDate(inv?.invoice_date),
          // Prefer the real unit/bedroom labels; fall back to whatever the
          // invoice printed if this line isn't tied to a unit.
          label:
            unitPartyLabel(
              unitLabelById[l.unit_id],
              partyLabelById[l.party_id],
            ) ||
            l.label ||
            "Line",
          invoiceLabel: l.label || "",
          serviceType: l.service_type,
          // The saved item breakdown, so the grid can drop down and show
          // exactly what made up the charge — same detail as the invoice.
          subsections: Array.isArray(l.subsections) ? l.subsections : [],
          description: l.description || "",
          extraAmount: num(l.extra_amount),
          extraNote: l.extra_note || "",
          cleaners: Object.values(byPerson).sort((a, b) => b.hours - a.hours),
          cleanedDays,
          baseHours: hours,
          hours: hoursEff,
          baseCharge,
          basePay: pay,
          charge,
          paid,
          editedCharge: !!rev && rev.charged_override != null,
          editedPaid: !!rev && rev.paid_override != null,
          editedHours: !!rev && rev.hours_override != null,
          edited:
            !!rev &&
            (rev.charged_override != null ||
              rev.paid_override != null ||
              rev.hours_override != null),
          note: rev?.note || "",
        };
      });

      // Cleaned-but-not-invoiced apartments. Instead of hiding this labor in
      // a single "unbilled" number, each apartment becomes its OWN row — pay
      // from the labor, charge from a manual charge you set here (blank until
      // you do). This is the "populate by work done" view: work with no
      // invoice still shows, per apartment, on the days it was cleaned.
      const unclaimedBlocks = liveBlocks
        .filter((b) => !usedBlockIds.has(b.id))
        .filter((b) => {
          const d = String(b.start_time).slice(0, 10);
          return d >= start && d <= end;
        });
      const aptGroups = {};
      unclaimedBlocks.forEach((b) => {
        const hrs = (new Date(b.end_time) - new Date(b.start_time)) / 3600000;
        if (hrs <= 0) return;
        const emp = b.shift.employee;
        if (!emp) return;
        const key = `${b.shift.customer_id}:${b.unit_id}:${b.party_id || ""}`;
        if (!aptGroups[key])
          aptGroups[key] = {
            customerId: b.shift.customer_id,
            customerName: b.shift.customer?.name || "Property",
            unitId: b.unit_id,
            partyId: b.party_id || null,
            unitLabelFallback: b.unit?.label || "",
            pay: 0,
            hours: 0,
            byPerson: {},
            days: new Set(),
          };
        const g = aptGroups[key];
        const rate = num(emp.pay_rate_hourly);
        g.pay += hrs * rate;
        g.hours += hrs;
        g.days.add(String(b.start_time).slice(0, 10));
        g.byPerson[emp.id] = g.byPerson[emp.id] || {
          name: emp.name,
          hours: 0,
          pay: 0,
        };
        g.byPerson[emp.id].hours += hrs;
        g.byPerson[emp.id].pay += hrs * rate;
      });
      // Manual charges + real labels for these apartments.
      const uUnitIds = [
        ...new Set(
          Object.values(aptGroups)
            .map((g) => g.unitId)
            .filter(Boolean),
        ),
      ];
      const uPartyIds = [
        ...new Set(
          Object.values(aptGroups)
            .map((g) => g.partyId)
            .filter(Boolean),
        ),
      ];
      const manualByApt = {};
      for (let i = 0; i < uUnitIds.length; i += 200) {
        const { data } = await supabase
          .from("manual_charges")
          .select("id, unit_id, party_id, amount")
          .in("unit_id", uUnitIds.slice(i, i + 200));
        (data || []).forEach((m) => {
          manualByApt[`${m.unit_id}:${m.party_id || ""}`] = m;
        });
      }
      for (let i = 0; i < uUnitIds.length; i += 200) {
        const { data } = await supabase
          .from("units")
          .select("id, label")
          .in("id", uUnitIds.slice(i, i + 200));
        (data || []).forEach((u) => {
          if (!unitLabelById[u.id]) unitLabelById[u.id] = u.label;
        });
      }
      for (let i = 0; i < uPartyIds.length; i += 200) {
        const { data } = await supabase
          .from("parties")
          .select("id, label")
          .in("id", uPartyIds.slice(i, i + 200));
        (data || []).forEach((pt) => {
          if (!partyLabelById[pt.id]) partyLabelById[pt.id] = pt.label;
        });
      }
      const manualRows = Object.values(aptGroups).map((g) => {
        const mc = manualByApt[`${g.unitId}:${g.partyId || ""}`];
        const charge = mc ? num(mc.amount) : 0;
        return {
          id: `manual:${g.unitId}:${g.partyId || "none"}`,
          isManual: true,
          manualId: mc?.id || null,
          manualUnitId: g.unitId,
          manualPartyId: g.partyId,
          manualCustomerId: g.customerId,
          propertyId: g.customerId,
          propertyName: g.customerName,
          invoiceNumber: null,
          invoiceStatus: "uninvoiced",
          periodLabel: "Not invoiced yet",
          label:
            unitPartyLabel(
              unitLabelById[g.unitId],
              partyLabelById[g.partyId],
            ) ||
            g.unitLabelFallback ||
            "Apartment",
          invoiceLabel: "",
          serviceType: null,
          subsections: [],
          description: "",
          extraAmount: 0,
          extraNote: "",
          cleaners: Object.values(g.byPerson).sort((a, b) => b.hours - a.hours),
          cleanedDays: [...g.days].sort(),
          baseHours: g.hours,
          hours: g.hours,
          baseCharge: charge,
          basePay: g.pay,
          charge,
          paid: g.pay,
          editedCharge: false,
          editedPaid: false,
          editedHours: false,
          edited: false,
          note: "",
        };
      });
      // Uninvoiced work is shown as rows now, not a hidden lump.
      setUnbilled(0);

      const allRows = [...rows, ...manualRows];
      const byProp = {};
      allRows.forEach((r) => {
        byProp[r.propertyId] = byProp[r.propertyId] || {
          id: r.propertyId,
          name: r.propertyName,
          rows: [],
          charge: 0,
          pay: 0,
        };
        byProp[r.propertyId].rows.push(r);
        byProp[r.propertyId].charge += r.charge;
        byProp[r.propertyId].pay += r.paid;
      });
      const out = Object.values(byProp);
      out.forEach((g) =>
        g.rows.sort((a, b) => b.charge - b.paid - (a.charge - a.paid)),
      );
      out.sort((a, b) => b.charge - b.pay - (a.charge - a.pay));
      setGroups(out);
      setTotals({
        charge: allRows.reduce((s, r) => s + r.charge, 0),
        pay: allRows.reduce((s, r) => s + r.paid, 0),
      });
    } catch (e) {
      alert("Could not run the report: " + (e?.message || e));
      setGroups([]);
    }
    setLoading(false);
  };

  // Rebuild on load if we already know the range, so a refresh lands you
  // back on the report instead of a blank form.
  useEffect(() => {
    if (savedRange?.start && savedRange?.end) run();
    /* eslint-disable-next-line */
  }, []);

  // Cell editing. One cell at a time, saved on Enter or blur — the point
  // of a grid is that you can tab through numbers without opening a panel
  // for each one.
  const beginEdit = (r, field) => {
    setCell({ id: r.id, field });
    const cur =
      field === "charge" ? r.charge : field === "paid" ? r.paid : r.hours;
    setCellVal(String(Number(cur).toFixed(field === "hours" ? 2 : 2)));
  };

  const commitCell = async (r, field) => {
    const raw = cellVal.trim();
    setCell(null);
    // Uninvoiced rows: only the charge is editable, saved to manual_charges
    // (one per apartment). Pay comes from labor and isn't overridable here.
    // Insert vs update by the manual_charge id we loaded, so we never depend
    // on upsert conflict-targets across a null party_id.
    if (r.isManual) {
      if (field !== "charge") return;
      const amt = raw === "" ? 0 : num(raw);
      setSavingId(r.id);
      let error;
      if (r.manualId) {
        ({ error } = await supabase
          .from("manual_charges")
          .update({
            amount: amt,
            updated_by: employee?.id || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", r.manualId));
      } else {
        ({ error } = await supabase.from("manual_charges").insert({
          unit_id: r.manualUnitId,
          party_id: r.manualPartyId,
          customer_id: r.manualCustomerId,
          amount: amt,
          updated_by: employee?.id || null,
        }));
      }
      setSavingId(null);
      if (error) {
        alert("Could not save that charge: " + error.message);
        return;
      }
      run();
      return;
    }
    const base =
      field === "charge"
        ? r.baseCharge
        : field === "paid"
          ? r.basePay
          : r.baseHours;
    // Blank, or back to the original figure, clears the override rather
    // than storing a redundant one.
    const next = raw === "" ? null : num(raw);
    const isSame = next != null && Math.abs(next - base) < 0.005;
    const existing = {
      charge: r.editedCharge ? r.charge : null,
      paid: r.editedPaid ? r.paid : null,
      hours: r.editedHours ? r.hours : null,
    };
    const patch = {
      invoice_line_id: r.id,
      charged_override:
        field === "charge"
          ? next == null || isSame
            ? null
            : next
          : existing.charge,
      paid_override:
        field === "paid"
          ? next == null || isSame
            ? null
            : next
          : existing.paid,
      hours_override:
        field === "hours"
          ? next == null || isSame
            ? null
            : next
          : existing.hours,
      note: r.note || null,
      reviewed_by: employee?.id || null,
      reviewed_at: new Date().toISOString(),
    };
    const allClear =
      patch.charged_override == null &&
      patch.paid_override == null &&
      patch.hours_override == null &&
      !patch.note;
    setSavingId(r.id);
    const { error } = allClear
      ? await supabase
          .from("profit_line_reviews")
          .delete()
          .eq("invoice_line_id", r.id)
      : await supabase
          .from("profit_line_reviews")
          .upsert(patch, { onConflict: "invoice_line_id" });
    setSavingId(null);
    if (error) {
      alert("Could not save that cell: " + error.message);
      return;
    }
    run();
  };

  const saveNote = async (r, text) => {
    setSavingId(r.id);
    const { error } = await supabase.from("profit_line_reviews").upsert(
      {
        invoice_line_id: r.id,
        charged_override: r.editedCharge ? r.charge : null,
        paid_override: r.editedPaid ? r.paid : null,
        hours_override: r.editedHours ? r.hours : null,
        note: text || null,
        reviewed_by: employee?.id || null,
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: "invoice_line_id" },
    );
    setSavingId(null);
    if (error) {
      alert("Could not save that note: " + error.message);
      return;
    }
    run();
  };

  const resetRow = async (r) => {
    setSavingId(r.id);
    const { error } = await supabase
      .from("profit_line_reviews")
      .delete()
      .eq("invoice_line_id", r.id);
    setSavingId(null);
    if (error) {
      alert("Could not reset that row: " + error.message);
      return;
    }
    run();
  };

  // Every row, flat — a grid, not cards per property.
  const allRows = (groups || []).flatMap((g) => g.rows);

  // Copy as TSV. Pastes straight into Excel or Sheets as real columns.
  const copyForExcel = async () => {
    const head = [
      "Property",
      "Apartment",
      "Type",
      "Cleaned",
      "Cleaners",
      "Hours",
      "Paid",
      "Charged",
      "Profit",
      "Note",
    ];
    const body = allRows.map((r) => [
      r.propertyName,
      r.label,
      r.serviceType || "",
      r.cleanedDays.join(" "),
      r.cleaners.map((c) => c.name).join(", "),
      r.hours.toFixed(2),
      r.paid.toFixed(2),
      r.charge.toFixed(2),
      (r.charge - r.paid).toFixed(2),
      (r.note || "").replace(/\t|\n/g, " "),
    ]);
    const tsv = [head, ...body].map((row) => row.join("\t")).join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      alert(
        "Copied " +
          allRows.length +
          " rows. Paste straight into Excel or Sheets.",
      );
    } catch {
      alert(
        "Could not copy automatically — your browser blocked clipboard access.",
      );
    }
  };

  const profitTotal = totals.charge - totals.pay;

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <Header
        name={employee.name}
        onSignOut={onSignOut}
        role={employee.role}
        employee={employee}
        onOpenMessages={onOpenMessages}
        onLogoClick={onLogoClick}
      />
      {topToggle}
      {/* The controls stay narrow — a full-width date picker looks silly.
         The grid gets the whole screen, because that's what a grid is for. */}
      <div className="px-5 pt-6 space-y-5 max-w-7xl mx-auto">
        <div className="max-w-2xl space-y-5">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              Report
            </div>
            <h1 className="font-serif text-3xl text-stone-900">
              Profit / loss
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              Every invoiced apartment: what you charged, who cleaned it, what
              they cost.
            </p>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2">
              Date range
            </div>
            <DateRangePicker
              start={start}
              end={end}
              onChange={(s, e) => {
                setStart(s);
                setEnd(e);
              }}
            />
            <p className="text-[11px] text-stone-400 mt-1.5">
              Matches the work an invoice covers, not the date it was written.
            </p>
          </div>

          <button
            onClick={run}
            disabled={loading || !start || !end}
            className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium disabled:opacity-50"
          >
            {loading ? "Crunching…" : "Run report"}
          </button>
        </div>

        {groups && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white border border-stone-200 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] uppercase text-stone-400 font-mono">
                  Charged
                </div>
                <div className="text-lg font-mono text-stone-900">
                  {fmtMoney(totals.charge)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-stone-400 font-mono">
                  Paid
                </div>
                <div className="text-lg font-mono text-stone-900">
                  {fmtMoney(totals.pay)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-stone-400 font-mono">
                  Profit
                </div>
                <div
                  className={`text-lg font-mono ${profitTotal >= 0 ? "text-emerald-700" : "text-red-600"}`}
                >
                  {fmtMoney(profitTotal)}
                </div>
              </div>
            </div>

            {runaway.count > 0 && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-[11px] text-red-900">
                <div className="font-medium">
                  {runaway.count} work{" "}
                  {runaway.count === 1 ? "block" : "blocks"} in this range{" "}
                  {runaway.count === 1 ? "is" : "are"} longer than{" "}
                  {MAX_BLOCK_HOURS}h — {runaway.hours.toFixed(0)}h total,{" "}
                  {fmtMoney(runaway.pay)} of "labor".
                </div>
                <div className="mt-1 text-red-800/80">
                  Almost certainly someone forgot to clock out. Left in, they'd
                  swamp every number on this page, so they're excluded above.
                  Fix them in the timesheet and re-run.
                </div>
              </div>
            )}

            {unbilled > 0.005 && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-mono">
                {fmtMoney(unbilled)} of labor in this range isn't on any invoice
                yet — not counted above.
              </div>
            )}

            {groups.length === 0 ? (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-white border border-stone-200 text-center">
                  <div className="text-sm text-stone-600">
                    No invoices cover work in this range.
                  </div>
                  <div className="text-xs text-stone-400 mt-1">
                    {unbilled > 0.005
                      ? "The cleaning happened — it just hasn\u2019t been billed yet, so there\u2019s nothing to compare it against."
                      : "No finished cleanings in this range either."}
                  </div>
                </div>
                {unbilledDetail.length > 0 && (
                  <div className="p-4 rounded-2xl bg-white border border-stone-200">
                    <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2">
                      Uninvoiced labor in this range
                    </div>
                    {unbilledDetail.map((u, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 py-1 text-xs font-mono"
                      >
                        <span className="text-stone-700 truncate">
                          {u.name}
                        </span>
                        <span className="text-stone-500 flex-shrink-0">
                          {u.hours.toFixed(1)}h · {fmtMoney(u.pay)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {invoiceHint.length > 0 && (
                  <div className="p-4 rounded-2xl bg-white border border-stone-200">
                    <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2">
                      Your most recent invoices cover
                    </div>
                    {invoiceHint.map((h, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const s2 = h.period_start || h.invoice_date;
                          const e2 = h.period_end || h.invoice_date;
                          if (s2 && e2) {
                            setStart(s2);
                            setEnd(e2);
                          }
                        }}
                        className="w-full flex items-center justify-between gap-2 py-1.5 text-xs font-mono hover:bg-stone-50 rounded-lg px-1 text-left"
                      >
                        <span className="text-stone-700 truncate">
                          {h.invoice_number ? `#${h.invoice_number} · ` : ""}
                          {h.customer?.name || "Property"}
                        </span>
                        <span className="text-amber-700 flex-shrink-0">
                          {h.period_start && h.period_end
                            ? `${h.period_start} \u2192 ${h.period_end}`
                            : fmtInvoiceDate(h.invoice_date)}
                        </span>
                      </button>
                    ))}
                    <p className="text-[10px] text-stone-400 mt-2">
                      Tap one to jump the date range to it.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* THE GRID. Every invoiced apartment as a row. Hours, Paid and
                 Charged are click-to-edit; Profit is always computed so it
                 can never disagree with the two columns beside it. */
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs uppercase tracking-wider text-stone-500 font-mono">
                    {allRows.length}{" "}
                    {allRows.length === 1 ? "apartment" : "apartments"}
                  </span>
                  <button
                    onClick={copyForExcel}
                    className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-white border border-stone-300 text-stone-700 inline-flex items-center gap-1"
                  >
                    <Copy size={11} /> Copy for Excel
                  </button>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white overflow-x-auto">
                  <table className="w-full text-xs" style={{ minWidth: 860 }}>
                    <thead>
                      <tr className="bg-stone-100 text-stone-500 font-mono text-[10px] uppercase tracking-wider">
                        <th className="text-left px-3 py-2 font-medium">
                          Apartment
                        </th>
                        <th className="text-left px-3 py-2 font-medium">
                          Cleaned
                        </th>
                        <th className="text-left px-3 py-2 font-medium">
                          Cleaner(s)
                        </th>
                        <th className="text-right px-3 py-2 font-medium">
                          Hours
                        </th>
                        <th className="text-right px-3 py-2 font-medium">
                          Paid
                        </th>
                        <th className="text-right px-3 py-2 font-medium">
                          Charged
                        </th>
                        <th className="text-right px-3 py-2 font-medium">
                          Profit
                        </th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {allRows.map((r, idx) => {
                        const p = r.charge - r.paid;
                        const prev = idx > 0 ? allRows[idx - 1] : null;
                        const newProp =
                          !prev || prev.propertyId !== r.propertyId;
                        const editCell = (field, val, edited) =>
                          cell && cell.id === r.id && cell.field === field ? (
                            <input
                              autoFocus
                              type="number"
                              step="0.01"
                              value={cellVal}
                              onChange={(e) => setCellVal(e.target.value)}
                              onBlur={() => commitCell(r, field)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitCell(r, field);
                                if (e.key === "Escape") setCell(null);
                              }}
                              className="w-20 px-1.5 py-1 rounded border border-indigo-400 text-right font-mono text-xs"
                            />
                          ) : (
                            <button
                              onClick={() => beginEdit(r, field)}
                              disabled={savingId === r.id}
                              title="Click to change"
                              className={`w-full text-right px-1.5 py-1 rounded font-mono hover:bg-indigo-50 hover:ring-1 hover:ring-indigo-200 ${edited ? "bg-indigo-50 text-indigo-800 font-medium" : "text-stone-700"}`}
                            >
                              {val}
                            </button>
                          );
                        return (
                          <React.Fragment key={r.id}>
                            {newProp && (
                              <tr>
                                <td
                                  colSpan={8}
                                  className="px-3 pt-3 pb-1 bg-stone-50 border-t border-stone-200"
                                >
                                  <span className="font-serif text-sm text-stone-900">
                                    {r.propertyName}
                                  </span>
                                  {r.invoiceNumber && (
                                    <span className="text-[10px] font-mono text-stone-400 ml-2">
                                      Inv #{r.invoiceNumber}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )}
                            <tr className="border-t border-stone-100 align-top">
                              <td className="px-3 py-2">
                                <button
                                  onClick={() =>
                                    setOpenRow(openRow === r.id ? null : r.id)
                                  }
                                  className="text-left hover:underline"
                                  title="Show what made up this charge"
                                >
                                  <div className="font-mono text-stone-900 flex items-center gap-1">
                                    <ChevronRight
                                      size={11}
                                      className={`text-stone-400 transition-transform ${openRow === r.id ? "rotate-90" : ""}`}
                                    />
                                    {r.label}
                                    {r.isManual && (
                                      <span className="text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 ml-1">
                                        Not invoiced
                                      </span>
                                    )}
                                  </div>
                                </button>
                                {r.serviceType && (
                                  <div className="text-[10px] text-stone-400 ml-4">
                                    {assignmentTypeLabel
                                      ? assignmentTypeLabel(r.serviceType)
                                      : r.serviceType}
                                  </div>
                                )}
                                {r.note && (
                                  <div className="text-[10px] text-stone-500 italic mt-0.5 ml-4">
                                    {r.note}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono text-stone-600 whitespace-nowrap">
                                {r.cleanedDays.length === 0 ? (
                                  <span className="text-stone-400">—</span>
                                ) : r.cleanedDays.length === 1 ? (
                                  fmtDueDate(r.cleanedDays[0])
                                ) : (
                                  `${fmtDueDate(r.cleanedDays[0])} +${r.cleanedDays.length - 1}`
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {r.cleaners.length === 0 ? (
                                  <span className="text-stone-400">
                                    No clocked clean
                                  </span>
                                ) : (
                                  r.cleaners.map((c) => (
                                    <div
                                      key={c.name}
                                      className="font-mono text-stone-700 whitespace-nowrap"
                                    >
                                      {c.name}
                                    </div>
                                  ))
                                )}
                              </td>
                              <td className="px-1 py-2">
                                {r.isManual ? (
                                  <span className="font-mono text-stone-500 block text-right pr-1">
                                    {r.hours.toFixed(2)}
                                  </span>
                                ) : (
                                  editCell(
                                    "hours",
                                    r.hours.toFixed(2),
                                    r.editedHours,
                                  )
                                )}
                              </td>
                              <td className="px-1 py-2">
                                {r.isManual ? (
                                  <span className="font-mono text-stone-500 block text-right pr-1">
                                    {r.paid.toFixed(2)}
                                  </span>
                                ) : (
                                  editCell(
                                    "paid",
                                    r.paid.toFixed(2),
                                    r.editedPaid,
                                  )
                                )}
                              </td>
                              <td className="px-1 py-2">
                                {editCell(
                                  "charge",
                                  r.charge.toFixed(2),
                                  r.editedCharge,
                                )}
                              </td>
                              <td
                                className={`px-3 py-2 text-right font-mono font-medium whitespace-nowrap ${p >= 0 ? "text-emerald-700" : "text-red-600"}`}
                              >
                                {p >= 0 ? "+" : ""}
                                {p.toFixed(2)}
                              </td>
                              <td className="px-2 py-2 text-right">
                                {r.edited && (
                                  <button
                                    onClick={() => resetRow(r)}
                                    disabled={savingId === r.id}
                                    title="Undo my changes to this row"
                                    className="text-[10px] font-mono text-stone-400 hover:text-red-600"
                                  >
                                    reset
                                  </button>
                                )}
                              </td>
                            </tr>
                            {openRow === r.id && (
                              <tr className="bg-stone-50">
                                <td colSpan={8} className="px-6 py-3">
                                  {/* Read-only — this is what the invoice
                                     billed. Change it on the invoice, not here. */}
                                  <div className="text-[10px] uppercase tracking-wider font-mono text-stone-400 mb-2">
                                    What made up the {fmtMoney(r.baseCharge)}{" "}
                                    charge
                                  </div>
                                  {r.subsections.length === 0 ? (
                                    <div className="text-[11px] font-mono text-stone-400">
                                      No item breakdown saved on this line.
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-1">
                                      {r.subsections.map((sub, si) => (
                                        <div
                                          key={si}
                                          className="flex items-center justify-between gap-2 text-[11px] font-mono border-b border-stone-200 pb-0.5"
                                        >
                                          <span
                                            className="text-stone-700 truncate"
                                            title={sub.label}
                                          >
                                            {sub.label}
                                          </span>
                                          <span className="text-stone-500 flex-shrink-0">
                                            {sub.mode === "time" && sub.minutes
                                              ? `${sub.minutes}m · ${fmtMoney(sub.amount)}`
                                              : fmtMoney(sub.amount)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {r.extraAmount > 0 && (
                                    <div className="mt-2 text-[11px] font-mono text-amber-700">
                                      + Extra charge {fmtMoney(r.extraAmount)}
                                      {r.extraNote ? ` — ${r.extraNote}` : ""}
                                    </div>
                                  )}
                                  {r.description && (
                                    <div className="mt-2 text-[11px] text-stone-500 italic">
                                      Prints as: “{r.description}”
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      <tr className="border-t-2 border-stone-300 bg-stone-50 font-medium">
                        <td
                          className="px-3 py-2 font-serif text-stone-900"
                          colSpan={3}
                        >
                          Total
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-stone-700">
                          {allRows
                            .reduce((s2, r) => s2 + r.hours, 0)
                            .toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-stone-900">
                          {totals.pay.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-stone-900">
                          {totals.charge.toFixed(2)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono font-bold ${profitTotal >= 0 ? "text-emerald-700" : "text-red-600"}`}
                        >
                          {profitTotal >= 0 ? "+" : ""}
                          {profitTotal.toFixed(2)}
                        </td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-stone-400 mt-2">
                  Click any Hours, Paid or Charged cell to change it. Enter
                  saves, Esc cancels, blank restores the original. Edits only
                  change this report — the invoice itself is untouched.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
