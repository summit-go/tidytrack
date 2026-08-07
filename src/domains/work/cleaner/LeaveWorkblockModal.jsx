import React from "react";
import { AlertCircle, Check, ArrowLeft, Pause } from "lucide-react";

export function LeaveWorkblockModal({ onChoose, onClose }) {
  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl flex flex-col">
        <div className="p-5 border-b border-stone-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={20} className="text-amber-600" />
            <div className="font-serif text-xl text-stone-900 font-bold">
              You're in active work
            </div>
          </div>
          <div className="text-sm text-stone-600">
            You're about to leave your current work block. What do you want to
            do?
          </div>
        </div>
        <div className="p-3 space-y-2">
          <button
            onClick={() => onChoose("done")}
            className="w-full p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-left flex items-start gap-3 active:scale-98"
          >
            <Check size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Mark it done</div>
              <div className="text-xs text-emerald-100 mt-0.5">
                Finish this work block and continue
              </div>
            </div>
          </button>
          <button
            onClick={() => onChoose("stay")}
            className="w-full p-4 rounded-2xl bg-stone-900 hover:bg-stone-800 text-stone-50 text-left flex items-start gap-3 active:scale-98"
          >
            <ArrowLeft size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Stay and complete it</div>
              <div className="text-xs text-stone-400 mt-0.5">
                Keep working — don't leave
              </div>
            </div>
          </button>
          <button
            onClick={() => onChoose("pause")}
            className="w-full p-4 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-left flex items-start gap-3 active:scale-98"
          >
            <Pause size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Pause and come back</div>
              <div className="text-xs text-amber-800 mt-0.5">
                Save your progress, return later
              </div>
            </div>
          </button>
        </div>
        <button
          onClick={onClose}
          className="py-3 text-sm font-mono text-stone-500 hover:bg-stone-100 border-t border-stone-200"
        >
          Close
        </button>
      </div>
    </div>
  );
}
