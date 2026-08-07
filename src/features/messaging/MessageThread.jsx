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

export function MessageThread({
  conversationId,
  otherName,
  asEmployee = null,
  asPmCustomer = null,
  pmActorKind = null,
  isPropertyThread = false,
  propertyName,
  onBack,
}) {
  const [messages, setMessages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [zoomPhoto, setZoomPhoto] = useState(null);
  const [urgent, setUrgent] = useState(false); // urgent flag for next message
  const scrollRef = useRef(null);

  const load = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*, sender:employees(id, name)")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    setLoaded(true);
    // Mark conversation as read for this person
    if (asEmployee) {
      // For DMs they're already a participant. For property threads, owners/managers
      // may not have a row yet — upsert so the read state actually persists.
      const nowIso = new Date().toISOString();
      const { error: updErr } = await supabase
        .from("conversation_participants")
        .update({ last_read_at: nowIso })
        .eq("conversation_id", conversationId)
        .eq("employee_id", asEmployee.id);
      // If no row was updated (property thread, first time opening), insert one
      if (isPropertyThread) {
        await supabase.from("conversation_participants").upsert(
          {
            conversation_id: conversationId,
            employee_id: asEmployee.id,
            last_read_at: nowIso,
          },
          { onConflict: "conversation_id,employee_id" },
        );
      }
    } else if (asPmCustomer) {
      await supabase
        .from("customers")
        .update({ pm_last_read_at: new Date().toISOString() })
        .eq("id", asPmCustomer.id);
    }
    setTimeout(
      () =>
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        }),
      50,
    );
  };

  useEffect(() => {
    load();
  }, [conversationId]);

  // Realtime subscription for new messages in this conversation
  useEffect(() => {
    const channel = supabase
      .channel("msg-" + conversationId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => load(),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const send = async () => {
    if (sending) return;
    if (!text.trim() && !photoFile) {
      setError("Type a message or attach a photo.");
      return;
    }
    setError("");
    setSending(true);
    try {
      let photoUrl = null,
        photoPath = null;
      if (photoFile) {
        const r = await uploadMessagePhoto(photoFile, conversationId);
        photoUrl = r.publicUrl;
        photoPath = r.path;
      }
      const insert = {
        conversation_id: conversationId,
        content: text.trim() || null,
        photo_url: photoUrl,
        photo_path: photoPath,
        urgent: !!urgent,
      };
      if (asEmployee) {
        insert.sender_employee_id = asEmployee.id;
        insert.sender_is_pm = false;
      } else {
        insert.sender_employee_id = null;
        insert.sender_is_pm = true;
        insert.pm_actor_kind = pmActorKind || "pm";
      }
      const { error: e } = await supabase.from("messages").insert(insert);
      if (e) throw e;
      // Bell notification for a 1-on-1 staff DM — tell the OTHER participant
      // there's a new message. (Property threads are a broadcast with a
      // lazily-built participant list, so those aren't notified here; the
      // existing unread badge still covers them.)
      if (asEmployee) {
        try {
          const { data: conv } = await supabase
            .from("conversations")
            .select("kind")
            .eq("id", conversationId)
            .maybeSingle();
          if (conv?.kind === "staff_dm") {
            const { data: parts } = await supabase
              .from("conversation_participants")
              .select("employee_id")
              .eq("conversation_id", conversationId);
            (parts || []).forEach((p) => {
              if (p.employee_id && p.employee_id !== asEmployee.id)
                createNotification({
                  to: { employeeId: p.employee_id },
                  kind: "message",
                  title: `New message from ${asEmployee.name}`,
                  body: (text.trim() || (photoUrl ? "📷 Photo" : "")).slice(
                    0,
                    120,
                  ),
                  linkKind: "conversation",
                  linkId: conversationId,
                  createdBy: asEmployee.id,
                });
            });
          }
        } catch (notifyErr) {
          console.warn("[notify] dm notify skipped", notifyErr);
        }
      }
      setText("");
      setPhotoFile(null);
      setUrgent(false);
      // load() will be triggered by realtime, but call it anyway for instant response
      load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (m) => {
    if (!confirm("Delete this message? This cannot be undone.")) return;
    if (m.photo_path) await deleteMessagePhoto(m.photo_path);
    await supabase.from("messages").delete().eq("id", m.id);
    // Realtime will refresh
  };

  // Decide who counts as "me" for bubble alignment
  const isMine = (m) => {
    if (asEmployee) return m.sender_employee_id === asEmployee.id;
    if (asPmCustomer) return m.sender_is_pm === true;
    return false;
  };

  // Decide the displayed sender name
  const senderName = (m) => {
    if (m.sender_is_pm) {
      return m.pm_actor_kind === "pm_staff"
        ? "Property manager · staff"
        : "Property manager";
    }
    if (!isPropertyThread) return m.sender?.name || "Unknown";
    // Property thread + staff sender → show as Summit Clean to the PM
    if (asPmCustomer) return "Summit Clean";
    // Property thread + viewing as staff → show real name
    return m.sender?.name || "Summit Clean";
  };

  return (
    <div
      className="flex flex-col bg-stone-50"
      style={{ height: "100dvh", maxHeight: "100dvh" }}
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200 bg-white flex-shrink-0">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100"
        >
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div className="flex-1 min-w-0">
          {isPropertyThread && (
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              Property thread
            </div>
          )}
          <div className="font-serif text-xl text-stone-900 truncate">
            {otherName}
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ minHeight: 0 }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
          {!loaded ? (
            <div className="text-center text-stone-400 text-sm">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-stone-400 text-sm py-12">
              No messages yet. Say hi!
            </div>
          ) : (
            messages.map((m) => {
              const mine = isMine(m);
              const isUrgent = !!m.urgent;
              const bubbleClass = isUrgent
                ? mine
                  ? "bg-amber-600 text-white border border-amber-700"
                  : "bg-amber-50 border-2 border-amber-400 text-amber-950"
                : mine
                  ? "bg-stone-900 text-stone-50"
                  : "bg-white border border-stone-200 text-stone-900";
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col`}
                  >
                    {!mine && (
                      <div className="text-[10px] font-mono text-stone-500 mb-0.5 px-1">
                        {senderName(m)}
                      </div>
                    )}
                    {isUrgent && (
                      <div
                        className={`flex items-center gap-1 mb-0.5 px-1 text-[10px] font-mono uppercase tracking-wider ${mine ? "text-amber-700" : "text-amber-700"}`}
                      >
                        <AlertCircle size={10} /> Urgent
                      </div>
                    )}
                    <div className={`px-3 py-2 rounded-2xl ${bubbleClass}`}>
                      {m.photo_url && (
                        <button
                          onClick={() => setZoomPhoto(m.photo_url)}
                          className="block mb-1"
                        >
                          <img
                            src={m.photo_url}
                            alt=""
                            loading="lazy"
                            className="rounded-xl max-w-full max-h-60 object-cover"
                          />
                        </button>
                      )}
                      {m.content && (
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {m.content}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 px-1">
                      <div className="text-[10px] font-mono text-stone-400">
                        {fmtClock(m.created_at)}
                      </div>
                      {mine && (
                        <button
                          onClick={() => deleteMessage(m)}
                          className="text-[10px] font-mono text-stone-400 hover:text-red-600"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-sm flex items-center gap-2 flex-shrink-0">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {photoFile && (
        <div className="px-4 py-2 bg-stone-100 border-t border-stone-200 flex items-center gap-2 flex-shrink-0">
          <ImageIcon size={16} className="text-stone-600" />
          <span className="text-xs text-stone-700 flex-1 truncate">
            {photoFile.name}
          </span>
          <button
            onClick={() => setPhotoFile(null)}
            className="p-1 rounded-full hover:bg-stone-200"
          >
            <X size={14} className="text-stone-600" />
          </button>
        </div>
      )}

      <div
        className="border-t border-stone-200 bg-white flex-shrink-0"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {urgent && (
          <div className="px-4 py-2 bg-amber-100 border-t border-amber-200 flex items-center gap-2 flex-shrink-0">
            <AlertCircle size={14} className="text-amber-700 flex-shrink-0" />
            <span className="text-xs text-amber-900 flex-1">
              This message will be sent as{" "}
              <span className="font-bold">urgent</span>.
            </span>
            <button
              onClick={() => setUrgent(false)}
              className="text-[10px] text-amber-700 hover:text-amber-900 font-mono uppercase tracking-wider"
            >
              Cancel
            </button>
          </div>
        )}
        <div className="px-4 py-3 max-w-2xl mx-auto flex items-end gap-2">
          <label className="p-2 rounded-full hover:bg-stone-100 cursor-pointer flex-shrink-0">
            <Camera size={20} className="text-stone-600" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPhotoFile(f);
              }}
            />
          </label>
          <button
            onClick={() => setUrgent((u) => !u)}
            type="button"
            title={
              urgent
                ? "Urgent flag enabled — tap to turn off"
                : "Mark this message as urgent"
            }
            className={`p-2 rounded-full flex-shrink-0 transition-colors ${urgent ? "bg-amber-600 hover:bg-amber-700 text-white" : "hover:bg-stone-100 text-stone-600"}`}
          >
            <AlertCircle size={20} />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            placeholder={
              urgent ? "Type your urgent message…" : "Type a message…"
            }
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            onFocus={(e) => {
              // Scroll the input into view after the iOS keyboard animation
              setTimeout(() => {
                try {
                  e.target.scrollIntoView({ block: "end", behavior: "smooth" });
                } catch {}
              }, 300);
            }}
            style={{ fontSize: 16 }}
            className={`flex-1 px-3 py-2 rounded-xl border bg-white resize-none max-h-32 ${urgent ? "border-amber-400 focus:border-amber-600" : "border-stone-300"}`}
          />
          <button
            onClick={send}
            disabled={sending || (!text.trim() && !photoFile)}
            className={`p-2.5 rounded-full text-stone-50 disabled:opacity-40 flex-shrink-0 ${urgent ? "bg-amber-600 hover:bg-amber-700" : "bg-stone-900"}`}
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-stone-50 border-t-transparent rounded-full animate-spin" />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>
        </div>
      </div>

      {zoomPhoto && (
        <div
          className="fixed inset-0 bg-stone-900/95 z-50 flex flex-col"
          onClick={() => setZoomPhoto(null)}
        >
          <div className="flex justify-end p-4">
            <button className="p-2 rounded-full bg-stone-800">
              <X size={20} className="text-stone-50" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <img src={zoomPhoto} alt="" className="w-full h-auto rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
