import React, { useState } from "react";
import { Languages } from "lucide-react";
import { isTextTranslateConfigured, translateText } from "../lib/translation.js";

export function TranslatableText({ text, targetLang = "en", className = "" }) {
  const [translated, setTranslated] = useState(null); // { text, sourceLang } | null
  const [showTranslation, setShowTranslation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!text || !text.trim()) return null;
  const canTranslate = isTextTranslateConfigured();

  const onToggle = async () => {
    setError(null);
    if (translated) {
      // Already fetched — just flip the view
      setShowTranslation((s) => !s);
      return;
    }
    setBusy(true);
    try {
      const results = await translateText([text], targetLang);
      const first = results[0];
      if (!first) throw new Error("No translation returned.");
      // If detected source matches target, the translation is the same as original.
      // Inform the user rather than showing identical text.
      if (first.detectedSourceLanguage === targetLang) {
        setError(
          `This text is already in ${targetLang === "en" ? "English" : "Spanish"}.`,
        );
        setBusy(false);
        return;
      }
      setTranslated({
        text: first.translatedText,
        sourceLang: first.detectedSourceLanguage,
      });
      setShowTranslation(true);
    } catch (e) {
      setError(e.message || "Translation failed.");
    } finally {
      setBusy(false);
    }
  };

  const visibleText = showTranslation && translated ? translated.text : text;
  const sourceLangLabel =
    translated?.sourceLang === "es"
      ? "Spanish"
      : translated?.sourceLang === "en"
        ? "English"
        : translated?.sourceLang || "original";

  return (
    <span className={className}>
      <span>{visibleText}</span>
      {canTranslate && (
        <button
          onClick={onToggle}
          disabled={busy}
          type="button"
          className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 text-[9px] font-mono uppercase tracking-wider align-middle disabled:opacity-50"
        >
          <Languages size={9} />
          {busy
            ? "…"
            : showTranslation
              ? `Show ${sourceLangLabel}`
              : translated
                ? `Show ${targetLang === "en" ? "English" : "Spanish"}`
                : `Translate`}
        </button>
      )}
      {error && (
        <span className="ml-1.5 text-[9px] font-mono text-amber-700 italic">
          ({error})
        </span>
      )}
    </span>
  );
}
