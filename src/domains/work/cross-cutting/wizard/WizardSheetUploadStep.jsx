import React from "react";
import {
  Camera,
  Edit2,
  Eye,
  FileText,
  X,
} from "lucide-react";

export function WizardSheetUploadStep({
  sheetFiles,
  sheetPreviews,
  renamingIdx,
  setRenamingIdx,
  renamingValue,
  setRenamingValue,
  addSheetFiles,
  removeSheetFile,
  renameSheetFile,
  suggestedSheetName,
  setQuickView,
}) {
  const renderSheetUpload = () => {
    return (
      <div>
        <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-1">
          Step 1 · Attach paper sheets (optional)
        </div>
        <div className="text-sm text-stone-600 mb-4">
          Take photos or attach PDFs of the inspection sheets. You can attach
          more than one — for example, one sheet per bedroom. Cleaners will see
          all sheets inside the assignment. Skip if you don't have them.
        </div>
  
        {/* Already-attached files */}
        {sheetFiles.length > 0 && (
          <div className="space-y-2 mb-3">
            {sheetFiles.map((f, idx) => {
              // Build a blob URL for both images and PDFs so quick-view
              // works for either kind. Reuse the image preview URL when
              // it already exists.
              const viewUrl =
                sheetPreviews[f.name] ||
                (f.type ? URL.createObjectURL(f) : null);
              const isImage = f.type && f.type.startsWith("image/");
              const isRenaming = renamingIdx === idx;
              const suggestion = suggestedSheetName();
              return (
                <div
                  key={`${f.name}-${idx}`}
                  className="p-3 rounded-xl border border-emerald-300 bg-emerald-50"
                >
                  <div className="flex items-center gap-3">
                    {isImage ? (
                      <img
                        src={sheetPreviews[f.name]}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-stone-200 flex items-center justify-center flex-shrink-0">
                        <FileText size={20} className="text-stone-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <input
                          autoFocus
                          value={renamingValue}
                          onChange={(e) => setRenamingValue(e.target.value)}
                          onBlur={() => {
                            renameSheetFile(idx, renamingValue);
                            setRenamingIdx(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              renameSheetFile(idx, renamingValue);
                              setRenamingIdx(null);
                            }
                            if (e.key === "Escape") {
                              setRenamingIdx(null);
                            }
                          }}
                          className="w-full px-2 py-1 rounded-md border border-emerald-400 bg-white text-sm text-stone-900"
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setRenamingIdx(idx);
                            setRenamingValue(f.name.replace(/\.[^.]+$/, ""));
                          }}
                          className="text-sm font-medium text-emerald-900 truncate text-left w-full hover:underline"
                          title="Tap to rename"
                        >
                          {f.name}
                        </button>
                      )}
                      <div className="text-[10px] font-mono text-emerald-700 flex items-center gap-1 mt-0.5">
                        <span>
                          {(f.size / 1024).toFixed(0)} KB ·{" "}
                          {f.type === "application/pdf" ? "PDF" : "Image"}
                        </span>
                        {/* Suggested name button — appears when bedrooms
                           are selected and the current name doesn't
                           already match the suggestion. One tap renames
                           the file. */}
                        {suggestion && !f.name.startsWith(suggestion) && (
                          <button
                            onClick={() => renameSheetFile(idx, suggestion)}
                            className="ml-1 px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 hover:bg-emerald-300"
                            title="Rename using selected apartment/bedroom"
                          >
                            Use: {suggestion}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Rename pencil — alternate way to enter edit mode */}
                    <button
                      onClick={() => {
                        setRenamingIdx(idx);
                        setRenamingValue(f.name.replace(/\.[^.]+$/, ""));
                      }}
                      className="p-2 rounded-lg hover:bg-emerald-100 text-emerald-700 flex-shrink-0"
                      title="Rename"
                    >
                      <Edit2 size={16} />
                    </button>
                    {/* Quick view: opens an overlay preview so the
                       uploader can confirm which sheet is which. Tap
                       the backdrop to close. */}
                    {viewUrl && (
                      <button
                        onClick={() => setQuickView({ file: f, url: viewUrl })}
                        className="p-2 rounded-lg hover:bg-emerald-100 text-emerald-700 flex-shrink-0"
                        title="Quick view"
                      >
                        <Eye size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => removeSheetFile(idx)}
                      className="p-2 rounded-lg hover:bg-red-100 text-red-600 flex-shrink-0"
                      title="Remove"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
  
        {/* Dropzone — always shown, lets uploader add more */}
        <label className="block">
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            multiple
            onChange={(e) => {
              // Snapshot files into a plain array FIRST. Setting
              // e.target.value below wipes e.target.files, so any
              // async (React state) read of it would get nothing.
              const snapshot = Array.from(e.target.files || []);
              e.target.value = ""; // allow re-picking the same file later
              addSheetFiles(snapshot);
            }}
          />
          <div className="px-4 py-6 rounded-2xl border-2 border-dashed border-stone-300 text-center text-stone-600 hover:border-stone-500 cursor-pointer">
            <Camera size={24} className="mx-auto mb-2 text-stone-400" />
            <div className="font-medium text-sm">
              {sheetFiles.length === 0
                ? "Tap to attach sheet photos or PDFs"
                : "Add another sheet"}
            </div>
            <div className="text-xs mt-1 text-stone-500">
              {sheetFiles.length === 0
                ? "Or skip this step"
                : "You can attach as many as you need"}
            </div>
          </div>
        </label>
      </div>
    );
  };

  return renderSheetUpload();
}
