#!/usr/bin/env node
/**
 * Phase A6 — extract manager tab symbols from App.jsx into
 * src/apps/staff/manager/{daily,dashboard,team,properties,assignments}/
 *
 * Usage: node scripts/extract-a6-manager-tabs.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { findSymbolRange } from "./a4-extract-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_PATH = path.join(ROOT, "src/App.jsx");

/** @type {Record<string, string>} folder name per symbol */
const SYMBOL_FOLDERS = {
  ManagerDashboard: "dashboard",
  ShiftList: "dashboard",
  ShiftsByCleanerView: "dashboard",
  GroupedByPartyView: "dashboard",
  StatCard: "dashboard",
  ShiftDetail: "dashboard",
  TimeEditModal: "dashboard",
  DeleteConfirmModal: "dashboard",
  AdjustmentModal: "dashboard",
  WorkBlockDetail: "dashboard",
  TaskDetail: "dashboard",
  PhotoColumn: "dashboard",
  EmployeeAdmin: "team",
  EmployeeForm: "team",
  PortalUsersAdmin: "team",
  PortalUserForm: "team",
  PropertyAdmin: "properties",
  PropertySetup: "properties",
  PortalUserAssignmentSection: "properties",
  QuickAddPortalUserModal: "properties",
  PropertyForm: "properties",
  UnitList: "properties",
  PropertyTeamTab: "properties",
  UnitForm: "properties",
  BulkCreateUnits: "properties",
  ApartmentGridBuilder: "properties",
  TownhomeImportBuilder: "properties",
  PartyList: "properties",
  PartyForm: "properties",
  CompletedAssignmentsView: "assignments",
  AssignmentsTab: "assignments",
  CleaningsReportView: "assignments",
  AssignmentList: "assignments",
  QuickAssignmentForm: "assignments",
  AssignmentForm: "assignments",
  AssignmentDetail: "assignments",
  AssignmentBanner: "assignments",
  AssignmentCard: "assignments",
  AllOpenAssignments: "assignments",
  DailyView: "daily",
  WhosWherePanel: "daily",
  AssignedVsCleanedView: "daily",
  ActivityTimelineView: "daily",
  DailyCalendar: "daily",
  DailyDayDetail: "daily",
  DayPhotoTabs: "daily",
  BedroomHistoryView: "daily",
  DailyUnitDayDetail: "daily",
};

const A6_NAMES = Object.keys(SYMBOL_FOLDERS);

/** Symbols still in App.jsx that A6 files may import (bridge). */
const BRIDGE_SYMBOLS = [
  "LiveCleanersSheet",
  "ChecklistAssignmentWizard",
  "ChecklistAssignmentView",
  "AssignmentViewer",
  "ReassignModal",
  "SupplyChecklistManager",
  "WorkBlockAssignmentLink",
  "AttachmentModal",
  "SpanishTranslationPanel",
  "TranslationOverridesModal",
  "BlockedNoteModal",
  "AssignPicker",
  "BedBathPicker",
  "DateRangePicker",
  "InboxView",
  "MoveBlockModal",
  "PropertyCard",
  "PropertyRow",
  "SearchableUnitPicker",
  "StatusIcon",
  "Stepper",
  "isBetaFeaturesEnabled",
];

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
} from "../../../../lib/supabase.js";
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
} from "../../../../lib/constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "../../../../lib/permissions.js";
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
} from "../../../../lib/format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "../../../../lib/compare.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
} from "../../../../lib/photos.js";
import { sessionStore } from "../../../../lib/sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "../../../../lib/translation.js";
import { buildTargetTitle, unitSizeLabel, shortenBedroom } from "../../../../lib/labels.js";
import { splitTaskName } from "../../../../lib/tasks.js";
import { useAssignmentSync } from "../../../../hooks/useAssignmentSync.js";
import { useIdleDetector } from "../../../../hooks/useIdleDetector.js";
import { usePagePersistence } from "../../../../hooks/usePagePersistence.js";
import { useItemLabelOverrides } from "../../../../hooks/useItemLabelOverrides.js";
import { useTick } from "../../../../hooks/useTick.js";
import { useUnreadCount } from "../../../../hooks/useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "../../../../hooks/useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "../../../../contexts/LocaleContext.jsx";
import { PreviewContext } from "../../../../contexts/PreviewContext.jsx";
import { AssignmentTypeChip } from "../../../../components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "../../../../components/chips/PriorityChip.jsx";
import { Splash } from "../../../../components/Splash.jsx";
import { ScreenId } from "../../../../components/ScreenId.jsx";
import { OwnerOnly } from "../../../../components/OwnerOnly.jsx";
import { DueDateEditor } from "../../../../components/DueDateEditor.jsx";
import { ProgressBar } from "../../../../components/ProgressBar.jsx";
import { CleanerProgressBar } from "../../../../components/CleanerProgressBar.jsx";
import { ConfirmModal } from "../../../../components/ConfirmModal.jsx";
import { AddressLink } from "../../../../components/AddressLink.jsx";
import { TranslatableText } from "../../../../components/TranslatableText.jsx";
import { PhotoModal } from "../../../../components/PhotoModal.jsx";
import { NotificationBell } from "../../../../components/NotificationBell.jsx";
import { Header } from "../../../../components/Header.jsx";
import { TeamClockIcon } from "../../../../components/TeamClockIcon.jsx";
import { TabButton } from "../../../../components/TabButton.jsx";
import { PhotoZoomViewer } from "../../../../components/PhotoZoomViewer.jsx";
import { TranslateButton } from "../../../../components/TranslateButton.jsx";
import { ZoomableImage } from "../../../../components/ZoomableImage.jsx";
import { ItemsDropdown } from "../../cleaner/ItemsDropdown.jsx";
`;

function symbolPath(name) {
  const folder = SYMBOL_FOLDERS[name];
  return `src/apps/staff/manager/${folder}/${name}.jsx`;
}

function buildExtraImports(body, selfName) {
  const lines = [];
  for (const name of A6_NAMES) {
    if (name === selfName) continue;
    if (
      body.includes(`<${name}`) ||
      body.includes(`${name}(`) ||
      body.includes(`${name} `)
    ) {
      const folder = SYMBOL_FOLDERS[name];
      lines.push(
        `import { ${name} } from "../${folder}/${name}.jsx";`,
      );
    }
  }
  for (const name of BRIDGE_SYMBOLS) {
    if (body.includes(`<${name}`) || body.includes(`${name}(`)) {
      lines.push(`import { ${name} } from "../../../../App.jsx";`);
    }
  }
  return [...new Set(lines)].sort().join("\n");
}

function transformBody(body, name) {
  let out = body.replace(/^function /, "export function ");
  if (name === "Header") {
    out = out.replace(
      /React\.useContext\(PreviewContext\)/g,
      "useContext(PreviewContext)",
    );
  }
  return out;
}

function buildAppImports() {
  const entries = A6_NAMES.map((name) => {
    const folder = SYMBOL_FOLDERS[name];
    return `import { ${name} } from "./apps/staff/manager/${folder}/${name}.jsx";`;
  });
  return entries.join("\n");
}

function exportBridgeSymbols(source) {
  let out = source;
  for (const name of BRIDGE_SYMBOLS) {
    out = out.replace(
      new RegExp(`\\nfunction ${name}\\(`),
      `\nexport function ${name}(`,
    );
  }
  return out;
}

function removeLabelHelpers(source) {
  const lines = source.split("\n");
  const helpers = ["buildTargetTitle", "unitSizeLabel", "shortenBedroom"];
  const ranges = helpers
    .map((name) => findSymbolRange(lines, name))
    .sort((a, b) => b.start - a.start);

  let result = lines;
  for (const { start, end } of ranges) {
    let s = start;
    if (s > 0 && result[s - 1].trim() === "") s--;
    // Also remove preceding comment block if it's the buildTargetTitle header
    result = [...result.slice(0, s), ...result.slice(end + 1)];
  }
  return result.join("\n");
}

function main() {
  let source = fs.readFileSync(APP_PATH, "utf8");
  let lines = source.split("\n");

  // Write extracted files
  for (const name of A6_NAMES) {
    const { start, end } = findSymbolRange(lines, name);
    const body = lines.slice(start, end + 1).join("\n");
    const extra = buildExtraImports(body, name);
    const content =
      SHARED_PREAMBLE +
      (extra ? extra + "\n" : "") +
      "\n" +
      transformBody(body, name) +
      "\n";
    const rel = symbolPath(name);
    const abs = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    console.log(`Wrote ${rel}`);
  }

  // Remove symbols from App.jsx (bottom-up)
  lines = fs.readFileSync(APP_PATH, "utf8").split("\n");
  const ranges = A6_NAMES.map((name) => ({
    name,
    ...findSymbolRange(lines, name),
  })).sort((a, b) => b.start - a.start);

  for (const { name, start, end } of ranges) {
    let s = start;
    // Remove section banner comments immediately above
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
  out = removeLabelHelpers(out);

  const labelsImport = `import { buildTargetTitle, unitSizeLabel, shortenBedroom } from "./lib/labels.js";`;
  if (!out.includes(labelsImport)) {
    out = out.replace(
      'import { splitTaskName } from "./lib/tasks.js";',
      `import { splitTaskName } from "./lib/tasks.js";\n${labelsImport}`,
    );
  }

  out = exportBridgeSymbols(out);

  const marker = 'import { ConfigError } from "./apps/staff/ConfigError.jsx";';
  const a6Imports = buildAppImports();
  if (!out.includes("manager/dashboard/ManagerDashboard")) {
    out = out.replace(marker, `${marker}\n${a6Imports}`);
  }

  fs.writeFileSync(APP_PATH, out);
  console.log("Updated App.jsx");
}

main();
