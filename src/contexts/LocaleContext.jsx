import React, { createContext, useContext, useState, useEffect } from "react";
import {
  isTextTranslateConfigured,
  translateText,
  loadTranslationCache,
  saveTranslationCache,
} from "../lib/translation.js";

// =================================================================
// LIVE PAGE TRANSLATION — Spanish toggle for cleaners.
// Walks the DOM, batch-translates text nodes via Google Translate
// API, caches in localStorage to avoid re-translating known strings.
// A MutationObserver re-runs on new content (route changes, modals).
// Locale persists in localStorage and is per-device, not per-user
// (matches the cleaner's preference, doesn't broadcast to PMs).
// =================================================================
export const LocaleContext = createContext({
  locale: "en",
  setLocale: () => {},
});

export function useLocale() {
  return useContext(LocaleContext);
}

export function TranslationProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    try {
      // Saved preference wins; otherwise sniff the device. We accept
      // 'es' / 'es-MX' / 'es-ES' / etc. as Spanish.
      const saved = localStorage.getItem("tidytrack_locale");
      if (saved) return saved;
      const nav =
        (typeof navigator !== "undefined" && navigator.language) || "en";
      if (nav.toLowerCase().startsWith("es")) return "es";
      return "en";
    } catch {
      return "en";
    }
  });

  // Expose locale globally so non-React helpers (tt() in AuthedShift)
  // can read the current language without prop drilling. The Spanish
  // micro-dictionary is populated below so the multi-cleaner prompts
  // ("All items done?", "Delete this photo?") translate.
  useEffect(() => {
    try {
      window.__tidytrack_locale = locale;
      window.__tidytrack_es = {
        // Multi-cleaner prompts (from leaveBlock + deletePhoto)
        "All items done at this bedroom. Finish the workblock?":
          "Todos los elementos están listos en este dormitorio. ¿Terminar el workblock?",
        "Delete this photo? This cannot be reversed.":
          "¿Eliminar esta foto? No se puede deshacer.",
        "You can only delete photos you took.":
          "Solo puedes eliminar fotos que tú tomaste.",
      };
    } catch {}
  }, [locale]);

  const setLocale = (newLocale) => {
    try {
      localStorage.setItem("tidytrack_locale", newLocale);
    } catch {}
    // Switching back to English: easiest reset is a reload, since we
    // mutated text nodes in place and can't reliably restore originals
    // after React re-renders.
    if (newLocale === "en" && locale !== "en") {
      window.location.reload();
      return;
    }
    setLocaleState(newLocale);
  };

  useEffect(() => {
    if (locale !== "es") return;
    if (!isTextTranslateConfigured()) {
      console.warn(
        "[translate] Spanish requested but Google Translate API key not configured",
      );
      return;
    }

    // Don't translate text inside these elements — they're either
    // user-generated content that should stay raw (apartment labels,
    // proper names, IDs) or interactive form values.
    const SKIP_TAGS = new Set([
      "SCRIPT",
      "STYLE",
      "NOSCRIPT",
      "TEXTAREA",
      "INPUT",
      "CODE",
      "PRE",
    ]);
    // Common UI strings that are SHORT and ambiguous — skip to avoid
    // weird machine translations. Apartment labels like "B1-101" or
    // "Bedroom 2" are best left as-is.
    const SKIP_PATTERN =
      /^([A-Z]\d+-?\d*|[a-f0-9-]{8,}|\d+|\d+[:.]?\d*[ap]m?|[\s·•—|/]+)$/i;

    let pending = false;
    const translateVisibleNodes = async () => {
      if (pending) return;
      pending = true;
      try {
        const cache = loadTranslationCache();
        const nodes = [];
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              const text = node.nodeValue;
              if (!text || !text.trim()) return NodeFilter.FILTER_REJECT;
              if (node._ttDone) return NodeFilter.FILTER_REJECT;
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              if (SKIP_TAGS.has(parent.tagName))
                return NodeFilter.FILTER_REJECT;
              if (parent.closest("[data-no-translate]"))
                return NodeFilter.FILTER_REJECT;
              const trimmed = text.trim();
              if (SKIP_PATTERN.test(trimmed)) return NodeFilter.FILTER_REJECT;
              // Skip strings shorter than 2 chars
              if (trimmed.length < 2) return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            },
          },
        );
        while (walker.nextNode()) nodes.push(walker.currentNode);
        if (nodes.length === 0) return;

        const uniqueTexts = [];
        const seen = new Set();
        nodes.forEach((n) => {
          const key = n.nodeValue.trim();
          if (!cache[key] && !seen.has(key)) {
            seen.add(key);
            uniqueTexts.push(key);
          }
        });

        if (uniqueTexts.length > 0) {
          // Batch up to ~100 strings per request (Google limit is 128)
          const BATCH = 100;
          for (let i = 0; i < uniqueTexts.length; i += BATCH) {
            const slice = uniqueTexts.slice(i, i + BATCH);
            try {
              const results = await translateText(slice, "es");
              results.forEach((r, j) => {
                cache[slice[j]] = r.translatedText;
              });
            } catch (e) {
              console.warn("[translate] batch failed", e);
            }
          }
          saveTranslationCache(cache);
        }

        // Apply translations to all gathered nodes
        nodes.forEach((node) => {
          const original = node.nodeValue.trim();
          const translated = cache[original];
          if (translated && translated !== original) {
            // Preserve leading/trailing whitespace from the original
            const leading = node.nodeValue.match(/^\s*/)[0];
            const trailing = node.nodeValue.match(/\s*$/)[0];
            node.nodeValue = leading + translated + trailing;
          }
          node._ttDone = true;
        });
      } finally {
        pending = false;
      }
    };

    // Initial translate
    translateVisibleNodes();

    // Re-run when DOM changes (route changes, modals, new content)
    let raf = null;
    const observer = new MutationObserver(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(translateVisibleNodes);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}
