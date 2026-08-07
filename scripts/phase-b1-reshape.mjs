#!/usr/bin/env node
/**
 * Phase B1 — MVP-aligned folder reshape (pure moves + import updates).
 * Run from tidytrack/: node scripts/phase-b1-reshape.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");

/** @type {[string, string][]} oldRel → newRel (relative to src/) */
const MOVES = [
  // auth
  ["apps/staff/SignIn.jsx", "domains/auth/SignIn.jsx"],
  ["apps/staff/ConfigError.jsx", "domains/auth/ConfigError.jsx"],
  ["apps/portal/PortalSignIn.jsx", "domains/auth/PortalSignIn.jsx"],
  ["lib/sessionStore.js", "domains/auth/sessionStore.js"],

  // billing
  ["apps/staff/manager/money/DateRangePicker.jsx", "domains/billing/manager/DateRangePicker.jsx"],
  ["apps/staff/manager/money/ExportView.jsx", "domains/billing/manager/ExportView.jsx"],
  ["apps/staff/manager/money/InvoiceDocument.jsx", "domains/billing/manager/InvoiceDocument.jsx"],
  ["apps/staff/manager/money/InvoiceDraftEditor.jsx", "domains/billing/manager/InvoiceDraftEditor.jsx"],
  ["apps/staff/manager/money/InvoiceList.jsx", "domains/billing/manager/InvoiceList.jsx"],
  ["apps/staff/manager/money/InvoicePaymentsReport.jsx", "domains/billing/manager/InvoicePaymentsReport.jsx"],
  ["apps/staff/manager/money/InvoicePreview.jsx", "domains/billing/manager/InvoicePreview.jsx"],
  ["apps/staff/manager/money/InvoiceView.jsx", "domains/billing/manager/InvoiceView.jsx"],
  ["apps/staff/manager/money/MoneyView.jsx", "domains/billing/manager/MoneyView.jsx"],
  ["apps/staff/manager/money/PriceBookEditor.jsx", "domains/billing/manager/PriceBookEditor.jsx"],
  ["apps/staff/manager/money/ProfitReportView.jsx", "domains/billing/manager/ProfitReportView.jsx"],
  ["apps/staff/manager/money/invoiceAmounts.js", "domains/billing/manager/invoiceAmounts.js"],
  ["apps/portal/PortalInvoicesTab.jsx", "domains/billing/portal/PortalInvoicesTab.jsx"],

  // properties — admin
  ["apps/staff/manager/properties/ApartmentGridBuilder.jsx", "domains/properties/admin/ApartmentGridBuilder.jsx"],
  ["apps/staff/manager/properties/BulkCreateUnits.jsx", "domains/properties/admin/BulkCreateUnits.jsx"],
  ["apps/staff/manager/properties/PartyForm.jsx", "domains/properties/admin/PartyForm.jsx"],
  ["apps/staff/manager/properties/PartyList.jsx", "domains/properties/admin/PartyList.jsx"],
  ["apps/staff/manager/properties/PortalUserAssignmentSection.jsx", "domains/properties/admin/PortalUserAssignmentSection.jsx"],
  ["apps/staff/manager/properties/PropertyAdmin.jsx", "domains/properties/admin/PropertyAdmin.jsx"],
  ["apps/staff/manager/properties/PropertyForm.jsx", "domains/properties/admin/PropertyForm.jsx"],
  ["apps/staff/manager/properties/PropertySetup.jsx", "domains/properties/admin/PropertySetup.jsx"],
  ["apps/staff/manager/properties/PropertyTeamTab.jsx", "domains/properties/admin/PropertyTeamTab.jsx"],
  ["apps/staff/manager/properties/QuickAddPortalUserModal.jsx", "domains/properties/admin/QuickAddPortalUserModal.jsx"],
  ["apps/staff/manager/properties/TownhomeImportBuilder.jsx", "domains/properties/admin/TownhomeImportBuilder.jsx"],
  ["apps/staff/manager/properties/UnitForm.jsx", "domains/properties/admin/UnitForm.jsx"],
  ["apps/staff/manager/properties/UnitList.jsx", "domains/properties/admin/UnitList.jsx"],
  // properties — portal
  ["apps/portal/PortalPropertyPicker.jsx", "domains/properties/portal/PortalPropertyPicker.jsx"],
  ["apps/portal/ChangePortalCodeModal.jsx", "domains/properties/portal/ChangePortalCodeModal.jsx"],
  ["apps/portal/PortalTeamModal.jsx", "domains/properties/portal/PortalTeamModal.jsx"],
  ["apps/portal/PortalHome.jsx", "domains/properties/portal/PortalHome.jsx"],
  ["apps/portal/PortalLangToggle.jsx", "domains/properties/portal/PortalLangToggle.jsx"],

  // work — manager
  ["apps/staff/manager/assignments/AllOpenAssignments.jsx", "domains/work/assignments/AllOpenAssignments.jsx"],
  ["apps/staff/manager/assignments/AssignmentBanner.jsx", "domains/work/assignments/AssignmentBanner.jsx"],
  ["apps/staff/manager/assignments/AssignmentCard.jsx", "domains/work/assignments/AssignmentCard.jsx"],
  ["apps/staff/manager/assignments/AssignmentDetail.jsx", "domains/work/assignments/AssignmentDetail.jsx"],
  ["apps/staff/manager/assignments/AssignmentForm.jsx", "domains/work/assignments/AssignmentForm.jsx"],
  ["apps/staff/manager/assignments/AssignmentList.jsx", "domains/work/assignments/AssignmentList.jsx"],
  ["apps/staff/manager/assignments/AssignmentsTab.jsx", "domains/work/assignments/AssignmentsTab.jsx"],
  ["apps/staff/manager/assignments/CleaningsReportView.jsx", "domains/work/assignments/CleaningsReportView.jsx"],
  ["apps/staff/manager/assignments/CompletedAssignmentsView.jsx", "domains/work/assignments/CompletedAssignmentsView.jsx"],
  ["apps/staff/manager/assignments/QuickAssignmentForm.jsx", "domains/work/assignments/QuickAssignmentForm.jsx"],
  ["apps/staff/manager/dashboard/AdjustmentModal.jsx", "domains/work/dashboard/AdjustmentModal.jsx"],
  ["apps/staff/manager/dashboard/DeleteConfirmModal.jsx", "domains/work/dashboard/DeleteConfirmModal.jsx"],
  ["apps/staff/manager/dashboard/GroupedByPartyView.jsx", "domains/work/dashboard/GroupedByPartyView.jsx"],
  ["apps/staff/manager/dashboard/ManagerDashboard.jsx", "domains/work/dashboard/ManagerDashboard.jsx"],
  ["apps/staff/manager/dashboard/PhotoColumn.jsx", "domains/work/dashboard/PhotoColumn.jsx"],
  ["apps/staff/manager/dashboard/ShiftDetail.jsx", "domains/work/dashboard/ShiftDetail.jsx"],
  ["apps/staff/manager/dashboard/ShiftList.jsx", "domains/work/dashboard/ShiftList.jsx"],
  ["apps/staff/manager/dashboard/ShiftsByCleanerView.jsx", "domains/work/dashboard/ShiftsByCleanerView.jsx"],
  ["apps/staff/manager/dashboard/StatCard.jsx", "domains/work/dashboard/StatCard.jsx"],
  ["apps/staff/manager/dashboard/TaskDetail.jsx", "domains/work/dashboard/TaskDetail.jsx"],
  ["apps/staff/manager/dashboard/TimeEditModal.jsx", "domains/work/dashboard/TimeEditModal.jsx"],
  ["apps/staff/manager/dashboard/WorkBlockDetail.jsx", "domains/work/dashboard/WorkBlockDetail.jsx"],
  ["apps/staff/manager/daily/ActivityTimelineView.jsx", "domains/work/daily/ActivityTimelineView.jsx"],
  ["apps/staff/manager/daily/AssignedVsCleanedView.jsx", "domains/work/daily/AssignedVsCleanedView.jsx"],
  ["apps/staff/manager/daily/BedroomHistoryView.jsx", "domains/work/daily/BedroomHistoryView.jsx"],
  ["apps/staff/manager/daily/DailyCalendar.jsx", "domains/work/daily/DailyCalendar.jsx"],
  ["apps/staff/manager/daily/DailyDayDetail.jsx", "domains/work/daily/DailyDayDetail.jsx"],
  ["apps/staff/manager/daily/DailyUnitDayDetail.jsx", "domains/work/daily/DailyUnitDayDetail.jsx"],
  ["apps/staff/manager/daily/DailyView.jsx", "domains/work/daily/DailyView.jsx"],
  ["apps/staff/manager/daily/DayPhotoTabs.jsx", "domains/work/daily/DayPhotoTabs.jsx"],
  ["apps/staff/manager/daily/WhosWherePanel.jsx", "domains/work/daily/WhosWherePanel.jsx"],

  // work — cross-cutting
  ["apps/cross-cutting/AssignmentTabContent.jsx", "domains/work/cross-cutting/AssignmentTabContent.jsx"],
  ["apps/cross-cutting/AssignmentViewer.jsx", "domains/work/cross-cutting/AssignmentViewer.jsx"],
  ["apps/cross-cutting/AttachmentModal.jsx", "domains/work/cross-cutting/AttachmentModal.jsx"],
  ["apps/cross-cutting/BlockedNoteModal.jsx", "domains/work/cross-cutting/BlockedNoteModal.jsx"],
  ["apps/cross-cutting/ChangePinModal.jsx", "domains/work/cross-cutting/ChangePinModal.jsx"],
  ["apps/cross-cutting/ChecklistAssignmentView.jsx", "domains/work/cross-cutting/ChecklistAssignmentView.jsx"],
  ["apps/cross-cutting/ChecklistAssignmentWizard.jsx", "domains/work/cross-cutting/ChecklistAssignmentWizard.jsx"],
  ["apps/cross-cutting/IdleWarningModal.jsx", "domains/work/cross-cutting/IdleWarningModal.jsx"],
  ["apps/cross-cutting/NextUpModal.jsx", "domains/work/cross-cutting/NextUpModal.jsx"],
  ["apps/cross-cutting/ReassignModal.jsx", "domains/work/cross-cutting/ReassignModal.jsx"],
  ["apps/cross-cutting/RequestNewItemModal.jsx", "domains/work/cross-cutting/RequestNewItemModal.jsx"],
  ["apps/cross-cutting/ReviewAssignmentModal.jsx", "domains/work/cross-cutting/ReviewAssignmentModal.jsx"],
  ["apps/cross-cutting/ReviewLine.jsx", "domains/work/cross-cutting/ReviewLine.jsx"],
  ["apps/cross-cutting/SheetQuickViewModal.jsx", "domains/work/cross-cutting/SheetQuickViewModal.jsx"],
  ["apps/cross-cutting/SpanishTranslationPanel.jsx", "domains/work/cross-cutting/SpanishTranslationPanel.jsx"],
  ["apps/cross-cutting/SuggestedTabContent.jsx", "domains/work/cross-cutting/SuggestedTabContent.jsx"],
  ["apps/cross-cutting/SwitchBedroomModal.jsx", "domains/work/cross-cutting/SwitchBedroomModal.jsx"],
  ["apps/cross-cutting/TranslationOverridesModal.jsx", "domains/work/cross-cutting/TranslationOverridesModal.jsx"],
  ["apps/cross-cutting/WelcomeModal.jsx", "domains/work/cross-cutting/WelcomeModal.jsx"],
  ["apps/cross-cutting/WorkBlockAssignmentLink.jsx", "domains/work/cross-cutting/WorkBlockAssignmentLink.jsx"],

  // work — portal
  ["apps/portal/PortalAssignmentsTab.jsx", "domains/work/portal/PortalAssignmentsTab.jsx"],
  ["apps/portal/PortalAssignmentSection.jsx", "domains/work/portal/PortalAssignmentSection.jsx"],
  ["apps/portal/PortalAssignmentForm.jsx", "domains/work/portal/PortalAssignmentForm.jsx"],
  ["apps/portal/PortalAssignmentDetail.jsx", "domains/work/portal/PortalAssignmentDetail.jsx"],
  ["apps/portal/PortalScheduleTab.jsx", "domains/work/portal/PortalScheduleTab.jsx"],
  ["apps/portal/PortalHistoryTab.jsx", "domains/work/portal/PortalHistoryTab.jsx"],
  ["apps/portal/PortalUnitDay.jsx", "domains/work/portal/PortalUnitDay.jsx"],
  ["apps/portal/RecheckRequestModal.jsx", "domains/work/portal/RecheckRequestModal.jsx"],
  ["apps/portal/ReviewRecheckModal.jsx", "domains/work/portal/ReviewRecheckModal.jsx"],
  ["apps/portal/ResolvedDamageHistory.jsx", "domains/work/portal/ResolvedDamageHistory.jsx"],
  ["apps/portal/PortalPhotoSection.jsx", "domains/work/portal/PortalPhotoSection.jsx"],
  ["apps/portal/PortalPhotoUploadTab.jsx", "domains/work/portal/PortalPhotoUploadTab.jsx"],

  // work — cleaner
  ["apps/staff/cleaner/ActiveWorkblockCard.jsx", "domains/work/cleaner/ActiveWorkblockCard.jsx"],
  ["apps/staff/cleaner/ApartmentProgressList.jsx", "domains/work/cleaner/ApartmentProgressList.jsx"],
  ["apps/staff/cleaner/AssignPicker.jsx", "domains/work/cleaner/AssignPicker.jsx"],
  ["apps/staff/cleaner/AssignmentWorkHistory.jsx", "domains/work/cleaner/AssignmentWorkHistory.jsx"],
  ["apps/staff/cleaner/AssignmentsPanel.jsx", "domains/work/cleaner/AssignmentsPanel.jsx"],
  ["apps/staff/cleaner/BlockView.jsx", "domains/work/cleaner/BlockView.jsx"],
  ["apps/staff/cleaner/ClosedBlockMenu.jsx", "domains/work/cleaner/ClosedBlockMenu.jsx"],
  ["apps/staff/cleaner/EditItemLabelModal.jsx", "domains/work/cleaner/EditItemLabelModal.jsx"],
  ["apps/staff/cleaner/FloorFocusList.jsx", "domains/work/cleaner/FloorFocusList.jsx"],
  ["apps/staff/cleaner/InlineBedroomTasks.jsx", "domains/work/cleaner/InlineBedroomTasks.jsx"],
  ["apps/staff/cleaner/JobPeekModal.jsx", "domains/work/cleaner/JobPeekModal.jsx"],
  ["apps/staff/cleaner/LeaveWorkblockModal.jsx", "domains/work/cleaner/LeaveWorkblockModal.jsx"],
  ["apps/staff/cleaner/LiveCleanersSheet.jsx", "domains/work/cleaner/LiveCleanersSheet.jsx"],
  ["apps/staff/cleaner/MoveBlockModal.jsx", "domains/work/cleaner/MoveBlockModal.jsx"],
  ["apps/staff/cleaner/MoveBlockModalInline.jsx", "domains/work/cleaner/MoveBlockModalInline.jsx"],
  ["apps/staff/cleaner/OtherCleanersActivity.jsx", "domains/work/cleaner/OtherCleanersActivity.jsx"],
  ["apps/staff/cleaner/OtherCleanersTasksPanel.jsx", "domains/work/cleaner/OtherCleanersTasksPanel.jsx"],
  ["apps/staff/cleaner/OtherWorkblocksHere.jsx", "domains/work/cleaner/OtherWorkblocksHere.jsx"],
  ["apps/staff/cleaner/OthersActivityToday.jsx", "domains/work/cleaner/OthersActivityToday.jsx"],
  ["apps/staff/cleaner/PreparingBlockView.jsx", "domains/work/cleaner/PreparingBlockView.jsx"],
  ["apps/staff/cleaner/RequestItemsModal.jsx", "domains/work/cleaner/RequestItemsModal.jsx"],
  ["apps/staff/cleaner/SimpleShiftView.jsx", "domains/work/cleaner/SimpleShiftView.jsx"],
  ["apps/staff/cleaner/TaskCard.jsx", "domains/work/cleaner/TaskCard.jsx"],
  ["apps/staff/cleaner/TaskCategoryPicker.jsx", "domains/work/cleaner/TaskCategoryPicker.jsx"],
  ["apps/staff/cleaner/TodayApartmentsCard.jsx", "domains/work/cleaner/TodayApartmentsCard.jsx"],
  ["apps/staff/cleaner/UndoMoveMenu.jsx", "domains/work/cleaner/UndoMoveMenu.jsx"],
  ["apps/staff/cleaner/ViewOnlyAssignmentsPanel.jsx", "domains/work/cleaner/ViewOnlyAssignmentsPanel.jsx"],
  ["apps/staff/cleaner/ViewOnlyDashboard.jsx", "domains/work/cleaner/ViewOnlyDashboard.jsx"],
  ["apps/staff/cleaner/WhosHerePopup.jsx", "domains/work/cleaner/WhosHerePopup.jsx"],
  ["apps/staff/cleaner/WhosWorkingNowModal.jsx", "domains/work/cleaner/WhosWorkingNowModal.jsx"],
  ["apps/staff/cleaner/YourJobsCard.jsx", "domains/work/cleaner/YourJobsCard.jsx"],
  ["apps/staff/cleaner/CleanerWorkList.jsx", "domains/work/cleaner/CleanerWorkList.jsx"],

  // apps/internal — shells + composers
  ["apps/RootRouter.jsx", "apps/internal/RootRouter.jsx"],
  ["apps/LandingPage.jsx", "apps/internal/LandingPage.jsx"],
  ["apps/staff/StaffApp.jsx", "apps/internal/StaffApp.jsx"],
  ["apps/staff/BetaShell.jsx", "apps/internal/BetaShell.jsx"],
  ["apps/staff/ManagerShell.jsx", "apps/internal/ManagerShell.jsx"],
  ["apps/staff/cleaner/EmployeeApp.jsx", "apps/internal/cleaner/EmployeeApp.jsx"],
  ["apps/staff/cleaner/PropertyPicker.jsx", "apps/internal/cleaner/PropertyPicker.jsx"],
  ["apps/staff/cleaner/PropertyHub.jsx", "apps/internal/cleaner/PropertyHub.jsx"],
  ["apps/staff/cleaner/UnitPicker.jsx", "apps/internal/cleaner/UnitPicker.jsx"],
  ["apps/staff/cleaner/PartyPicker.jsx", "apps/internal/cleaner/PartyPicker.jsx"],
  ["apps/staff/cleaner/SectionPicker.jsx", "apps/internal/cleaner/SectionPicker.jsx"],
  ["apps/staff/cleaner/SearchableUnitPicker.jsx", "apps/internal/cleaner/SearchableUnitPicker.jsx"],
  ["apps/staff/cleaner/BedBathPicker.jsx", "apps/internal/cleaner/BedBathPicker.jsx"],
  ["apps/staff/cleaner/SupplyChecklistGate.jsx", "apps/internal/cleaner/SupplyChecklistGate.jsx"],
  ["apps/staff/cleaner/SupplyChecklistManager.jsx", "apps/internal/cleaner/SupplyChecklistManager.jsx"],
  ["apps/staff/cleaner/ItemsDropdown.jsx", "apps/internal/cleaner/ItemsDropdown.jsx"],
  ["apps/staff/cleaner/CleanerBottomNav.jsx", "apps/internal/cleaner/CleanerBottomNav.jsx"],
  ["apps/staff/cleaner/CleanerMoreExtras.jsx", "apps/internal/cleaner/CleanerMoreExtras.jsx"],
  ["apps/staff/cleaner/CleanerMenuSheet.jsx", "apps/internal/cleaner/CleanerMenuSheet.jsx"],
  ["apps/staff/cleaner/CleanerPropertiesList.jsx", "apps/internal/cleaner/CleanerPropertiesList.jsx"],
  ["apps/staff/manager/team/EmployeeAdmin.jsx", "apps/internal/manager/team/EmployeeAdmin.jsx"],
  ["apps/staff/manager/team/EmployeeForm.jsx", "apps/internal/manager/team/EmployeeForm.jsx"],
  ["apps/staff/manager/team/PortalUserForm.jsx", "apps/internal/manager/team/PortalUserForm.jsx"],
  ["apps/staff/manager/team/PortalUsersAdmin.jsx", "apps/internal/manager/team/PortalUsersAdmin.jsx"],

  // apps/client — portal shells
  ["apps/portal/PortalApp.jsx", "apps/client/PortalApp.jsx"],
  ["apps/portal/PortalDashboard.jsx", "apps/client/PortalDashboard.jsx"],
  ["apps/portal/PortalMenuSheet.jsx", "apps/client/PortalMenuSheet.jsx"],
];

function listSourceFiles(dir = SRC) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(full));
    else if (/\.(jsx?|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function moveFile(oldRel, newRel) {
  const from = path.join(SRC, oldRel);
  const to = path.join(SRC, newRel);
  if (!fs.existsSync(from)) {
    console.warn(`SKIP missing: ${oldRel}`);
    return;
  }
  ensureDir(to);
  fs.renameSync(from, to);
  console.log(`mv ${oldRel} → ${newRel}`);
}

const OLD_TO_NEW = new Map(MOVES);
const NEW_TO_OLD = new Map(MOVES.map(([o, n]) => [n, o]));

/** Resolve a relative import from a virtual (pre-move) src-relative file path. */
function resolveImportFromRel(fromRel, importSpec) {
  if (!importSpec.startsWith(".")) return null;
  const fromDir = path.join(SRC, path.dirname(fromRel));
  const joined = path.normalize(path.join(fromDir, importSpec));
  if (!joined.startsWith(SRC)) return null;

  const candidates = [];
  if (importSpec.endsWith(".jsx") || importSpec.endsWith(".js")) {
    candidates.push(path.relative(SRC, joined).replace(/\\/g, "/"));
  } else {
    candidates.push(
      path.relative(SRC, joined).replace(/\\/g, "/"),
      path.relative(SRC, joined + ".jsx").replace(/\\/g, "/"),
      path.relative(SRC, joined + ".js").replace(/\\/g, "/")
    );
  }

  for (const candidate of candidates) {
    if (OLD_TO_NEW.has(candidate) || fs.existsSync(path.join(SRC, candidate))) {
      return candidate;
    }
  }
  return null;
}

function currentPath(oldRel) {
  return OLD_TO_NEW.get(oldRel) ?? oldRel;
}

function toRelativeImport(fromRel, targetRel) {
  const fromDir = path.dirname(path.join(SRC, fromRel));
  const targetAbs = path.join(SRC, targetRel);
  let rel = path.relative(fromDir, targetAbs).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

function rewriteRelativeImport(fromNewRel, importSpec) {
  const fromOldRel = NEW_TO_OLD.get(fromNewRel) ?? fromNewRel;
  const targetOldRel = resolveImportFromRel(fromOldRel, importSpec);
  if (!targetOldRel) return importSpec;
  const targetNewRel = currentPath(targetOldRel);
  return toRelativeImport(fromNewRel, targetNewRel);
}

function fixImportsInFile(fileAbs) {
  const rel = path.relative(SRC, fileAbs).replace(/\\/g, "/");
  let content = fs.readFileSync(fileAbs, "utf8");
  let changed = false;

  const rewrite = (importSpec) => {
    const next = rewriteRelativeImport(rel, importSpec);
    if (next !== importSpec) changed = true;
    return next;
  };

  content = content.replace(
    /(\bfrom\s+["'])(\.\.?\/[^"']+)(["'])/g,
    (full, prefix, importSpec, suffix) => {
      const newImport = rewrite(importSpec);
      return newImport === importSpec ? full : `${prefix}${newImport}${suffix}`;
    }
  );

  content = content.replace(
    /(\bimport\s*\(\s*["'])(\.\.?\/[^"']+)(["']\s*\))/g,
    (full, prefix, importSpec, suffix) => {
      const newImport = rewrite(importSpec);
      return newImport === importSpec ? full : `${prefix}${newImport}${suffix}`;
    }
  );

  if (changed) {
    fs.writeFileSync(fileAbs, content);
    console.log(`fix imports: ${rel}`);
  }
}

function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(path.join(dir, entry.name));
  }
  if (dir === SRC) return;
  if (fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
    console.log(`rmdir ${path.relative(SRC, dir)}`);
  }
}

function main() {
  console.log("Phase B1 — moving files…");
  for (const [oldRel, newRel] of MOVES) {
    moveFile(oldRel, newRel);
  }

  console.log("\nPhase B1 — fixing imports…");
  for (const file of listSourceFiles()) {
    if (!/\.(jsx?)$/.test(file)) continue;
    fixImportsInFile(file);
  }

  console.log("\nPhase B1 — cleaning empty dirs…");
  removeEmptyDirs(SRC);

  console.log("\nDone. Run: npm run build");
}

main();
