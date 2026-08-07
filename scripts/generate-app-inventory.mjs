#!/usr/bin/env node
/**
 * Generates ai/inventories/app-jsx-symbols.{json,md} from src/App.jsx.
 * Regenerate when App.jsx changes during the pre-split baseline.
 *
 * Usage: node scripts/generate-app-inventory.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_PATH = path.join(ROOT, "src/App.jsx");
const OUT_DIR = path.join(ROOT, "ai/inventories");

/** Symbols explicitly named in the split plan phase checklist. */
const PLANNED_TARGETS = {
  // A1 lib/supabase.js
  secureEmployeeSignIn: "src/lib/supabase.js",
  securePortalSignIn: "src/lib/supabase.js",
  secureSetCredential: "src/lib/supabase.js",
  supabase: "src/lib/supabase.js",
  SUPABASE_URL: "src/lib/supabase.js",
  SUPABASE_ANON_KEY: "src/lib/supabase.js",
  GOOGLE_TRANSLATE_API_KEY: "src/lib/translation.js",
  PHOTO_BUCKET: "src/lib/supabase.js",
  ASSIGNMENT_BUCKET: "src/lib/supabase.js",
  PM_UPLOAD_BUCKET: "src/lib/supabase.js",
  MESSAGE_BUCKET: "src/lib/supabase.js",
  uploadAssignmentFile: "src/lib/supabase.js",
  uploadPmFile: "src/lib/supabase.js",
  deletePmFile: "src/lib/supabase.js",
  uploadMessagePhoto: "src/lib/supabase.js",
  deleteMessagePhoto: "src/lib/supabase.js",
  saveAssignees: "src/lib/supabase.js",
  fetchLivePresence: "src/lib/supabase.js",
  createNotification: "src/lib/supabase.js",
  clearPmAssignmentNotification: "src/lib/supabase.js",
  clearAssignmentBroadcast: "src/lib/supabase.js",
  // A1 lib/constants.js
  ASSIGNMENT_TYPES: "src/lib/constants.js",
  TASK_CATEGORIES: "src/lib/constants.js",
  CAPABILITIES: "src/lib/constants.js",
  PHOTO_KIND_LABELS: "src/lib/constants.js",
  FLAG_KINDS: "src/lib/constants.js",
  INVOICE_DESCR: "src/lib/constants.js",
  INVOICE_TYPE_LABEL: "src/lib/constants.js",
  INVOICE_STATUS_STYLE: "src/lib/constants.js",
  SUMMIT_COMPANY: "src/lib/constants.js",
  // A1 lib/permissions.js
  can: "src/lib/permissions.js",
  isOwner: "src/lib/permissions.js",
  isManager: "src/lib/permissions.js",
  canSeeMoney: "src/lib/permissions.js",
  visibleProps: "src/lib/permissions.js",
  // A1 lib/format.js
  fmtTime: "src/lib/format.js",
  fmtTimeShort: "src/lib/format.js",
  fmtMoney: "src/lib/format.js",
  fmtDate: "src/lib/format.js",
  fmtDateLong: "src/lib/format.js",
  fmtDateWithDay: "src/lib/format.js",
  fmtDueDate: "src/lib/format.js",
  fmtClock: "src/lib/format.js",
  fmtInvoiceDate: "src/lib/format.js",
  localTodayKey: "src/lib/format.js",
  localDayKey: "src/lib/format.js",
  toDateKey: "src/lib/format.js",
  greetingForTime: "src/lib/format.js",
  // A1 lib/compare.js
  naturalCompare: "src/lib/compare.js",
  buildingFromLabel: "src/lib/compare.js",
  floorFromLabel: "src/lib/compare.js",
  buildingKey: "src/lib/compare.js",
  // A1 lib/photos.js
  compressImage: "src/lib/photos.js",
  buildZipBlob: "src/lib/photos.js",
  photoFilename: "src/lib/photos.js",
  _crc32: "src/lib/photos.js",
  _strBytes: "src/lib/photos.js",
  canShareFiles: "src/lib/photos.js",
  // A1 lib/sessionStore.js
  sessionStore: "src/lib/sessionStore.js",
  // A1 lib/translation.js
  loadTranslationCache: "src/lib/translation.js",
  saveTranslationCache: "src/lib/translation.js",
  SUPPORTED_TRANSLATE_LANGUAGES: "src/lib/translation.js",
  isTranslateConfigured: "src/lib/translation.js",
  isTextTranslateConfigured: "src/lib/translation.js",
  TRANSLATION_ENABLED: "src/lib/translation.js",
  TEXT_TRANSLATION_ENABLED: "src/lib/translation.js",
  translateText: "src/lib/translation.js",
  blobToBase64: "src/lib/translation.js",
  extractTextFromAttachment: "src/lib/translation.js",
  autoTranslateAssignment: "src/lib/translation.js",
  // A2 hooks
  useAssignmentSync: "src/hooks/useAssignmentSync.js",
  useIdleDetector: "src/hooks/useIdleDetector.js",
  usePagePersistence: "src/hooks/usePagePersistence.js",
  useItemLabelOverrides: "src/hooks/useItemLabelOverrides.js",
  useTick: "src/hooks/useTick.js",
  useUnreadCount: "src/hooks/useUnreadCount.js",
  useAssignmentsForBedroomOnDate: "src/hooks/useAssignmentsForBedroomOnDate.js",
  // A3 contexts
  LocaleContext: "src/contexts/LocaleContext.jsx",
  useLocale: "src/contexts/LocaleContext.jsx",
  TranslationProvider: "src/contexts/LocaleContext.jsx",
  PreviewContext: "src/contexts/PreviewContext.jsx",
  // A4 components
  Splash: "src/components/Splash.jsx",
  ScreenId: "src/components/ScreenId.jsx",
  TabButton: "src/components/TabButton.jsx",
  TeamClockIcon: "src/components/TeamClockIcon.jsx",
  AssignmentTypeChip: "src/components/chips/AssignmentTypeChip.jsx",
  PriorityChip: "src/components/chips/PriorityChip.jsx",
  ProgressBar: "src/components/ProgressBar.jsx",
  CleanerProgressBar: "src/components/CleanerProgressBar.jsx",
  PhotoModal: "src/components/PhotoModal.jsx",
  PhotoZoomViewer: "src/components/PhotoZoomViewer.jsx",
  ZoomableImage: "src/components/ZoomableImage.jsx",
  AddressLink: "src/components/AddressLink.jsx",
  TranslatableText: "src/components/TranslatableText.jsx",
  TranslateButton: "src/components/TranslateButton.jsx",
  Header: "src/components/Header.jsx",
  NotificationBell: "src/components/NotificationBell.jsx",
  OwnerOnly: "src/components/OwnerOnly.jsx",
  DueDateEditor: "src/components/DueDateEditor.jsx",
  ConfirmModal: "src/components/ConfirmModal.jsx",
  // A5a early shells
  RootRouter: "src/apps/RootRouter.jsx",
  LandingPage: "src/apps/LandingPage.jsx",
  SignIn: "src/apps/staff/SignIn.jsx",
  ConfigError: "src/apps/staff/ConfigError.jsx",
  // A5b late shells
  StaffApp: "src/apps/staff/StaffApp.jsx",
  BetaShell: "src/apps/staff/BetaShell.jsx",
  readBetaView: "src/apps/staff/BetaShell.jsx",
  writeBetaView: "src/apps/staff/BetaShell.jsx",
  isBetaFeaturesEnabled: "src/apps/staff/BetaShell.jsx",
  ManagerShell: "src/apps/staff/ManagerShell.jsx",
  PortalApp: "src/apps/portal/PortalApp.jsx",
  PortalSignIn: "src/apps/portal/PortalSignIn.jsx",
  PortalPropertyPicker: "src/apps/portal/PortalPropertyPicker.jsx",
  PortalDashboard: "src/apps/portal/PortalDashboard.jsx",
  // A6 manager
  DailyView: "src/apps/staff/manager/daily/",
  DailyCalendar: "src/apps/staff/manager/daily/",
  DailyDayDetail: "src/apps/staff/manager/daily/",
  DailyUnitDayDetail: "src/apps/staff/manager/daily/",
  BedroomHistoryView: "src/apps/staff/manager/daily/",
  DayPhotoTabs: "src/apps/staff/manager/daily/",
  WhosWherePanel: "src/apps/staff/manager/daily/",
  AssignedVsCleanedView: "src/apps/staff/manager/daily/",
  ActivityTimelineView: "src/apps/staff/manager/daily/",
  ManagerDashboard: "src/apps/staff/manager/dashboard/",
  ShiftList: "src/apps/staff/manager/dashboard/",
  ShiftsByCleanerView: "src/apps/staff/manager/dashboard/",
  GroupedByPartyView: "src/apps/staff/manager/dashboard/",
  StatCard: "src/apps/staff/manager/dashboard/",
  ShiftDetail: "src/apps/staff/manager/dashboard/",
  TimeEditModal: "src/apps/staff/manager/dashboard/",
  DeleteConfirmModal: "src/apps/staff/manager/dashboard/",
  AdjustmentModal: "src/apps/staff/manager/dashboard/",
  WorkBlockDetail: "src/apps/staff/manager/dashboard/",
  TaskDetail: "src/apps/staff/manager/dashboard/",
  PhotoColumn: "src/apps/staff/manager/dashboard/",
  EmployeeAdmin: "src/apps/staff/manager/team/",
  EmployeeForm: "src/apps/staff/manager/team/",
  PortalUsersAdmin: "src/apps/staff/manager/team/",
  PortalUserForm: "src/apps/staff/manager/team/",
  PropertyAdmin: "src/apps/staff/manager/properties/",
  PropertySetup: "src/apps/staff/manager/properties/",
  PropertyForm: "src/apps/staff/manager/properties/",
  UnitList: "src/apps/staff/manager/properties/",
  UnitForm: "src/apps/staff/manager/properties/",
  PartyList: "src/apps/staff/manager/properties/",
  PartyForm: "src/apps/staff/manager/properties/",
  BulkCreateUnits: "src/apps/staff/manager/properties/",
  ApartmentGridBuilder: "src/apps/staff/manager/properties/",
  TownhomeImportBuilder: "src/apps/staff/manager/properties/",
  PropertyTeamTab: "src/apps/staff/manager/properties/",
  PortalUserAssignmentSection: "src/apps/staff/manager/properties/",
  QuickAddPortalUserModal: "src/apps/staff/manager/properties/",
  AssignmentsTab: "src/apps/staff/manager/assignments/",
  CleaningsReportView: "src/apps/staff/manager/assignments/",
  AssignmentList: "src/apps/staff/manager/assignments/",
  AssignmentForm: "src/apps/staff/manager/assignments/",
  QuickAssignmentForm: "src/apps/staff/manager/assignments/",
  AssignmentDetail: "src/apps/staff/manager/assignments/",
  AssignmentBanner: "src/apps/staff/manager/assignments/",
  AssignmentCard: "src/apps/staff/manager/assignments/",
  AllOpenAssignments: "src/apps/staff/manager/assignments/",
  CompletedAssignmentsView: "src/apps/staff/manager/assignments/",
  MoneyView: "src/apps/staff/manager/money/",
  PriceBookEditor: "src/apps/staff/manager/money/",
  InvoiceDraftEditor: "src/apps/staff/manager/money/",
  InvoiceDocument: "src/apps/staff/manager/money/",
  InvoiceList: "src/apps/staff/manager/money/",
  InvoiceView: "src/apps/staff/manager/money/",
  InvoicePreview: "src/apps/staff/manager/money/",
  ProfitReportView: "src/apps/staff/manager/money/",
  InvoicePaymentsReport: "src/apps/staff/manager/money/",
  ExportView: "src/apps/staff/manager/money/",
  DateRangePicker: "src/apps/staff/manager/money/",
  // A7 cleaner
  EmployeeApp: "src/apps/staff/cleaner/EmployeeApp.jsx",
  SupplyChecklistGate: "src/apps/staff/cleaner/",
  SupplyChecklistManager: "src/apps/staff/cleaner/",
  ItemsDropdown: "src/apps/staff/cleaner/",
  PropertyPicker: "src/apps/staff/cleaner/",
  PropertyHub: "src/apps/staff/cleaner/",
  AssignmentsPanel: "src/apps/staff/cleaner/",
  InlineBedroomTasks: "src/apps/staff/cleaner/",
  UnitPicker: "src/apps/staff/cleaner/",
  PartyPicker: "src/apps/staff/cleaner/",
  SectionPicker: "src/apps/staff/cleaner/",
  SearchableUnitPicker: "src/apps/staff/cleaner/",
  BedBathPicker: "src/apps/staff/cleaner/",
  PreparingBlockView: "src/apps/staff/cleaner/",
  BlockView: "src/apps/staff/cleaner/",
  SimpleShiftView: "src/apps/staff/cleaner/",
  ViewOnlyDashboard: "src/apps/staff/cleaner/",
  ViewOnlyAssignmentsPanel: "src/apps/staff/cleaner/",
  MoveBlockModalInline: "src/apps/staff/cleaner/",
  MoveBlockModal: "src/apps/staff/cleaner/",
  UndoMoveMenu: "src/apps/staff/cleaner/",
  LeaveWorkblockModal: "src/apps/staff/cleaner/",
  ClosedBlockMenu: "src/apps/staff/cleaner/",
  TaskCategoryPicker: "src/apps/staff/cleaner/",
  TaskCard: "src/apps/staff/cleaner/",
  ActiveWorkblockCard: "src/apps/staff/cleaner/",
  RequestItemsModal: "src/apps/staff/cleaner/",
  EditItemLabelModal: "src/apps/staff/cleaner/",
  WhosHerePopup: "src/apps/staff/cleaner/",
  WhosWorkingNowModal: "src/apps/staff/cleaner/",
  OthersActivityToday: "src/apps/staff/cleaner/",
  OtherCleanersActivity: "src/apps/staff/cleaner/",
  OtherCleanersTasksPanel: "src/apps/staff/cleaner/",
  OtherWorkblocksHere: "src/apps/staff/cleaner/",
  LiveCleanersSheet: "src/apps/staff/cleaner/",
  TodayApartmentsCard: "src/apps/staff/cleaner/",
  YourJobsCard: "src/apps/staff/cleaner/",
  ApartmentProgressList: "src/apps/staff/cleaner/",
  FloorFocusList: "src/apps/staff/cleaner/",
  CleanerPropertiesList: "src/apps/staff/cleaner/",
  CleanerWorkList: "src/apps/staff/cleaner/",
  AssignmentWorkHistory: "src/apps/staff/cleaner/",
  JobPeekModal: "src/apps/staff/cleaner/",
  AssignPicker: "src/apps/staff/cleaner/",
  CleanerBottomNav: "src/apps/staff/cleaner/",
  CleanerMoreExtras: "src/apps/staff/cleaner/",
  CleanerMenuSheet: "src/apps/staff/cleaner/",
  // A8 portal
  PortalHome: "src/apps/portal/",
  PortalMenuSheet: "src/apps/portal/",
  PortalLangToggle: "src/apps/portal/",
  PortalTeamModal: "src/apps/portal/",
  ChangePortalCodeModal: "src/apps/portal/",
  PortalInvoicesTab: "src/apps/portal/",
  PortalHistoryTab: "src/apps/portal/",
  PortalUnitDay: "src/apps/portal/",
  ResolvedDamageHistory: "src/apps/portal/",
  PortalPhotoSection: "src/apps/portal/",
  PortalPhotoUploadTab: "src/apps/portal/",
  PortalScheduleTab: "src/apps/portal/",
  PortalAssignmentsTab: "src/apps/portal/",
  PortalAssignmentSection: "src/apps/portal/",
  PortalAssignmentForm: "src/apps/portal/",
  PortalAssignmentDetail: "src/apps/portal/",
  RecheckRequestModal: "src/apps/portal/",
  ReviewRecheckModal: "src/apps/portal/",
  // A9 cross-cutting
  ChecklistAssignmentWizard: "src/apps/cross-cutting/",
  ReviewLine: "src/apps/cross-cutting/",
  ChecklistAssignmentView: "src/apps/cross-cutting/",
  AssignmentViewer: "src/apps/cross-cutting/",
  AssignmentTabContent: "src/apps/cross-cutting/",
  SuggestedTabContent: "src/apps/cross-cutting/",
  NextUpModal: "src/apps/cross-cutting/",
  SwitchBedroomModal: "src/apps/cross-cutting/",
  ReassignModal: "src/apps/cross-cutting/",
  ReviewAssignmentModal: "src/apps/cross-cutting/",
  RequestNewItemModal: "src/apps/cross-cutting/",
  BlockedNoteModal: "src/apps/cross-cutting/",
  SheetQuickViewModal: "src/apps/cross-cutting/",
  SpanishTranslationPanel: "src/apps/cross-cutting/",
  TranslationOverridesModal: "src/apps/cross-cutting/",
  WelcomeModal: "src/apps/cross-cutting/",
  IdleWarningModal: "src/apps/cross-cutting/",
  ChangePinModal: "src/apps/cross-cutting/",
  WorkBlockAssignmentLink: "src/apps/cross-cutting/",
  AttachmentModal: "src/apps/cross-cutting/",
  // A10 messaging
  StaffMessagesTab: "src/features/messaging/",
  ConversationList: "src/features/messaging/",
  NewDmPicker: "src/features/messaging/",
  NewPropertyThreadPicker: "src/features/messaging/",
  MessageThread: "src/features/messaging/",
  PortalMessagesTab: "src/features/messaging/",
  InboxView: "src/features/messaging/",
  App: "src/App.jsx",
};

const TOP_LEVEL_PATTERNS = [
  { re: /^async function ([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/, kind: "async function" },
  { re: /^function ([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/, kind: "function" },
  { re: /^export default function ([A-Za-z_$][A-Za-z0-9_$]*)/, kind: "function" },
  { re: /^const ([A-Za-z_$][A-Za-z0-9_$]*) = (async )?\(/, kind: "const fn" },
  { re: /^const ([A-Za-z_$][A-Za-z0-9_$]*) = function/, kind: "const fn" },
  { re: /^const ([A-Za-z_$][A-Za-z0-9_$]*) = async function/, kind: "const fn" },
  { re: /^const ([A-Za-z_$][A-Za-z0-9_$]*) = React\.(memo|forwardRef)/, kind: "const component" },
  { re: /^let ([A-Za-z_$][A-Za-z0-9_$]*) = /, kind: "let" },
];

function extractSymbols(source) {
  const lines = source.split("\n");
  const symbols = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s/.test(line)) continue;
    for (const { re, kind } of TOP_LEVEL_PATTERNS) {
      const m = line.match(re);
      if (m) {
        symbols.push({ name: m[1], line: i + 1, kind });
        break;
      }
    }
  }
  return symbols;
}

function auditCoupling(source) {
  const lines = source.split("\n");
  const findings = [];

  const pushMatches = (category, pattern, labelFn) => {
    lines.forEach((line, i) => {
      const m = line.match(pattern);
      if (m) {
        findings.push({
          category,
          line: i + 1,
          snippet: line.trim().slice(0, 120),
          detail: labelFn ? labelFn(m, line) : undefined,
        });
      }
    });
  };

  pushMatches("window global read/write", /window\.__tidytrack_[a-z_]+/, (m) => m[0]);
  pushMatches("useContext", /React\.useContext\(|useContext\(/);
  pushMatches("createContext", /React\.createContext\(|createContext\(/);
  pushMatches("module singleton", /^let _tt[A-Za-z]+/, (m) => m[0]);
  pushMatches("supabase.channel", /\.channel\(/);
  pushMatches("localStorage", /localStorage\.(get|set|remove)Item\(/);

  // Dedupe window globals
  const globals = [...new Set(findings.filter((f) => f.category === "window global read/write").map((f) => f.detail))];

  return { findings, globals };
}

function statusFor(name) {
  if (PLANNED_TARGETS[name]) return PLANNED_TARGETS[name];
  return "TBD";
}

function renderMarkdown(symbols, coupling, generatedAt) {
  const planned = symbols.filter((s) => statusFor(s.name) !== "TBD");
  const tbd = symbols.filter((s) => statusFor(s.name) === "TBD");

  let md = `# App.jsx symbol inventory

**Generated:** ${generatedAt}
**Source:** \`src/App.jsx\` (${symbols.length} top-level symbols)
**Regenerate:** \`node scripts/generate-app-inventory.mjs\`

Companion to [\`ai/roadmaps/2026-08-06_app-jsx-split_plan.md\`](../roadmaps/2026-08-06_app-jsx-split_plan.md).

> Name a symbol in the phase checklist only if it defines a folder/domain boundary or has documented hidden coupling; everything else lives in this inventory.

---

## Summary

| Status | Count |
|--------|------:|
| Planned target assigned | ${planned.length} |
| TBD (assign during extraction) | ${tbd.length} |
| **Total** | **${symbols.length}** |

---

## Symbol table

| Line | Symbol | Kind | Planned target |
|-----:|--------|------|----------------|
`;

  for (const s of symbols) {
    const target = statusFor(s.name);
    md += `| ${s.line} | \`${s.name}\` | ${s.kind} | ${target === "TBD" ? "TBD" : `\`${target}\``} |\n`;
  }

  md += `
---

## Coupling appendix

One-time audit of hidden cross-module contracts in \`App.jsx\`. Preserve exactly during Phase A.

### \`window.__tidytrack_*\` globals (${coupling.globals.length})

| Global | Purpose |
|--------|---------|
| \`window.__tidytrack_locale\` | Current locale; read by non-React helpers (\`tt()\`, etc.) |
| \`window.__tidytrack_es\` | Inline Spanish micro-dictionary for multi-cleaner prompts |
| \`window.__tidytrack_beta_view\` | BetaShell view switch; mirrored from localStorage |

### \`createContext\` call sites (2)

| Line | Context |
|-----:|---------|
`;

  coupling.findings
    .filter((f) => f.category === "createContext")
    .forEach((f) => {
      md += `| ${f.line} | \`${f.snippet.slice(0, 80)}\` |\n`;
    });

  md += `
### \`useContext\` call sites (2)

| Line | Call site |
|-----:|-----------|
`;

  coupling.findings
    .filter((f) => f.category === "useContext")
    .forEach((f) => {
      md += `| ${f.line} | \`${f.snippet.slice(0, 80)}\` |\n`;
    });

  md += `
### Module-level mutable singletons

| Line | Symbol |
|-----:|--------|
`;

  coupling.findings
    .filter((f) => f.category === "module singleton")
    .forEach((f) => {
      md += `| ${f.line} | \`${f.detail}\` |\n`;
    });

  md += `
### \`supabase.channel(\` realtime surfaces (3)

| Line | Channel pattern |
|-----:|-----------------|
`;

  coupling.findings
    .filter((f) => f.category === "supabase.channel")
    .forEach((f) => {
      md += `| ${f.line} | \`${f.snippet.slice(0, 90)}\` |\n`;
    });

  md += `
### Preview contract (\`ManagerShell\` ↔ \`EmployeeApp\` / \`PortalApp\`)

- **Cleaner preview:** \`previewMode={true}\`, \`onSignOut={exitPreviewMode}\`; DB writes carry \`is_preview=true\`; \`exitPreviewMode\` closes open preview shifts/work_blocks.
- **PM preview:** \`previewMode\`, \`previewEmployee={employee}\`, \`onExitPreview={() => setPmPreview(false)}\`.
- **Persistence keys:** \`manager_preview_cleaner_{id}\`, \`manager_preview_pm_{id}\` via \`usePagePersistence\` (prefix \`tidytrack_page_\`).

### \`PreviewContext\`

- **Definition:** moves to \`src/contexts/PreviewContext.jsx\` (A3).
- **Provider:** stays inline in \`ManagerShell\` until late A5b; value \`{ onPreview, isOwner }\`.
- **Consumer:** \`Header\` reads context; extract \`Header\` only after A3.

### \`TranslationProvider\` (high-risk — extract as a unit)

- Mutates \`document.body\` text nodes; runs \`MutationObserver\` on \`document.body\`.
- Calls \`window.location.reload()\` when toggling back to English.
- Do not split the DOM walker from the provider. Smoke-test Spanish toggle + reload after A3.

### Notable \`localStorage\` key-prefix contracts

| Key / prefix | Writer | Reader / clearer |
|--------------|--------|------------------|
| \`tidytrack_page_*\` | \`usePagePersistence\` (ManagerShell tabs, preview flags) | Same hook on restore |
| \`tidytrack_page_manager_preview_*\` | ManagerShell preview persistence | StaffApp sign-out clears matching keys |
| \`tidytrack_locale\` | TranslationProvider, StaffApp sign-in | TranslationProvider init |
| \`tidytrack_translations_es\` | \`saveTranslationCache\` | \`loadTranslationCache\` |
| \`tidytrack_session\` | \`sessionStore\` | StaffApp restore |
| \`tidytrack_portal\` | PortalApp session | PortalApp restore |
| \`tt_role_choice\` | RootRouter, sign-out flows | RootRouter landing skip |
| \`__tidytrack_beta_view\` LS key | BetaShell \`readBetaView\`/\`writeBetaView\` | BetaShell init |

---

## TBD symbols (${tbd.length})

These top-level symbols have no planned target yet. Assign during extraction or add to \`PLANNED_TARGETS\` in the generator script.

`;

  if (tbd.length === 0) {
    md += "_None — all symbols mapped._\n";
  } else {
    md += tbd.map((s) => `- L${s.line} \`${s.name}\` (${s.kind})`).join("\n") + "\n";
  }

  return md;
}

function main() {
  const source = fs.readFileSync(APP_PATH, "utf8");
  const symbols = extractSymbols(source);
  const coupling = auditCoupling(source);
  const generatedAt = new Date().toISOString().slice(0, 10);

  const payload = {
    generatedAt,
    sourceFile: "src/App.jsx",
    lineCount: source.split("\n").length,
    symbolCount: symbols.length,
    symbols: symbols.map((s) => ({
      ...s,
      plannedTarget: statusFor(s.name),
    })),
    coupling: {
      windowGlobals: coupling.globals,
      findingCount: coupling.findings.length,
      findings: coupling.findings,
    },
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "app-jsx-symbols.json"), JSON.stringify(payload, null, 2) + "\n");
  fs.writeFileSync(path.join(OUT_DIR, "app-jsx-symbols.md"), renderMarkdown(symbols, coupling, generatedAt));

  console.log(`Wrote ${symbols.length} symbols to ai/inventories/app-jsx-symbols.{json,md}`);
  console.log(`  Planned: ${symbols.filter((s) => statusFor(s.name) !== "TBD").length}`);
  console.log(`  TBD: ${symbols.filter((s) => statusFor(s.name) === "TBD").length}`);
}

main();
