import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase.js";

// =================================================================
// useAssignmentSync — keep assignment views in sync.
// Subscribes to realtime changes on assignment_targets and assignments,
// and refreshes when the window/tab regains focus.
// Pass it a load() function to call when something changes.
// =================================================================
export function useAssignmentSync(load, channelKey = "asgn-sync") {
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    const debouncedLoad = (() => {
      let t = null;
      return () => {
        if (t) clearTimeout(t);
        t = setTimeout(() => loadRef.current && loadRef.current(), 250);
      };
    })();
    const channel = supabase
      .channel(channelKey + "-" + Math.random().toString(36).slice(2, 8))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assignment_targets" },
        debouncedLoad,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assignments" },
        debouncedLoad,
      )
      // Also listen for workblock activity. Without these subscriptions
      // a cleaner who has the Assignments / Suggested tab open won't
      // see that another cleaner just started a workblock until they
      // pull-to-refresh — which is exactly what the owner reported.
      // The debounced load coalesces back-to-back events into one fetch.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_blocks" },
        debouncedLoad,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_block_participants" },
        debouncedLoad,
      )
      // Tasks and photos changing inside an existing workblock should
      // also propagate — that's how a viewer of OtherWorkblocksHere
      // sees "Troy added a photo" or "Troy started cleaning the tub"
      // without manual refresh. Without these, the bullet list of
      // tasks in another cleaner's workblock card sat stale until
      // the user pulled-to-refresh.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        debouncedLoad,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "photos" },
        debouncedLoad,
      )
      .subscribe();

    const onFocus = () => debouncedLoad();
    const onVisible = () => {
      if (!document.hidden) debouncedLoad();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line
  }, [channelKey]);
}
