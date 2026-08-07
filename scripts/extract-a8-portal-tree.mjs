#!/usr/bin/env node
/**
 * Phase A8 — extract portal tree symbols from App.jsx into
 * src/apps/portal/
 *
 * Shells (PortalApp, PortalSignIn, PortalPropertyPicker, PortalDashboard)
 * stay in App.jsx for A5b.
 *
 * Usage: node scripts/extract-a8-portal-tree.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_PATH = path.join(ROOT, "src/App.jsx");

/** @type {string[]} */
const A8_NAMES = [
  "PortalMenuSheet",
  "PortalTeamModal",
  "ChangePortalCodeModal",
  "PortalLangToggle",
  "PortalHome",
  "PortalInvoicesTab",
  "PortalHistoryTab",
  "PortalUnitDay",
  "ResolvedDamageHistory",
  "PortalPhotoSection",
  "PortalPhotoUploadTab",
  "PortalScheduleTab",
  "PortalAssignmentsTab",
  "PortalAssignmentSection",
  "PortalAssignmentForm",
  "RecheckRequestModal",
  "PortalAssignmentDetail",
  "ReviewRecheckModal",
];

/** Symbols still in App.jsx that portal files may import (bridge). */
const BRIDGE_SYMBOLS = [
  "WelcomeModal",
  "PortalMessagesTab",
  "ChecklistAssignmentWizard",
  "AssignmentViewer",
  "AttachmentModal",
  "DateRangePicker",
  "InvoiceDocument",
  "SpanishTranslationPanel",
  "WorkBlockAssignmentLink",
  "ReviewLine",
  "NextUpModal",
  "ReviewAssignmentModal",
  "IdleWarningModal",
  "ChangePinModal",
  "AssignmentTabContent",
  "SuggestedTabContent",
  "ChecklistAssignmentView",
  "BlockedNoteModal",
  "InboxView",
  "TranslationOverridesModal",
  "StaffMessagesTab",
  "resolveItemLabel",
  "StatusIcon",
  "Stepper",
  "PropertyCard",
];

/** Already extracted elsewhere — import from domain, not App.jsx. */
const MANAGER_IMPORTS = {
  QuickAssignmentForm:
    "../../staff/manager/assignments/QuickAssignmentForm.jsx",
};

const CLEANER_IMPORTS = {
  SearchableUnitPicker: "../../staff/cleaner/SearchableUnitPicker.jsx",
};

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
  return `src/apps/portal/${name}.jsx`;
}

function buildExtraImports(body, selfName) {
  const lines = [];
  for (const name of A8_NAMES) {
    if (name === selfName) continue;
    if (
      body.includes(`<${name}`) ||
      body.includes(`${name}(`) ||
      body.includes(`${name} `)
    ) {
      lines.push(`import { ${name} } from "./${name}.jsx";`);
    }
  }
  for (const [name, relPath] of Object.entries(MANAGER_IMPORTS)) {
    if (body.includes(`<${name}`) || body.includes(`${name}(`)) {
      lines.push(`import { ${name} } from "${relPath}";`);
    }
  }
  for (const [name, relPath] of Object.entries(CLEANER_IMPORTS)) {
    if (body.includes(`<${name}`) || body.includes(`${name}(`)) {
      lines.push(`import { ${name} } from "${relPath}";`);
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
  return A8_NAMES.map(
    (name) => `import { ${name} } from "./apps/portal/${name}.jsx";`,
  ).join("\n");
}

function exportBridgeSymbols(source) {
  let out = source;
  const toExport = [
    ...BRIDGE_SYMBOLS,
    "WelcomeModal",
    "InvoiceDocument",
    "PortalMessagesTab",
  ];
  for (const name of toExport) {
    out = out.replace(
      new RegExp(`\\nfunction ${name}\\(`),
      `\nexport function ${name}(`,
    );
  }
  return out;
}

function main() {
  let source = fs.readFileSync(APP_PATH, "utf8");
  let lines = source.split("\n");

  for (const name of A8_NAMES) {
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
  const ranges = A8_NAMES.map((name) => ({
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
  out = exportBridgeSymbols(out);

  const marker =
    'import { LiveCleanersSheet } from "./apps/staff/cleaner/LiveCleanersSheet.jsx";';
  const a8Imports = buildAppImports();
  if (!out.includes("apps/portal/PortalHome")) {
    out = out.replace(marker, `${marker}\n${a8Imports}`);
  }

  fs.writeFileSync(APP_PATH, out);
  console.log("Updated App.jsx");
}

main();
