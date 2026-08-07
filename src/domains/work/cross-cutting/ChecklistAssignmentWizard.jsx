import React from "react";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Splash } from "../../../components/Splash.jsx";
import { ProgressBar } from "../../../components/ProgressBar.jsx";
import { useChecklistWizardState } from "../hooks/useChecklistWizardState.js";
import { SheetQuickViewModal } from "./SheetQuickViewModal.jsx";
import { WizardSheetUploadStep } from "./wizard/WizardSheetUploadStep.jsx";
import { WizardUnitPickerStep } from "./wizard/WizardUnitPickerStep.jsx";
import { WizardSheetTypeStep } from "./wizard/WizardSheetTypeStep.jsx";
import { WizardConfigureStep } from "./wizard/WizardConfigureStep.jsx";
import { WizardReviewStep } from "./wizard/WizardReviewStep.jsx";

export function ChecklistAssignmentWizard({
  property,
  employee,
  actorKind = null,
  portalUser = null,
  onCancel,
  onSaved,
}) {
  const wizard = useChecklistWizardState({
    property,
    employee,
    actorKind,
    portalUser,
    onSaved,
  });

  const {
    step,
    setStep,
    units,
    unitSearch,
    setUnitSearch,
    uploadMode,
    setUploadMode,
    parties,
    selectedParties,
    setSelectedParties,
    sheetType,
    setSheetType,
    config,
    setConfig,
    activePartyId,
    setActivePartyId,
    sheetFiles,
    setSheetFiles,
    sheetPreviews,
    templateSet,
    items,
    templateLoading,
    templateError,
    customText,
    setCustomText,
    busy,
    error,
    submitted,
    nextAttempted,
    setNextAttempted,
    quickView,
    setQuickView,
    renamingIdx,
    setRenamingIdx,
    renamingValue,
    setRenamingValue,
    addSheetFiles,
    removeSheetFile,
    renameSheetFile,
    suggestedSheetName,
    ensureConfigShell,
    togglePartySelection,
    setBathroomVariantWithAutofill,
    setGeneralVariant,
    setCleaningType,
    setSheetForBedroom,
    toggleItem,
    addCustomItem,
    removeCustomItem,
    setMode,
    toggleSectionPass,
    toggleSectionFail,
    canAdvanceFromStep,
    sectionsForBedroomComplete,
    submit,
    stepLabels,
    variantsBySection,
    variantBySectionKey,
    itemsForVariant,
  } = wizard;

  if (templateLoading) return <Splash text="Loading templates…" />;
  if (templateError) {
    return (
      <div className="min-h-screen bg-stone-50 px-5 py-6">
        <button onClick={onCancel} className="text-sm text-stone-600 mb-3">
          ← Back
        </button>
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Couldn't load templates</div>
              <div className="text-xs mt-1">{templateError}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-stone-50 pb-[176px]">
        <div className="px-5 py-4 border-b border-stone-200 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => {
                if (step > 0) setStep(step - 1);
                else onCancel();
              }}
              className="p-2 -ml-2 rounded-full hover:bg-stone-100"
              title="Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider font-mono text-stone-500">
                {property.name}
              </div>
              <div className="font-serif text-lg text-stone-900 font-bold">
                New checklist assignment
              </div>
            </div>
          </div>
          <ProgressBar
            steps={stepLabels}
            currentStep={step}
            complete={submitted}
            onStepClick={(targetStep) => {
              if (!submitted) setStep(targetStep);
            }}
          />
        </div>

        <div className="px-5 py-5">
          {step === 0 && (
            <WizardSheetUploadStep
              sheetFiles={sheetFiles}
              sheetPreviews={sheetPreviews}
              renamingIdx={renamingIdx}
              setRenamingIdx={setRenamingIdx}
              renamingValue={renamingValue}
              setRenamingValue={setRenamingValue}
              addSheetFiles={addSheetFiles}
              removeSheetFile={removeSheetFile}
              renameSheetFile={renameSheetFile}
              suggestedSheetName={suggestedSheetName}
              setQuickView={setQuickView}
            />
          )}
          {step === 1 && (
            <WizardUnitPickerStep
              units={units}
              unitSearch={unitSearch}
              setUnitSearch={setUnitSearch}
              uploadMode={uploadMode}
              setUploadMode={setUploadMode}
              parties={parties}
              selectedParties={selectedParties}
              setSelectedParties={setSelectedParties}
              setConfig={setConfig}
              setActivePartyId={setActivePartyId}
              togglePartySelection={togglePartySelection}
              ensureConfigShell={ensureConfigShell}
            />
          )}
          {step === 2 && (
            <WizardSheetTypeStep
              sheetType={sheetType}
              setSheetType={setSheetType}
            />
          )}
          {step === 3 && (
            <WizardConfigureStep
              units={units}
              parties={parties}
              selectedParties={selectedParties}
              config={config}
              setConfig={setConfig}
              activePartyId={activePartyId}
              setActivePartyId={setActivePartyId}
              sheetFiles={sheetFiles}
              setSheetFiles={setSheetFiles}
              sheetPreviews={sheetPreviews}
              sheetType={sheetType}
              templateSet={templateSet}
              items={items}
              templateLoading={templateLoading}
              renamingIdx={renamingIdx}
              setRenamingIdx={setRenamingIdx}
              renamingValue={renamingValue}
              setRenamingValue={setRenamingValue}
              renameSheetFile={renameSheetFile}
              setSheetForBedroom={setSheetForBedroom}
              setQuickView={setQuickView}
              sectionsForBedroomComplete={sectionsForBedroomComplete}
              nextAttempted={nextAttempted}
              setMode={setMode}
              setCleaningType={setCleaningType}
              setBathroomVariantWithAutofill={setBathroomVariantWithAutofill}
              setGeneralVariant={setGeneralVariant}
              toggleSectionPass={toggleSectionPass}
              toggleSectionFail={toggleSectionFail}
              toggleItem={toggleItem}
              addCustomItem={addCustomItem}
              removeCustomItem={removeCustomItem}
              customText={customText}
              setCustomText={setCustomText}
              variantsBySection={variantsBySection}
              variantBySectionKey={variantBySectionKey}
              itemsForVariant={itemsForVariant}
            />
          )}
          {step === 4 && (
            <WizardReviewStep
              sheetFiles={sheetFiles}
              selectedParties={selectedParties}
              parties={parties}
              units={units}
              uploadMode={uploadMode}
              sheetType={sheetType}
              config={config}
              error={error}
              submitted={submitted}
            />
          )}
        </div>

        <div className="fixed bottom-[104px] left-0 right-0 bg-white border-t border-stone-200 px-5 py-3 flex gap-2 z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <button
            onClick={() => {
              if (step > 0) setStep(step - 1);
              else onCancel();
            }}
            className="px-4 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium flex items-center gap-1.5 active:scale-95"
          >
            <ArrowLeft size={14} /> Back
          </button>
          {step < 4 && (
            <button
              onClick={() => {
                if (canAdvanceFromStep()) {
                  setNextAttempted(false);
                  setStep(step + 1);
                } else if (step === 3) {
                  setNextAttempted(true);
                }
              }}
              disabled={step !== 3 && !canAdvanceFromStep()}
              className={`flex-1 py-3 rounded-xl text-sm font-medium ${
                !canAdvanceFromStep() && step === 3
                  ? "bg-stone-400 text-stone-50"
                  : "bg-stone-900 text-stone-50 disabled:opacity-50"
              }`}
            >
              {step === 0 && sheetFiles.length === 0
                ? "Skip & continue"
                : step === 3 && !canAdvanceFromStep()
                  ? "Finish each section first"
                  : "Next"}
            </button>
          )}
          {step === 4 && !submitted && (
            <button
              onClick={submit}
              disabled={busy}
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create assignments"}
            </button>
          )}
        </div>
      </div>
      {quickView && (
        <SheetQuickViewModal
          file={quickView.file}
          url={quickView.url}
          onClose={() => setQuickView(null)}
        />
      )}
    </>
  );
}
