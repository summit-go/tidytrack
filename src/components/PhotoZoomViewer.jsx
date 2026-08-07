import React, { useState } from "react";
import { X, Check, AlertCircle, Languages, RotateCcw, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { KIND_CANNOT, FLAG_KINDS } from "../lib/constants.js";
import { fmtDate } from "../lib/format.js";
import { isLead, isLeadOnly } from "../lib/permissions.js";

export function PhotoZoomViewer({
  photos,
  initialUrl,
  onClose,
  onResolveCurrent,
  employee,
  onPhotoResolved,
}) {
  const startIdx = Math.max(
    0,
    photos.findIndex((p) => p.public_url === initialUrl),
  );
  const [idx, setIdx] = useState(startIdx);
  // Local optimistic overlay for resolution state — keyed by photo.id
  // so flipping a photo doesn't require reloading the whole gallery.
  // Values: { resolved_at, resolved_by, resolved_by_kind } or null
  // (null = revert to whatever's on the underlying photo prop).
  const [localResolveById, setLocalResolveById] = useState({});
  const [resolveBusy, setResolveBusy] = useState(false);
  const baseRaw = photos[idx];
  if (!baseRaw) return null;
  // Merge optimistic local state on top of the underlying photo so
  // the UI reflects the change immediately after Mark resolved.
  const photo = localResolveById[baseRaw.id]
    ? { ...baseRaw, ...localResolveById[baseRaw.id] }
    : baseRaw;
  // Owner-side inline resolve flow. Only when:
  //   • caller passed an owner/manager employee
  //   • photo is a flagged kind (damage or couldn't-clean)
  //   • photo isn't already resolved
  //   • caller didn't already wire onResolveCurrent (PM portal does)
  const canSelfResolve =
    !!employee &&
    (isLead(employee)) &&
    FLAG_KINDS.includes(photo.kind) &&
    !photo.resolved_at &&
    !onResolveCurrent;
  const selfResolve = async () => {
    setResolveBusy(true);
    const ts = new Date().toISOString();
    const payload = {
      resolved_at: ts,
      resolved_by: employee.id,
      resolved_by_kind: "employee",
    };
    const { error } = await supabase
      .from("photos")
      .update(payload)
      .eq("id", photo.id);
    setResolveBusy(false);
    if (error) {
      alert("Could not mark resolved: " + error.message);
      return;
    }
    setLocalResolveById((prev) => ({ ...prev, [photo.id]: payload }));
    if (typeof onPhotoResolved === "function") onPhotoResolved(photo, payload);
  };

  // Owner/manager can correct a mis-tagged photo — e.g. a shot marked
  // "Couldn't clean" by mistake. They can re-tag it to the right bucket or
  // delete it outright. Uses local overlay state so the change shows at once.
  const isOwnerMgr =
    !!employee && (isLead(employee));
  const [retagOpen, setRetagOpen] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [gone, setGone] = useState({}); // photo.id -> true (deleted locally)
  const retagPhoto = async (newKind) => {
    setAdminBusy(true);
    const { error } = await supabase
      .from("photos")
      .update({ kind: newKind })
      .eq("id", photo.id);
    setAdminBusy(false);
    setRetagOpen(false);
    if (error) {
      alert("Could not change the tag: " + error.message);
      return;
    }
    // Overlay the new kind locally so the pill/label updates immediately.
    setLocalResolveById((prev) => ({
      ...prev,
      [photo.id]: { ...(prev[photo.id] || {}), kind: newKind },
    }));
    if (typeof onPhotoResolved === "function")
      onPhotoResolved({ ...photo, kind: newKind }, { kind: newKind });
  };
  const deleteThisPhoto = async () => {
    if (!confirm("Delete this photo? It will be removed from the job.")) return;
    setAdminBusy(true);
    // Soft-delete (recoverable), matching the cleaner's delete path.
    const { error } = await supabase
      .from("photos")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", photo.id);
    setAdminBusy(false);
    if (error) {
      alert("Could not delete: " + error.message);
      return;
    }
    setGone((prev) => ({ ...prev, [photo.id]: true }));
    if (typeof onPhotoResolved === "function")
      onPhotoResolved(photo, { deleted_at: new Date().toISOString() });
    // Move off the deleted photo: next one, or close if it was the last.
    if (photos.length <= 1) {
      onClose();
      return;
    }
    setIdx((i) => (i + 1) % photos.length);
  };
  return (
    <div className="fixed inset-0 bg-stone-900/95 z-50 flex flex-col items-center justify-center p-4">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-stone-800 text-stone-50 z-10"
      >
        <X size={20} />
      </button>
      <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-stone-800 text-stone-50 text-xs font-mono z-10">
        {idx + 1} / {photos.length}
      </div>
      <img
        loading="lazy"
        src={photo.public_url}
        alt=""
        className="max-w-full max-h-[80vh] rounded-xl"
      />
      {/* Photo attribution + capture time. Resolves from the joined
         taken_by_employee (set by the multi-cleaner work). Falls back
         to the cleanerName field that BedroomHistoryView enriches
         (shift owner) for legacy / pre-multi-cleaner photos. */}
      {(photo.taken_by_employee?.name || photo.cleanerName) && (
        <div className="mt-3 max-w-md w-full px-4 py-2 rounded-xl bg-stone-800/70 text-stone-100 text-xs font-mono flex items-center justify-between gap-3">
          <span className="truncate">
            by {photo.taken_by_employee?.name || photo.cleanerName}
          </span>
          <span className="text-stone-400 flex-shrink-0 text-right leading-tight">
            {photo.taken_at && (
              <span className="block text-stone-200">
                📷 Taken{" "}
                {new Date(photo.taken_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
            {photo.created_at && (
              <span
                className={`block ${photo.taken_at ? "text-stone-500 text-[10px]" : ""}`}
              >
                {photo.taken_at ? "Uploaded " : ""}
                {fmtDate(photo.created_at)}
              </span>
            )}
          </span>
        </div>
      )}
      {/* Resolved-status pill for damage photos. Shown when the photo
         already has resolved_at (either from server load or our own
         optimistic update). */}
      {FLAG_KINDS.includes(photo.kind) && photo.resolved_at && (
        <div className="mt-3 max-w-md w-full px-4 py-2 rounded-xl bg-emerald-900/70 text-emerald-100 text-xs font-mono flex items-center gap-2">
          <Check size={12} />
          <span className="truncate">
            Resolved {fmtDate(photo.resolved_at)}
          </span>
        </div>
      )}
      {/* Which bucket this came from — matters most for couldn't-clean,
         where the photo alone doesn't explain why it's here. */}
      {photo.kind === KIND_CANNOT && (
        <div className="mt-3 max-w-md w-full px-4 py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-100 text-xs font-mono flex items-center gap-2">
          <AlertCircle size={12} />
          <span>Couldn't clean — the room was not cleaned</span>
        </div>
      )}
      {/* Show the cleaner's note when one is attached — useful for
         damage photos where the note explains what's broken. */}
      {photo.notes && photo.notes.trim() && (
        <div className="mt-3 max-w-md w-full px-4 py-2.5 rounded-xl bg-stone-800/90 text-stone-100 text-sm">
          <div className="text-[10px] uppercase tracking-wider text-stone-400 font-mono mb-0.5">
            Note
          </div>
          {/* When the cleaner wrote in another language we stored an English
             translation at save time. Lead with the English, but keep the
             cleaner's own words underneath — a translation is never the
             record, just the convenience. */}
          {photo.notes_en &&
          photo.notes_en.trim() &&
          photo.notes_en.trim() !== photo.notes.trim() ? (
            <>
              <div className="whitespace-pre-wrap break-words">
                {photo.notes_en}
              </div>
              <div className="mt-2 pt-2 border-t border-stone-700">
                <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-0.5 flex items-center gap-1">
                  <Languages size={9} /> Cleaner's original
                </div>
                <div className="whitespace-pre-wrap break-words text-stone-300 text-[13px]">
                  {photo.notes}
                </div>
              </div>
            </>
          ) : (
            <div className="whitespace-pre-wrap break-words">{photo.notes}</div>
          )}
        </div>
      )}
      <div className="mt-4 flex items-center gap-3 flex-wrap justify-center">
        {photos.length > 1 && (
          <>
            <button
              onClick={() => setIdx((idx - 1 + photos.length) % photos.length)}
              className="px-4 py-2 rounded-full bg-stone-800 text-stone-50 text-sm"
            >
              ← Prev
            </button>
            <button
              onClick={() => setIdx((idx + 1) % photos.length)}
              className="px-4 py-2 rounded-full bg-stone-800 text-stone-50 text-sm"
            >
              Next →
            </button>
          </>
        )}
        {onResolveCurrent && (
          <button
            onClick={() => onResolveCurrent(photo)}
            className="px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium flex items-center gap-2"
          >
            <Check size={14} /> Mark resolved
          </button>
        )}
        {canSelfResolve && (
          <button
            onClick={selfResolve}
            disabled={resolveBusy}
            className="px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <Check size={14} /> {resolveBusy ? "Saving…" : "Mark resolved"}
          </button>
        )}
        {isOwnerMgr && (
          <>
            <div className="relative">
              <button
                onClick={() => setRetagOpen((o) => !o)}
                disabled={adminBusy}
                className="px-4 py-2 rounded-full bg-stone-700 hover:bg-stone-600 text-stone-50 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <RotateCcw size={14} /> Change tag
              </button>
              {retagOpen && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-44 rounded-xl bg-white border border-stone-200 shadow-xl overflow-hidden z-10">
                  {[
                    { k: "before", label: "Before" },
                    { k: "after", label: "After" },
                    { k: "damage", label: "Damage" },
                    { k: KIND_CANNOT, label: "Couldn't clean" },
                  ]
                    .filter((o) => o.k !== photo.kind)
                    .map((o) => (
                      <button
                        key={o.k}
                        onClick={() => retagPhoto(o.k)}
                        disabled={adminBusy}
                        className="w-full text-left px-4 py-2.5 text-sm text-stone-800 hover:bg-stone-50 border-b border-stone-100 last:border-0 disabled:opacity-50"
                      >
                        Change to {o.label}
                      </button>
                    ))}
                </div>
              )}
            </div>
            <button
              onClick={deleteThisPhoto}
              disabled={adminBusy}
              className="px-4 py-2 rounded-full bg-red-700 hover:bg-red-800 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 size={14} /> Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
