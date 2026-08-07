import React from "react";


export function WizardSheetTypeStep({ sheetType, setSheetType }) {
  const renderSheetTypePicker = () => {
    return (
      <div>
        <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-3">
          Step 3 · Which sheet type?
        </div>
        <div className="space-y-3">
          <button
            onClick={() => setSheetType("cleaning_check")}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-colors ${sheetType === "cleaning_check" ? "bg-amber-50 border-amber-500" : "bg-white border-stone-200 hover:border-stone-400"}`}
          >
            <div className="font-serif text-lg text-stone-900 font-bold">
              Cleaning check
            </div>
          </button>
          <button
            onClick={() => setSheetType("move_out_clean")}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-colors ${sheetType === "move_out_clean" ? "bg-amber-50 border-amber-500" : "bg-white border-stone-200 hover:border-stone-400"}`}
          >
            <div className="font-serif text-lg text-stone-900 font-bold">
              Move-out clean
            </div>
          </button>
        </div>
      </div>
    );
  };

  return renderSheetTypePicker();
}
