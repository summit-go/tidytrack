import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase.js";

// =================================================================
// IDLE DETECTOR — auto clock-out after 1 hour of inactivity.
// Shows a warning at the 45-minute mark giving them 15 minutes to
// dismiss before the clock-out lands.
//
// Detects activity via pointer/keyboard/touch events. Debounces saves
// of `last_activity_at` to the database to once per minute max.
// When the app regains focus, checks if too much time has passed and
// triggers auto-clock-out retroactively using the saved last_activity_at.
//
// NOTE: this only clocks a shift OUT — it never signs the cleaner out of
// the app or closes anything. If a cleaner reports the app "closing" after
// a while, that's the phone OS discarding the backgrounded tab to save
// memory (screen lock, switching to the camera, etc.), not this. The
// session persists; the app just reloads and reload() re-attaches their
// open shift, work block and active task.
//
// Returns: { showWarning, dismissWarning } — caller renders the warning UI.
// =================================================================
// Auto-clock-out behavior: warn at 45min of inactivity, force end at 1hr.
// 1 hour is the target (per owner preference) — the 45min warning gives
// the cleaner a chance to dismiss before time is lost.
const IDLE_WARN_MS = 45 * 60 * 1000; // 45 minutes
const IDLE_LIMIT_MS = 60 * 60 * 1000; // 1 hour
const ACTIVITY_SAVE_THROTTLE_MS = 60 * 1000; // save to DB at most once per minute

export function useIdleDetector({ shift, onAutoClockOut, enabled = true }) {
  const [showWarning, setShowWarning] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const lastSaveRef = useRef(0);
  const idleStartRef = useRef(null); // timestamp when current idle interval started
  const intervalRef = useRef(null);

  // Save activity timestamp to DB (throttled)
  const saveActivity = async (ts) => {
    if (!shift?.id) return;
    if (ts - lastSaveRef.current < ACTIVITY_SAVE_THROTTLE_MS) return;
    lastSaveRef.current = ts;
    try {
      await supabase
        .from("shifts")
        .update({ last_activity_at: new Date(ts).toISOString() })
        .eq("id", shift.id);
    } catch (e) {
      /* fail silent */
    }
  };

  // Record an idle interval (when an idle gap is observed)
  const recordIdleInterval = async (startTs, endTs) => {
    if (!shift?.id) return;
    const seconds = Math.floor((endTs - startTs) / 1000);
    if (seconds < 60) return; // ignore gaps under 1 minute
    try {
      const { data: cur } = await supabase
        .from("shifts")
        .select("idle_seconds, idle_intervals")
        .eq("id", shift.id)
        .maybeSingle();
      const existing = cur?.idle_intervals || [];
      const newIntervals = [
        ...existing,
        {
          start: new Date(startTs).toISOString(),
          end: new Date(endTs).toISOString(),
          seconds,
        },
      ];
      const totalSec = (cur?.idle_seconds || 0) + seconds;
      await supabase
        .from("shifts")
        .update({
          idle_seconds: totalSec,
          idle_intervals: newIntervals,
        })
        .eq("id", shift.id);
    } catch (e) {
      /* fail silent */
    }
  };

  // Activity marker
  const markActive = () => {
    const now = Date.now();
    const wasIdling = idleStartRef.current !== null;
    if (wasIdling) {
      // We were idle — log the gap
      const startedAt = idleStartRef.current;
      idleStartRef.current = null;
      // Only count it as a true idle gap if it exceeded the warn threshold (avoid noise)
      if (now - startedAt > IDLE_WARN_MS) {
        recordIdleInterval(startedAt, now);
      }
    }
    lastActivityRef.current = now;
    setShowWarning(false);
    saveActivity(now);
  };

  // Wire up activity listeners
  useEffect(() => {
    if (!enabled || !shift) return;
    const events = ["mousedown", "touchstart", "keydown", "pointerdown"];
    const handler = () => markActive();
    events.forEach((e) =>
      window.addEventListener(e, handler, { passive: true }),
    );
    // Initial activity stamp on enable
    markActive();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
    };
    // eslint-disable-next-line
  }, [enabled, shift?.id]);

  // Tick: check idle status every 30 seconds
  useEffect(() => {
    if (!enabled || !shift) return;
    const tick = async () => {
      const now = Date.now();
      const sinceActive = now - lastActivityRef.current;

      if (sinceActive >= IDLE_LIMIT_MS) {
        // Past the limit — auto clock out
        if (intervalRef.current) clearInterval(intervalRef.current);
        // Record the idle gap up to the last activity
        if (idleStartRef.current === null)
          idleStartRef.current = lastActivityRef.current;
        await recordIdleInterval(
          idleStartRef.current,
          lastActivityRef.current + IDLE_WARN_MS,
        );
        // Auto-clock-out via callback (caller handles UI + state cleanup)
        if (onAutoClockOut) onAutoClockOut(lastActivityRef.current);
        setShowWarning(false);
      } else if (sinceActive >= IDLE_WARN_MS) {
        // Warning zone — show the warning UI
        if (idleStartRef.current === null)
          idleStartRef.current = lastActivityRef.current;
        setShowWarning(true);
      }
    };
    intervalRef.current = setInterval(tick, 30 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line
  }, [enabled, shift?.id]);

  // On focus / visibility return: check if we should retroactively clock out
  useEffect(() => {
    if (!enabled || !shift) return;
    const check = async () => {
      // Pull fresh last_activity_at from DB
      const { data: s } = await supabase
        .from("shifts")
        .select("last_activity_at, end_time")
        .eq("id", shift.id)
        .maybeSingle();
      if (!s || s.end_time) return; // already ended
      const lastTs = s.last_activity_at
        ? new Date(s.last_activity_at).getTime()
        : null;
      if (!lastTs) return;
      const now = Date.now();
      if (now - lastTs >= IDLE_LIMIT_MS) {
        // Retroactive clock-out
        await recordIdleInterval(lastTs, lastTs + IDLE_WARN_MS);
        if (onAutoClockOut) onAutoClockOut(lastTs);
      } else if (now - lastTs >= IDLE_WARN_MS) {
        setShowWarning(true);
      }
      lastActivityRef.current = lastTs; // reset local clock
    };
    const onFocus = () => check();
    const onVis = () => {
      if (!document.hidden) check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line
  }, [enabled, shift?.id]);

  const dismissWarning = () => {
    lastActivityRef.current = Date.now();
    saveActivity(Date.now());
    idleStartRef.current = null;
    setShowWarning(false);
  };

  return { showWarning, dismissWarning };
}
