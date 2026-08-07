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
} from "../../lib/supabase.js";
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
} from "../../lib/constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "../../lib/permissions.js";
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
} from "../../lib/format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "../../lib/compare.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
  sharePhotos,
} from "../../lib/photos.js";
import { sessionStore } from "../../lib/sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "../../lib/translation.js";
import {
  buildTargetTitle,
  unitSizeLabel,
  shortenBedroom,
  partyDisplay,
  unitPartyLabel,
  bathroomNumberForBedroom,
} from "../../lib/labels.js";
import { splitTaskName } from "../../lib/tasks.js";
import { useAssignmentSync } from "../../hooks/useAssignmentSync.js";
import { useIdleDetector } from "../../hooks/useIdleDetector.js";
import { usePagePersistence } from "../../hooks/usePagePersistence.js";
import { useItemLabelOverrides } from "../../hooks/useItemLabelOverrides.js";
import { useTick } from "../../hooks/useTick.js";
import { useUnreadCount } from "../../hooks/useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "../../hooks/useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "../../contexts/LocaleContext.jsx";
import { PreviewContext } from "../../contexts/PreviewContext.jsx";
import { AssignmentTypeChip } from "../../components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "../../components/chips/PriorityChip.jsx";
import { Splash } from "../../components/Splash.jsx";
import { ScreenId } from "../../components/ScreenId.jsx";
import { OwnerOnly } from "../../components/OwnerOnly.jsx";
import { DueDateEditor } from "../../components/DueDateEditor.jsx";
import { ProgressBar } from "../../components/ProgressBar.jsx";
import { CleanerProgressBar } from "../../components/CleanerProgressBar.jsx";
import { ConfirmModal } from "../../components/ConfirmModal.jsx";
import { AddressLink } from "../../components/AddressLink.jsx";
import { TranslatableText } from "../../components/TranslatableText.jsx";
import { PhotoModal } from "../../components/PhotoModal.jsx";
import { NotificationBell } from "../../components/NotificationBell.jsx";
import { Header } from "../../components/Header.jsx";
import { TeamClockIcon } from "../../components/TeamClockIcon.jsx";
import { TabButton } from "../../components/TabButton.jsx";
import { PhotoZoomViewer } from "../../components/PhotoZoomViewer.jsx";
import { TranslateButton } from "../../components/TranslateButton.jsx";
import { ZoomableImage } from "../../components/ZoomableImage.jsx";
import { PortalPhotoSection } from "./PortalPhotoSection.jsx";
import { ResolvedDamageHistory } from "./ResolvedDamageHistory.jsx";

export function PortalUnitDay({ property, unitId, date, portalUser, onBack }) {
  const [unit, setUnit] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [viewMode, setViewMode] = useState("all"); // 'all' | 'by-section'
  // Selection mode lets the PM check photos and bulk-download or share
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [zipProgress, setZipProgress] = useState(null); // {done,total} while zipping
  // Bedroom tab — when a unit has multiple bedrooms cleaned on the same
  // day, the PM needs to see photos isolated by bedroom. Without this,
  // pictures from 3 different bedrooms all merge into one stream which
  // makes it impossible to tell which photo belongs to which bedroom.
  // Default '' = "All bedrooms" (merged view, kept as an option but
  // not the default once we know there are multiple bedrooms).
  const [bedroomTab, setBedroomTab] = useState("");

  const toggleSelectOne = (photoId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  useEffect(() => {
    (async () => {
      setLoaded(false);

      // Enforce portal start date — refuse to load anything before it
      if (property.portal_start_date && date < property.portal_start_date) {
        setBlocks([]);
        setLoaded(true);
        return;
      }

      const [dyY, dyM, dyD] = String(date).split("-").map(Number);
      const dayStart = new Date(dyY, dyM - 1, dyD, 0, 0, 0, 0).toISOString();
      const dayEnd = new Date(dyY, dyM - 1, dyD, 23, 59, 59, 999).toISOString();

      if (unitId) {
        const { data: u } = await supabase
          .from("units")
          .select("*")
          .eq("id", unitId)
          .maybeSingle();
        setUnit(u);
        const { data: bs } = await supabase
          .from("work_blocks")
          .select(
            "*, party:parties(label,full_name), shift:shifts!inner(customer_id), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
          )
          .eq("unit_id", unitId)
          .eq("is_preview", false)
          .gte("start_time", dayStart)
          .lte("start_time", dayEnd)
          .order("start_time");
        const filtered = (bs || []).filter(
          (b) => b.shift?.customer_id === property.id,
        );
        setBlocks(filtered);
      } else {
        // Simple property: pull tasks for shifts on this date
        const { data: shifts } = await supabase
          .from("shifts")
          .select(
            "*, tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
          )
          .eq("customer_id", property.id)
          .eq("is_preview", false)
          .gte("start_time", dayStart)
          .lte("start_time", dayEnd)
          .order("start_time");
        // Wrap each shift as a "block" for uniform display
        const fakeBlocks = (shifts || []).map((s) => ({
          id: s.id,
          start_time: s.start_time,
          end_time: s.end_time,
          party: null,
          tasks: s.tasks || [],
        }));
        setBlocks(fakeBlocks);
      }
      setLoaded(true);
    })();
  }, [unitId, date, property.id]);

  // Compute the list of bedrooms (parties) that were cleaned on this
  // day. When there's more than one, we default the tab to the first
  // bedroom alphabetically so photos appear isolated by default. The
  // PM can switch to "All bedrooms" if they want the merged view.
  const partyLabels = (() => {
    const labels = [
      ...new Set(blocks.map((b) => b.party?.label).filter(Boolean)),
    ];
    return labels.sort(naturalCompare);
  })();
  // Auto-pick the first bedroom on initial load if there are multiple.
  // Doesn't override a user's choice — only sets when bedroomTab is empty.
  useEffect(() => {
    if (partyLabels.length > 1 && !bedroomTab) {
      setBedroomTab(partyLabels[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  if (!loaded) return <Splash text="Loading…" />;

  // Aggregate all photos for this unit/day, separated by kind.
  // We also tag each photo with the task's category/subcategory so
  // the "By section" view can group on them.
  // Bedroom-tab filter: when the PM picks a specific bedroom, only
  // include blocks for that party. '' means All bedrooms (no filter).
  const visibleBlocks = bedroomTab
    ? blocks.filter((b) => b.party?.label === bedroomTab)
    : blocks;
  const allBefore = [];
  const allAfter = [];
  const allDamageActive = []; // unresolved damage — shows in red banner
  const allDamageResolved = []; // resolved damage — collapsed history below
  const allCannotActive = []; // unresolved "couldn't clean" — yellow banner
  const allCannotResolved = []; // resolved "couldn't clean" — collapsed below
  visibleBlocks.forEach((b) =>
    (b.tasks || []).forEach((t) =>
      (t.photos || []).forEach((p) => {
        const enriched = {
          ...p,
          taskName: t.name,
          taskCategory: t.category,
          taskSubcategory: t.subcategory,
          partyLabel: b.party?.label,
        };
        if (p.kind === "before") allBefore.push(enriched);
        else if (p.kind === "after") allAfter.push(enriched);
        else if (p.kind === "damage") {
          if (p.resolved_at) allDamageResolved.push(enriched);
          else allDamageActive.push(enriched);
        } else if (p.kind === KIND_CANNOT) {
          if (p.resolved_at) allCannotResolved.push(enriched);
          else allCannotActive.push(enriched);
        }
      }),
    ),
  );

  // Build a flat lookup so the toolbar can find selected photos and
  // their context for download/share filename tagging.
  const allPhotos = [
    ...allBefore,
    ...allAfter,
    ...allDamageActive,
    ...allDamageResolved,
    ...allCannotActive,
    ...allCannotResolved,
  ];
  const photoContext = (p) => ({
    propertyName: property.name,
    unitLabel: unit?.label || null,
    partyLabel: p.partyLabel,
    taskName: p.taskName,
    date,
  });
  const getSelectedPhotos = () =>
    allPhotos.filter((p) => selectedIds.has(p.id));

  const handleBulkDownload = async () => {
    const sel = getSelectedPhotos();
    if (sel.length === 0) return;
    setBulkBusy(true);
    // On phones, the same native picker that "Save X images" uses (Web Share
    // with files) is the nicest way to get photos into the camera roll — one
    // action, one confirm. So if this device can share files, Download uses
    // that exact path. Desktop (no file-share) falls back to a single .zip.
    if (canShareFiles()) {
      const ok = await sharePhotos(sel, (p) => photoContext(p));
      setBulkBusy(false);
      if (!ok) {
        // Share was dismissed or failed — fall back to the zip so Download
        // always does something.
        setBulkBusy(true);
        const parts = [property.name, unit?.label, date]
          .filter(Boolean)
          .map((s) => String(s).replace(/[^\w\-]+/g, "_"));
        const zipName = `${parts.join("_") || "cleaning"}_photos.zip`;
        await downloadPhotosZip(
          sel,
          (p) => photoContext(p),
          zipName,
          (done, total) => setZipProgress({ done, total }),
        );
        setZipProgress(null);
        setBulkBusy(false);
      }
      return;
    }
    if (sel.length === 1) {
      await downloadPhoto(sel[0], photoContext(sel[0]));
    } else {
      const parts = [property.name, unit?.label, date]
        .filter(Boolean)
        .map((s) => String(s).replace(/[^\w\-]+/g, "_"));
      const zipName = `${parts.join("_") || "cleaning"}_photos.zip`;
      await downloadPhotosZip(
        sel,
        (p) => photoContext(p),
        zipName,
        (done, total) => setZipProgress({ done, total }),
      );
      setZipProgress(null);
    }
    setBulkBusy(false);
  };

  const handleBulkShare = async () => {
    const sel = getSelectedPhotos();
    if (sel.length === 0) return;
    setBulkBusy(true);
    const ok = await sharePhotos(sel, (p) => photoContext(p));
    setBulkBusy(false);
    if (!ok && canShareFiles()) {
      alert("Share didn't complete. You can try Download instead.");
    } else if (!ok && !canShareFiles()) {
      alert("Share isn't available on this device — please use Download.");
    }
  };

  // Local mutation helper — flip a photo's resolved state and re-fetch
  // (cheap reload to keep state in sync).
  const setPhotoResolution = async (photo, resolve) => {
    const payload = resolve
      ? {
          resolved_at: new Date().toISOString(),
          resolved_by: portalUser?.id || null,
          resolved_by_kind: "portal_user",
        }
      : { resolved_at: null, resolved_by: null, resolved_by_kind: null };
    const { error } = await supabase
      .from("photos")
      .update(payload)
      .eq("id", photo.id);
    if (error) {
      alert("Could not update status: " + error.message);
      return;
    }
    // Update in place via block mutation
    setBlocks((prev) =>
      prev.map((b) => ({
        ...b,
        tasks: (b.tasks || []).map((t) => ({
          ...t,
          photos: (t.photos || []).map((p) =>
            p.id === photo.id ? { ...p, ...payload } : p,
          ),
        })),
      })),
    );
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-12">
      <ScreenId id="PM-DAY" />
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="no-print bg-stone-900 text-stone-50 px-5 py-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-stone-400 text-sm hover:text-stone-50"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-full bg-stone-50 text-stone-900 text-sm font-medium flex items-center gap-2"
        >
          <Printer size={14} /> Print
        </button>
      </div>

      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">
          {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </div>
        <h1 className="font-serif text-3xl text-stone-900 mb-1">
          {unit?.label || property.name}
        </h1>
        <div className="text-sm text-stone-600 mb-2">{property.name}</div>
        {/* Bedroom selector — always a clickable strip (never a static
           "Cleaned: chips" line). When there's only one bedroom, the
           strip shows just that one button (selected by default).
           When there are multiple, each bedroom is a tab that filters
           the photo grid below. The "All bedrooms" tab preserves the
           merged view as an option. */}
        {partyLabels.length > 0 && (
          <div className="mt-4 p-3 rounded-2xl bg-amber-50 border-2 border-amber-300">
            <div className="text-[10px] uppercase tracking-wider font-mono text-amber-800 mb-2 font-bold">
              {partyLabels.length === 1
                ? "Bedroom cleaned"
                : `Tap a bedroom (${partyLabels.length} cleaned this day)`}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-3 px-3">
              {partyLabels.map((label) => {
                const active =
                  bedroomTab === label ||
                  (partyLabels.length === 1 && !bedroomTab);
                return (
                  <button
                    key={label}
                    onClick={() => setBedroomTab(label)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors ${active ? "bg-stone-900 text-stone-50 border-2 border-stone-900 shadow-sm" : "bg-white text-stone-700 border-2 border-stone-200 hover:border-stone-400"}`}
                  >
                    {label}
                  </button>
                );
              })}
              {partyLabels.length > 1 && (
                <button
                  onClick={() => setBedroomTab("")}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors ${bedroomTab === "" ? "bg-stone-900 text-stone-50 border-2 border-stone-900 shadow-sm" : "bg-white text-stone-600 border-2 border-stone-200 hover:border-stone-400"}`}
                >
                  All bedrooms
                </button>
              )}
            </div>
            {/* Always show "Viewing: X" so user knows which bedroom is active */}
            <div className="mt-2.5 text-xs text-amber-900">
              <span className="uppercase tracking-wider font-mono text-amber-700 mr-1.5">
                Viewing:
              </span>
              <span className="font-medium">
                {bedroomTab ||
                  (partyLabels.length === 1
                    ? partyLabels[0]
                    : "All bedrooms (merged)")}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pt-6 space-y-6">
        {/* View mode toggle + Select button on the same row */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-1 p-1 bg-stone-100 rounded-xl">
            <button
              onClick={() => setViewMode("all")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${viewMode === "all" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
            >
              All photos
            </button>
            <button
              onClick={() => setViewMode("by-section")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${viewMode === "by-section" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
            >
              By section
            </button>
          </div>
          <button
            onClick={() => {
              setSelectMode((s) => !s);
              setSelectedIds(new Set());
            }}
            className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 flex-shrink-0 transition-colors ${selectMode ? "bg-stone-900 text-stone-50" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}
          >
            {selectMode ? <Check size={14} /> : <Square size={14} />}
            {selectMode ? "Done" : "Select"}
          </button>
        </div>

        {viewMode === "all" ? (
          <>
            {allDamageActive.length > 0 && (
              <PortalPhotoSection
                label="Active damage"
                photos={allDamageActive}
                highlight="red"
                description="Issues identified during cleaning. Tap a photo to resolve."
                onResolve={(p) => setPhotoResolution(p, true)}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelectOne}
              />
            )}
            {allDamageResolved.length > 0 && (
              <ResolvedDamageHistory
                photos={allDamageResolved}
                onReopen={(p) => setPhotoResolution(p, false)}
              />
            )}
            {allCannotActive.length > 0 && (
              <PortalPhotoSection
                label="Couldn't clean"
                photos={allCannotActive}
                highlight="yellow"
                description="Rooms the cleaner was not able to clean. Tap a photo to read the note and resolve."
                onResolve={(p) => setPhotoResolution(p, true)}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelectOne}
              />
            )}
            {allCannotResolved.length > 0 && (
              <ResolvedDamageHistory
                photos={allCannotResolved}
                title="Resolved — couldn't clean"
                blurb="Rooms previously reported as not cleanable that have been marked resolved."
                onReopen={(p) => setPhotoResolution(p, false)}
              />
            )}
            <PortalPhotoSection
              label="Before cleaning"
              photos={allBefore}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelectOne}
            />
            <PortalPhotoSection
              label="After cleaning"
              photos={allAfter}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelectOne}
            />
          </>
        ) : (
          // BY-SECTION MODE — bucket photos by the most specific identifier
          // available. The cleaner could organize their work in 3 ways:
          //   1. Structured: Quick picker → category + subcategory set
          //      → group by the structured label (e.g. "Bedroom", "General — Kitchen")
          //   2. Freeform per party: cleaning Bedroom 2 with tasks
          //      "habitación" + "baño" → group by task name within party
          //      (e.g. "Bedroom 2 — habitación", "Bedroom 2 — baño")
          //   3. Freeform without parties: simple property with tasks named
          //      "kitchen", "bathroom" → group by task name alone
          // Task name is more SPECIFIC than party label, so it takes
          // precedence — that was the bug that lumped all photos under
          // "Bedroom 2" when the cleaner clearly split work into habitación
          // and baño tasks.
          (() => {
            const sectionMap = new Map();
            const sectionAll = [
              ...allBefore,
              ...allAfter,
              ...allDamageActive,
              ...allDamageResolved,
              ...allCannotActive,
              ...allCannotResolved,
            ];

            // Figure out if task names are useful for grouping — i.e. are
            // there multiple distinct task names? If there's only one task
            // name, falling back to party label gives more useful labels.
            const distinctTaskNames = new Set(
              sectionAll.map((p) => p.taskName).filter(Boolean),
            );
            const useTaskNameAsKey = distinctTaskNames.size > 1;

            const buildKey = (p) => {
              // Structured category trumps everything
              const catLabel = taskCategoryShortLabel(
                p.taskCategory,
                p.taskSubcategory,
              );
              if (catLabel) return catLabel;
              // If task names vary, use them (optionally prefixed with party)
              if (useTaskNameAsKey && p.taskName) {
                return p.partyLabel
                  ? `${p.partyLabel} — ${p.taskName}`
                  : p.taskName;
              }
              // Otherwise group by party
              return p.partyLabel || p.taskName || "Other";
            };

            sectionAll.forEach((p) => {
              const key = buildKey(p);
              if (!sectionMap.has(key))
                sectionMap.set(key, {
                  before: [],
                  after: [],
                  damage: [],
                  damageResolved: [],
                  cannot: [],
                  cannotResolved: [],
                });
              const bucket = sectionMap.get(key);
              if (p.kind === "before") bucket.before.push(p);
              else if (p.kind === "after") bucket.after.push(p);
              else if (p.kind === "damage") {
                if (p.resolved_at) bucket.damageResolved.push(p);
                else bucket.damage.push(p);
              } else if (p.kind === KIND_CANNOT) {
                if (p.resolved_at) bucket.cannotResolved.push(p);
                else bucket.cannot.push(p);
              }
            });
            // Order: bedroom > bathroom > vanity > general > others alphabetical, "Other" last
            const orderHint = (label) => {
              const l = (label || "").toLowerCase();
              if (l.startsWith("bedroom")) return 0;
              if (l.startsWith("bathroom")) return 1;
              if (l.startsWith("vanity")) return 2;
              if (l.startsWith("general")) return 3;
              if (label === "Other") return 99;
              return 50;
            };
            const sorted = Array.from(sectionMap.entries()).sort(([a], [b]) => {
              const oA = orderHint(a),
                oB = orderHint(b);
              if (oA !== oB) return oA - oB;
              return a.localeCompare(b);
            });
            return sorted.map(([sectionLabel, buckets]) => (
              <div
                key={sectionLabel}
                className="p-4 rounded-2xl bg-white border border-stone-200 space-y-4"
              >
                <div className="flex items-baseline justify-between pb-2 border-b border-stone-200">
                  <h2 className="font-serif text-2xl text-stone-900">
                    {sectionLabel}
                  </h2>
                  <span className="text-[11px] font-mono text-stone-500">
                    {buckets.before.length +
                      buckets.after.length +
                      buckets.damage.length +
                      buckets.damageResolved.length +
                      buckets.cannot.length +
                      buckets.cannotResolved.length}{" "}
                    photos
                  </span>
                </div>
                {buckets.damageResolved.length > 0 && (
                  <ResolvedDamageHistory
                    photos={buckets.damageResolved}
                    onReopen={(p) => setPhotoResolution(p, false)}
                  />
                )}
                {buckets.cannotResolved.length > 0 && (
                  <ResolvedDamageHistory
                    photos={buckets.cannotResolved}
                    title="Resolved — couldn't clean"
                    blurb="Rooms previously reported as not cleanable that have been marked resolved."
                    onReopen={(p) => setPhotoResolution(p, false)}
                  />
                )}
                {/* 3-column side-by-side layout on desktop, stacked on
                   mobile. Each child uses `compact` so its inner thumbnail
                   grid adapts to the available width. */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <PortalPhotoSection
                    label="Before"
                    photos={buckets.before}
                    compact
                    selectMode={selectMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelectOne}
                  />
                  <PortalPhotoSection
                    label="After"
                    photos={buckets.after}
                    compact
                    selectMode={selectMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelectOne}
                  />
                  {buckets.damage.length > 0 ? (
                    <PortalPhotoSection
                      label="Active damage"
                      photos={buckets.damage}
                      highlight="red"
                      compact
                      description="Tap to resolve."
                      onResolve={(p) => setPhotoResolution(p, true)}
                      selectMode={selectMode}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelectOne}
                    />
                  ) : (
                    <PortalPhotoSection
                      label="Damage"
                      photos={[]}
                      highlight="red"
                      compact
                    />
                  )}
                </div>
                {/* Couldn't-clean sits on its own row rather than squeezing a
                   fourth column in — it's the exception, not a routine bucket. */}
                {buckets.cannot.length > 0 && (
                  <PortalPhotoSection
                    label="Couldn't clean"
                    photos={buckets.cannot}
                    highlight="yellow"
                    description="Not cleaned. Tap to read the note and resolve."
                    onResolve={(p) => setPhotoResolution(p, true)}
                    selectMode={selectMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelectOne}
                  />
                )}
              </div>
            ));
          })()
        )}

        {/* Per-party breakdown (no cleaner names — only labels and notes) */}
        {blocks.length > 0 &&
          blocks.some((b) => b.party || b.tasks?.length) && (
            <div className="mt-6">
              <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
                Cleaning breakdown
              </div>
              <div className="space-y-3">
                {blocks.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-2xl bg-white border border-stone-200"
                  >
                    {b.party && (
                      <div className="font-serif text-base text-stone-900 mb-1">
                        {b.party.label}
                        {b.party.full_name && ` · ${b.party.full_name}`}
                      </div>
                    )}
                    {b.work_notes && (
                      <div className="text-sm text-stone-600 italic mb-2">
                        "
                        <TranslatableText text={b.work_notes} targetLang="en" />
                        "
                      </div>
                    )}
                    {b.tasks?.length > 0 && (
                      <ul className="text-sm text-stone-700 space-y-0.5">
                        {b.tasks.map((t) => (
                          <li key={t.id} className="flex items-center gap-2">
                            <Check
                              size={12}
                              className="text-emerald-600 flex-shrink-0"
                            />
                            <TranslatableText text={t.name} targetLang="en" />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        {allBefore.length === 0 &&
          allAfter.length === 0 &&
          allDamageActive.length === 0 &&
          allDamageResolved.length === 0 &&
          allCannotActive.length === 0 &&
          allCannotResolved.length === 0 && (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              No photos recorded for this date.
            </div>
          )}

        {/* Bottom spacer when select mode is active so the toolbar doesn't
           cover content */}
        {selectMode && <div className="h-20" />}
      </div>

      {/* Selection toolbar pinned to the bottom while select mode is on */}
      {selectMode && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 bg-stone-900 text-stone-50 shadow-2xl"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="px-4 py-3 max-w-2xl mx-auto flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono uppercase tracking-wider text-stone-400">
                Selected
              </div>
              <div className="text-base font-medium">
                {selectedIds.size} {selectedIds.size === 1 ? "photo" : "photos"}
              </div>
            </div>
            <button
              onClick={clearSelection}
              disabled={selectedIds.size === 0 || bulkBusy}
              className="px-3 py-2 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-50 text-xs font-mono disabled:opacity-40"
            >
              Clear
            </button>
            <button
              onClick={handleBulkDownload}
              disabled={selectedIds.size === 0 || bulkBusy}
              className="px-3 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-40"
            >
              {bulkBusy ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download size={14} />
              )}
              {bulkBusy && zipProgress
                ? `Zipping ${zipProgress.done}/${zipProgress.total}`
                : selectedIds.size > 1
                  ? "Download zip"
                  : "Download"}
            </button>
            {canShareFiles() && (
              <button
                onClick={handleBulkShare}
                disabled={selectedIds.size === 0 || bulkBusy}
                className="px-3 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-40"
              >
                <Share2 size={14} />
                Share
              </button>
            )}
            <button
              onClick={exitSelectMode}
              disabled={bulkBusy}
              className="p-2 rounded-full hover:bg-stone-800 disabled:opacity-40"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
