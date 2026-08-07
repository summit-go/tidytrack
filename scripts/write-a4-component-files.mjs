#!/usr/bin/env node
/**
 * Extract A4 component source from App.jsx into component files.
 * Run once, then: node scripts/extract-a4-components.mjs --remove-only
 * Or run this standalone to regenerate component files from App.jsx.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { findSymbolRange } from "./a4-extract-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_PATH = path.join(ROOT, "src/App.jsx");

/** @type {Record<string, { path: string, header: string, kind?: 'function' | 'const' }>} */
const EXTRACTS = {
  AssignmentTypeChip: {
    path: "src/components/chips/AssignmentTypeChip.jsx",
    header: `import React from "react";
import { assignmentTypeMeta } from "../../lib/constants.js";

`,
  },
  PriorityChip: {
    path: "src/components/chips/PriorityChip.jsx",
    header: `import React from "react";
import { AlertCircle } from "lucide-react";

`,
  },
  Splash: {
    path: "src/components/Splash.jsx",
    header: `import React from "react";

`,
  },
  ScreenId: {
    path: "src/components/ScreenId.jsx",
    header: `import React from "react";
import { BUILD_TAG } from "../lib/constants.js";

`,
  },
  OwnerOnly: {
    path: "src/components/OwnerOnly.jsx",
    header: `import React from "react";
import { Lock } from "lucide-react";
import { isOwner } from "../lib/permissions.js";

`,
  },
  DueDateEditor: {
    path: "src/components/DueDateEditor.jsx",
    header: `import React, { useState } from "react";

`,
  },
  ProgressBar: {
    path: "src/components/ProgressBar.jsx",
    header: `import React from "react";

`,
  },
  LeaveWorkblockModal: {
    path: "src/apps/staff/cleaner/LeaveWorkblockModal.jsx",
    header: `import React from "react";
import { AlertCircle, Check, ArrowLeft, Pause } from "lucide-react";

`,
  },
  CleanerProgressBar: {
    path: "src/components/CleanerProgressBar.jsx",
    header: `import React, { useState } from "react";
import { LeaveWorkblockModal } from "../apps/staff/cleaner/LeaveWorkblockModal.jsx";

`,
  },
  ConfirmModal: {
    path: "src/components/ConfirmModal.jsx",
    header: `import React from "react";

`,
  },
  splitTaskName: {
    path: "src/lib/tasks.js",
    kind: "const",
    header: "",
  },
  ItemsDropdown: {
    path: "src/apps/staff/cleaner/ItemsDropdown.jsx",
    header: `import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

`,
  },
  AddressLink: {
    path: "src/components/AddressLink.jsx",
    header: `import React from "react";
import { MapPin } from "lucide-react";

`,
  },
  TranslatableText: {
    path: "src/components/TranslatableText.jsx",
    header: `import React, { useState } from "react";
import { Languages } from "lucide-react";
import { isTextTranslateConfigured, translateText } from "../lib/translation.js";

`,
  },
  PhotoZoomViewer: {
    path: "src/components/PhotoZoomViewer.jsx",
    header: `import React, { useState } from "react";
import { X, Check, AlertCircle, Languages, RotateCcw, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { KIND_CANNOT, FLAG_KINDS } from "../lib/constants.js";
import { fmtDate } from "../lib/format.js";

`,
  },
  PhotoModal: {
    path: "src/components/PhotoModal.jsx",
    header: `import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  Image as ImageIcon,
  X,
  AlertCircle,
  Check,
  Clock,
  Trash2,
} from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { KIND_CANNOT, photoKindLabel } from "../lib/constants.js";
import { splitTaskName } from "../lib/tasks.js";
import { ItemsDropdown } from "../apps/staff/cleaner/ItemsDropdown.jsx";
import { PhotoZoomViewer } from "./PhotoZoomViewer.jsx";

`,
  },
  NotificationBell: {
    path: "src/components/NotificationBell.jsx",
    header: `import React, { useState, useEffect } from "react";
import { Bell, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabase.js";

`,
  },
  Header: {
    path: "src/components/Header.jsx",
    header: `import React, { useState, useContext } from "react";
import {
  ArrowLeft,
  Home,
  MoreVertical,
  Languages,
  MessageCircle,
  Users,
  LogOut,
} from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { BUILD_TAG } from "../lib/constants.js";
import { isTextTranslateConfigured } from "../lib/translation.js";
import { useUnreadCount } from "../hooks/useUnreadCount.js";
import { useLocale } from "../contexts/LocaleContext.jsx";
import { PreviewContext } from "../contexts/PreviewContext.jsx";
import { NotificationBell } from "./NotificationBell.jsx";

`,
  },
  TeamClockIcon: {
    path: "src/components/TeamClockIcon.jsx",
    header: `import React from "react";
import { Users, Clock } from "lucide-react";

`,
  },
  TabButton: {
    path: "src/components/TabButton.jsx",
    header: `import React from "react";

`,
  },
  TranslateButton: {
    path: "src/components/TranslateButton.jsx",
    header: `import React, { useState } from "react";
import { Languages, ChevronRight, AlertCircle } from "lucide-react";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  isTranslateConfigured,
  translateText,
} from "../lib/translation.js";

`,
  },
  ZoomableImage: {
    path: "src/components/ZoomableImage.jsx",
    header: `import React, { useState } from "react";

`,
  },
};

function main() {
  const lines = fs.readFileSync(APP_PATH, "utf8").split("\n");

  for (const [name, cfg] of Object.entries(EXTRACTS)) {
    const kind = cfg.kind || "function";
    const { start, end } = findSymbolRange(lines, name, kind);
    let body = lines.slice(start, end + 1).join("\n");

    if (kind === "const") {
      body = body.replace(/^const /, "export const ");
    } else {
      body = body.replace(/^function /, "export function ");
    }

    if (name === "Header") {
      body = body.replace(
        /React\.useContext\(PreviewContext\)/g,
        "useContext(PreviewContext)",
      );
    }

    const absPath = path.join(ROOT, cfg.path);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, cfg.header + body + "\n");
    console.log(`Wrote ${cfg.path}`);
  }
}

main();
