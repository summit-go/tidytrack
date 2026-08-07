import React, { useState } from "react";

export function DueDateEditor({ value, onSave, onCancel, compact = false }) {
  const [draft, setDraft] = useState(value || "");
  const txt = compact ? "text-[10px]" : "text-[11px]";
  const stop = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };
  return (
    <span
      className="inline-flex items-center gap-1 flex-wrap align-middle"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Picking a date saves it right away — the phone's own calendar
         checkmark is the only confirm needed, so there's no separate Save
         button to tap afterward. */}
      <input
        type="date"
        autoFocus
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (e.target.value) onSave(e.target.value);
        }}
        onClick={(e) => e.stopPropagation()}
        className={`${txt} font-mono px-1.5 py-0.5 rounded border border-stone-400 bg-white`}
      />
      {value ? (
        <button
          onClick={(e) => {
            stop(e);
            onSave("");
          }}
          className={`${txt} font-mono px-2 py-0.5 rounded bg-white border border-stone-300 text-stone-600`}
        >
          Clear
        </button>
      ) : null}
      <button
        onClick={(e) => {
          stop(e);
          onCancel();
        }}
        className={`${txt} font-mono px-1.5 py-0.5 text-stone-500`}
      >
        Cancel
      </button>
    </span>
  );
}
