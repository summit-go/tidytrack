import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { isLead } from "../lib/permissions.js";

// ---- Hook: unread message count ----
export function useUnreadCount({ employee = null, customer = null, refreshKey = 0 }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (employee) {
          // Staff: count unread across all conversations they're in
          // For owners: also include property threads (they implicitly see all)
          // For everyone: count DMs they're a participant in
          const { data: parts } = await supabase
            .from("conversation_participants")
            .select("conversation_id, last_read_at")
            .eq("employee_id", employee.id);
          if (!parts || cancelled) return;
          let unread = 0;
          for (const p of parts) {
            const since = p.last_read_at || "1970-01-01";
            const { count: c } = await supabase
              .from("messages")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", p.conversation_id)
              .gt("created_at", since)
              .neq("sender_employee_id", employee.id);
            unread += c || 0;
          }
          // For owners and managers, also count unread property threads.
          // Per-thread read state uses conversation_participants — if no row
          // exists for this employee, treat the thread as fully unread.
          if (isLead(employee)) {
            const { data: convs } = await supabase
              .from("conversations")
              .select("id, last_message_at")
              .eq("kind", "property_thread");
            for (const c of convs || []) {
              if (!c.last_message_at) continue;
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
                unread += cc || 0;
              }
            }
          }
          if (!cancelled) setCount(unread);
        } else if (customer) {
          // PM: their property thread
          const { data: conv } = await supabase
            .from("conversations")
            .select("id, last_message_at")
            .eq("customer_id", customer.id)
            .eq("kind", "property_thread")
            .maybeSingle();
          if (!conv) {
            if (!cancelled) setCount(0);
            return;
          }
          const since = customer.pm_last_read_at || "1970-01-01";
          const { count: c } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .gt("created_at", since)
            .eq("sender_is_pm", false);
          if (!cancelled) setCount(c || 0);
        }
      } catch (e) {
        console.error("[unread]", e);
      }
    };
    load();
    // 30s backup poll (was 20s, always-on). Realtime is the fast path; this
    // only catches missed events, and now pauses when the app is hidden.
    const interval = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [employee?.id, customer?.id, refreshKey]);
  return count;
}
