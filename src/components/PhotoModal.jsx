import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  Image as ImageIcon,
  X,
  AlertCircle,
  Check,
  Clock,
  Trash2,
} from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { KIND_CANNOT, photoKindLabel } from "../lib/constants.js";
import { splitTaskName } from "../lib/tasks.js";
import { isLeadOnly } from "../lib/permissions.js";
import { ItemsDropdown } from "../apps/internal/cleaner/ItemsDropdown.jsx";
import { PhotoZoomViewer } from "./PhotoZoomViewer.jsx";

export function PhotoModal({
  kind,
  taskName,
  existing,
  onUpload,
  onSaveNote,
  onClose,
  employee,
  onDeletePhoto,
  onChangeKind,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Track the most recently uploaded photo so we can attach an
  // optional note to it. Only used for damage photos — a quick
  // "what's broken" detail that PMs / owners will see alongside
  // the image. Notes are never required.
  const [lastUploaded, setLastUploaded] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  // When the cleaner taps an existing photo in the grid, open the
  // full-screen zoom viewer so they can inspect detail + read notes.
  const [zoomPhoto, setZoomPhoto] = useState(null);
  // Which bucket's photos are shown in the grid. Defaults to the kind the
  // modal opened with (or 'before' for the single-camera flow). Clicking a
  // bucket tab shows only that bucket's photos.
  const [bucketTab, setBucketTab] = useState(kind || "before");
  // Drag-and-drop: which photo id is being dragged (for the drop targets).
  const [dragId, setDragId] = useState(null);
  const inputRef = useRef(null);
  const existingPhotos = Array.isArray(existing) ? existing : [];
  // "Couldn't clean" gets its own yellow treatment so a cleaner glancing
  // at the sheet knows immediately which bucket they're in.
  const isCannot = kind === KIND_CANNOT;
  const tone = isCannot
    ? {
        box: "bg-yellow-50 border-yellow-300",
        label: "text-yellow-900",
        input: "border-yellow-400 focus:border-yellow-600",
        btn: "bg-yellow-600 hover:bg-yellow-700",
      }
    : kind === "damage"
      ? {
          box: "bg-amber-50 border-amber-200",
          label: "text-amber-800",
          input: "border-amber-300 focus:border-amber-600",
          btn: "bg-amber-700 hover:bg-amber-800",
        }
      : {
          box: "bg-stone-50 border-stone-200",
          label: "text-stone-700",
          input: "border-stone-300 focus:border-stone-600",
          btn: "bg-stone-700 hover:bg-stone-800",
        };

  // "Took extra" flag per photo — cleaner marks a photo of an item
  // (tub, fridge, oven…) that took extra work. Shows for owner + PM.
  const [extraFlags, setExtraFlags] = useState({});
  useEffect(() => {
    const m = {};
    existingPhotos.forEach((p) => {
      m[p.id] = !!p.took_extra;
    });
    setExtraFlags(m);
    /* eslint-disable-next-line */
  }, [existing]);
  const toggleExtra = async (p) => {
    const next = !extraFlags[p.id];
    setExtraFlags((prev) => ({ ...prev, [p.id]: next }));
    const { error: e } = await supabase
      .from("photos")
      .update({ took_extra: next })
      .eq("id", p.id);
    if (e) setExtraFlags((prev) => ({ ...prev, [p.id]: !next })); // revert on failure
  };

  const handleFile = async (e) => {
    const files = Array.from(e.target.files || []);
    // Reset the input so picking the same file(s) again still triggers.
    if (e.target) e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError("");
    setNoteSaved(false);
    let last = null;
    let failed = 0;
    try {
      // Upload each selected photo in turn (gallery multi-select or one shot).
      // Uploads go into the CURRENTLY SELECTED bucket tab, so the cleaner
      // chooses before/after/damage/couldn't-clean up front (no auto-assign).
      for (const file of files) {
        try {
          const uploaded = await onUpload(file, bucketTab);
          if (uploaded && uploaded.id) last = uploaded;
        } catch (err) {
          failed++;
          console.warn("[photo] one upload failed", err);
        }
      }
      if (last) {
        setLastUploaded(last);
        setNoteDraft("");
        if (last.kind) setBucketTab(last.kind);
      }
      if (failed)
        setError(
          `${failed} photo${failed === 1 ? "" : "s"} failed to upload. The rest went through.`,
        );
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    if (!lastUploaded?.id || !onSaveNote) return;
    setSavingNote(true);
    setError("");
    try {
      await onSaveNote(lastUploaded.id, noteDraft.trim(), kind);
      setNoteSaved(true);
      // Keep the textarea contents so the user can see what they just
      // saved. The "Saved" indicator goes away when they upload another.
    } catch (err) {
      setError(err?.message || "Could not save note.");
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[85vh] flex flex-col"
        style={{ touchAction: "manipulation" }}
      >
        <div className="flex items-start justify-between p-5 border-b border-stone-200 gap-3">
          <div className="min-w-0 flex-1">
            <div
              className={`text-xs uppercase tracking-wider font-mono ${isCannot ? "text-yellow-700 font-bold" : "text-stone-500"}`}
            >
              {kind ? `${photoKindLabel(kind)} photo` : "Add photo"}
            </div>
            {(() => {
              const nameParts = splitTaskName(taskName || "");
              if (nameParts.length > 1) {
                return (
                  <>
                    <div className="font-serif text-lg text-stone-900 leading-tight">
                      {nameParts.length} tasks
                    </div>
                    <ItemsDropdown items={nameParts} />
                  </>
                );
              }
              return (
                <div className="font-serif text-xl text-stone-900 break-words">
                  {taskName}
                </div>
              );
            })()}
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-2 rounded-full hover:bg-stone-100 disabled:opacity-50 flex-shrink-0"
          >
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {/* One-line explainer for the newest bucket — it's the only one
             whose meaning isn't obvious from the word alone. */}
          {isCannot && (
            <div className="mb-4 p-3 rounded-xl bg-yellow-50 border border-yellow-300 text-[13px] text-yellow-900">
              Use this when you{" "}
              <span className="font-bold">could not clean</span> the room —
              someone wouldn't let you in, the door was locked, pets were loose,
              or it was too full to work in. Take a photo of what stopped you,
              then add a note if you can. Your manager and the property manager
              both see it.
            </div>
          )}
          {(() => {
            const BUCKETS = [
              {
                k: "before",
                label: "Before",
                active: "bg-stone-900 text-white border-stone-900",
              },
              {
                k: "after",
                label: "After",
                active: "bg-stone-900 text-white border-stone-900",
              },
              {
                k: "damage",
                label: "Damage",
                active: "bg-red-600 text-white border-red-600",
              },
              {
                k: KIND_CANNOT,
                label: "Couldn't clean",
                active: "bg-yellow-500 text-white border-yellow-500",
              },
            ];
            const countFor = (k) =>
              existingPhotos.filter((p) => p.kind === k).length;
            const shown = existingPhotos.filter((p) => p.kind === bucketTab);
            return (
              <div className="mb-4">
                <div className="text-[11px] uppercase tracking-wider font-mono text-stone-500 mb-1.5">
                  Which bucket?
                </div>
                {/* Bucket tabs — tap to choose which bucket you're adding to /
                   viewing. Also drop targets: drag a photo onto a tab to move
                   it there. The cleaner picks the bucket BEFORE taking or
                   uploading, so nothing auto-assigns. */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  {BUCKETS.map((b) => (
                    <button
                      key={b.k}
                      onClick={() => setBucketTab(b.k)}
                      onDragOver={(e) => {
                        if (dragId) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragId && onChangeKind) {
                          onChangeKind(dragId, b.k);
                          setBucketTab(b.k);
                        }
                        setDragId(null);
                      }}
                      className={`text-[11px] uppercase tracking-wider font-mono px-2.5 py-1.5 rounded-full border transition flex items-center gap-1 ${
                        bucketTab === b.k
                          ? b.active
                          : "bg-white text-stone-500 border-stone-300 hover:bg-stone-100"
                      } ${dragId ? "ring-2 ring-offset-1 ring-stone-400" : ""}`}
                    >
                      {b.label}{" "}
                      <span className="opacity-70">({countFor(b.k)})</span>
                    </button>
                  ))}
                </div>
                {onChangeKind && existingPhotos.length > 0 && (
                  <div className="text-[11px] text-stone-500 mb-2">
                    Drag a photo onto a bucket to move it there.
                  </div>
                )}
                {shown.length === 0 ? (
                  <div className="text-center py-4 text-stone-400 text-xs border-2 border-dashed border-stone-200 rounded-xl mb-2">
                    No{" "}
                    {BUCKETS.find(
                      (b) => b.k === bucketTab,
                    )?.label.toLowerCase()}{" "}
                    photos yet — take or upload one below.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {shown.map((p) => {
                      const canDelete =
                        !!onDeletePhoto &&
                        (employee?.role === "owner" ||
                          isLeadOnly(employee) ||
                          p.taken_by === employee?.id);
                      return (
                        <div
                          key={p.id}
                          className="relative"
                          draggable={!!onChangeKind}
                          onDragStart={() => setDragId(p.id)}
                          onDragEnd={() => setDragId(null)}
                        >
                          <button
                            type="button"
                            onClick={() => setZoomPhoto(p)}
                            className={`block aspect-square w-full rounded-xl overflow-hidden active:opacity-80 transition-opacity ${dragId === p.id ? "opacity-40" : ""}`}
                          >
                            <img
                              src={p.public_url}
                              alt=""
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExtra(p);
                            }}
                            className={`absolute top-1.5 left-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-md ${extraFlags[p.id] ? "bg-amber-500 text-white border border-amber-400" : "bg-white text-amber-700 border-2 border-amber-400"}`}
                          >
                            <Clock size={12} />{" "}
                            {extraFlags[p.id] ? "Extra ✓" : "+ Mark extra"}
                          </button>
                          {(p.taken_by || canDelete) && (
                            <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-stone-900/80 to-transparent rounded-b-xl flex items-end justify-between gap-2">
                              <div className="text-[10px] font-mono text-stone-100 truncate">
                                {p.taken_by === employee?.id
                                  ? "by you"
                                  : p.taken_by_employee?.name
                                    ? `by ${p.taken_by_employee.name}`
                                    : p.taken_by
                                      ? "shared"
                                      : ""}
                              </div>
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeletePhoto(p.id);
                                  }}
                                  className="p-1 rounded-full bg-stone-900/70 hover:bg-red-700 text-stone-100 hover:text-white"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
          {error && (
            <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {/* Damage-only: optional note input that shows up after the
             cleaner uploads a photo. Pre-upload, it's a hint message;
             post-upload, it becomes a real save-note input pointing at
             the photo they just took. */}
          {/* Note prompt — appears after any photo upload (before /
             after / damage / etc.). Notes are always optional but
             useful context for the PM/owner to see alongside the
             image. Damage notes use the most assertive copy since
             they're the highest-priority reason to add one. */}
          {lastUploaded && onSaveNote && (
            <div className={`mb-3 p-3 rounded-xl border ${tone.box}`}>
              <div
                className={`text-xs uppercase tracking-wider font-mono mb-1.5 ${tone.label}`}
              >
                Add a note (optional)
              </div>
              {isCannot && (
                <div className="text-[11px] text-yellow-800 mb-1.5">
                  Write it in whatever language you like — we translate it to
                  English for the property manager automatically.
                </div>
              )}
              <textarea
                value={noteDraft}
                onChange={(e) => {
                  setNoteDraft(e.target.value);
                  setNoteSaved(false);
                }}
                disabled={savingNote}
                rows={3}
                placeholder={
                  isCannot
                    ? "What stopped you? Which room? Did anyone tell you something?"
                    : kind === "damage"
                      ? "What's damaged? Where exactly? Any context that helps the PM understand."
                      : kind === "before"
                        ? "Any details about the state when you started."
                        : kind === "after"
                          ? "Any details about what you cleaned or special handling."
                          : "A short note about this photo."
                }
                className={`w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none resize-none disabled:opacity-60 ${tone.input}`}
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={saveNote}
                  disabled={savingNote || !noteDraft.trim()}
                  className={`px-3 py-1.5 rounded-lg text-white text-xs font-medium disabled:opacity-50 ${tone.btn}`}
                >
                  {savingNote ? "Saving…" : noteSaved ? "Saved" : "Save note"}
                </button>
                {noteSaved && (
                  <span className="text-[11px] text-emerald-700 font-mono flex items-center gap-1">
                    <Check size={11} /> Attached to the photo
                  </span>
                )}
                <span className="text-[11px] text-stone-500 ml-auto">
                  Skipping is fine
                </span>
              </div>
            </div>
          )}
          {busy ? (
            <div className="block w-full p-8 border-2 border-dashed border-amber-300 bg-amber-50 rounded-2xl text-center">
              <div className="w-8 h-8 mx-auto mb-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-stone-700 font-medium">Uploading…</div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="text-[11px] uppercase tracking-wider font-mono text-stone-500">
                Adding to{" "}
                <span
                  className={`font-bold ${bucketTab === "damage" ? "text-red-600" : bucketTab === KIND_CANNOT ? "text-yellow-700" : "text-stone-800"}`}
                >
                  {photoKindLabel(bucketTab)}
                </span>{" "}
                — tap a bucket above to change
              </div>
              {/* Take a live photo with the camera. */}
              <label className="block w-full p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-colors border-stone-300 hover:border-stone-900">
                <Camera size={28} className="mx-auto mb-2 text-stone-400" />
                <div className="text-stone-700 font-medium">
                  {lastUploaded ? "Take another photo" : "Take a photo"}
                </div>
                <div className="text-xs text-stone-500">Opens the camera</div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFile}
                  disabled={busy}
                  className="hidden"
                />
              </label>
              {/* Upload existing photos from the gallery — several at once. */}
              <label className="block w-full p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-colors border-stone-300 hover:border-stone-900">
                <ImageIcon size={28} className="mx-auto mb-2 text-stone-400" />
                <div className="text-stone-700 font-medium">
                  Upload from gallery
                </div>
                <div className="text-xs text-stone-500">
                  Pick one or several photos you already took
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFile}
                  disabled={busy}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>
        <div className="p-5 border-t border-stone-200">
          <button
            onClick={onClose}
            disabled={busy}
            className="w-full py-3.5 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 transition-transform disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>
      {/* Tap any existing photo to zoom and inspect detail. The zoom
         viewer also surfaces the photo's note (when present). */}
      {zoomPhoto && (
        <PhotoZoomViewer
          photos={existingPhotos}
          initialUrl={zoomPhoto.public_url}
          onClose={() => setZoomPhoto(null)}
          employee={employee}
        />
      )}
    </div>
  );
}
