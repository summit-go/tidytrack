import React, { useState } from "react";
import { Languages, ChevronRight, AlertCircle } from "lucide-react";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  isTranslateConfigured,
  translateText,
} from "../lib/translation.js";

export function TranslateButton({ texts, defaultTargetLang = "es" }) {
  const [open, setOpen] = useState(false);
  const [targetLang, setTargetLang] = useState(() => {
    try {
      return localStorage.getItem("tt_translate_target") || defaultTargetLang;
    } catch {
      return defaultTargetLang;
    }
  });
  const [translated, setTranslated] = useState(null); // array of { translatedText, detectedSourceLanguage }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!isTranslateConfigured()) return null;
  const inputs = (Array.isArray(texts) ? texts : [texts]).filter(Boolean);
  if (inputs.length === 0) return null;

  const doTranslate = async (lang) => {
    setBusy(true);
    setError("");
    try {
      const out = await translateText(inputs, lang);
      setTranslated(out);
      try {
        localStorage.setItem("tt_translate_target", lang);
      } catch {}
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const langLabel =
    SUPPORTED_TRANSLATE_LANGUAGES.find((l) => l.code === targetLang)?.label ||
    targetLang;

  return (
    <div className="mt-2">
      {!translated ? (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setOpen((o) => !o)}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-mono active:scale-95 transition-all disabled:opacity-50"
          >
            <Languages size={12} />
            {busy ? "Translating…" : "Translate"}
            <ChevronRight
              size={10}
              className={`transition-transform ${open ? "rotate-90" : ""}`}
            />
          </button>
          {open && (
            <select
              autoFocus
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  setTargetLang(e.target.value);
                  doTranslate(e.target.value);
                }
              }}
              disabled={busy}
              className="text-xs font-mono px-2 py-1.5 rounded-lg border border-stone-300 bg-white"
            >
              <option value="" disabled>
                Choose language…
              </option>
              {SUPPORTED_TRANSLATE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <div className="mt-1 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono text-amber-800">
              <Languages size={11} /> Translated to {langLabel}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={targetLang}
                onChange={(e) => {
                  setTargetLang(e.target.value);
                  doTranslate(e.target.value);
                }}
                disabled={busy}
                className="text-[10px] font-mono px-2 py-0.5 rounded border border-amber-300 bg-white"
              >
                {SUPPORTED_TRANSLATE_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setTranslated(null)}
                className="text-[10px] font-mono text-stone-500 hover:text-stone-800"
              >
                Hide
              </button>
            </div>
          </div>
          {busy ? (
            <div className="text-xs text-amber-700 italic">Translating…</div>
          ) : (
            <div className="space-y-2">
              {translated.map((t, i) => (
                <div
                  key={i}
                  className="text-sm text-stone-800 whitespace-pre-wrap"
                >
                  {t.translatedText}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </div>
      )}
    </div>
  );
}
