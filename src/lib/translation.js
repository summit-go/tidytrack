import { supabase } from './supabase.js';

// =================================================================
// 🌍 GOOGLE TRANSLATE API KEY (optional — for the Translate button)
// Restrict the key to HTTP referrers app.gosummitclean.com + tidytrack-ten.vercel.app
// and restrict to the Cloud Translation API only.
// If empty, the Translate button is hidden.
// =================================================================
const GOOGLE_TRANSLATE_API_KEY = "AIzaSyD7ceHPryMzs45hWJOyFNBxtOzQOEmJcSA";

export const SUPPORTED_TRANSLATE_LANGUAGES = [
  { code: 'es', label: 'Spanish' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'fr', label: 'French' },
  { code: 'zh', label: 'Chinese' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'tl', label: 'Tagalog' },
  { code: 'ru', label: 'Russian' },
  { code: 'ar', label: 'Arabic' },
];

// Translation is disabled — flip to `true` to re-enable the auto-translate
// pipeline and the Translate button on assignments. When false, all translation
// UI is hidden and no API calls are made (regardless of the API key).
export const TRANSLATION_ENABLED = false;
// Text-only translation for short content (cleaner notes, task names).
// This is independent from TRANSLATION_ENABLED (which gates the full
// PDF/image document translation pipeline that's currently dormant).
// Text translation is cheap and useful so it's on by default; gates
// downstream still check for a valid API key.
export const TEXT_TRANSLATION_ENABLED = true;

export const isTranslateConfigured = () =>
  TRANSLATION_ENABLED &&
  GOOGLE_TRANSLATE_API_KEY &&
  GOOGLE_TRANSLATE_API_KEY !== 'PASTE_YOUR_GOOGLE_TRANSLATE_KEY_HERE' &&
  GOOGLE_TRANSLATE_API_KEY.length > 10;

// Lighter gate for short-text translation. Doesn't require the master
// document-translation flag, but still needs a real API key.
export const isTextTranslateConfigured = () =>
  TEXT_TRANSLATION_ENABLED &&
  GOOGLE_TRANSLATE_API_KEY &&
  GOOGLE_TRANSLATE_API_KEY !== 'PASTE_YOUR_GOOGLE_TRANSLATE_KEY_HERE' &&
  GOOGLE_TRANSLATE_API_KEY.length > 10;

// Translate one or more strings via Google Cloud Translation API v2.
// Returns array of { translatedText, detectedSourceLanguage } in the same order.
export async function translateText(strings, targetLang) {
  if (!isTextTranslateConfigured()) throw new Error('Translation is not configured.');
  const inputs = (Array.isArray(strings) ? strings : [strings]).filter(s => s && s.trim());
  if (inputs.length === 0) return [];
  const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;
  const body = { q: inputs, target: targetLang, format: 'text' };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Translation failed (${res.status})`);
  }
  const data = await res.json();
  return (data?.data?.translations || []).map(t => ({
    translatedText: t.translatedText,
    detectedSourceLanguage: t.detectedSourceLanguage,
  }));
}

// In-memory cache so we don't hit localStorage on every node check.
let _ttTranslationCache = null;
export function loadTranslationCache() {
  if (_ttTranslationCache) return _ttTranslationCache;
  try {
    _ttTranslationCache = JSON.parse(localStorage.getItem('tidytrack_translations_es') || '{}');
  } catch { _ttTranslationCache = {}; }
  return _ttTranslationCache;
}
export function saveTranslationCache(cache) {
  _ttTranslationCache = cache;
  try { localStorage.setItem('tidytrack_translations_es', JSON.stringify(cache)); } catch {}
}

// Convert a fetched Blob to base64 (strips the data: prefix).
export async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result;
      // result is "data:<mime>;base64,<actual-base64>"
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(blob);
  });
}

// OCR an attachment via Google Cloud Vision API.
// Returns the extracted full text, or '' if nothing readable found.
// Throws on hard errors (network, auth, etc) so callers can handle.
export async function extractTextFromAttachment(fileUrl, fileKind) {
  if (!isTranslateConfigured()) throw new Error('Translation is not configured.');
  // 1. Fetch the file as a Blob
  let resp;
  try {
    resp = await fetch(fileUrl);
  } catch (e) {
    throw new Error(`Could not fetch attachment from storage: ${e.message || 'network error'}`);
  }
  if (!resp.ok) throw new Error(`Could not fetch attachment (HTTP ${resp.status})`);
  const blob = await resp.blob();
  // Sanity cap — Cloud Vision has a 20MB limit for synchronous calls
  if (blob.size > 20 * 1024 * 1024) {
    throw new Error('Attachment too large for OCR (over 20MB).');
  }
  const base64 = await blobToBase64(blob);

  const isPdf = fileKind === 'pdf' || blob.type === 'application/pdf';

  if (isPdf) {
    // PDFs use the files:annotate endpoint with mimeType
    const url = `https://vision.googleapis.com/v1/files:annotate?key=${GOOGLE_TRANSLATE_API_KEY}`;
    const body = {
      requests: [{
        inputConfig: {
          content: base64,
          mimeType: 'application/pdf',
        },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        // Limit to first 5 pages to keep costs/time reasonable
        pages: [1, 2, 3, 4, 5],
      }]
    };
    const apiResp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!apiResp.ok) {
      const err = await apiResp.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Vision API (PDF) failed (HTTP ${apiResp.status})`);
    }
    const data = await apiResp.json();
    // Response shape: data.responses[0].responses[] (one per page)
    const pages = data?.responses?.[0]?.responses || [];
    const allText = pages.map(p => p?.fullTextAnnotation?.text || '').filter(Boolean).join('\n\n');
    return allText;
  } else {
    // Images use the simpler images:annotate endpoint
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_TRANSLATE_API_KEY}`;
    const body = {
      requests: [{
        image: { content: base64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
      }]
    };
    const apiResp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!apiResp.ok) {
      const err = await apiResp.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Vision API failed (HTTP ${apiResp.status})`);
    }
    const data = await apiResp.json();
    const annotation = data?.responses?.[0]?.fullTextAnnotation;
    return annotation?.text || '';
  }
}

// Run the full auto-translation pipeline for an uploaded assignment:
//   fetch attachment → OCR → translate to Spanish → save back to DB.
// Called fire-and-forget after upload; never blocks the UI.
export async function autoTranslateAssignment(assignmentId, fileUrl, fileKind) {
  if (!isTranslateConfigured()) {
    console.warn('[auto-translate] skipped — translation not configured');
    return;
  }
  console.log('[auto-translate] starting for', assignmentId, fileKind);
  try {
    await supabase.from('assignments')
      .update({ translation_status: 'processing' })
      .eq('id', assignmentId);
    console.log('[auto-translate] OCR step…');
    const text = await extractTextFromAttachment(fileUrl, fileKind);
    console.log('[auto-translate] OCR returned', text.length, 'chars');
    if (!text || text.trim().length < 3) {
      // Nothing readable in the attachment
      await supabase.from('assignments')
        .update({ extracted_text: text || '', translation_status: 'skipped' })
        .eq('id', assignmentId);
      return;
    }
    console.log('[auto-translate] translation step…');
    const translations = await translateText([text], 'es');
    const spanish = translations?.[0]?.translatedText || '';
    console.log('[auto-translate] saved Spanish version:', spanish.slice(0, 80) + '…');
    await supabase.from('assignments')
      .update({
        extracted_text: text,
        spanish_translation: spanish,
        translation_status: 'done',
        translation_error: null,
      })
      .eq('id', assignmentId);
  } catch (e) {
    console.error('[auto-translate] FAILED for assignment', assignmentId, e);
    try {
      await supabase.from('assignments')
        .update({
          translation_status: 'failed',
          translation_error: (e?.message || String(e)).slice(0, 500),
        })
        .eq('id', assignmentId);
    } catch {}
  }
}
