import React, { useState, useEffect } from "react";
import { Bell, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabase.js";

export function NotificationBell({ employee, isOwner, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!employee?.id) return;
    setLoading(true);
    const weekAgoISO = new Date(Date.now() - 7 * 86400000).toISOString();
    // Auto-prune: delete anything past the 7-day window so history stays
    // tidy without anyone running SQL. Fire-and-forget; owners/managers do
    // the delete (cleaners just read). Safe if it no-ops.
    if (isOwner) {
      supabase
        .from("notifications")
        .delete()
        .lt("created_at", weekAgoISO)
        .then(({ error }) => {
          if (error) console.warn("[notify] prune failed", error);
        });
      // Backfill: PM assignments that are pending approval but have no bell
      // notification yet (e.g. submitted before the bell existed). Create one
      // per assignment so the owner sees them in the bell, not just a screen.
      try {
        // Don't filter on deleted_at in the query itself — if that column is
        // absent the whole query errors and the backfill silently no-ops.
        // Filter it out in JS instead.
        const { data: pendingAsg, error: paErr } = await supabase
          .from("assignments")
          .select(
            "id, title, customer_id, deleted_at, customer:customers(name)",
          )
          .eq("source", "pm")
          .eq("pm_status", "pending");
        if (paErr) console.warn("[notify] backfill query error", paErr);
        const live = (pendingAsg || []).filter((a) => !a.deleted_at);
        if (live.length) {
          const { data: existing } = await supabase
            .from("notifications")
            .select("link_id")
            .eq("kind", "pm_assignment")
            .in(
              "link_id",
              live.map((a) => a.id),
            );
          const have = new Set((existing || []).map((r) => r.link_id));
          const toInsert = live
            .filter((a) => !have.has(a.id))
            .map((a) => ({
              recipient_scope: "owner",
              kind: "pm_assignment",
              title: "New assignment to approve",
              body: `${a.customer?.name || "A property"} · ${a.title || "Assignment"}`,
              link_kind: "assignment",
              link_id: a.id,
            }));
          if (toInsert.length) {
            const { error: insErr } = await supabase
              .from("notifications")
              .insert(toInsert);
            if (insErr) console.warn("[notify] backfill insert error", insErr);
          }
        }
      } catch (e) {
        console.warn("[notify] pm backfill skipped", e);
      }
    }
    // A person sees notifications addressed to them, plus (if owner/manager)
    // the 'owner' broadcast feed.
    let q = supabase
      .from("notifications")
      .select("*")
      .gte("created_at", weekAgoISO)
      .order("created_at", { ascending: false })
      .limit(50);
    if (isOwner) {
      q = q.or(
        `recipient_employee_id.eq.${employee.id},recipient_scope.eq.owner`,
      );
    } else {
      // Cleaners see notifications addressed to them personally, plus any
      // broadcast to all cleaners (e.g. a priority job open to whoever grabs
      // it). The broadcast row is deleted when someone claims the job, so it
      // stops showing for everyone at once.
      q = q.or(
        `recipient_employee_id.eq.${employee.id},recipient_scope.eq.all_cleaners`,
      );
    }
    const { data } = await q;
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Light polling so new items surface without a full refresh — paused
    // while the app is backgrounded, refreshes on return.
    const t = setInterval(() => {
      if (!document.hidden) load();
    }, 60000);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id, isOwner]);

  const unread = items.filter((n) => !n.read_at).length;

  const openBell = async () => {
    setOpen((o) => !o);
    if (!open && unread > 0) {
      const unreadItems = items.filter((n) => !n.read_at);
      // Only the all_cleaners broadcast is truly shared across many people —
      // writing read_at there would mark it read for everyone, so we skip DB
      // for those (they clear when the job is claimed). Owner-scope rows and
      // personal rows SHOULD persist read: the owner team is one audience, so
      // once you've seen them they stay seen and don't pop back up.
      const persistIds = unreadItems
        .filter((n) => n.recipient_scope !== "all_cleaners")
        .map((n) => n.id);
      setItems((prev) =>
        prev.map((n) =>
          !n.read_at ? { ...n, read_at: new Date().toISOString() } : n,
        ),
      );
      if (persistIds.length) {
        try {
          await supabase
            .from("notifications")
            .update({ read_at: new Date().toISOString() })
            .in("id", persistIds);
        } catch (e) {
          console.warn("[notify] mark read failed", e);
        }
      }
    }
  };

  const fmtWhen = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 60000;
    if (diff < 1) return "just now";
    if (diff < 60) return `${Math.floor(diff)}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };
  const KIND_DOT = {
    pm_assignment: "bg-amber-500",
    cleaner_request: "bg-amber-500",
    message: "bg-blue-500",
    priority_assignment: "bg-red-500",
    other: "bg-stone-400",
  };

  if (!employee?.id) return null;
  return (
    <div className="relative">
      <button
        onClick={openBell}
        className="relative p-2 rounded-full text-stone-50 active:scale-95 transition"
        style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-mono font-bold flex items-center justify-center border-2"
            style={{ borderColor: "#3E5C76" }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[92vw] z-50 rounded-2xl bg-white border border-stone-200 shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-mono text-stone-500">
                Notifications
              </span>
              <span className="text-[10px] font-mono text-stone-400">
                last 7 days
              </span>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {loading && items.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-stone-400">
                  Loading…
                </div>
              ) : items.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-stone-400">
                  Nothing yet.
                </div>
              ) : (
                items.map((n) => {
                  // Always tappable: tapping marks it read (grays it out) and,
                  // if a navigation handler is wired on this screen, opens the
                  // related screen too. Even without navigation, the tap clears
                  // it so a resolved item stops nagging.
                  const canNavigate = !!onNavigate && (n.link_kind || n.kind);
                  const handleTap = async () => {
                    // Persist read immediately for this row (owner/personal
                    // scope) so it doesn't come back on reopen.
                    if (!n.read_at && n.recipient_scope !== "all_cleaners") {
                      setItems((prev) =>
                        prev.map((x) =>
                          x.id === n.id
                            ? { ...x, read_at: new Date().toISOString() }
                            : x,
                        ),
                      );
                      try {
                        await supabase
                          .from("notifications")
                          .update({ read_at: new Date().toISOString() })
                          .eq("id", n.id);
                      } catch {}
                    }
                    if (canNavigate) {
                      setOpen(false);
                      onNavigate(n);
                    }
                  };
                  return (
                    <div
                      key={n.id}
                      role="button"
                      onClick={handleTap}
                      className={`px-4 py-3 border-b border-stone-50 flex gap-3 ${n.read_at ? "bg-stone-100/70 opacity-60" : "bg-amber-50/40"} hover:bg-stone-50 cursor-pointer active:scale-[0.99]`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${KIND_DOT[n.kind] || KIND_DOT.other}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-stone-900 font-medium">
                          {n.title}
                        </div>
                        {n.body && (
                          <div className="text-xs text-stone-600 mt-0.5 whitespace-pre-wrap">
                            {n.body}
                          </div>
                        )}
                        <div className="text-[10px] font-mono text-stone-400 mt-1">
                          {fmtWhen(n.created_at)}
                        </div>
                      </div>
                      {canNavigate && (
                        <ChevronRight
                          size={14}
                          className="text-stone-300 flex-shrink-0 self-center"
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
