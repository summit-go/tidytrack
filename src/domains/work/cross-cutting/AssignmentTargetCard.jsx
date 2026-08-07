import React from "react";
import {
  ChevronRight,
  Plus,
  Pause,
  Play,
  Check,
  X,
  AlertCircle,
  Eye,
  Clock,
  Calendar,
  FileText,
  UserPlus,
  Edit2,
  User,
  RotateCcw,
} from "lucide-react";
import { supabase } from "../../../lib/supabase.js";
import { ASSIGNMENT_STATUSES } from "../../../lib/constants.js";
import { can } from "../../../lib/permissions.js";
import { fmtDueDate, localTodayKey } from "../../../lib/format.js";
import { unitPartyLabel } from "../../../lib/labels.js";
import { AssignmentTypeChip } from "../../../components/chips/AssignmentTypeChip.jsx";
import { OwnerOnly } from "../../../components/OwnerOnly.jsx";

export function AssignmentTargetCard({
  groupKey,
  newItems,
  firstTarget,
  bedLabel,
  group,
  unitLabel,
  sectionBits,
  partyId: pid,
  canGoToBedroom,
  busy,
  employee,
  whosHereByParty,
  onJoinBlock,
  reviewRequest,
  startAndGo,
  bulkTogglePriority,
  bulkUpdateStatus,
  setOpened,
  onOpenBedroomHistory,
  canViewTimelineT,
  timelineOpenT,
  setTimelineOpenT,
  canEditDatesT,
  editDueId,
  setEditDueId,
  dueDraftT,
  setDueDraftT,
  saveDueT,
  setStatusModal,
  setReassignTarget,
  reload,
  onUpdate,
}) {
  const todayKeyT = localTodayKey();
  const fmtStampT = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d)) return null;
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  };

  const anyPriority = newItems.some((t) => t.priority);
  const hasRequestedItems = newItems.some((t) => t.requested_by);
  const pendingReview = newItems.filter(
    (t) => t.requested_by && (t.request_status || "pending") === "pending",
  );
  const hasPendingReview = pendingReview.length > 0;
  const reviewedApproved = newItems.some(
    (t) => t.requested_by && t.request_status === "approved",
  );
  const reviewedRejected = newItems.some(
    (t) => t.requested_by && t.request_status === "rejected",
  );
  const statusOrder = [
    "pending",
    "in_progress",
    "paused",
    "blocked",
    "done",
  ];
  const dominantStatus =
    statusOrder.find((s) => newItems.some((t) => t.status === s)) || "pending";
  const statusPill =
    ASSIGNMENT_STATUSES[dominantStatus] || ASSIGNMENT_STATUSES.pending;
  const allDone = newItems.every((t) => t.status === "done");
  const canBulkComplete =
    !allDone && can(employee, "mark_assignments_done");

  return (
                        <div
                          key={`bulk-${groupKey}`}
                          className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
                        >
                          {/* Cleaner request banner — shows at the very
                             top of the card whenever a cleaner has
                             submitted a request at this bedroom that's
                             still pending. Drops a clear "needs review"
                             signal in front of the owner without
                             interrupting the rest of the card. */}
                          {/* Cleaner request banner — when there are
                             requests awaiting review, show Approve /
                             Reject. Once reviewed, it collapses to a
                             quiet status line. The requested items are
                             already on the cleaner's list regardless;
                             this is owner sign-off after the fact. */}
                          {hasPendingReview ? (
                            <div className="mb-2 px-2 py-1.5 rounded-md bg-amber-100 border border-amber-300">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                                <span className="text-[10px] uppercase tracking-wider font-mono text-amber-900 font-bold">
                                  Cleaner requested {pendingReview.length} item
                                  {pendingReview.length === 1 ? "" : "s"} —
                                  review
                                </span>
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() =>
                                    reviewRequest(newItems, "approved")
                                  }
                                  disabled={busy}
                                  className="flex-1 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                  <Check size={12} /> Approve
                                </button>
                                <button
                                  onClick={() =>
                                    reviewRequest(newItems, "rejected")
                                  }
                                  disabled={busy}
                                  className="flex-1 py-1 rounded-md bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                  <X size={12} /> Reject
                                </button>
                              </div>
                            </div>
                          ) : hasRequestedItems &&
                            (reviewedApproved || reviewedRejected) ? (
                            <div className="mb-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-stone-100 border border-stone-200">
                              {reviewedApproved && !reviewedRejected ? (
                                <span className="text-[10px] uppercase tracking-wider font-mono text-emerald-700 font-bold flex items-center gap-1">
                                  <Check size={11} /> Request approved
                                </span>
                              ) : reviewedRejected && !reviewedApproved ? (
                                <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500 font-bold flex items-center gap-1">
                                  <X size={11} /> Request rejected
                                </span>
                              ) : (
                                <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500 font-bold">
                                  Request reviewed
                                </span>
                              )}
                            </div>
                          ) : null}
                          {/* "Who's here" chips — only shows when ANOTHER
                             cleaner has an open workblock at this bedroom.
                             Each chip carries the cleaner's name + section
                             they're working + a Join button so the viewer
                             can hop in without going through the picker
                             flow. Self-chip is filtered out in useOpenWorkBlocksAtProperty
                             since "Join yourself" makes no sense. */}
                          {(() => {
                            // Never show "someone is here" on a DONE card — the
                            // job's finished, nobody's actively in it. And look
                            // up by THIS card's assignment (falling back to the
                            // bedroom for legacy blocks) so a different job at
                            // the same bedroom doesn't bleed its chip onto this
                            // card.
                            if (allDone) return null;
                            const asgKey = firstTarget?.assignment_id
                              ? `a:${firstTarget.assignment_id}`
                              : null;
                            const here =
                              (asgKey && whosHereByParty.get(asgKey)) ||
                              whosHereByParty.get(`p:${pid}`) ||
                              [];
                            if (here.length === 0) return null;
                            const hNames = here
                              .map((w) => w.name)
                              .filter(Boolean);
                            const hSections = Array.from(
                              new Set(
                                here.map((w) => w.mainSection).filter(Boolean),
                              ),
                            );
                            const hJoin = here.find((w) => w.workBlockId);
                            const hLabel =
                              hNames.join(", ") +
                              " here" +
                              (hSections.length
                                ? ` · ${hSections.join(", ")}`
                                : "");
                            return (
                              <div className="mb-2 flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] uppercase tracking-wider font-mono text-amber-900 font-bold">
                                  ●
                                </span>
                                <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                                  {hLabel}
                                </span>
                                {onJoinBlock && hJoin && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onJoinBlock({ id: hJoin.workBlockId });
                                    }}
                                    className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-900 hover:bg-stone-800 text-stone-50 font-bold inline-flex items-center gap-1 active:scale-95"
                                  >
                                    <Plus size={9} /> Join
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                          {/* === HEADER: title + chips === */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              {canGoToBedroom ? (
                                <button
                                  onClick={() => startAndGo(firstTarget)}
                                  disabled={busy}
                                  className="block text-left w-full font-serif text-base text-stone-900 leading-tight break-words hover:underline disabled:opacity-50"
                                >
                                  {unitPartyLabel(
                                    group.unit?.label || unitLabel,
                                    bedLabel,
                                  )}
                                </button>
                              ) : (
                                <div className="font-serif text-base text-stone-900 leading-tight break-words">
                                  {unitPartyLabel(
                                    group.unit?.label || unitLabel,
                                    bedLabel,
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                {can(employee, "mark_assignments_done") ||
                                can(employee, "upload_assignments") ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      bulkTogglePriority(newItems);
                                    }}
                                    disabled={busy}
                                    className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 transition-colors disabled:opacity-50 ${
                                      anyPriority
                                        ? "bg-red-100 text-red-800 border-red-300 font-bold hover:bg-red-200"
                                        : "bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200"
                                    }`}
                                  >
                                    <AlertCircle size={10} />{" "}
                                    {anyPriority ? "Priority" : "Mark priority"}
                                  </button>
                                ) : anyPriority ? (
                                  <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border bg-red-100 text-red-800 border-red-300 font-bold inline-flex items-center gap-1">
                                    <AlertCircle size={10} /> Priority
                                  </span>
                                ) : null}
                                <span
                                  className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border ${statusPill.color}`}
                                >
                                  {statusPill.label}
                                </span>
                                {(() => {
                                  const asg = (newItems[0] || firstTarget)
                                    ?.assignment;
                                  const sd = asg?.scheduled_date;
                                  // Done work has a completion date, not a due
                                  // date. "Overdue" on a finished job is a
                                  // contradiction — overdue means unfinished
                                  // past its due date. Show when it finished.
                                  const grpDone =
                                    newItems.every(
                                      (t) => t.status === "done",
                                    ) && newItems.length > 0;
                                  const doneAtT =
                                    newItems
                                      .map((t) => t.completed_at)
                                      .filter(Boolean)
                                      .sort()
                                      .slice(-1)[0] || null;
                                  if (canViewTimelineT) {
                                    return (
                                      <div className="relative inline-block">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setTimelineOpenT(
                                              timelineOpenT === asg?.id
                                                ? null
                                                : asg?.id,
                                            );
                                          }}
                                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                                            grpDone
                                              ? "bg-stone-900 text-white border-stone-900"
                                              : sd
                                                ? sd < todayKeyT
                                                  ? "bg-red-100 text-red-700 border-red-200"
                                                  : sd === todayKeyT
                                                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                    : "bg-stone-100 text-stone-600 border-stone-200"
                                                : "bg-white text-stone-500 border-dashed border-stone-300"
                                          }`}
                                        >
                                          {grpDone ? (
                                            <>
                                              <Check size={9} />{" "}
                                              {doneAtT
                                                ? `Done ${fmtDueDate(String(doneAtT).slice(0, 10))}`
                                                : "Done"}
                                            </>
                                          ) : (
                                            <>
                                              <Calendar size={9} />{" "}
                                              {sd
                                                ? fmtDueDate(sd)
                                                : "Set due date"}
                                            </>
                                          )}
                                          <ChevronRight
                                            size={10}
                                            className="rotate-90 opacity-60"
                                          />
                                        </button>
                                        {timelineOpenT === asg?.id && (
                                          <>
                                            <div
                                              className="fixed inset-0 z-30"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setTimelineOpenT(null);
                                              }}
                                            />
                                            <div
                                              className="absolute right-0 top-full mt-1 z-40 w-60 rounded-xl bg-white border border-stone-200 shadow-xl overflow-hidden text-left"
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                            >
                                              <div className="px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-wider font-mono text-stone-400">
                                                Timeline
                                              </div>
                                              <div className="px-3 pb-2 space-y-1.5">
                                                <div className="flex items-center justify-between gap-3">
                                                  <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                                                    <FileText size={11} />{" "}
                                                    Submitted
                                                  </span>
                                                  <span
                                                    className={`text-[11px] font-mono ${asg?.created_at ? "text-stone-800" : "text-stone-400"}`}
                                                  >
                                                    {asg?.created_at
                                                      ? fmtStampT(
                                                          asg.created_at,
                                                        )
                                                      : "—"}
                                                  </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                  <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                                                    <UserPlus size={11} />{" "}
                                                    Accepted
                                                  </span>
                                                  <span
                                                    className={`text-[11px] font-mono ${asg?.approved_at || asg?.pm_status === "approved" || !asg?.pm_status ? "text-emerald-700" : "text-stone-400"}`}
                                                  >
                                                    {asg?.approved_at
                                                      ? fmtStampT(
                                                          asg.approved_at,
                                                        )
                                                      : !asg?.pm_status ||
                                                          asg?.pm_status ===
                                                            "approved"
                                                        ? asg?.created_at
                                                          ? `${fmtStampT(asg.created_at)} · auto`
                                                          : "Auto"
                                                        : asg?.pm_status ===
                                                            "pending"
                                                          ? "Awaiting you"
                                                          : asg?.pm_status ===
                                                              "rejected"
                                                            ? "Rejected"
                                                            : "Not yet"}
                                                  </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                  <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                                                    <Check size={11} /> Done
                                                  </span>
                                                  <span
                                                    className={`text-[11px] font-mono ${doneAtT ? "text-stone-800" : "text-stone-400"}`}
                                                  >
                                                    {doneAtT
                                                      ? fmtStampT(doneAtT)
                                                      : "Not yet"}
                                                  </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3 pt-1 border-t border-stone-100">
                                                  <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                                                    <Calendar size={11} /> Due
                                                  </span>
                                                  <span className="text-[11px] font-mono text-stone-800">
                                                    {sd ? fmtDueDate(sd) : "—"}
                                                  </span>
                                                </div>
                                              </div>
                                              {canEditDatesT && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTimelineOpenT(null);
                                                    setDueDraftT(sd || "");
                                                    setEditDueId(asg?.id);
                                                  }}
                                                  className="w-full border-t border-stone-100 px-3 py-2 text-[11px] font-mono text-stone-600 hover:bg-stone-50 text-left flex items-center gap-1.5"
                                                >
                                                  <Edit2 size={11} /> Change due
                                                  date
                                                </button>
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    );
                                  }
                                  if (grpDone) {
                                    const last = newItems
                                      .map((t) => t.completed_at)
                                      .filter(Boolean)
                                      .sort()
                                      .slice(-1)[0];
                                    return (
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-900 text-white inline-flex items-center gap-1">
                                        <Check size={9} />{" "}
                                        {last
                                          ? `Done ${fmtDueDate(String(last).slice(0, 10))}`
                                          : "Done"}
                                      </span>
                                    );
                                  }
                                  if (editDueId === asg?.id)
                                    return (
                                      <span
                                        className="inline-flex items-center gap-1"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <input
                                          type="date"
                                          autoFocus
                                          defaultValue={sd || ""}
                                          onChange={(e) =>
                                            setDueDraftT(e.target.value)
                                          }
                                          className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-stone-400 bg-white"
                                        />
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            saveDueT(
                                              asg?.id,
                                              dueDraftT || null,
                                            );
                                            setEditDueId(null);
                                          }}
                                          className="text-[10px] px-1.5 py-0.5 rounded bg-stone-900 text-white"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditDueId(null);
                                          }}
                                          className="text-[10px] px-1 text-stone-500"
                                        >
                                          Cancel
                                        </button>
                                      </span>
                                    );
                                  if (canEditDatesT)
                                    return (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDueDraftT(sd || "");
                                          setEditDueId(asg?.id);
                                        }}
                                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                                          sd
                                            ? sd < todayKeyT
                                              ? "bg-red-100 text-red-700 border-red-200"
                                              : sd === todayKeyT
                                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                : "bg-stone-100 text-stone-600 border-stone-200"
                                            : "bg-white text-stone-500 border-dashed border-stone-300"
                                        }`}
                                      >
                                        <Calendar size={9} />{" "}
                                        {sd
                                          ? sd < todayKeyT
                                            ? `Overdue · ${fmtDueDate(sd)}`
                                            : sd === todayKeyT
                                              ? "Today"
                                              : fmtDueDate(sd)
                                          : "Set due date"}
                                      </button>
                                    );
                                  return sd ? (
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-stone-100 text-stone-600 border-stone-200 inline-flex items-center gap-1">
                                      <Calendar size={9} />{" "}
                                      {sd === todayKeyT
                                        ? "Today"
                                        : fmtDueDate(sd)}
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpened(firstTarget);
                                  }}
                                  className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center gap-1"
                                >
                                  <Eye size={10} /> Quick glance
                                </button>
                                {onOpenBedroomHistory &&
                                  firstTarget?.unit_id &&
                                  firstTarget?.party_id && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenBedroomHistory({
                                          unitId: firstTarget.unit_id,
                                          unitLabel: group.unit?.label,
                                          partyId: firstTarget.party_id,
                                          partyLabel: bedLabel,
                                        });
                                      }}
                                      disabled={busy}
                                      className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center gap-1 disabled:opacity-50"
                                    >
                                      <Clock size={10} /> History
                                    </button>
                                  )}
                              </div>
                            </div>
                          </div>
                          {/* === TYPE + TASK COUNT (new card style) === */}
                          <div className="mb-2 flex items-center gap-2 flex-wrap text-[11px] font-mono text-stone-500">
                            {firstTarget?.assignment?.assignment_type && (
                              <AssignmentTypeChip
                                type={firstTarget.assignment.assignment_type}
                              />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpened(firstTarget);
                              }}
                              className="underline decoration-stone-400 underline-offset-2 hover:text-stone-700"
                            >
                              {newItems.length}{" "}
                              {newItems.length === 1 ? "task" : "tasks"}
                            </button>
                            {sectionBits.length > 0 && (
                              <span className="text-stone-400">
                                · {sectionBits.join(" · ")}
                              </span>
                            )}
                          </div>
                          {/* === BULK ACTION BUTTONS ===
                             Start = navigate to bedroom (no status flip).
                             Pause = flip in_progress items to paused so the
                                     cleaner can step away and return without
                                     losing the timer/credit. Visible on In
                                     progress tab only — Pending has nothing
                                     to pause, Done/Blocked are terminal.
                             Resume = flip paused items back to in_progress.
                                      Visible on Paused tab.
                             Mark complete = bulk mark all to done (with confirm).
                             Blocked = bulk mark all blocked (note via modal on first
                                       target as proxy; we apply the same note to all).
                             Reassign = opens reassign modal on the first target.
                                        It's a per-target modal so handling N targets
                                        sequentially would be ugly; keeping it on
                                        one. Most apt cases have 1 assignment per
                                        bedroom in the new model anyway. */}
                          <div className="flex gap-2 flex-wrap items-center">
                            {canGoToBedroom && (
                              <button
                                onClick={() => startAndGo(firstTarget)}
                                disabled={busy}
                                className="h-9 px-3 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                              >
                                Go to bedroom <ChevronRight size={13} />
                              </button>
                            )}
                            {allDone &&
                              can(employee, "mark_assignments_done") && (
                                <button
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `Reopen ${bedLabel}? It goes back to Pending so it can be worked again.`,
                                      )
                                    )
                                      bulkUpdateStatus(newItems, "pending");
                                  }}
                                  disabled={busy}
                                  className="h-9 px-3 rounded-lg border border-amber-300 hover:bg-amber-50 text-amber-800 text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                                >
                                  <RotateCcw size={12} /> Reopen
                                </button>
                              )}
                            {/* Pause: only visible when there's actually
                               something running at this bedroom. The bulk
                               filter picks the in_progress items and
                               flips them to paused, preserving started_by /
                               started_at so the audit trail stays honest. */}
                            {newItems.some(
                              (t) => t.status === "in_progress",
                            ) && (
                              <button
                                onClick={() => {
                                  const running = newItems.filter(
                                    (t) => t.status === "in_progress",
                                  );
                                  bulkUpdateStatus(running, "paused");
                                }}
                                disabled={busy}
                                className="h-9 px-3 rounded-lg border border-blue-300 hover:bg-blue-50 text-blue-700 text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                              >
                                <Pause size={12} /> Pause
                              </button>
                            )}
                            {/* Resume: pulls paused items back to in_progress
                               so the cleaner picks up where they left off. */}
                            {newItems.some((t) => t.status === "paused") && (
                              <button
                                onClick={async () => {
                                  const paused = newItems.filter(
                                    (t) => t.status === "paused",
                                  );
                                  await bulkUpdateStatus(paused, "in_progress");
                                  // Resume should drop the cleaner straight back
                                  // into the bedroom to keep working — not leave
                                  // them on the card having to tap "Go to this
                                  // bedroom" as a second step.
                                  startAndGo(firstTarget);
                                }}
                                disabled={busy}
                                className="h-9 px-3 rounded-lg border border-amber-300 hover:bg-amber-50 text-amber-700 text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                              >
                                <Play size={12} /> Resume
                              </button>
                            )}
                            {canBulkComplete && (
                              <button
                                onClick={async () => {
                                  if (
                                    !confirm(
                                      `Mark all ${newItems.length} items at ${bedLabel} complete?`,
                                    )
                                  )
                                    return;
                                  await bulkUpdateStatus(newItems, "done");
                                  // Also close any open workblock this cleaner
                                  // owns at this bedroom. Saying "everything
                                  // is done" with a workblock still ticking
                                  // was contradictory and forced the cleaner
                                  // to remember to close it manually.
                                  if (employee?.id) {
                                    const unitId = newItems[0]?.unit_id;
                                    const partyId = newItems[0]?.party_id;
                                    if (unitId && partyId) {
                                      try {
                                        const { data: openBlocks } =
                                          await supabase
                                            .from("work_blocks")
                                            .select(
                                              "id, shift:shifts!inner(employee_id)",
                                            )
                                            .eq("unit_id", unitId)
                                            .eq("party_id", partyId)
                                            .is("end_time", null);
                                        const myOpen = (
                                          openBlocks || []
                                        ).filter(
                                          (b) =>
                                            b.shift?.employee_id ===
                                            employee.id,
                                        );
                                        if (myOpen.length > 0) {
                                          const ts = new Date().toISOString();
                                          await supabase
                                            .from("work_blocks")
                                            .update({ end_time: ts })
                                            .in(
                                              "id",
                                              myOpen.map((b) => b.id),
                                            );
                                        }
                                      } catch (e) {
                                        console.warn(
                                          "[Finished all tasks] could not close own workblock",
                                          e,
                                        );
                                      }
                                    }
                                  }
                                }}
                                disabled={busy}
                                className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                              >
                                <Check size={12} /> Finished all tasks
                              </button>
                            )}
                            {!allDone && (
                              <OwnerOnly employee={employee}>
                                <button
                                  onClick={() =>
                                    setStatusModal({
                                      target: firstTarget,
                                      bulkRows: newItems,
                                    })
                                  }
                                  disabled={busy}
                                  title="Owners only"
                                  className="h-9 px-3 rounded-lg border border-red-200 hover:bg-red-50 text-red-700 text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                                >
                                  <AlertCircle size={12} /> Block
                                </button>
                              </OwnerOnly>
                            )}
                            {!allDone && (
                              <button
                                onClick={() => setReassignTarget(firstTarget)}
                                disabled={busy}
                                className="h-9 px-3 rounded-lg border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                              >
                                <User size={12} /> Reassign
                              </button>
                            )}
                            {/* Owner-only: delete an assignment uploaded by mistake. */}
                            {can(employee, "upload_assignments") &&
                              firstTarget?.assignment?.id && (
                                <button
                                  onClick={async () => {
                                    if (
                                      !confirm(
                                        "Delete this assignment? Use this only if it was uploaded by mistake — it removes it for everyone.",
                                      )
                                    )
                                      return;
                                    const { error } = await supabase
                                      .from("assignments")
                                      .update({
                                        deleted_at: new Date().toISOString(),
                                        deleted_by: employee?.id || null,
                                      })
                                      .eq("id", firstTarget.assignment.id);
                                    if (error) {
                                      alert(
                                        "Could not delete: " + error.message,
                                      );
                                      return;
                                    }
                                    reload();
                                    if (onUpdate) onUpdate();
                                  }}
                                  disabled={busy}
                                  title="Delete this assignment (uploaded by mistake)"
                                  className="ml-auto w-9 h-9 rounded-lg flex items-center justify-center border border-stone-300 bg-white hover:bg-red-50 text-red-600 disabled:opacity-50"
                                >
                                  <X size={16} />
                                </button>
                              )}
                          </div>
                          {/* Full-width "Go to this bedroom" bar removed — it's a
                             small button in the action row now. */}
                        </div>
  );
}
