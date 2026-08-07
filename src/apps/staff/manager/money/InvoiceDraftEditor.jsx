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
import { subAmount, baseAmount, extraAmount, lineAmount, lineFullAmount } from "./invoiceAmounts.js";
import { InvoiceDocument } from "./InvoiceDocument.jsx";
import { subAmount } from "./invoiceAmounts.js";

export function InvoiceDraftEditor({
  property,
  start,
  end,
  employee,
  onBack,
  onSaved,
  seedInvoice = null,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [takenNumbers, setTakenNumbers] = useState(new Set()); // numbers already used
  const [unfinished, setUnfinished] = useState([]); // scheduled in range, not finished
  const [dismissed, setDismissed] = useState(new Set()); // ones you've waved off
  const [title, setTitle] = useState("");
  const today = new Date().toISOString().split("T")[0];
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [billTo, setBillTo] = useState({
    org: "",
    contact: "",
    email: "",
    phone: "",
    address: "",
  });
  const [billOpen, setBillOpen] = useState(false);
  const [diag, setDiag] = useState(null);
  // Done work in this window that an earlier invoice already claimed.
  const [billedElsewhere, setBilledElsewhere] = useState({
    bedrooms: 0,
    invoices: [],
  });
  const [rebillWarning, setRebillWarning] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [defaultRate, setDefaultRate] = useState(0);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // 1) Price book for this property (+ preset hourly rate).
      const { data: pb } = await supabase
        .from("invoice_price_book")
        .select("*")
        .eq("customer_id", property.id);
      let defRate = 0;
      const book = {};
      (pb || []).forEach((r) => {
        if (r.subsection_key === "__hourly_rate__") {
          defRate = r.rate || 0;
          return;
        }
        book[r.subsection_key] = r;
      });
      setDefaultRate(defRate);
      // 2) Units for this property.
      const { data: unitRows } = await supabase
        .from("units")
        .select("id,label,bedrooms,bathrooms")
        .eq("customer_id", property.id);
      const unitIds = (unitRows || []).map((u) => u.id);
      const unitLabelById = Object.fromEntries(
        (unitRows || []).map((u) => [u.id, u.label]),
      );
      const unitMetaById = Object.fromEntries(
        (unitRows || []).map((u) => [
          u.id,
          { bedrooms: u.bedrooms, bathrooms: u.bathrooms },
        ]),
      );
      // 3) Done items in range (paginated). Resilient: if v41's
      //    invoiced_on column isn't there yet, retry without that filter.
      let targets = [];
      let fetchErr = null;
      const fetchTargets = async (useInvoiced) => {
        let rows = [];
        let err = null;
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          let q = supabase
            .from("assignment_targets")
            .select(
              "id, unit_id, party_id, assignment_id, template_item_key, template_section, status_notes, completed_at, status, assignment:assignments(id, assignment_type, deleted_at, took_longer), party:parties(id,label)",
            )
            .eq("status", "done")
            .in("unit_id", unitIds)
            .gte("completed_at", start + "T00:00:00")
            .lte("completed_at", end + "T23:59:59")
            .range(from, from + PAGE - 1);
          if (useInvoiced) q = q.is("invoiced_on", null);
          const { data, error } = await q;
          if (error) {
            err = error;
            break;
          }
          rows = rows.concat(data || []);
          if (!data || data.length < PAGE) break;
          if (from > 100000) break;
        }
        return { rows, err };
      };
      if (unitIds.length) {
        let res = await fetchTargets(true);
        if (
          res.err &&
          /invoiced_on|column|does not exist/i.test(res.err.message || "")
        ) {
          // The invoiced_on column is what stops already-billed work from
          // reappearing on a new invoice. If it's missing we must NOT silently
          // fall back to showing everything — that's how a bedroom gets billed
          // twice. Surface it loudly and keep the fallback only so the screen
          // isn't blank, with a banner the owner can't miss.
          console.error(
            "[invoice] invoiced_on column missing — re-bill protection OFF until v41 is run",
          );
          setRebillWarning(true);
          res = await fetchTargets(false);
        }
        targets = res.rows;
        fetchErr = res.err;
      }
      // 3a2) Work in this range that ISN'T finished. It has no completed_at
      //      (only done targets get stamped), so "in this range" can only
      //      mean the assignment's SCHEDULED date. Never billed — you can't
      //      charge for a clean that hasn't happened — but it's listed so
      //      you can see what the range was expecting and chase it.
      let notDone = [];
      if (unitIds.length) {
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("assignment_targets")
            .select(
              "id, unit_id, party_id, assignment_id, status, assignment:assignments!inner(id, assignment_type, deleted_at, scheduled_date), unit:units(label), party:parties(label)",
            )
            .not("status", "in", "(done)")
            .in("unit_id", unitIds)
            .gte("assignment.scheduled_date", start)
            .lte("assignment.scheduled_date", end)
            .range(from, from + PAGE - 1);
          if (error || !data) break;
          notDone = notDone.concat(data);
          if (data.length < PAGE) break;
          if (from > 100000) break;
        }
      }
      {
        const byJob = new Map();
        notDone
          .filter((t) => t.assignment && !t.assignment.deleted_at)
          .forEach((t) => {
            const k = t.assignment_id;
            if (!byJob.has(k))
              byJob.set(k, {
                id: k,
                label: unitPartyLabel(t.unit?.label, t.party?.label) || "Job",
                type: t.assignment?.assignment_type || "",
                scheduled: t.assignment?.scheduled_date || null,
                total: 0,
                started: 0,
              });
            const r = byJob.get(k);
            r.total++;
            if (t.status === "in_progress" || t.status === "paused")
              r.started++;
          });
        setUnfinished(
          Array.from(byJob.values()).sort((a, b) =>
            String(a.label).localeCompare(String(b.label), undefined, {
              numeric: true,
            }),
          ),
        );
      }

      // 3b) The gap. `invoiced_on IS NULL` above is the ONLY filter this
      //     draft applies that the property's Done tab does not — so a
      //     bedroom finished in this window that an earlier invoice already
      //     stamped is done, in range, and still absent here with no
      //     explanation. That silence is what makes the two screens look
      //     like they disagree. Count it and say so.
      let alreadyBilled = { bedrooms: 0, invoices: [], items: [] };
      if (unitIds.length) {
        let billed = [];
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("assignment_targets")
            .select(
              "unit_id, party_id, invoiced_on, completed_at, assignment:assignments(assignment_type)",
            )
            .eq("status", "done")
            .in("unit_id", unitIds)
            .gte("completed_at", start + "T00:00:00")
            .lte("completed_at", end + "T23:59:59")
            .not("invoiced_on", "is", null)
            .range(from, from + PAGE - 1);
          if (error || !data) break;
          billed = billed.concat(data);
          if (data.length < PAGE) break;
          if (from > 100000) break;
        }
        const beds = new Set(billed.map((b) => `${b.unit_id}:${b.party_id}`));
        const invIds = [
          ...new Set(billed.map((b) => b.invoiced_on).filter(Boolean)),
        ];
        let invMeta = [];
        if (invIds.length) {
          const { data: im } = await supabase
            .from("invoices")
            .select("id, invoice_number, invoice_date, status")
            .in("id", invIds);
          invMeta = im || [];
        }
        const invById = Object.fromEntries(invMeta.map((i) => [i.id, i]));
        // One row per unit:party:invoice so the verify panel can show exactly
        // which already-sent invoice each cleaning is sitting on.
        const seenBilled = new Map();
        billed.forEach((b) => {
          const k = `${b.unit_id}:${b.party_id}:${b.invoiced_on}`;
          if (seenBilled.has(k)) {
            const ex = seenBilled.get(k);
            if (b.completed_at && (!ex.date || b.completed_at < ex.date))
              ex.date = b.completed_at;
            return;
          }
          const inv = invById[b.invoiced_on];
          seenBilled.set(k, {
            unitLabel: unitLabelById[b.unit_id] || "—",
            type: b.assignment?.assignment_type || "",
            date: b.completed_at || null,
            invoiceNumber: inv?.invoice_number || null,
            invoiceStatus: inv?.status || null,
          });
        });
        const billedItems = Array.from(seenBilled.values()).sort((a, b) =>
          String(a.unitLabel).localeCompare(String(b.unitLabel), undefined, {
            numeric: true,
          }),
        );
        alreadyBilled = {
          bedrooms: beds.size,
          invoices: invMeta,
          items: billedItems,
        };
      }
      setBilledElsewhere(alreadyBilled);
      // 4) Group by assignment (= one bedroom clean).
      const byAssign = new Map();
      const sampleItems = [];
      const sampleSecs = [];
      let withItemKey = 0,
        sectionOnly = 0;
      targets.forEach((t) => {
        if (t.assignment && t.assignment.deleted_at) return; // skip soft-deleted assignments
        const aid = t.assignment_id || `${t.unit_id}:${t.party_id}`;
        if (!byAssign.has(aid))
          byAssign.set(aid, {
            aid,
            unit_id: t.unit_id,
            party_id: t.party_id,
            type: t.assignment?.assignment_type,
            partyLabel: t.party?.label || "",
            tookLonger: false,
            days: new Set(),
            items: [],
            targetIds: [],
          });
        // The Extra flag lives on the ASSIGNMENT, so capture it here off the
        // target's joined assignment. It used to be read off the item objects
        // pushed below, which never carried an `assignment` key — so it was
        // always undefined and no line was ever marked EXTRA.
        if (t.assignment?.took_longer) byAssign.get(aid).tookLonger = true;
        // When the work actually happened. Every target carries completed_at
        // (the draft only takes status='done'), so collect the distinct days.
        if (t.completed_at)
          byAssign.get(aid).days.add(String(t.completed_at).slice(0, 10));
        const sec = (t.template_section || "").toLowerCase();
        const itemKey = t.template_item_key || "";
        const fullKey = itemKey
          ? itemKey.includes(":")
            ? itemKey
            : sec
              ? `${sec}:${itemKey}`
              : itemKey
          : sec
            ? `${sec}:__section__`
            : null;
        if (fullKey)
          byAssign
            .get(aid)
            .items.push({ fullKey, sec, itemKey, notes: t.status_notes });
        if (t.id) byAssign.get(aid).targetIds.push(t.id);
        const aType = t.assignment?.assignment_type || "?";
        if (itemKey) {
          withItemKey++;
          if (sampleItems.length < 15)
            sampleItems.push(`${sec || "(no sec)"}:${itemKey} · ${aType}`);
        } else {
          sectionOnly++;
          if (sampleSecs.length < 8)
            sampleSecs.push(`sec=${sec || "(empty)"} · ${aType}`);
        }
      });
      // 5) Build lines (show every cleaned thing — priced or not).
      // Pull the P&L manual charges so an apartment you priced in the report
      // but never invoiced pre-fills its line here — the "vice versa" half of
      // the two-way flow. Keyed by unit (invoice lines are per apartment).
      const mcUnitIds = [
        ...new Set(
          Array.from(byAssign.values())
            .map((g) => g.unit_id)
            .filter(Boolean),
        ),
      ];
      const manualByUnit = {};
      for (let i = 0; i < mcUnitIds.length; i += 200) {
        const { data: mcs } = await supabase
          .from("manual_charges")
          .select("unit_id, amount")
          .in("unit_id", mcUnitIds.slice(i, i + 200));
        (mcs || []).forEach((m) => {
          if (Number(m.amount) > 0) manualByUnit[m.unit_id] = Number(m.amount);
        });
      }
      const SEC_LABEL = {
        bathroom: "Bathroom",
        vanity: "Vanity",
        general: "General / kitchen",
        bedroom: "Bedroom",
      };
      const built = Array.from(byAssign.values())
        .map((g) => {
          const unitLabel = unitLabelById[g.unit_id] || "";
          const apt = String(unitLabel)
            .replace(/^B\d+-/i, "")
            .trim();
          const brm = (g.partyLabel.match(/(\d+)\s*$/) || [])[1] || "";
          // Whole-apartment (quick) cleans have no bedroom number — surface the
          // apartment's bed/bath count (e.g. "D302 · 2BR/2BA") on the invoice.
          const meta = unitMetaById[g.unit_id] || {};
          const brBa =
            !brm && (meta.bedrooms || meta.bathrooms)
              ? ` · ${meta.bedrooms || 0}BR/${meta.bathrooms || 0}BA`
              : "";
          const tookLonger = !!g.tookLonger;
          // NOTE: `label` prints on the client's invoice (see the print view), so
          // the EXTRA flag deliberately does NOT go in here. It rides on the line
          // as `tookLonger` and shows as an amber chip in the editor only.
          const label = brm ? `${apt} - ${brm}` : `${apt}${brBa}`;
          const subs = [];
          const seen = new Set();
          g.items.forEach((it) => {
            if (seen.has(it.fullKey)) return;
            seen.add(it.fullKey);
            const b = book[it.fullKey];
            const isSection = !it.itemKey;
            const isCustom = it.itemKey && it.itemKey.startsWith("custom_");
            const fallback = isSection
              ? `Whole ${SEC_LABEL[it.sec] || it.sec || "section"}`
              : isCustom
                ? it.notes || "Custom item"
                : resolveItemLabel(
                    it.fullKey,
                    "en",
                    null,
                    String(it.itemKey)
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase()),
                  );
            if (b) {
              const mode = b.mode === "time" ? "time" : "fixed";
              subs.push({
                key: it.fullKey,
                label: b.label || fallback,
                mode,
                amount: mode === "fixed" ? b.base_amount || 0 : "",
                rate: b.rate || defRate || 0,
                minutes: b.default_minutes || "",
                included: true,
                fromBook: true,
              });
            } else {
              subs.push({
                key: it.fullKey,
                label: fallback,
                mode: "fixed",
                amount: "",
                rate: defRate || 0,
                minutes: "",
                included: true,
                fromBook: false,
              });
            }
          });
          // Bedrooms with no itemized failures (cleaning checks where nothing
          // failed) still get billed — give them one flat "whole bedroom"
          // line, priced per service type and remembered like any item.
          if (subs.length === 0) {
            // Whole-apartment (nothing itemized failed). Price by SIZE first —
            // a 1x1 / 2x2 / 3x2 tier in the price book — because Bridges and
            // Citifront bill a flat rate per apartment size. Fall back to the
            // per-type flat price, then to unpriced.
            const meta = unitMetaById[g.unit_id] || {};
            const bd = meta.bedrooms != null ? meta.bedrooms : null;
            const ba = meta.bathrooms != null ? meta.bathrooms : null;
            const sizeKey =
              bd != null && ba != null ? `__apt__:${bd}x${ba}` : null;
            const flatKey = `__flat__:${g.type || "clean"}`;
            const sizeBook = sizeKey ? book[sizeKey] : null;
            const b = sizeBook || book[flatKey];
            const flatLabel =
              g.type === "cleaning_check"
                ? "Cleaning check (whole bedroom)"
                : g.type === "move_out_check"
                  ? "Move-out clean (whole bedroom)"
                  : "Whole bedroom";
            // Use the size key when a size price exists so removing/relabeling
            // stays stable; otherwise keep the flat-by-type key.
            const useKey = sizeBook ? sizeKey : flatKey;
            if (b) {
              const mode = b.mode === "time" ? "time" : "fixed";
              subs.push({
                key: useKey,
                label: b.label || flatLabel,
                mode,
                amount: mode === "fixed" ? b.base_amount || 0 : "",
                rate: b.rate || defRate || 0,
                minutes: b.default_minutes || "",
                included: true,
                fromBook: true,
              });
            } else if (manualByUnit[g.unit_id] != null) {
              // No price-book entry, but you set a charge for this apartment in
              // the P&L — pull it in so you're not re-typing it.
              subs.push({
                key: useKey,
                label: flatLabel,
                mode: "fixed",
                amount: String(manualByUnit[g.unit_id]),
                rate: 0,
                minutes: "",
                included: true,
                fromBook: false,
              });
            } else {
              subs.push({
                key: useKey,
                label: flatLabel,
                mode: "fixed",
                amount: "",
                rate: defRate || 0,
                minutes: "",
                included: true,
                fromBook: false,
              });
            }
          }
          subs.sort((a, b) => a.label.localeCompare(b.label));
          // #3 — remember what you charged last time for THIS EXACT set of items.
          // The per-item book above prices items individually; but you often price
          // the whole assignment as a bundle (tub alone vs tub+stove+fridge cost
          // different flat amounts). So we also key a "combo" price by the sorted
          // set of item keys. If we've billed this exact combo before, prefill the
          // line's flat total with that amount — you can still override it.
          const comboSig = subs
            .filter((s) => s.included)
            .map((s) => s.key)
            .sort()
            .join("|");
          const comboKey = comboSig
            ? `__combo__:${g.type || "clean"}:${comboSig}`
            : null;
          const comboBook = comboKey ? book[comboKey] : null;
          const amountOverride =
            comboBook &&
            comboBook.base_amount != null &&
            Number(comboBook.base_amount) > 0
              ? String(comboBook.base_amount)
              : "";
          const fromMemory = amountOverride !== "";
          return {
            key: g.aid,
            unitId: g.unit_id,
            partyId: g.party_id,
            label,
            serviceType: g.type,
            tookLonger,
            cleanedDays: Array.from(g.days).sort(),
            description: INVOICE_DESCR[g.type] || "",
            subsections: subs,
            amountOverride,
            comboKey,
            fromMemory,
            extraOn: tookLonger,
            extraMode: "fixed",
            extraAmount: "",
            extraMinutes: "",
            extraRate: "",
            extraNote: "",
            sourceTargetIds: g.targetIds,
          };
        })
        .filter((l) => l.label && l.subsections.length > 0)
        .sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { numeric: true }),
        );

      // Reopen path: carry the SAVED invoice's customizations onto the
      // freshly-regenerated lines, matched by unit:party. Without this,
      // reopening an invoice wiped every manual price, override, extra and
      // description because the editor rebuilds lines from scratch. Newly
      // eligible cleanings still appear (they just won't have a saved line
      // to inherit from); everything you'd already tuned survives.
      let builtSeeded = built;
      if (seedInvoice?.lines?.length) {
        const savedByKey = {};
        seedInvoice.lines.forEach((sl) => {
          savedByKey[`${sl.unit_id || ""}:${sl.party_id || ""}`] = sl;
        });
        builtSeeded = built.map((l) => {
          const sl = savedByKey[`${l.unitId || ""}:${l.partyId || ""}`];
          if (!sl) return l;
          const hasExtra =
            (parseFloat(sl.extra_amount) || 0) > 0 || sl.extra_note;
          // Rebuild subsection prices from the saved line so edited amounts
          // return exactly as they were.
          const savedSubs = Array.isArray(sl.subsections) ? sl.subsections : [];
          const subByKey = {};
          savedSubs.forEach((s) => {
            subByKey[s.key] = s;
          });
          const mergedSubs = l.subsections.map((s) => {
            const ss = subByKey[s.key];
            if (!ss) return s;
            return {
              ...s,
              mode: ss.mode || s.mode,
              amount: ss.amount != null ? ss.amount : s.amount,
              rate: ss.rate != null ? ss.rate : s.rate,
              minutes: ss.minutes != null ? ss.minutes : s.minutes,
              included: true,
            };
          });
          return {
            ...l,
            subsections: mergedSubs,
            description:
              sl.description != null ? sl.description : l.description,
            amountOverride: sl.amount_overridden
              ? String(sl.amount ?? "")
              : l.amountOverride,
            extraOn: !!hasExtra,
            extraMode: sl.extra_mode || "fixed",
            extraAmount:
              sl.extra_mode !== "time" && (parseFloat(sl.extra_amount) || 0) > 0
                ? String(sl.extra_amount)
                : "",
            extraMinutes:
              sl.extra_minutes != null ? String(sl.extra_minutes) : "",
            extraRate: sl.extra_rate != null ? String(sl.extra_rate) : "",
            extraNote: sl.extra_note || "",
            nonBillable: !!sl.non_billable,
          };
        });
      }
      // Any saved line whose apartment didn't regenerate (its targets are
      // no longer inside the date window, or the free-targets update hadn't
      // propagated yet) is REBUILT straight from the saved row. Without
      // this, reopening silently dropped those lines and their prices —
      // which is exactly the "it erased my presets" report. We reconstruct
      // the whole line from what was saved so nothing is lost.
      if (seedInvoice?.lines?.length) {
        const builtKeys = new Set(
          builtSeeded.map((l) => `${l.unitId || ""}:${l.partyId || ""}`),
        );
        const missing = seedInvoice.lines.filter(
          (sl) => !builtKeys.has(`${sl.unit_id || ""}:${sl.party_id || ""}`),
        );
        if (missing.length) {
          const rebuilt = missing.map((sl) => {
            const savedSubs = Array.isArray(sl.subsections)
              ? sl.subsections
              : [];
            const subs = savedSubs.length
              ? savedSubs.map((s) => ({
                  key: s.key,
                  label: s.label,
                  mode: s.mode || "fixed",
                  amount: s.amount != null ? s.amount : "",
                  rate: s.rate || 0,
                  minutes: s.minutes || "",
                  included: true,
                  fromBook: false,
                }))
              : [
                  {
                    key: `__flat__:${sl.service_type || "clean"}`,
                    label: sl.label || "Whole bedroom",
                    mode: "fixed",
                    amount:
                      parseFloat(sl.base_amount) || parseFloat(sl.amount) || 0,
                    rate: 0,
                    minutes: "",
                    included: true,
                    fromBook: false,
                  },
                ];
            const hasExtra =
              (parseFloat(sl.extra_amount) || 0) > 0 || sl.extra_note;
            return {
              key: `saved:${sl.id}`,
              unitId: sl.unit_id || null,
              partyId: sl.party_id || null,
              label: sl.label || "Line",
              serviceType: sl.service_type || "",
              tookLonger: false,
              cleanedDays: [],
              description: sl.description || "",
              subsections: subs,
              amountOverride: sl.amount_overridden
                ? String(sl.amount ?? "")
                : "",
              extraOn: !!hasExtra,
              extraMode: sl.extra_mode || "fixed",
              extraAmount:
                sl.extra_mode !== "time" &&
                (parseFloat(sl.extra_amount) || 0) > 0
                  ? String(sl.extra_amount)
                  : "",
              extraMinutes:
                sl.extra_minutes != null ? String(sl.extra_minutes) : "",
              extraRate: sl.extra_rate != null ? String(sl.extra_rate) : "",
              extraNote: sl.extra_note || "",
              nonBillable: !!sl.non_billable,
              // No source targets to re-stamp — this line was already billed
              // and its targets freed; saving re-stamps whatever regenerated.
              sourceTargetIds: [],
            };
          });
          builtSeeded = [...builtSeeded, ...rebuilt].sort((a, b) =>
            String(a.label).localeCompare(String(b.label), undefined, {
              numeric: true,
            }),
          );
        }
      }
      setLines(builtSeeded);
      // Diagnostics — surfaced in the empty state so we can see where it
      // breaks (no items found vs found-but-unpriced vs query error).
      const pricedKeys = Object.keys(book).length;
      setDiag({
        units: unitIds.length,
        doneItems: targets.length,
        withItemKey,
        sectionOnly,
        bedrooms: byAssign.size,
        lines: built.length,
        pricedKeys,
        sampleItems,
        sampleSecs,
        err: fetchErr ? fetchErr.message || String(fetchErr) : null,
      });
      // 6) Next invoice number = HIGHEST existing number + 1.
      //    This used to take the most recently CREATED row and add one,
      //    which is only the same thing if invoices are always made in
      //    order. Reopen an old invoice, or save one late, and the "last
      //    created" row is a low number — so the next draft would reuse a
      //    number you've already sent. Scan them all and take the max.
      //    Ordering in SQL can't help here: invoice_number is text, so the
      //    database sorts "99" above "472".
      let allNums = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("invoices")
          .select("invoice_number")
          .range(from, from + 999);
        if (error || !data) break;
        allNums = allNums.concat(data);
        if (data.length < 1000) break;
        if (from > 100000) break;
      }
      const maxNum = allNums
        .map((r) =>
          parseInt(String(r.invoice_number || "").replace(/[^0-9]/g, ""), 10),
        )
        .filter((n) => Number.isFinite(n))
        .reduce((m, n) => Math.max(m, n), 0);
      // Reopen keeps the SAME invoice number and metadata — you're editing
      // the same bill, not writing a new one. A fresh draft gets max+1.
      if (seedInvoice?.invoice_number) {
        setInvoiceNumber(String(seedInvoice.invoice_number));
      } else {
        setInvoiceNumber(maxNum > 0 ? String(maxNum + 1) : "1");
      }
      setTakenNumbers(
        new Set(
          allNums
            .map((r) => String(r.invoice_number || "").trim())
            .filter(Boolean),
        ),
      );
      if (seedInvoice) {
        if (seedInvoice.title) setTitle(seedInvoice.title);
        if (seedInvoice.invoice_date) setInvoiceDate(seedInvoice.invoice_date);
        if (seedInvoice.due_date) setDueDate(seedInvoice.due_date);
      }
      // 7) Bill-to: from the reopened invoice if present, else property.
      setBillTo({
        org: seedInvoice?.bill_to_org || property.name || "",
        contact:
          seedInvoice?.bill_to_contact || property.billing_contact_name || "",
        email: seedInvoice?.bill_to_email || property.billing_email || "",
        phone: seedInvoice?.bill_to_phone || property.billing_phone || "",
        address:
          seedInvoice?.bill_to_address ||
          property.billing_address ||
          property.address ||
          "",
      });
      setLoading(false);
    })(); /* eslint-disable-next-line */
  }, []);

  const toggleExpand = (k) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  const updateLine = (key, patch) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const updateSub = (key, si, patch) =>
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const subsections = l.subsections.map((s, i) =>
          i === si ? { ...s, ...patch } : s,
        );
        return { ...l, subsections };
      }),
    );
  const removeLine = (key) => setLines((ls) => ls.filter((l) => l.key !== key));

  const grandTotal = lines.reduce((s, l) => s + lineAmount(l), 0);

  const save = async (status) => {
    setSaving(true);
    const total = lines.reduce((s, l) => s + lineAmount(l), 0);
    const { data: inv, error } = await supabase
      .from("invoices")
      .insert({
        customer_id: property.id,
        invoice_number: invoiceNumber || null,
        title: title || null,
        invoice_date: invoiceDate || null,
        due_date: dueDate || null,
        status: status || "draft",
        bill_to_org: billTo.org || null,
        bill_to_contact: billTo.contact || null,
        bill_to_email: billTo.email || null,
        bill_to_phone: billTo.phone || null,
        bill_to_address: billTo.address || null,
        period_start: start,
        period_end: end,
        total,
        created_by: employee?.id || null,
      })
      .select()
      .single();
    if (error) {
      setSaving(false);
      alert("Could not save invoice: " + error.message);
      return;
    }
    // Remember this billing contact on the property so the next invoice
    // for it prefills automatically instead of re-typing.
    supabase
      .from("customers")
      .update({
        billing_contact_name: billTo.contact || null,
        billing_email: billTo.email || null,
        billing_phone: billTo.phone || null,
        billing_address: billTo.address || null,
      })
      .eq("id", property.id)
      .then(
        () => {},
        () => {},
      );
    const lineRows = lines.map((l, i) => ({
      invoice_id: inv.id,
      unit_id: l.unitId || null,
      party_id: l.partyId || null,
      label: l.label,
      service_type: l.serviceType || null,
      description: l.description || null,
      subsections: l.subsections
        .filter((s) => s.included)
        .map((s) => ({
          key: s.key,
          label: s.label,
          mode: s.mode,
          amount: subAmount(s),
          minutes: s.minutes,
          rate: s.rate,
        })),
      amount: lineAmount(l),
      amount_overridden: l.amountOverride !== "" && l.amountOverride != null,
      base_amount: baseAmount(l),
      extra_amount: extraAmount(l),
      extra_note: l.extraOn && l.extraNote ? l.extraNote : null,
      extra_mode: l.extraOn ? l.extraMode || "fixed" : null,
      extra_minutes:
        l.extraOn && l.extraMode === "time"
          ? parseFloat(l.extraMinutes) || 0
          : null,
      extra_rate:
        l.extraOn && l.extraMode === "time"
          ? parseFloat(l.extraRate) || 0
          : null,
      // Non-billable lines: amount above is 0 (they don't add to the bill),
      // but we keep what they WOULD have been so reporting shows the comp.
      non_billable: !!l.nonBillable,
      full_amount: lineFullAmount(l),
      qty: 1,
      sort_order: i,
      source_unit_id: l.unitId || null,
      source_party_id: l.partyId || null,
    }));
    if (lineRows.length) {
      const { error: le } = await supabase
        .from("invoice_lines")
        .insert(lineRows);
      if (le) {
        setSaving(false);
        alert("Invoice saved but lines failed: " + le.message);
        return;
      }
    }
    // #3 — learn the combo price. For each billable line that has a combo key
    // (its exact item set) and a real total, remember that amount so the next
    // assignment with the same item set prefills automatically. Only stores
    // when there's an actual amount, and never overwrites with 0/blank.
    try {
      const comboPayload = [];
      lines.forEach((l) => {
        if (!l.comboKey || l.nonBillable) return;
        const amt = lineAmount(l);
        if (!amt || amt <= 0) return;
        comboPayload.push({
          customer_id: property.id,
          subsection_key: l.comboKey,
          label: `Last charged for ${l.label}`,
          mode: "fixed",
          base_amount: amt,
          rate: 0,
          default_minutes: 0,
          sort_order: 5,
          updated_at: new Date().toISOString(),
        });
      });
      if (comboPayload.length) {
        await supabase
          .from("invoice_price_book")
          .upsert(comboPayload, { onConflict: "customer_id,subsection_key" });
      }
    } catch (e) {
      console.warn("[combo price learn] skipped", e);
    }
    // Stamp every covered item as invoiced so it can't be billed again.
    // (Removed lines aren't stamped, so they stay billable.)
    const allTargetIds = lines.flatMap((l) => l.sourceTargetIds || []);
    for (let i = 0; i < allTargetIds.length; i += 200) {
      const chunk = allTargetIds.slice(i, i + 200);
      if (chunk.length)
        await supabase
          .from("assignment_targets")
          .update({ invoiced_on: inv.id })
          .in("id", chunk);
    }
    // Learn: any item priced inline that wasn't already in the price book
    // gets remembered for next time (fixed amount or time rate+minutes).
    const learnMap = {};
    lines.forEach((l) =>
      (l.subsections || []).forEach((s) => {
        if (s.fromBook || !s.included) return;
        if (s.mode === "time") {
          const rate = parseFloat(s.rate) || defaultRate || 0;
          if (rate > 0)
            learnMap[s.key] = {
              customer_id: property.id,
              subsection_key: s.key,
              label: s.label,
              mode: "time",
              base_amount: 0,
              rate,
              default_minutes: parseFloat(s.minutes) || 0,
              sort_order: 0,
              updated_at: new Date().toISOString(),
            };
        } else {
          const amt = parseFloat(s.amount) || 0;
          if (amt > 0)
            learnMap[s.key] = {
              customer_id: property.id,
              subsection_key: s.key,
              label: s.label,
              mode: "fixed",
              base_amount: amt,
              rate: 0,
              default_minutes: 0,
              sort_order: 0,
              updated_at: new Date().toISOString(),
            };
        }
      }),
    );
    const learnRows = Object.values(learnMap);
    if (learnRows.length) {
      await supabase
        .from("invoice_price_book")
        .upsert(learnRows, { onConflict: "customer_id,subsection_key" });
    }
    setSaving(false);
    onSaved && onSaved(inv);
  };

  if (loading) return <Splash text="Building draft…" />;

  if (previewing) {
    const previewInv = {
      invoice_number: invoiceNumber,
      title,
      invoice_date: invoiceDate,
      due_date: dueDate,
      status: "draft",
      bill_to_org: billTo.org,
      bill_to_contact: billTo.contact,
      bill_to_email: billTo.email,
      bill_to_phone: billTo.phone,
      bill_to_address: billTo.address,
    };
    // Must mirror what save() writes, or the preview lies about the bill.
    // InvoiceDocument reads the DB column names (extra_amount etc.), and
    // this mapper used to drop them — so an extra charge was invisible in
    // the preview and only appeared once the invoice was saved.
    const previewLines = lines.map((l) => ({
      id: l.key,
      label: l.label,
      service_type: l.serviceType,
      description: l.description,
      qty: 1,
      amount: lineAmount(l),
      base_amount: baseAmount(l),
      extra_amount: extraAmount(l),
      non_billable: !!l.nonBillable,
      full_amount: lineFullAmount(l),
      extra_note: l.extraOn && l.extraNote ? l.extraNote : null,
      extra_mode: l.extraOn ? l.extraMode || "fixed" : null,
      extra_minutes:
        l.extraOn && l.extraMode === "time"
          ? parseFloat(l.extraMinutes) || 0
          : null,
      extra_rate:
        l.extraOn && l.extraMode === "time"
          ? parseFloat(l.extraRate) || 0
          : null,
    }));
    return (
      <InvoiceDocument
        data={{ inv: previewInv, lines: previewLines }}
        preview
        saving={saving}
        onSaveDraft={() => save("draft")}
        onSaveSent={() => save("sent")}
        onSavePaid={() => save("paid")}
        onBack={() => setPreviewing(false)}
      />
    );
  }

  return (
    <div className="pb-28">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-stone-200 bg-white sticky top-0 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-stone-700 text-sm"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewing(true)}
            className="px-3 py-2 rounded-xl bg-white border border-stone-300 text-stone-700 text-sm font-medium flex items-center gap-1.5"
          >
            <Eye size={15} /> Preview
          </button>
          <button
            onClick={() => save("draft")}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
        </div>
      </div>

      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">
          {property.name}
        </div>
        <h1 className="text-3xl font-light text-stone-900 tracking-tight mb-1">
          Invoice{" "}
          <span className="font-serif italic text-amber-700">draft</span>
        </h1>
        <p className="text-xs text-stone-500 font-mono mb-5">
          {start} → {end} · {lines.length} bedrooms
        </p>

        {/* Invoice meta */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="text-xs font-mono text-stone-500">
            Invoice #
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className={`mt-1 w-full px-3 py-2 rounded-lg border bg-white text-sm text-stone-900 ${
                takenNumbers.has(String(invoiceNumber).trim())
                  ? "border-red-400"
                  : "border-stone-300"
              }`}
            />
            {/* Auto-filled with the next number, but it's a free text field —
               so say something if you land on one that's already out there. */}
            {takenNumbers.has(String(invoiceNumber).trim()) && (
              <span className="block mt-1 text-[10px] text-red-600 normal-case">
                #{invoiceNumber} is already used by another invoice.
              </span>
            )}
          </label>
          <label className="text-xs font-mono text-stone-500">
            Invoice date
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm text-stone-900"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="text-xs font-mono text-stone-500">
            Due date
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm text-stone-900"
            />
          </label>
          <label className="text-xs font-mono text-stone-500">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cleaning Checks June Bldg 6-10"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm text-stone-900"
            />
          </label>
        </div>

        {/* Bill to (collapsible, defaulted from property) */}
        <div className="mb-5 rounded-2xl bg-white border border-stone-200 overflow-hidden">
          <button
            onClick={() => setBillOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50"
          >
            <span className="text-sm font-medium text-stone-800">
              Bill to · {billTo.org || "—"}
            </span>
            <ChevronRight
              size={15}
              className={`text-stone-400 transition-transform ${billOpen ? "rotate-90" : ""}`}
            />
          </button>
          {billOpen && (
            <div className="border-t border-stone-100 p-4 space-y-2">
              {[
                ["org", "Organization"],
                ["contact", "Contact name"],
                ["email", "Email"],
                ["phone", "Phone"],
                ["address", "Address"],
              ].map(([k, lbl]) => (
                <label
                  key={k}
                  className="block text-[11px] font-mono text-stone-500"
                >
                  {lbl}
                  <input
                    value={billTo[k]}
                    onChange={(e) =>
                      setBillTo((b) => ({ ...b, [k]: e.target.value }))
                    }
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm text-stone-900"
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Reconciliation. The Done tab on the property side counts every
           finished bedroom in this window; this draft drops the ones an
           earlier invoice already claimed. Without this line the two
           screens disagree for no visible reason. */}
        {rebillWarning && (
          <div className="mb-3 p-3 rounded-2xl bg-red-50 border-2 border-red-300">
            <div className="text-xs text-red-900 font-bold flex items-center gap-1.5">
              <AlertCircle size={14} className="flex-shrink-0" /> Re-bill
              protection is OFF
            </div>
            <div className="text-[11px] text-red-800 mt-1">
              This database is missing the column that tracks which cleanings
              have already been invoiced, so this draft may show work you've{" "}
              <span className="font-bold">already billed</span> (e.g. a bedroom
              that's on another invoice). Don't send this until it's fixed — run
              the <span className="font-mono">v41</span> migration in Supabase,
              then reopen this draft.
            </div>
          </div>
        )}

        {billedElsewhere.bedrooms > 0 && (
          <div className="mb-3 p-3 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="text-xs text-amber-900 font-medium">
              {billedElsewhere.bedrooms} more{" "}
              {billedElsewhere.bedrooms === 1
                ? "cleaning was"
                : "cleanings were"}{" "}
              finished in this window but{" "}
              {billedElsewhere.bedrooms === 1 ? "is" : "are"} already billed —
              not shown below.
            </div>
            {billedElsewhere.invoices.length > 0 && (
              <div className="text-[11px] font-mono text-amber-800/80 mt-1">
                On{" "}
                {billedElsewhere.invoices
                  .map((i) => `#${i.invoice_number || "—"} (${i.status})`)
                  .join(", ")}
              </div>
            )}
            <div className="text-[11px] text-amber-800/70 mt-1">
              This is why the property's Done list can show more than this
              draft. To re-bill them, reopen that invoice with “Edit / add
              cleanings”.
            </div>
          </div>
        )}

        {/* Scheduled in this range but not finished. Deliberately NOT
           billable lines: an invoice is a claim that work happened, and
           nothing here has. Listed so the range can't quietly hide a job,
           and dismissible so a known no-show stops nagging. */}
        {unfinished.filter((u) => !dismissed.has(u.id)).length > 0 && (
          <div className="mb-4 rounded-2xl border-2 border-red-300 bg-red-50 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-red-200">
              <div className="text-xs font-medium text-red-900">
                {unfinished.filter((u) => !dismissed.has(u.id)).length} cleaning
                {unfinished.filter((u) => !dismissed.has(u.id)).length === 1
                  ? ""
                  : "s"}{" "}
                scheduled in this range{" "}
                {unfinished.filter((u) => !dismissed.has(u.id)).length === 1
                  ? "is"
                  : "are"}{" "}
                not finished — not billed below.
              </div>
              <div className="text-[11px] text-red-800/70 mt-0.5">
                Finish them in Operations and regenerate to bill them, or
                dismiss to hide.
              </div>
            </div>
            {unfinished
              .filter((u) => !dismissed.has(u.id))
              .map((u) => (
                <div
                  key={u.id}
                  className="px-4 py-2 flex items-center gap-2 border-b border-red-100 last:border-0"
                >
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex-shrink-0 ${
                      u.started > 0
                        ? "bg-amber-500 text-white"
                        : "bg-white border border-red-300 text-red-700"
                    }`}
                  >
                    {u.started > 0 ? "In progress" : "Not started"}
                  </span>
                  <span className="font-mono text-sm text-stone-900 truncate">
                    {u.label}
                  </span>
                  {u.type && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-stone-600 flex-shrink-0">
                      {assignmentTypeLabel(u.type)}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-stone-500 flex-shrink-0">
                    {u.scheduled ? fmtDueDate(u.scheduled) : "no date"} ·{" "}
                    {u.started}/{u.total} items started
                  </span>
                  <button
                    onClick={() =>
                      setDismissed((prev) => new Set([...prev, u.id]))
                    }
                    title="Hide this — doesn't change the job"
                    className="ml-auto p-1 rounded-lg text-red-400 hover:text-red-700 hover:bg-red-100 flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
          </div>
        )}

        {/* CROSS-CHECK — see the same three things you'd check by hand:
            what this draft bills, what's already on past invoices, and what
            was done in this range but isn't being billed. All for the same
            date window, so you can confirm nothing's double-billed or
            missed before sending. */}
        <div className="mb-4 rounded-2xl border border-stone-200 overflow-hidden">
          <button
            onClick={() => setVerifyOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 hover:bg-stone-100 transition-colors"
          >
            <span className="text-xs uppercase tracking-wider font-mono text-stone-700 flex items-center gap-2">
              <ClipboardList size={13} /> Cross-check this range
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-stone-400">
                {lines.length} to bill · {billedElsewhere.bedrooms} already
                billed
              </span>
              <ChevronRight
                size={15}
                className={`text-stone-400 transition-transform ${verifyOpen ? "rotate-90" : ""}`}
              />
            </span>
          </button>
          {verifyOpen && (
            <div className="p-4 space-y-4 bg-white">
              {/* 1 — On this draft */}
              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono text-emerald-700 mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> On
                  this new invoice ({lines.length})
                </div>
                {lines.length === 0 ? (
                  <div className="text-xs text-stone-400 pl-3.5">
                    Nothing on the draft yet.
                  </div>
                ) : (
                  <div className="space-y-1 pl-3.5">
                    {lines.map((l) => (
                      <div
                        key={l.key}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-mono text-stone-800 truncate">
                          {l.label}
                          {l.serviceType
                            ? ` · ${assignmentTypeLabel ? assignmentTypeLabel(l.serviceType) : l.serviceType}`
                            : ""}
                          {l.cleanedDays?.length > 0 && (
                            <span className="text-stone-400">
                              {" "}
                              · {fmtDueDate(l.cleanedDays[0])}
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-stone-600 flex-shrink-0">
                          {l.nonBillable ? (
                            <span className="text-stone-400">not billed</span>
                          ) : (
                            `$${lineAmount(l).toFixed(2)}`
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2 — Already on past invoices */}
              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono text-blue-700 mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Already
                  billed on a past invoice ({billedElsewhere.items?.length || 0}
                  )
                </div>
                {(billedElsewhere.items?.length || 0) === 0 ? (
                  <div className="text-xs text-stone-400 pl-3.5">
                    None of this range's cleanings are on an earlier invoice.
                  </div>
                ) : (
                  <div className="space-y-1 pl-3.5">
                    {billedElsewhere.items.map((b, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-mono text-stone-800 truncate">
                          {b.unitLabel}
                          {b.type
                            ? ` · ${assignmentTypeLabel ? assignmentTypeLabel(b.type) : b.type}`
                            : ""}
                          {b.date && (
                            <span className="text-stone-400">
                              {" "}
                              · {fmtDueDate(String(b.date).slice(0, 10))}
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-blue-700 flex-shrink-0 whitespace-nowrap">
                          #{b.invoiceNumber || "—"}
                          {b.invoiceStatus ? ` (${b.invoiceStatus})` : ""}
                        </span>
                      </div>
                    ))}
                    <div className="text-[11px] text-stone-400 pt-1">
                      These are hidden from the draft above so they can't be
                      billed twice.
                    </div>
                  </div>
                )}
              </div>

              {/* 3 — Done in range but not on this bill (unfinished / scheduled) */}
              {unfinished.filter((u) => !dismissed.has(u.id)).length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-mono text-amber-700 mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />{" "}
                    Scheduled in range, not finished (
                    {unfinished.filter((u) => !dismissed.has(u.id)).length})
                  </div>
                  <div className="space-y-1 pl-3.5">
                    {unfinished
                      .filter((u) => !dismissed.has(u.id))
                      .map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-mono text-stone-800 truncate">
                            {u.label}
                            {u.type
                              ? ` · ${assignmentTypeLabel ? assignmentTypeLabel(u.type) : u.type}`
                              : ""}
                            {u.scheduled && (
                              <span className="text-stone-400">
                                {" "}
                                · {fmtDueDate(String(u.scheduled).slice(0, 10))}
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-stone-400 flex-shrink-0">
                            {u.started}/{u.total} started
                          </span>
                        </div>
                      ))}
                    <div className="text-[11px] text-stone-400 pt-1">
                      Not billed — the work isn't finished.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wider text-stone-500 font-mono">
            Line items ({lines.length})
          </span>
          {diag && lines.length > 0 && (
            <span className="text-[10px] font-mono text-stone-400">
              {diag.bedrooms} {diag.bedrooms === 1 ? "bedroom" : "bedrooms"}{" "}
              billable · {diag.doneItems} cleaned items
            </span>
          )}
        </div>
        {lines.length === 0 ? (
          <div className="py-6 px-4 border-2 border-dashed border-stone-200 rounded-2xl text-sm">
            <div className="text-stone-500 mb-3 text-center">
              Nothing to bill in this range yet.
            </div>
            {diag && (
              <div className="text-xs font-mono text-stone-500 space-y-1 bg-stone-50 rounded-xl p-3">
                <div>
                  Units in property:{" "}
                  <span className="text-stone-800">{diag.units}</span>
                </div>
                <div>
                  Cleaned items found in range:{" "}
                  <span className="text-stone-800">{diag.doneItems}</span>
                </div>
                <div>
                  Bedrooms with work:{" "}
                  <span className="text-stone-800">{diag.bedrooms}</span>
                </div>
                <div>
                  Priced items in price book:{" "}
                  <span className="text-stone-800">{diag.pricedKeys}</span>
                </div>
                {diag.err && (
                  <div className="text-red-600 break-words">
                    Query error: {diag.err}
                  </div>
                )}
                <div className="pt-2 text-stone-400">
                  {diag.units === 0
                    ? "This property has no units — generation needs unit/bedroom data."
                    : diag.doneItems === 0
                      ? "No items were marked done with a completion date in this range. Try widening the dates, or check that these cleans were completed (not just started)."
                      : diag.pricedKeys === 0
                        ? "Items were cleaned, but nothing is priced yet — set prices in the price book."
                        : "Items were cleaned but none matched a priced subsection key. Tell me a cleaned item and I can check the key mapping."}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {lines.map((l, idx) => {
              const open = expanded.has(l.key);
              const amt = lineAmount(l);
              const base = baseAmount(l);
              const xtra = extraAmount(l);
              // What the ticked items come to, before any override replaces
              // it — shown next to the "Standard" header so the override is
              // visibly a replacement rather than a mystery.
              const baseItemsTotal = (l.subsections || [])
                .filter((x) => x.included)
                .reduce((sum, x) => sum + subAmount(x), 0);
              const overridden =
                l.overrideMode === "time" ||
                (l.amountOverride !== "" && l.amountOverride != null);
              return (
                /* Heavy border + shadow: expanded lines run long, and a 1px
                   hairline made it impossible to see where one apartment
                   ended and the next began. Open lines get an amber edge so
                   the one you're editing is unmistakable. */
                <div
                  key={l.key}
                  className={`rounded-2xl overflow-hidden bg-white shadow-sm ${
                    open
                      ? "border-2 border-amber-400 shadow-md"
                      : "border-2 border-stone-300"
                  }`}
                >
                  <div
                    className={`flex items-center gap-2 px-4 py-3 ${open ? "bg-amber-50 border-b-2 border-amber-200" : ""}`}
                  >
                    <button
                      onClick={() => toggleExpand(l.key)}
                      className="flex-1 flex items-center gap-2 text-left"
                    >
                      <ChevronRight
                        size={15}
                        className={`text-stone-400 transition-transform ${open ? "rotate-90" : ""}`}
                      />
                      <span className="font-mono text-sm font-medium text-stone-900">
                        {l.label}
                      </span>
                      {l.serviceType && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                          {assignmentTypeLabel
                            ? assignmentTypeLabel(l.serviceType)
                            : l.serviceType}
                        </span>
                      )}
                      {/* Two ways a line becomes "extra": the cleaner flagged
                         it in the field (tookLonger), or you priced one here.
                         Either way the chip should say so — a $30 extra with
                         no chip is exactly the thing you'd miss scanning
                         seven lines. */}
                      {(l.tookLonger || xtra > 0) && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white inline-flex items-center gap-1 flex-shrink-0"
                          title={
                            xtra > 0
                              ? `Extra charge of $${xtra.toFixed(2)} on this line`
                              : "Cleaner marked this as taking longer — charge extra"
                          }
                        >
                          <Clock size={9} /> EXTRA
                          {xtra > 0 ? ` +$${xtra.toFixed(2)}` : ""}
                        </span>
                      )}
                    </button>
                    {/* When this bedroom was actually cleaned. The invoice
                       only bills finished work, so every line has a date —
                       and you shouldn't have to trust the range blindly. */}
                    {l.cleanedDays?.length > 0 && (
                      <span className="text-[10px] font-mono text-stone-500 flex-shrink-0 inline-flex items-center gap-1 whitespace-nowrap">
                        <Calendar size={9} className="text-stone-400" />
                        {l.cleanedDays.length === 1
                          ? fmtDueDate(l.cleanedDays[0])
                          : `${fmtDueDate(l.cleanedDays[0])} → ${fmtDueDate(l.cleanedDays[l.cleanedDays.length - 1])}`}
                      </span>
                    )}
                    <span className="text-right flex-shrink-0">
                      {l.nonBillable ? (
                        <>
                          <span className="font-mono text-sm block text-stone-400 line-through">
                            ${lineFullAmount(l).toFixed(2)}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-full bg-stone-200 text-stone-600 font-bold">
                            Not billed
                          </span>
                        </>
                      ) : (
                        <>
                          <span
                            className={`font-mono text-sm block ${overridden ? "text-amber-700" : "text-stone-900"}`}
                          >
                            ${amt.toFixed(2)}
                          </span>
                          {xtra > 0 && (
                            <span className="text-[10px] font-mono text-amber-700 block">
                              ${base.toFixed(2)} + ${xtra.toFixed(2)} extra
                            </span>
                          )}
                        </>
                      )}
                    </span>
                    <button
                      onClick={() => removeLine(l.key)}
                      className="p-1.5 rounded-lg text-stone-300 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {open && (
                    <div className="border-t border-stone-100 p-4 space-y-3">
                      {/* Non-billable: owner eats this line. Excluded from the
                         property's total and hidden on the printed invoice,
                         but still recorded so it shows in reporting. */}
                      <label
                        className={`flex items-center gap-3 p-3 rounded-xl border ${l.nonBillable ? "bg-stone-100 border-stone-300" : "bg-white border-stone-200"}`}
                      >
                        <input
                          type="checkbox"
                          checked={!!l.nonBillable}
                          onChange={(e) =>
                            updateLine(l.key, { nonBillable: e.target.checked })
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-stone-900">
                            Don't bill the property for this
                          </div>
                          <div className="text-xs text-stone-500">
                            Keeps it off the invoice you send and out of the
                            total, but still records it (at{" "}
                            {`$${lineFullAmount(l).toFixed(2)}`}) so it shows in
                            your reports as a comp / redo you covered.
                          </div>
                        </div>
                      </label>
                      {/* Three stages, in the order they apply:
                         1. STANDARD — the priced items
                         2. EXTRA    — added on top
                         3. OVERRIDE — replaces the standard total, so it
                                       goes last where it can't be missed. */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500">
                          1 · Standard
                        </span>
                        <span className="text-[10px] font-mono text-stone-400">
                          what the items come to
                        </span>
                        <div className="flex-1 h-px bg-stone-200" />
                        <span className="text-[11px] font-mono text-stone-700">
                          ${baseItemsTotal.toFixed(2)}
                        </span>
                      </div>
                      {l.subsections.length === 0 ? (
                        <div className="text-xs text-stone-400 font-mono">
                          No priced items detected for this bedroom. Set a line
                          total below, or price its items in the price book.
                        </div>
                      ) : (
                        (() => {
                          const bySection = {};
                          l.subsections.forEach((s, si) => {
                            const sec =
                              String(s.key || "").split(":")[0] || "other";
                            (bySection[sec] = bySection[sec] || []).push({
                              s,
                              si,
                            });
                          });
                          const order = [
                            "bedroom",
                            "vanity",
                            "bathroom",
                            "general",
                            "__flat__",
                            "other",
                          ];
                          // '__flat__' is the synthetic key for a whole-bedroom
                          // line (nothing itemised failed). It was printing raw
                          // as "__FLAT__", which means nothing to anyone.
                          const secLabel = {
                            bedroom: "Bedroom",
                            vanity: "Vanity",
                            bathroom: "Bathroom",
                            general: "General",
                            __flat__: "Whole bedroom",
                            other: "Other",
                          };
                          const secs = Object.keys(bySection).sort((a, b) => {
                            const ia = order.indexOf(a),
                              ib = order.indexOf(b);
                            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
                          });
                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
                              {secs.map((sec) => (
                                <React.Fragment key={sec}>
                                  <div className="col-span-full text-[10px] uppercase tracking-wider font-mono text-stone-400 border-b border-stone-100 pb-1 mt-1">
                                    {secLabel[sec] || sec}
                                  </div>
                                  {bySection[sec].map(({ s, si }) => (
                                    <div
                                      key={s.key}
                                      className="flex items-center gap-1.5 min-w-0 max-w-[340px]"
                                    >
                                      <button
                                        onClick={() =>
                                          updateSub(l.key, si, {
                                            included: !s.included,
                                          })
                                        }
                                        className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${s.included ? "bg-stone-900 text-white" : "border border-stone-300 text-transparent"}`}
                                      >
                                        <Check size={10} />
                                      </button>
                                      <span
                                        className={`flex-1 min-w-0 text-xs truncate ${s.included ? "text-stone-800" : "text-stone-400 line-through"} ${!s.fromBook && s.included ? "font-medium" : ""}`}
                                        title={s.label}
                                      >
                                        {s.label}
                                      </span>
                                      <button
                                        onClick={() =>
                                          updateSub(l.key, si, {
                                            mode:
                                              s.mode === "time"
                                                ? "fixed"
                                                : "time",
                                            rate:
                                              parseFloat(s.rate) > 0
                                                ? s.rate
                                                : defaultRate || 0,
                                          })
                                        }
                                        className={`p-0.5 rounded flex-shrink-0 ${s.mode === "time" ? "text-stone-900 bg-stone-100" : "text-stone-300 hover:text-stone-500"}`}
                                        title="Switch to time × rate"
                                      >
                                        <Clock size={11} />
                                      </button>
                                      {s.mode === "time" ? (
                                        /* Was "47 × 2" with no units — unreadable.
                                         It's an hourly RATE times MINUTES, so say
                                         so, and show what it works out to. */
                                        <span
                                          className="flex items-center gap-0.5 text-[11px] font-mono flex-shrink-0"
                                          title="Hourly rate × minutes"
                                        >
                                          <span className="text-stone-400">
                                            $
                                          </span>
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={s.rate}
                                            onChange={(e) =>
                                              updateSub(l.key, si, {
                                                rate: e.target.value,
                                              })
                                            }
                                            placeholder={
                                              defaultRate
                                                ? String(defaultRate)
                                                : "0"
                                            }
                                            className="w-10 px-1 py-0.5 rounded border border-stone-300 bg-white text-right"
                                          />
                                          <span className="text-stone-400">
                                            /hr ×
                                          </span>
                                          <input
                                            type="number"
                                            value={s.minutes}
                                            onChange={(e) =>
                                              updateSub(l.key, si, {
                                                minutes: e.target.value,
                                              })
                                            }
                                            placeholder="0"
                                            className="w-8 px-1 py-0.5 rounded border border-stone-300 bg-white text-right"
                                          />
                                          <span className="text-stone-400">
                                            m =
                                          </span>
                                          <span className="text-emerald-700 font-medium w-12 text-right">
                                            ${subAmount(s).toFixed(2)}
                                          </span>
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-0.5 text-[11px] font-mono flex-shrink-0">
                                          <span className="text-stone-400">
                                            $
                                          </span>
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={s.amount}
                                            onChange={(e) =>
                                              updateSub(l.key, si, {
                                                amount: e.target.value,
                                              })
                                            }
                                            placeholder="0.00"
                                            className={`w-14 px-1.5 py-0.5 rounded border bg-white text-right ${s.fromBook ? "border-stone-300" : "border-amber-300"}`}
                                          />
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </React.Fragment>
                              ))}
                            </div>
                          );
                        })()
                      )}
                      <div className="pt-2 border-t border-stone-100">
                        <label className="block text-[11px] font-mono text-stone-500 mb-1">
                          Description (prints on invoice)
                        </label>
                        <input
                          value={l.description}
                          onChange={(e) =>
                            updateLine(l.key, { description: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm text-stone-700"
                        />
                      </div>
                      {/* EXTRA — adds on top of the standard total. */}
                      <div className="pt-3 mt-2 border-t-2 border-amber-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] uppercase tracking-wider font-mono text-amber-700">
                            2 · Extra charge
                          </span>
                          <span className="text-[10px] font-mono text-stone-400">
                            added on top
                          </span>
                          <div className="flex-1 h-px bg-amber-100" />
                          <span className="text-[11px] font-mono text-amber-700">
                            +${xtra.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <button
                            onClick={() =>
                              updateLine(l.key, {
                                extraOn: !l.extraOn,
                                extraRate:
                                  !l.extraOn && !l.extraRate
                                    ? defaultRate || ""
                                    : l.extraRate,
                              })
                            }
                            className={`text-[10px] font-mono px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${l.extraOn ? "bg-amber-500 text-white" : "bg-white border border-dashed border-stone-300 text-stone-500"}`}
                          >
                            <Plus size={10} />{" "}
                            {l.extraOn ? "Extra charge" : "Add extra charge"}
                          </button>
                          {l.extraOn && (
                            <div className="flex p-0.5 bg-stone-100 rounded-lg">
                              <button
                                onClick={() =>
                                  updateLine(l.key, { extraMode: "fixed" })
                                }
                                className={`px-2 py-1 rounded-md text-[10px] font-mono flex items-center gap-0.5 ${l.extraMode !== "time" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
                              >
                                <DollarSign size={10} /> Amount
                              </button>
                              <button
                                onClick={() =>
                                  updateLine(l.key, {
                                    extraMode: "time",
                                    extraRate:
                                      parseFloat(l.extraRate) > 0
                                        ? l.extraRate
                                        : defaultRate || 0,
                                  })
                                }
                                className={`px-2 py-1 rounded-md text-[10px] font-mono flex items-center gap-0.5 ${l.extraMode === "time" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
                              >
                                <Clock size={10} /> Time × rate
                              </button>
                            </div>
                          )}
                        </div>
                        {l.extraOn && (
                          <>
                            {l.extraMode === "time" ? (
                              <div className="flex items-center justify-end gap-1 text-sm font-mono text-stone-600 flex-wrap">
                                <span className="text-stone-400">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={l.extraRate || ""}
                                  onChange={(e) =>
                                    updateLine(l.key, {
                                      extraRate: e.target.value,
                                    })
                                  }
                                  placeholder={
                                    defaultRate ? String(defaultRate) : "0.00"
                                  }
                                  className="w-16 px-2 py-1 rounded-lg border border-stone-300 bg-white text-right"
                                />
                                <span className="text-stone-400 text-xs">
                                  /hr ×
                                </span>
                                <input
                                  type="number"
                                  step="1"
                                  value={l.extraMinutes || ""}
                                  onChange={(e) =>
                                    updateLine(l.key, {
                                      extraMinutes: e.target.value,
                                    })
                                  }
                                  placeholder="min"
                                  className="w-16 px-2 py-1 rounded-lg border border-stone-300 bg-white text-right"
                                />
                                <span className="text-stone-400 text-xs">
                                  min =
                                </span>
                                <span className="text-amber-700 font-medium min-w-[56px] text-right">
                                  ${xtra.toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end">
                                <span className="flex items-center gap-1 text-sm font-mono">
                                  <span className="text-stone-400">$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={l.extraAmount}
                                    onChange={(e) =>
                                      updateLine(l.key, {
                                        extraAmount: e.target.value,
                                      })
                                    }
                                    placeholder="0.00"
                                    className="w-24 px-2 py-1 rounded-lg border border-amber-300 bg-white text-right"
                                  />
                                </span>
                              </div>
                            )}
                            <input
                              value={l.extraNote || ""}
                              onChange={(e) =>
                                updateLine(l.key, { extraNote: e.target.value })
                              }
                              placeholder="Why? Prints under the extra, e.g. “Heavy soil — 45 min over”"
                              className="w-full mt-2 px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm text-stone-700"
                            />
                            <div className="flex items-center justify-end gap-3 mt-2 text-[11px] font-mono">
                              <span className="text-stone-500">
                                Base ${base.toFixed(2)}
                              </span>
                              <span className="text-amber-700">
                                Extra ${xtra.toFixed(2)}
                              </span>
                              <span className="text-stone-900 font-medium">
                                Total ${amt.toFixed(2)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="pt-3 mt-2 border-t-2 border-stone-300">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500">
                            3 · Override line total
                          </span>
                          <span className="text-[10px] font-mono text-stone-400">
                            replaces the standard total — the extra still
                            applies
                          </span>
                          {l.fromMemory && (
                            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5 flex items-center gap-1">
                              <Clock size={9} /> from last time
                            </span>
                          )}
                          <div className="flex-1 h-px bg-stone-200" />
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-mono text-stone-500">
                            Set a flat total
                          </span>
                          <div className="flex p-0.5 bg-stone-100 rounded-lg">
                            <button
                              onClick={() =>
                                updateLine(l.key, { overrideMode: "fixed" })
                              }
                              className={`px-2 py-1 rounded-md text-[10px] font-mono flex items-center gap-0.5 ${l.overrideMode !== "time" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
                            >
                              <DollarSign size={10} /> Amount
                            </button>
                            <button
                              onClick={() =>
                                updateLine(l.key, {
                                  overrideMode: "time",
                                  overrideRate:
                                    parseFloat(l.overrideRate) > 0
                                      ? l.overrideRate
                                      : defaultRate || 0,
                                })
                              }
                              className={`px-2 py-1 rounded-md text-[10px] font-mono flex items-center gap-0.5 ${l.overrideMode === "time" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
                            >
                              <Clock size={10} /> Time × rate
                            </button>
                          </div>
                        </div>
                        {l.overrideMode === "time" ? (
                          <div className="flex items-center justify-end gap-1 text-sm font-mono text-stone-600 flex-wrap">
                            <span className="text-stone-400">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={l.overrideRate || ""}
                              onChange={(e) =>
                                updateLine(l.key, {
                                  overrideRate: e.target.value,
                                })
                              }
                              placeholder={
                                defaultRate ? String(defaultRate) : "0.00"
                              }
                              className="w-16 px-2 py-1 rounded-lg border border-stone-300 bg-white text-right"
                            />
                            <span className="text-stone-400 text-xs">
                              /hr ×
                            </span>
                            <input
                              type="number"
                              step="1"
                              value={l.overrideMinutes || ""}
                              onChange={(e) =>
                                updateLine(l.key, {
                                  overrideMinutes: e.target.value,
                                })
                              }
                              placeholder="min"
                              className="w-16 px-2 py-1 rounded-lg border border-stone-300 bg-white text-right"
                            />
                            <span className="text-stone-400 text-xs">
                              min =
                            </span>
                            <span className="text-emerald-700 font-medium min-w-[56px] text-right">
                              ${base.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end">
                            <span className="flex items-center gap-1 text-sm font-mono">
                              <span className="text-stone-400">$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={l.amountOverride}
                                onChange={(e) =>
                                  updateLine(l.key, {
                                    amountOverride: e.target.value,
                                  })
                                }
                                placeholder={l.subsections
                                  .filter((s) => s.included)
                                  .reduce((sum, s) => sum + subAmount(s), 0)
                                  .toFixed(2)}
                                className="w-24 px-2 py-1 rounded-lg border border-stone-300 bg-white text-right"
                              />
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Total */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t-2 border-stone-900">
          <span className="text-xs uppercase tracking-widest text-stone-500 font-mono">
            Total
          </span>
          <span className="font-serif text-2xl text-stone-900">
            ${grandTotal.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
