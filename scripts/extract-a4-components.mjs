#!/usr/bin/env node
/**
 * Remove A4 symbols from App.jsx (files must already exist).
 * Usage: node scripts/extract-a4-components.mjs --remove-only
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { findSymbolRange } from "./a4-extract-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_PATH = path.join(ROOT, "src/App.jsx");

const SYMBOLS = [
  { name: "AssignmentTypeChip", kind: "function" },
  { name: "PriorityChip", kind: "function" },
  { name: "Splash", kind: "function" },
  { name: "ScreenId", kind: "function" },
  { name: "OwnerOnly", kind: "function" },
  { name: "DueDateEditor", kind: "function" },
  { name: "ProgressBar", kind: "function" },
  { name: "CleanerProgressBar", kind: "function" },
  { name: "LeaveWorkblockModal", kind: "function" },
  { name: "ConfirmModal", kind: "function" },
  { name: "splitTaskName", kind: "const" },
  { name: "ItemsDropdown", kind: "function" },
  { name: "AddressLink", kind: "function" },
  { name: "TranslatableText", kind: "function" },
  { name: "PhotoModal", kind: "function" },
  { name: "NotificationBell", kind: "function" },
  { name: "Header", kind: "function" },
  { name: "TeamClockIcon", kind: "function" },
  { name: "TabButton", kind: "function" },
  { name: "PhotoZoomViewer", kind: "function" },
  { name: "TranslateButton", kind: "function" },
  { name: "ZoomableImage", kind: "function" },
];

const IMPORTS = `import { AssignmentTypeChip } from "./components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "./components/chips/PriorityChip.jsx";
import { Splash } from "./components/Splash.jsx";
import { ScreenId } from "./components/ScreenId.jsx";
import { OwnerOnly } from "./components/OwnerOnly.jsx";
import { DueDateEditor } from "./components/DueDateEditor.jsx";
import { ProgressBar } from "./components/ProgressBar.jsx";
import { CleanerProgressBar } from "./components/CleanerProgressBar.jsx";
import { ConfirmModal } from "./components/ConfirmModal.jsx";
import { AddressLink } from "./components/AddressLink.jsx";
import { TranslatableText } from "./components/TranslatableText.jsx";
import { PhotoModal } from "./components/PhotoModal.jsx";
import { NotificationBell } from "./components/NotificationBell.jsx";
import { Header } from "./components/Header.jsx";
import { TeamClockIcon } from "./components/TeamClockIcon.jsx";
import { TabButton } from "./components/TabButton.jsx";
import { PhotoZoomViewer } from "./components/PhotoZoomViewer.jsx";
import { TranslateButton } from "./components/TranslateButton.jsx";
import { ZoomableImage } from "./components/ZoomableImage.jsx";
import { splitTaskName } from "./lib/tasks.js";
import { ItemsDropdown } from "./apps/staff/cleaner/ItemsDropdown.jsx";`;

function main() {
  const source = fs.readFileSync(APP_PATH, "utf8");
  let lines = source.split("\n");

  const ranges = SYMBOLS.map(({ name, kind }) => ({
    name,
    ...findSymbolRange(lines, name, kind),
  })).sort((a, b) => b.start - a.start);

  for (const { name, start, end } of ranges) {
    // Also remove one preceding blank line if present
    let s = start;
    if (s > 0 && lines[s - 1].trim() === "") s--;
    lines = [...lines.slice(0, s), ...lines.slice(end + 1)];
    console.log(`Removed ${name} (${start + 1}-${end + 1})`);
  }

  let out = lines.join("\n");
  const marker =
    'import { PreviewContext } from "./contexts/PreviewContext.jsx";';
  if (!out.includes(marker)) throw new Error("marker missing");
  out = out.replace(marker, `${marker}\n${IMPORTS}`);

  fs.writeFileSync(APP_PATH, out);
  console.log("Updated App.jsx");
}

main();
