import React from "react";

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  busy = false,
  danger = false,
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] bg-stone-900/70 flex items-center justify-center p-5"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl"
      >
        {title && (
          <div className="font-serif text-lg text-stone-900 mb-1.5">
            {title}
          </div>
        )}
        {message && (
          <div className="text-sm text-stone-600 mb-5 whitespace-pre-wrap">
            {message}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2.5 rounded-full bg-white border border-stone-300 text-stone-700 text-sm font-medium active:scale-95 transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 py-2.5 rounded-full text-white text-sm font-semibold active:scale-95 transition disabled:opacity-50 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-amber-700 hover:bg-amber-800"}`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
