#!/usr/bin/env node
/**
 * Phase A9 — extract cross-cutting assignment symbols from App.jsx into
 * src/apps/cross-cutting/
 *
 * Order: leaf modals/helpers → views → megacomponents last.
 *
 * Usage: node scripts/extract-a9-cross-cutting.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_PATH = path.join(ROOT, "src/App.jsx");
const CONSTANTS_PATH = path.join(ROOT, "src/lib/constants.js");

/** @type {string[]} leaves → views → megacomponents */
const A9_NAMES = [
  "WorkBlockAssignmentLink",
  "SpanishTranslationPanel",
  "WelcomeModal",
  "IdleWarningModal",
  "ChangePinModal",
  "TranslationOverridesModal",
  "SheetQuickViewModal",
  "ReviewLine",
  "NextUpModal",
  "SwitchBedroomModal",
  "ReassignModal",
  "AttachmentModal",
  "BlockedNoteModal",
  "RequestNewItemModal",
  "ReviewAssignmentModal",
  "AssignmentViewer",
  "ChecklistAssignmentView",
  "SuggestedTabContent",
  "ChecklistAssignmentWizard",
  "AssignmentTabContent",
];

/** const blocks immediately above a symbol (same file). */
const ADJACENT_CONSTS = {
  ChangePinModal: "OBVIOUS_PINS",
};

/** Symbols still in App.jsx that A9 files may import (bridge). */
const BRIDGE_SYMBOLS = [
  "InboxView",
  "StaffMessagesTab",
  "PortalMessagesTab",
  "InvoiceDocument",
  "DateRangePicker",
  "resolveItemLabel",
  "StatusIcon",
  "Stepper",
  "PropertyCard",
  "PropertyRow",
];

const TOP_LEVEL =
  /^(export )?(async )?function \w+\(|^const \w+ =|^export default function /;

function findSymbolRangeExtended(lines, name) {
  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (new RegExp(`^(export )?function ${name}\\(`).test(line)) {
      startLine = i;
      break;
    }
    if (new RegExp(`^const ${name}\\s*=`).test(line)) {
      startLine = i;
      break;
    }
  }
  if (startLine === -1) throw new Error(`Symbol not found: ${name}`);

  const adjacent = ADJACENT_CONSTS[name];
  if (adjacent) {
    for (let i = startLine - 1; i >= 0; i--) {
      const t = lines[i].trim();
      if (t === "" || t.startsWith("//")) continue;
      if (new RegExp(`^const ${adjacent}\\s*=`).test(lines[i])) {
        startLine = i;
        break;
      }
      break;
    }
  }

  const isConst = /^const /.test(lines[startLine]);
  if (isConst) {
    for (let i = startLine + 1; i < lines.length; i++) {
      if (TOP_LEVEL.test(lines[i])) {
        let end = i - 1;
        while (end > startLine) {
          const t = lines[end].trim();
          if (t === "" || t.startsWith("//")) {
            end--;
            continue;
          }
          break;
        }
        return { start: startLine, end };
      }
    }
    let end = lines.length - 1;
    while (end > startLine && lines[end].trim() === "") end--;
    return { start: startLine, end };
  }

  for (let i = startLine + 1; i < lines.length; i++) {
    if (TOP_LEVEL.test(lines[i])) {
      let end = i - 1;
      while (end > startLine) {
        const t = lines[end].trim();
        if (t === "" || t.startsWith("//")) {
          end--;
          continue;
        }
        break;
      }
      return { start: startLine, end };
    }
  }

  let end = lines.length - 1;
  while (end > startLine && lines[end].trim() === "") end--;
  return { start: startLine, end };
}

const SHARED_PREAMBLE = `import React, { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
  Search,
  Clock,
  Camera,
  LogOut,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Plus,
  Pause,
  Play,
  Check,
  ArrowLeft,
  Users,
  Image as ImageIcon,
  Download,
  X,
  MapPin,
  Briefcase,
  Delete,
  AlertCircle,
  UserPlus,
  Building2,
  Trash2,
  Eye,
  EyeOff,
  LayoutDashboard,
  FileText,
  DollarSign,
  Home,
  Layers,
  User,
  Edit2,
  Copy,
  Printer,
  Calendar,
  HelpCircle,
  MessageCircle,
  MessageSquare,
  Settings,
  Languages,
  Menu,
  Square,
  Share2,
  ClipboardList,
  Lock,
  Circle,
  MoreVertical,
  RotateCcw,
  Undo2,
  Bell,
} from "lucide-react";
import {
  supabase,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  secureEmployeeSignIn,
  securePortalSignIn,
  secureSetCredential,
  PHOTO_BUCKET,
  ASSIGNMENT_BUCKET,
  PM_UPLOAD_BUCKET,
  MESSAGE_BUCKET,
  saveAssignees,
  fetchLivePresence,
  createNotification,
  clearAssignmentBroadcast,
  clearPmAssignmentNotification,
  uploadAssignmentFile,
  uploadPmFile,
  deletePmFile,
  uploadMessagePhoto,
  deleteMessagePhoto,
} from "../../lib/supabase.js";
import {
  ASSIGNMENT_TYPES,
  assignmentTypeLabel,
  assignmentTypeMeta,
  BUILD_TAG,
  KIND_CANNOT,
  PHOTO_KIND_LABELS,
  photoKindLabel,
  FLAG_KINDS,
  ASSIGNMENT_MAX_SIZE_MB,
  CAPABILITIES,
  TASK_CATEGORIES,
  GENERAL_GROUP_ORDER,
  taskCategoryLabel,
  taskCategoryShortLabel,
  ASSIGNMENT_STATUSES,
  INVOICE_DESCR,
  SUMMIT_LOGO_URL,
  SUMMIT_COMPANY,
  INVOICE_TYPE_LABEL,
  INVOICE_STATUS_STYLE,
  STALE_IDLE_MIN,
  STALE_FORCE_MIN,
  MAX_BLOCK_HOURS,
} from "../../lib/constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "../../lib/permissions.js";
import {
  fmtTime,
  fmtTimeShort,
  fmtMoney,
  fmtDate,
  fmtDateLong,
  fmtDateWithDay,
  fmtDueDate,
  localTodayKey,
  assignmentDueKind,
  assignmentDueRank,
  fmtClock,
  greetingForTime,
  shiftBillableMs,
  shiftBillableHours,
  localDayKey,
  fmtInvoiceDate,
  toDateKey,
} from "../../lib/format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "../../lib/compare.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
} from "../../lib/photos.js";
import { sessionStore } from "../../lib/sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "../../lib/translation.js";
import {
  buildTargetTitle,
  unitSizeLabel,
  shortenBedroom,
  partyDisplay,
  unitPartyLabel,
  bathroomNumberForBedroom,
} from "../../lib/labels.js";
import { splitTaskName } from "../../lib/tasks.js";
import { useAssignmentSync } from "../../hooks/useAssignmentSync.js";
import { useIdleDetector } from "../../hooks/useIdleDetector.js";
import { usePagePersistence } from "../../hooks/usePagePersistence.js";
import { useItemLabelOverrides } from "../../hooks/useItemLabelOverrides.js";
import { useTick } from "../../hooks/useTick.js";
import { useUnreadCount } from "../../hooks/useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "../../hooks/useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "../../contexts/LocaleContext.jsx";
import { PreviewContext } from "../../contexts/PreviewContext.jsx";
import { AssignmentTypeChip } from "../../components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "../../components/chips/PriorityChip.jsx";
import { Splash } from "../../components/Splash.jsx";
import { ScreenId } from "../../components/ScreenId.jsx";
import { OwnerOnly } from "../../components/OwnerOnly.jsx";
import { DueDateEditor } from "../../components/DueDateEditor.jsx";
import { ProgressBar } from "../../components/ProgressBar.jsx";
import { CleanerProgressBar } from "../../components/CleanerProgressBar.jsx";
import { ConfirmModal } from "../../components/ConfirmModal.jsx";
import { AddressLink } from "../../components/AddressLink.jsx";
import { TranslatableText } from "../../components/TranslatableText.jsx";
import { PhotoModal } from "../../components/PhotoModal.jsx";
import { NotificationBell } from "../../components/NotificationBell.jsx";
import { Header } from "../../components/Header.jsx";
import { TeamClockIcon } from "../../components/TeamClockIcon.jsx";
import { TabButton } from "../../components/TabButton.jsx";
import { PhotoZoomViewer } from "../../components/PhotoZoomViewer.jsx";
import { TranslateButton } from "../../components/TranslateButton.jsx";
import { ZoomableImage } from "../../components/ZoomableImage.jsx";
`;

function symbolPath(name) {
  return `src/apps/cross-cutting/${name}.jsx`;
}

function buildExtraImports(body, selfName) {
  const lines = [];
  for (const name of A9_NAMES) {
    if (name === selfName) continue;
    if (
      body.includes(`<${name}`) ||
      body.includes(`${name}(`) ||
      body.includes(`${name} `)
    ) {
      lines.push(`import { ${name} } from "./${name}.jsx";`);
    }
  }
  for (const name of BRIDGE_SYMBOLS) {
    if (body.includes(`<${name}`) || body.includes(`${name}(`)) {
      lines.push(`import { ${name} } from "../../App.jsx";`);
    }
  }
  return [...new Set(lines)].sort().join("\n");
}

function transformBody(body) {
  return body
    .replace(/^export function /, "export function ")
    .replace(/^function /, "export function ")
    .replace(/^const /, "export const ");
}

function buildAppImports() {
  return A9_NAMES.map(
    (name) => `import { ${name} } from "./apps/cross-cutting/${name}.jsx";`,
  ).join("\n");
}

function moveQuickTypesToConstants(source) {
  const match = source.match(
    /const QUICK_TYPES = \[[\s\S]*?\];\n/,
  );
  if (!match) return source;

  let constants = fs.readFileSync(CONSTANTS_PATH, "utf8");
  if (!constants.includes("export const QUICK_TYPES")) {
    const block = match[0].replace(/^const /, "export const ");
    constants = constants.replace(
      "export const ASSIGNMENT_TYPES = [",
      `${block}\nexport const ASSIGNMENT_TYPES = [`,
    );
    fs.writeFileSync(CONSTANTS_PATH, constants);
    console.log("Moved QUICK_TYPES to lib/constants.js");
  }

  return source.replace(match[0], "");
}

function updateQuickTypesConsumers() {
  const files = [
    "src/apps/staff/manager/assignments/QuickAssignmentForm.jsx",
    "src/apps/staff/manager/assignments/CompletedAssignmentsView.jsx",
  ];
  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    let content = fs.readFileSync(abs, "utf8");
    if (content.includes("QUICK_TYPES") && !content.includes("QUICK_TYPES,")) {
      content = content.replace(
        /from "\.\.\/\.\.\/\.\.\/\.\.\/lib\/constants\.js";/,
        'from "../../../../lib/constants.js";\nimport { QUICK_TYPES } from "../../../../lib/constants.js";',
      );
      // Avoid duplicate import if constants already imported
      content = content.replace(
        /import \{([^}]*)\} from "\.\.\/\.\.\/\.\.\/\.\.\/lib\/constants\.js";\nimport \{ QUICK_TYPES \} from "\.\.\/\.\.\/\.\.\/\.\.\/lib\/constants\.js";/,
        (m, inner) => {
          if (inner.includes("QUICK_TYPES")) return m.replace(/\nimport \{ QUICK_TYPES \}[^;]+;/, "");
          return `import {${inner.trim()}, QUICK_TYPES } from "../../../../lib/constants.js";`;
        },
      );
    }
    if (!content.includes("QUICK_TYPES")) {
      content = content.replace(
        /(from "\.\.\/\.\.\/\.\.\/\.\.\/lib\/constants\.js";)/,
        (m) => {
          const prev = content.match(
            /import \{([^}]*)\} from "\.\.\/\.\.\/\.\.\/\.\.\/lib\/constants\.js";/,
          );
          if (prev && !prev[1].includes("QUICK_TYPES")) {
            return m.replace(
              /import \{([^}]*)\}/,
              "import {$1, QUICK_TYPES",
            );
          }
          return m;
        },
      );
    }
    fs.writeFileSync(abs, content);
    console.log(`Updated QUICK_TYPES import in ${rel}`);
  }
}

function updateBridgeImportsInConsumers() {
  const srcRoot = path.join(ROOT, "src");
  const a9Set = new Set(A9_NAMES);

  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "cross-cutting") continue;
        walk(abs);
        continue;
      }
      if (!ent.name.endsWith(".jsx")) continue;
      if (abs === APP_PATH) continue;

      let content = fs.readFileSync(abs, "utf8");
      const importMatch = content.match(
        /import \{([^}]+)\} from ['"]([^'"]*App\.jsx)['"];/,
      );
      if (!importMatch) continue;

      const symbols = importMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const a9Symbols = symbols.filter((s) => a9Set.has(s));
      if (a9Symbols.length === 0) continue;

      const relFromFile = path.relative(path.dirname(abs), path.join(ROOT, "src/apps/cross-cutting"));
      const crossCuttingPrefix = relFromFile.split(path.sep).join("/");

      const remaining = symbols.filter((s) => !a9Set.has(s));
      let newImports = a9Symbols
        .map(
          (s) =>
            `import { ${s} } from "${crossCuttingPrefix}/${s}.jsx";`,
        )
        .join("\n");

      if (remaining.length > 0) {
        newImports += `\nimport { ${remaining.join(", ")} } from "${importMatch[2]}";`;
      }

      content = content.replace(importMatch[0], newImports);

      // EmployeeApp: SwitchBedroomModal was used without import
      if (
        abs.includes("EmployeeApp.jsx") &&
        content.includes("<SwitchBedroomModal") &&
        !content.includes("SwitchBedroomModal")
      ) {
        // covered by a9Symbols if we add it manually below
      }
      if (
        abs.includes("EmployeeApp.jsx") &&
        content.includes("<SwitchBedroomModal") &&
        !content.match(/import \{ SwitchBedroomModal \}/)
      ) {
        content = content.replace(
          newImports,
          `${newImports}\nimport { SwitchBedroomModal } from "${crossCuttingPrefix}/SwitchBedroomModal.jsx";`,
        );
      }

      fs.writeFileSync(abs, content);
      console.log(`Updated bridge imports in ${path.relative(ROOT, abs)}`);
    }
  }

  walk(srcRoot);
}

function main() {
  let source = fs.readFileSync(APP_PATH, "utf8");
  source = moveQuickTypesToConstants(source);
  fs.writeFileSync(APP_PATH, source);

  let lines = source.split("\n");

  for (const name of A9_NAMES) {
    const { start, end } = findSymbolRangeExtended(lines, name);
    const body = lines.slice(start, end + 1).join("\n");
    const extra = buildExtraImports(body, name);
    const content =
      SHARED_PREAMBLE +
      (extra ? extra + "\n" : "") +
      "\n" +
      transformBody(body) +
      "\n";
    const rel = symbolPath(name);
    const abs = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    console.log(`Wrote ${rel}`);
  }

  lines = fs.readFileSync(APP_PATH, "utf8").split("\n");
  const ranges = A9_NAMES.map((name) => ({
    name,
    ...findSymbolRangeExtended(lines, name),
  })).sort((a, b) => b.start - a.start);

  for (const { name, start, end } of ranges) {
    let s = start;
    while (s > 0) {
      const prev = lines[s - 1].trim();
      if (
        prev === "" ||
        prev.startsWith("//") ||
        prev.startsWith("/*") ||
        prev === "// ================================================================="
      ) {
        s--;
        continue;
      }
      break;
    }
    lines = [...lines.slice(0, s), ...lines.slice(end + 1)];
    console.log(`Removed ${name}`);
  }

  let out = lines.join("\n");

  const marker =
    'import { ReviewRecheckModal } from "./apps/portal/ReviewRecheckModal.jsx";';
  const a9Imports = buildAppImports();
  if (!out.includes("apps/cross-cutting/WorkBlockAssignmentLink")) {
    out = out.replace(marker, `${marker}\n${a9Imports}`);
  }

  fs.writeFileSync(APP_PATH, out);
  console.log("Updated App.jsx");

  updateQuickTypesConsumers();
  updateBridgeImportsInConsumers();
}

main();
