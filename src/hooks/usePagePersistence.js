import { useState } from "react";

// =================================================================
// PAGE PERSISTENCE — remember the cleaner's current page so refreshing
// or reopening the app drops them back where they were. Stored per-
// device in localStorage under a key the caller picks.
// =================================================================
export function usePagePersistence(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(`tidytrack_page_${key}`);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  const set = (next) => {
    setState(next);
    try {
      localStorage.setItem(`tidytrack_page_${key}`, JSON.stringify(next));
    } catch {}
  };
  return [state, set];
}
