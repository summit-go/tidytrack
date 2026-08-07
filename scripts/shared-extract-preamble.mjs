/** Shared extraction preamble — lib path uses `../`.repeat(depth) + "lib/..." */

export function libPrefix(depth) {
  return `${"../".repeat(depth)}lib/`;
}

export function appsPrefix(depth) {
  return `${"../".repeat(depth)}apps/`;
}

export function hooksPrefix(depth) {
  return `${"../".repeat(depth)}hooks/`;
}

export function contextsPrefix(depth) {
  return `${"../".repeat(depth)}contexts/`;
}

export function componentsPrefix(depth) {
  return `${"../".repeat(depth)}components/`;
}

export function featuresPrefix(depth) {
  return `${"../".repeat(depth)}features/`;
}

export function buildPreamble(depth) {
  const L = libPrefix(depth);
  const H = hooksPrefix(depth);
  const C = contextsPrefix(depth);
  const P = componentsPrefix(depth);
  return `import React, { useState, useEffect, useCallback, useRef, useContext } from "react";
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
} from "${L}supabase.js";
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
} from "${L}constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "${L}permissions.js";
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
  isoToLocalInput,
  localInputToISO,
  shiftBillableAmount,
} from "${L}format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "${L}compare.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
  readPhotoTakenAt,
  sharePhotos,
} from "${L}photos.js";
import { sessionStore } from "${L}sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "${L}translation.js";
import {
  buildTargetTitle,
  unitSizeLabel,
  shortenBedroom,
  partyDisplay,
  unitPartyLabel,
  bathroomNumberForBedroom,
} from "${L}labels.js";
import { resolveItemLabel } from "${L}pickerLabels.js";
import { generatePortalUserCode } from "${L}portal.js";
import { splitTaskName } from "${L}tasks.js";
import { useAssignmentSync } from "${H}useAssignmentSync.js";
import { useIdleDetector } from "${H}useIdleDetector.js";
import { usePagePersistence } from "${H}usePagePersistence.js";
import { useItemLabelOverrides } from "${H}useItemLabelOverrides.js";
import { useTick } from "${H}useTick.js";
import { useUnreadCount } from "${H}useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "${H}useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "${C}LocaleContext.jsx";
import { PreviewContext } from "${C}PreviewContext.jsx";
import { AssignmentTypeChip } from "${P}chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "${P}chips/PriorityChip.jsx";
import { Splash } from "${P}Splash.jsx";
import { ScreenId } from "${P}ScreenId.jsx";
import { OwnerOnly } from "${P}OwnerOnly.jsx";
import { DueDateEditor } from "${P}DueDateEditor.jsx";
import { ProgressBar } from "${P}ProgressBar.jsx";
import { CleanerProgressBar } from "${P}CleanerProgressBar.jsx";
import { ConfirmModal } from "${P}ConfirmModal.jsx";
import { AddressLink } from "${P}AddressLink.jsx";
import { TranslatableText } from "${P}TranslatableText.jsx";
import { PhotoModal } from "${P}PhotoModal.jsx";
import { NotificationBell } from "${P}NotificationBell.jsx";
import { Header } from "${P}Header.jsx";
import { TeamClockIcon } from "${P}TeamClockIcon.jsx";
import { TabButton } from "${P}TabButton.jsx";
import { PhotoZoomViewer } from "${P}PhotoZoomViewer.jsx";
import { TranslateButton } from "${P}TranslateButton.jsx";
import { ZoomableImage } from "${P}ZoomableImage.jsx";
`;
}

export const TOP_LEVEL =
  /^(export )?(async )?function \w+\(|^const \w+ =|^export default function /;

export function findSymbolRangeExtended(lines, name, adjacentConst = null) {
  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (new RegExp(`^(export )?(async )?function ${name}\\(`).test(line)) {
      startLine = i;
      break;
    }
    if (new RegExp(`^const ${name}\\s*=`).test(line)) {
      startLine = i;
      break;
    }
  }
  if (startLine === -1) throw new Error(`Symbol not found: ${name}`);

  if (adjacentConst) {
    for (let i = startLine - 1; i >= 0; i--) {
      const t = lines[i].trim();
      if (t === "" || t.startsWith("//")) continue;
      if (new RegExp(`^const ${adjacentConst}\\s*=`).test(lines[i])) {
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

export function findBlockRange(lines, startPattern, endBeforePattern) {
  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (startPattern.test(lines[i])) {
      startLine = i;
      break;
    }
  }
  if (startLine === -1) throw new Error(`Block not found: ${startPattern}`);
  for (let i = startLine + 1; i < lines.length; i++) {
    if (endBeforePattern.test(lines[i])) {
      let end = i - 1;
      while (end > startLine && lines[end].trim() === "") end--;
      return { start: startLine, end };
    }
  }
  throw new Error(`Block end not found for ${startPattern}`);
}

export function transformBody(body) {
  return body
    .replace(/^export function /, "export function ")
    .replace(/^function /, "export function ")
    .replace(/^export async function /, "export async function ")
    .replace(/^async function /, "export async function ")
    .replace(/^const /, "export const ");
}

export function removeRanges(lines, ranges) {
  const sorted = [...ranges].sort((a, b) => b.start - a.start);
  for (const { start, end, trimComments = true } of sorted) {
    let s = start;
    if (trimComments) {
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
    }
    lines = [...lines.slice(0, s), ...lines.slice(end + 1)];
  }
  return lines;
}
