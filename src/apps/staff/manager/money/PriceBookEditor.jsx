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

export function PriceBookEditor({ property, onBack }) {
  // Priceable "subsections" are the real checklist ITEMS (tub, vanity,
  // fridge inside, ...), keyed `section:item_key` so they match what's
  // recorded as cleaned. Loaded from the property's template set.
  const [items, setItems] = useState([]); // [{key, section, label, sort}]
  const [prices, setPrices] = useState({}); // key -> {mode, base_amount, rate, default_minutes}
  const [originalKeys, setOriginalKeys] = useState([]);
  const [defaultRate, setDefaultRate] = useState(""); // preset $/hr for time items
  const [aptSizes, setAptSizes] = useState([]); // [{key:'2x2', bedrooms, bathrooms, label}]
  const [aptPrices, setAptPrices] = useState({}); // '__apt__:2x2' -> amount string
  const [expanded, setExpanded] = useState(new Set());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const SECTION_LABELS = {
    bedroom: "Bedroom",
    vanity: "Vanity",
    bathroom: "Bathroom",
    general: "General / kitchen",
  };
  const SECTION_ORDER = ["bathroom", "vanity", "general", "bedroom"];

  useEffect(() => {
    (async () => {
      setLoaded(false);
      setError(null);
      try {
        // Resolve template set: property-specific, else global default.
        let { data: ownSet } = await supabase
          .from("section_template_sets")
          .select("*")
          .eq("customer_id", property.id)
          .limit(1);
        let chosen = (ownSet && ownSet[0]) || null;
        if (!chosen) {
          const { data: def } = await supabase
            .from("section_template_sets")
            .select("*")
            .eq("is_default", true)
            .is("customer_id", null)
            .limit(1);
          chosen = (def && def[0]) || null;
        }
        if (!chosen) {
          setError("No checklist template found for this property.");
          setLoaded(true);
          return;
        }
        const { data: vData } = await supabase
          .from("section_template_variants")
          .select("*")
          .eq("set_id", chosen.id)
          .order("sort_order");
        const variants = vData || [];
        const variantById = Object.fromEntries(variants.map((v) => [v.id, v]));
        const variantIds = variants.map((v) => v.id);
        let itemRows = [];
        if (variantIds.length) {
          const { data: iData } = await supabase
            .from("section_template_items")
            .select("*")
            .in("variant_id", variantIds)
            .order("sort_order");
          itemRows = iData || [];
        }
        const seen = new Set();
        const built = [];
        itemRows.forEach((it) => {
          const v = variantById[it.variant_id];
          const section = (v?.section_key || "general").toLowerCase();
          const key = `${section}:${it.item_key}`;
          if (seen.has(key)) return;
          seen.add(key);
          built.push({
            key,
            section,
            label: resolveItemLabel(key, "en", null, it.label || it.item_key),
            sort: it.sort_order ?? 0,
            vsort: v?.sort_order ?? 0,
            vlabel: v?.label || "",
            vkey: v?.variant_key || "",
          });
        });
        setItems(built);
        const { data: pb } = await supabase
          .from("invoice_price_book")
          .select("*")
          .eq("customer_id", property.id);
        const pmap = {};
        let dr = "";
        (pb || []).forEach((r) => {
          if (r.subsection_key === "__hourly_rate__") {
            dr = r.rate ?? "";
            return;
          }
          pmap[r.subsection_key] = {
            mode: r.mode,
            base_amount: r.base_amount ?? "",
            rate: r.rate ?? "",
            default_minutes: r.default_minutes ?? "",
          };
        });
        setPrices(pmap);
        setDefaultRate(dr === 0 ? "" : (dr ?? ""));
        // Apartment SIZE tiers (1x1, 2x2, 3x2…) for whole-apartment flat
        // pricing at Bridges/Citifront-style properties. Discover which
        // sizes actually exist here from the units table, then load any
        // saved __apt__ prices.
        const { data: unitRows } = await supabase
          .from("units")
          .select("bedrooms, bathrooms")
          .eq("customer_id", property.id);
        const sizeSet = new Map();
        (unitRows || []).forEach((u) => {
          if (u.bedrooms == null || u.bathrooms == null) return;
          const key = `${u.bedrooms}x${u.bathrooms}`;
          if (!sizeSet.has(key))
            sizeSet.set(key, {
              key,
              bedrooms: u.bedrooms,
              bathrooms: u.bathrooms,
            });
        });
        const sizes = Array.from(sizeSet.values()).sort(
          (a, b) => a.bedrooms - b.bedrooms || a.bathrooms - b.bathrooms,
        );
        setAptSizes(sizes);
        const apmap = {};
        (pb || []).forEach((r) => {
          if (r.subsection_key?.startsWith("__apt__:")) {
            apmap[r.subsection_key] =
              r.base_amount != null ? String(r.base_amount) : "";
          }
        });
        setAptPrices(apmap);
        setOriginalKeys(
          (pb || [])
            .filter((r) => r.subsection_key !== "__hourly_rate__")
            .map((r) => r.subsection_key),
        );
      } catch (e) {
        setError(e.message || "Could not load template.");
      }
      setLoaded(true);
    })(); /* eslint-disable-next-line */
  }, [property.id]);

  const setPrice = (key, patch) =>
    setPrices((p) => ({
      ...p,
      [key]: {
        mode: "fixed",
        base_amount: "",
        rate: "",
        default_minutes: "",
        ...(p[key] || {}),
        ...patch,
      },
    }));
  const clearPrice = (key) =>
    setPrices((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
  const toggleSection = (s) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(s) ? n.delete(s) : n.add(s);
      return n;
    });

  // Effective rate for a time item = its own rate, else the preset.
  const effRate = (pr) => parseFloat(pr?.rate) || parseFloat(defaultRate) || 0;

  const pricedCount = (sectionItems) =>
    sectionItems.filter((it) => {
      const pr = prices[it.key];
      if (!pr) return false;
      return (
        (pr.mode === "time" ? effRate(pr) : parseFloat(pr.base_amount)) > 0
      );
    }).length;

  const save = async () => {
    setSaving(true);
    const payload = [];
    const keepKeys = [];
    items.forEach((it) => {
      const pr = prices[it.key];
      if (!pr) return;
      const mode = pr.mode === "time" ? "time" : "fixed";
      const base = mode === "fixed" ? parseFloat(pr.base_amount) || 0 : 0;
      const rate = mode === "time" ? effRate(pr) : 0;
      if (mode === "fixed" && base === 0) return; // unpriced — skip
      if (mode === "time" && rate === 0) return;
      keepKeys.push(it.key);
      payload.push({
        customer_id: property.id,
        subsection_key: it.key,
        label: it.label,
        mode,
        base_amount: base,
        rate,
        default_minutes:
          mode === "time" ? parseFloat(pr.default_minutes) || 0 : 0,
        sort_order: 0,
        updated_at: new Date().toISOString(),
      });
    });
    // Apartment size-tier flat prices (__apt__:2x2 etc).
    const aptKeep = [];
    aptSizes.forEach((sz) => {
      const k = `__apt__:${sz.key}`;
      const amt = parseFloat(aptPrices[k]) || 0;
      if (amt <= 0) return;
      aptKeep.push(k);
      payload.push({
        customer_id: property.id,
        subsection_key: k,
        label: `${sz.bedrooms}x${sz.bathrooms} apartment`,
        mode: "fixed",
        base_amount: amt,
        rate: 0,
        default_minutes: 0,
        sort_order: 0,
        updated_at: new Date().toISOString(),
      });
    });
    // Persist the preset hourly rate as a sentinel row (skipped by the
    // invoice generator). Generators must ignore keys starting with '__'.
    const dr = parseFloat(defaultRate) || 0;
    if (dr > 0) {
      payload.push({
        customer_id: property.id,
        subsection_key: "__hourly_rate__",
        label: "Default hourly rate",
        mode: "time",
        base_amount: 0,
        rate: dr,
        default_minutes: 0,
        sort_order: -1,
        updated_at: new Date().toISOString(),
      });
    }
    if (payload.length) {
      const { error: upErr } = await supabase
        .from("invoice_price_book")
        .upsert(payload, { onConflict: "customer_id,subsection_key" });
      if (upErr) {
        setSaving(false);
        alert("Could not save prices: " + upErr.message);
        return;
      }
    }
    if (dr <= 0) {
      await supabase
        .from("invoice_price_book")
        .delete()
        .eq("customer_id", property.id)
        .eq("subsection_key", "__hourly_rate__");
    }
    // Only remove template-item keys the user cleared — never touch
    // learned keys like "__flat__:cleaning_check" that aren't in the
    // template item list.
    const templateKeys = new Set(items.map((it) => it.key));
    const removed = originalKeys.filter(
      (k) => !keepKeys.includes(k) && templateKeys.has(k),
    );
    for (const k of removed) {
      await supabase
        .from("invoice_price_book")
        .delete()
        .eq("customer_id", property.id)
        .eq("subsection_key", k);
    }
    // Remove size-tier prices the user cleared to zero/blank.
    const aptClearedKeys = aptSizes
      .map((sz) => `__apt__:${sz.key}`)
      .filter((k) => !aptKeep.includes(k) && originalKeys.includes(k));
    for (const k of aptClearedKeys) {
      await supabase
        .from("invoice_price_book")
        .delete()
        .eq("customer_id", property.id)
        .eq("subsection_key", k);
    }
    setSaving(false);
    onBack();
  };

  // Group items by section in a friendly order.
  const bySection = {};
  items.forEach((it) => {
    (bySection[it.section] = bySection[it.section] || []).push(it);
  });
  const sections = [
    ...SECTION_ORDER.filter((s) => bySection[s]),
    ...Object.keys(bySection).filter((s) => !SECTION_ORDER.includes(s)),
  ];

  return (
    <div className="pb-28">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-stone-200 bg-white sticky top-0 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-stone-700 text-sm"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save prices"}
        </button>
      </div>
      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">
          {property.name}
        </div>
        <h1 className="text-3xl font-light text-stone-900 tracking-tight mb-2">
          Item <span className="font-serif italic text-amber-700">prices</span>
        </h1>
        <p className="text-sm text-stone-600 mb-4">
          Price the items you bill for (tub, vanity, fridge inside…). Each can
          be a fixed amount or a $/hr rate × minutes. Invoices add up the items
          that were actually cleaned. Leave the rest blank.
        </p>

        {/* Preset hourly rate — time items use this so you only type
           minutes, not the rate, on every item. */}
        <div className="mb-5 p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono uppercase tracking-wider text-amber-800">
            Default hourly rate
          </span>
          <span className="text-amber-700 font-mono">$</span>
          <input
            type="number"
            step="0.01"
            value={defaultRate}
            onChange={(e) => setDefaultRate(e.target.value)}
            placeholder="0.00"
            className="w-28 px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-right text-sm font-mono"
          />
          <span className="text-[11px] text-amber-700/80 font-mono">
            /hr — time items use this unless you override one
          </span>
        </div>

        {/* Whole-apartment flat pricing by SIZE. For properties billed per
           apartment (not per item) — a 2x2 is one price regardless of what
           was cleaned. Only the sizes that exist at this property show. */}
        {aptSizes.length > 0 && (
          <div className="mb-5 p-3 rounded-2xl bg-stone-100 border border-stone-200">
            <div className="text-xs font-mono uppercase tracking-wider text-stone-600 mb-1">
              Whole-apartment price by size
            </div>
            <p className="text-[11px] text-stone-500 mb-3">
              A flat rate per apartment size, used when the whole unit is
              cleaned. Leave blank for sizes you price by item instead.
            </p>
            <div className="space-y-2">
              {aptSizes.map((sz) => {
                const k = `__apt__:${sz.key}`;
                return (
                  <div key={k} className="flex items-center gap-2">
                    <span className="font-mono text-sm text-stone-800 w-16">
                      {sz.bedrooms}x{sz.bathrooms}
                    </span>
                    <span className="text-[10px] font-mono text-stone-400 flex-1">
                      {sz.bedrooms} bed / {sz.bathrooms} bath
                    </span>
                    <span className="text-stone-400 font-mono">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={aptPrices[k] || ""}
                      onChange={(e) =>
                        setAptPrices((p) => ({ ...p, [k]: e.target.value }))
                      }
                      placeholder="0.00"
                      className="w-28 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-right text-sm font-mono"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loaded ? (
          <Splash text="Loading items…" />
        ) : error ? (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No template items found.
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((s) => {
              // Order by variant first, then by the item's own order, so
              // related items (fridge inside / freezer inside) stay
              // together instead of interleaving across variants.
              const list = bySection[s]
                .slice()
                .sort(
                  (a, b) =>
                    a.vsort - b.vsort ||
                    a.sort - b.sort ||
                    a.label.localeCompare(b.label),
                );
              const open = expanded.has(s);
              const np = pricedCount(list);
              // Group consecutive items by variant.
              const groups = [];
              list.forEach((it) => {
                const last = groups[groups.length - 1];
                if (last && last.vkey === it.vkey) last.items.push(it);
                else
                  groups.push({
                    vkey: it.vkey,
                    vlabel: it.vlabel,
                    items: [it],
                  });
              });
              const showSub = groups.length > 1;
              return (
                <div
                  key={s}
                  className="rounded-2xl bg-white border border-stone-200 overflow-hidden"
                >
                  <button
                    onClick={() => toggleSection(s)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50"
                  >
                    <span className="font-serif text-base text-stone-900">
                      {SECTION_LABELS[s] || s}
                    </span>
                    <span className="flex items-center gap-2">
                      {np > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {np} priced
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-stone-400">
                        {list.length} items
                      </span>
                      <ChevronRight
                        size={15}
                        className={`text-stone-400 transition-transform ${open ? "rotate-90" : ""}`}
                      />
                    </span>
                  </button>
                  {open && (
                    <div className="border-t border-stone-100">
                      {groups.map((g, gi) => (
                        <div key={g.vkey || gi}>
                          {showSub && g.vlabel && (
                            <div className="px-4 pt-2.5 pb-1 text-[10px] uppercase tracking-wider font-mono text-amber-700/80 bg-stone-50/60">
                              {g.vlabel}
                            </div>
                          )}
                          <div className="divide-y divide-stone-100">
                            {g.items.map((it) => {
                              const pr = prices[it.key];
                              const isTime = pr?.mode === "time";
                              const hasPrice =
                                pr &&
                                (isTime
                                  ? effRate(pr)
                                  : parseFloat(pr.base_amount)) > 0;
                              return (
                                <div key={it.key} className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`flex-1 text-sm ${hasPrice ? "text-stone-900" : "text-stone-500"}`}
                                    >
                                      {it.label}
                                    </span>
                                    <div className="flex p-0.5 bg-stone-100 rounded-lg">
                                      <button
                                        onClick={() =>
                                          setPrice(it.key, { mode: "fixed" })
                                        }
                                        className={`px-2 py-1 rounded-md text-[10px] font-mono flex items-center gap-0.5 ${!isTime ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
                                      >
                                        <DollarSign size={10} />
                                      </button>
                                      <button
                                        onClick={() =>
                                          setPrice(it.key, { mode: "time" })
                                        }
                                        className={`px-2 py-1 rounded-md text-[10px] font-mono flex items-center gap-0.5 ${isTime ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
                                      >
                                        <Clock size={10} />
                                      </button>
                                    </div>
                                    {!isTime ? (
                                      <span className="flex items-center gap-1 text-sm font-mono text-stone-700">
                                        <span className="text-stone-400">
                                          $
                                        </span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={pr?.base_amount ?? ""}
                                          onChange={(e) =>
                                            setPrice(it.key, {
                                              base_amount: e.target.value,
                                            })
                                          }
                                          placeholder="0.00"
                                          className="w-24 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-right"
                                        />
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1.5 text-sm font-mono text-stone-700 flex-wrap justify-end">
                                        <span className="text-stone-400">
                                          $
                                        </span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={pr?.rate ?? ""}
                                          onChange={(e) =>
                                            setPrice(it.key, {
                                              rate: e.target.value,
                                            })
                                          }
                                          placeholder={
                                            defaultRate
                                              ? String(defaultRate)
                                              : "0.00"
                                          }
                                          title="Leave blank to use the default rate"
                                          className="w-20 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-right"
                                        />
                                        <span className="text-stone-400 text-[11px]">
                                          /hr ×
                                        </span>
                                        <input
                                          type="number"
                                          step="1"
                                          value={pr?.default_minutes ?? ""}
                                          onChange={(e) =>
                                            setPrice(it.key, {
                                              default_minutes: e.target.value,
                                            })
                                          }
                                          placeholder="min"
                                          className="w-20 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-right"
                                        />
                                        <span className="text-stone-400 text-[11px]">
                                          min =
                                        </span>
                                        <span className="text-emerald-700 font-medium min-w-[60px] text-right">
                                          $
                                          {(
                                            (effRate(pr) *
                                              (parseFloat(
                                                pr?.default_minutes,
                                              ) || 0)) /
                                            60
                                          ).toFixed(2)}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
