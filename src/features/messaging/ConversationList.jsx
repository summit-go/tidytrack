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
  isoToLocalInput,
  localInputToISO,
  shiftBillableAmount,
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
  readPhotoTakenAt,
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
import { resolveItemLabel } from "../../lib/pickerLabels.js";
import { generatePortalUserCode } from "../../lib/portal.js";
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

export function ConversationList({
  employee,
  onOpen,
  onNewDm,
  onNewPropertyThread,
  onClose,
}) {
  const [dms, setDms] = useState([]);
  const [threads, setThreads] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const canSeeThreads =
    employee.role === "owner" || employee.role === "manager";

  const load = async () => {
    setLoaded(false);
    // DMs the employee is a participant in
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select(
        "conversation_id, last_read_at, conversation:conversations!inner(id, kind, last_message_at, last_message_preview)",
      )
      .eq("employee_id", employee.id);
    const dmConvs = (parts || []).filter(
      (p) => p.conversation?.kind === "staff_dm",
    );
    // For each, find the OTHER participant's name
    const dmList = [];
    for (const p of dmConvs) {
      const { data: others } = await supabase
        .from("conversation_participants")
        .select("employee:employees(id, name)")
        .eq("conversation_id", p.conversation_id)
        .neq("employee_id", employee.id);
      const other = others?.[0]?.employee;
      if (other) {
        // Compute unread for this convo
        const since = p.last_read_at || "1970-01-01";
        const { count: unread } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", p.conversation_id)
          .gt("created_at", since)
          .neq("sender_employee_id", employee.id);
        dmList.push({
          conversationId: p.conversation_id,
          otherId: other.id,
          otherName: other.name,
          lastMessageAt: p.conversation.last_message_at,
          preview: p.conversation.last_message_preview,
          unread: unread || 0,
        });
      }
    }
    // Sort: unread first (highest count), then by recency
    dmList.sort((a, b) => {
      if (a.unread > 0 !== b.unread > 0) return a.unread > 0 ? -1 : 1;
      return (b.lastMessageAt || "").localeCompare(a.lastMessageAt || "");
    });
    setDms(dmList);

    // Property threads (only owners/managers see these)
    if (canSeeThreads) {
      const { data: convs } = await supabase
        .from("conversations")
        .select(
          "id, customer_id, last_message_at, last_message_preview, customer:customers(name)",
        )
        .eq("kind", "property_thread")
        .order("last_message_at", { ascending: false, nullsFirst: false });
      // Per-thread unread tracking via conversation_participants
      const threadList = [];
      for (const c of convs || []) {
        let unread = 0;
        if (c.last_message_at) {
          const { data: myRead } = await supabase
            .from("conversation_participants")
            .select("last_read_at")
            .eq("conversation_id", c.id)
            .eq("employee_id", employee.id)
            .maybeSingle();
          const since = myRead?.last_read_at || "1970-01-01";
          if (c.last_message_at > since) {
            const { count: cc } = await supabase
              .from("messages")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", c.id)
              .gt("created_at", since)
              .eq("sender_is_pm", true);
            unread = cc || 0;
          }
        }
        threadList.push({
          conversationId: c.id,
          customerId: c.customer_id,
          propertyName: c.customer?.name || "Unknown",
          lastMessageAt: c.last_message_at,
          preview: c.last_message_preview,
          unread,
        });
      }
      // Sort: unread first, then by recency
      threadList.sort((a, b) => {
        if (a.unread > 0 !== b.unread > 0) return a.unread > 0 ? -1 : 1;
        return (b.lastMessageAt || "").localeCompare(a.lastMessageAt || "");
      });
      setThreads(threadList);
    }
    setLoaded(true);
  };

  useEffect(() => {
    load();
  }, [employee.id]);

  // Realtime: refresh on any new message
  useEffect(() => {
    const channel = supabase
      .channel("msg-list-" + employee.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [employee.id]);

  return (
    <div className="pb-24">
      {onClose ? (
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200 bg-white">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-stone-100"
          >
            <ArrowLeft size={20} className="text-stone-700" />
          </button>
          <div className="font-serif text-xl text-stone-900">Messages</div>
        </div>
      ) : (
        <Header
          name={employee.name}
          onSignOut={() => {}}
          role={employee.role}
        />
      )}
      <div className="px-5 pt-6 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          {!onClose && (
            <h2 className="font-serif text-2xl text-stone-900">Messages</h2>
          )}
          <div className={`relative ${onClose ? "ml-auto" : ""}`}>
            <button
              onClick={() =>
                canSeeThreads ? setShowNewMenu((s) => !s) : onNewDm()
              }
              className="px-3 py-2 rounded-full bg-stone-900 text-stone-50 text-xs font-mono flex items-center gap-1.5"
            >
              <Plus size={14} /> New
            </button>
            {canSeeThreads && showNewMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNewMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-2xl bg-white border border-stone-200 shadow-lg overflow-hidden">
                  <button
                    onClick={() => {
                      setShowNewMenu(false);
                      onNewDm();
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-stone-50 flex items-start gap-2.5 border-b border-stone-100"
                  >
                    <User
                      size={16}
                      className="text-stone-500 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <div className="text-sm font-medium text-stone-900">
                        Message a teammate
                      </div>
                      <div className="text-[11px] text-stone-500">
                        Direct message to cleaners, managers
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setShowNewMenu(false);
                      onNewPropertyThread && onNewPropertyThread();
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-stone-50 flex items-start gap-2.5"
                  >
                    <Building2
                      size={16}
                      className="text-amber-700 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <div className="text-sm font-medium text-stone-900">
                        Message a property
                      </div>
                      <div className="text-[11px] text-stone-500">
                        Reach PMs and owners at a property
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {!loaded ? (
          <Splash text="Loading…" />
        ) : (
          <>
            {canSeeThreads && threads.length > 0 && (
              <div className="mb-6">
                <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-2">
                  Property threads
                </div>
                <div className="space-y-2">
                  {threads.map((t) => (
                    <button
                      key={t.conversationId}
                      onClick={() =>
                        onOpen({
                          conversationId: t.conversationId,
                          otherName: t.propertyName,
                          isPropertyThread: true,
                          propertyName: t.propertyName,
                        })
                      }
                      className="w-full text-left p-3 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Building2
                              size={14}
                              className="text-amber-700 flex-shrink-0"
                            />
                            <span
                              className={`font-serif text-base text-stone-900 truncate ${t.unread > 0 ? "font-bold" : ""}`}
                            >
                              {t.propertyName}
                            </span>
                            {t.unread > 0 && (
                              <span
                                className="w-2 h-2 rounded-full bg-amber-600 flex-shrink-0"
                                title={`${t.unread} unread`}
                              />
                            )}
                          </div>
                          {t.preview && (
                            <div
                              className={`text-xs truncate mt-1 ${t.unread > 0 ? "text-stone-900 font-medium" : "text-stone-600"}`}
                            >
                              {t.preview}
                            </div>
                          )}
                          {t.lastMessageAt && (
                            <div className="text-[10px] font-mono text-stone-400 mt-0.5">
                              {fmtDate(t.lastMessageAt)}
                            </div>
                          )}
                        </div>
                        <ChevronRight
                          size={14}
                          className="text-stone-400 flex-shrink-0"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-2">
                Direct messages
              </div>
              {dms.length === 0 ? (
                <div className="text-center py-10 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                  No direct messages yet. Tap "New" to start one.
                </div>
              ) : (
                <div className="space-y-2">
                  {dms.map((d) => (
                    <button
                      key={d.conversationId}
                      onClick={() =>
                        onOpen({
                          conversationId: d.conversationId,
                          otherName: d.otherName,
                          isPropertyThread: false,
                        })
                      }
                      className="w-full text-left p-3 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <User
                              size={14}
                              className="text-stone-500 flex-shrink-0"
                            />
                            <span
                              className={`font-serif text-base text-stone-900 truncate ${d.unread > 0 ? "font-bold" : ""}`}
                            >
                              {d.otherName}
                            </span>
                            {d.unread > 0 && (
                              <span
                                className="w-2 h-2 rounded-full bg-amber-600 flex-shrink-0"
                                title={`${d.unread} unread`}
                              />
                            )}
                          </div>
                          {d.preview && (
                            <div
                              className={`text-xs truncate mt-1 ${d.unread > 0 ? "text-stone-900 font-medium" : "text-stone-600"}`}
                            >
                              {d.preview}
                            </div>
                          )}
                          {d.lastMessageAt && (
                            <div className="text-[10px] font-mono text-stone-400 mt-0.5">
                              {fmtDate(d.lastMessageAt)}
                            </div>
                          )}
                        </div>
                        <ChevronRight
                          size={14}
                          className="text-stone-400 flex-shrink-0"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
