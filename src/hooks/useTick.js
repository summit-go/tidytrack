import { useState, useEffect } from "react";

export function useTick(active) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    // Only tick while the app is actually on screen — a backgrounded live
    // timer doesn't need to re-render every second (and the elapsed time is
    // recomputed from timestamps on return anyway, so nothing drifts).
    let id = null;
    const start = () => {
      if (id == null) id = setInterval(() => setT((t) => t + 1), 1000);
    };
    const stop = () => {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVis = () => {
      if (document.hidden) stop();
      else {
        setT((t) => t + 1);
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active]);
}
