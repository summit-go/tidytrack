#!/usr/bin/env node
/**
 * Phase A10 + A5b (+ deferred A6 money) — extract messaging, shells, money,
 * and lib orphans from App.jsx. Leaves App.jsx as route switch + TranslationProvider.
 *
 * Usage: node scripts/extract-a10-a5b.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildPreamble,
  findSymbolRangeExtended,
  findBlockRange,
  transformBody,
  removeRanges,
  TOP_LEVEL,
} from "./shared-extract-preamble.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_PATH = path.join(ROOT, "src/App.jsx");
const SRC = path.join(ROOT, "src");

const MONEY_NAMES = [
  "subAmount",
  "baseAmount",
  "extraAmount",
  "lineAmount",
  "lineFullAmount",
  "PriceBookEditor",
  "InvoiceDraftEditor",
  "InvoiceDocument",
  "InvoiceList",
  "ProfitReportView",
  "InvoicePaymentsReport",
  "MoneyView",
  "DateRangePicker",
  "InvoiceView",
  "InvoicePreview",
  "ExportView",
];

const MESSAGING_NAMES = [
  "InboxView",
  "StaffMessagesTab",
  "ConversationList",
  "NewDmPicker",
  "NewPropertyThreadPicker",
  "MessageThread",
  "PortalMessagesTab",
];

const SHELL_SPECS = [
  { name: "StaffApp", dir: "apps/staff", depth: 2, export: true },
  {
    name: "BetaShell",
    dir: "apps/staff",
    depth: 2,
    adjacentBlock: "BETA_VIEW_LS_KEY",
    extraNames: ["readBetaView", "writeBetaView", "isBetaFeaturesEnabled"],
  },
  { name: "ManagerShell", dir: "apps/staff", depth: 2 },
  { name: "PortalApp", dir: "apps/portal", depth: 2 },
  { name: "PortalSignIn", dir: "apps/portal", depth: 2 },
  { name: "PortalPropertyPicker", dir: "apps/portal", depth: 2 },
  { name: "PortalDashboard", dir: "apps/portal", depth: 2 },
];

const MONEY_ADJACENT = {
  InvoiceDraftEditor: "subAmount",
};

const MONEY_INTERNAL = new Set([
  "subAmount",
  "baseAmount",
  "extraAmount",
  "lineAmount",
  "lineFullAmount",
]);

function readApp() {
  return fs.readFileSync(APP_PATH, "utf8");
}

function writeApp(source) {
  fs.writeFileSync(APP_PATH, source);
}

function extractLibOrphans() {
  let source = readApp();
  if (!source.includes("const PICKER_ES")) {
    console.log("Lib orphans already removed from App.jsx — skipping");
    return;
  }
  let lines = source.split("\n");

  const resolveRange = findSymbolRangeExtended(lines, "resolveItemLabel");
  const pickerStart = lines.findIndex((l) => l.startsWith("const PICKER_ES"));
  if (pickerStart < 0) throw new Error("PICKER_ES not found");
  const pickerBody = lines.slice(pickerStart, resolveRange.end + 1).join("\n");
  fs.writeFileSync(
    path.join(SRC, "lib/pickerLabels.js"),
    pickerBody.replace(/^function resolveItemLabel/, "export function resolveItemLabel") + "\n",
  );
  console.log("Wrote src/lib/pickerLabels.js");

  for (const fn of ["readPhotoTakenAt", "sharePhotos"]) {
    const photosPath = path.join(SRC, "lib/photos.js");
    let photos = fs.readFileSync(photosPath, "utf8");
    if (!photos.includes(fn)) {
      const r = findSymbolRangeExtended(lines, fn);
      photos = photos.trimEnd() + "\n\n" + transformBody(lines.slice(r.start, r.end + 1).join("\n")) + "\n";
      fs.writeFileSync(photosPath, photos);
    }
  }
  console.log("Updated src/lib/photos.js");

  const formatPath = path.join(SRC, "lib/format.js");
  let format = fs.readFileSync(formatPath, "utf8");
  for (const fn of ["shiftBillableAmount", "isoToLocalInput", "localInputToISO"]) {
    if (!format.includes(fn)) {
      const r = findSymbolRangeExtended(lines, fn);
      format = format.trimEnd() + "\n\n" + transformBody(lines.slice(r.start, r.end + 1).join("\n")) + "\n";
    }
  }
  fs.writeFileSync(formatPath, format);
  console.log("Updated src/lib/format.js");

  if (!fs.existsSync(path.join(SRC, "lib/portal.js")) || source.includes("function generatePortalUserCode")) {
    const genRange = findSymbolRangeExtended(lines, "generatePortalUserCode");
    fs.writeFileSync(
      path.join(SRC, "lib/portal.js"),
      transformBody(lines.slice(genRange.start, genRange.end + 1).join("\n")) + "\n",
    );
    console.log("Wrote src/lib/portal.js");
  }

  const removeList = [
    { start: pickerStart, end: resolveRange.end, trimComments: false },
    findSymbolRangeExtended(lines, "readPhotoTakenAt"),
    findSymbolRangeExtended(lines, "sharePhotos"),
    findSymbolRangeExtended(lines, "shiftBillableAmount"),
    findSymbolRangeExtended(lines, "isoToLocalInput"),
    findSymbolRangeExtended(lines, "localInputToISO"),
    findSymbolRangeExtended(lines, "generatePortalUserCode"),
  ].map((r) => ({ ...r, trimComments: r.trimComments ?? true }));
  lines = removeRanges(lines, removeList);
  writeApp(lines.join("\n"));
  console.log("Removed lib orphans from App.jsx");
}

function buildMoneyExtraImports(body, selfName) {
  const imps = [];
  for (const name of MONEY_NAMES) {
    if (name === selfName || MONEY_INTERNAL.has(name)) continue;
    if (
      body.includes(`<${name}`) ||
      body.includes(`${name}(`) ||
      body.includes(`${name} `)
    ) {
      imps.push(`import { ${name} } from "./${name}.jsx";`);
    }
  }
  if (body.includes("lineAmount(") || body.includes("baseAmount(")) {
    for (const h of MONEY_INTERNAL) {
      if (body.includes(`${h}(`) && h !== selfName) {
        imps.push(`import { ${h} } from "./invoiceAmounts.js";`);
        break;
      }
    }
  }
  return [...new Set(imps)].sort().join("\n");
}

function buildMessagingExtraImports(body, selfName) {
  const imps = [];
  for (const name of MESSAGING_NAMES) {
    if (name === selfName) continue;
    if (
      body.includes(`<${name}`) ||
      body.includes(`${name}(`) ||
      body.includes(`${name} `)
    ) {
      imps.push(`import { ${name} } from "./${name}.jsx";`);
    }
  }
  return [...new Set(imps)].join("\n");
}

function crossCuttingImports(body, fromDir) {
  const names = [
    "WelcomeModal",
    "ChecklistAssignmentWizard",
    "ChecklistAssignmentView",
    "AssignmentViewer",
    "ReviewAssignmentModal",
    "ReviewRecheckModal",
    "RecheckRequestModal",
    "AttachmentModal",
    "SpanishTranslationPanel",
    "WorkBlockAssignmentLink",
    "NextUpModal",
    "BlockedNoteModal",
    "SuggestedTabContent",
    "AssignmentTabContent",
    "QuickAssignmentForm",
    "SearchableUnitPicker",
  ];
  const rel = path.relative(path.join(SRC, fromDir), path.join(SRC, "apps/cross-cutting")).split(path.sep).join("/");
  const imps = [];
  for (const name of names) {
    if (body.includes(`<${name}`) || body.includes(`${name}(`)) {
      imps.push(`import { ${name} } from "${rel}/${name}.jsx";`);
    }
  }
  return imps.join("\n");
}

function portalImports(body, fromDir) {
  const names = [
    "PortalHome",
    "PortalMenuSheet",
    "PortalInvoicesTab",
    "PortalHistoryTab",
    "PortalScheduleTab",
    "PortalAssignmentsTab",
    "PortalPhotoUploadTab",
    "PortalLangToggle",
    "PortalTeamModal",
    "ChangePortalCodeModal",
    "WelcomeModal",
  ];
  const rel = path.relative(path.join(SRC, fromDir), path.join(SRC, "apps/portal")).split(path.sep).join("/");
  const imps = [];
  for (const name of names) {
    if (body.includes(`<${name}`) || body.includes(`${name}(`)) {
      imps.push(`import { ${name} } from "${rel}/${name}.jsx";`);
    }
  }
  return imps.join("\n");
}

function managerImports(body, fromDir) {
  const map = {
    DailyView: "staff/manager/daily/DailyView.jsx",
    ManagerDashboard: "staff/manager/dashboard/ManagerDashboard.jsx",
    EmployeeAdmin: "staff/manager/team/EmployeeAdmin.jsx",
    PropertyAdmin: "staff/manager/properties/PropertyAdmin.jsx",
    AssignmentsTab: "staff/manager/assignments/AssignmentsTab.jsx",
    MoneyView: "staff/manager/money/MoneyView.jsx",
  };
  const imps = [];
  for (const [name, relPath] of Object.entries(map)) {
    if (body.includes(`<${name}`) || body.includes(`${name}(`)) {
      const rel = path.relative(path.join(SRC, fromDir), path.join(SRC, "apps", relPath)).split(path.sep).join("/");
      imps.push(`import { ${name} } from "${rel}";`);
    }
  }
  return imps.join("\n");
}

function cleanerImports(body, fromDir) {
  if (!body.includes("EmployeeApp")) return "";
  const rel = path.relative(path.join(SRC, fromDir), path.join(SRC, "apps/staff/cleaner/EmployeeApp.jsx")).split(path.sep).join("/");
  return `import { EmployeeApp } from "${rel}";`;
}

function messagingImports(body, fromDir) {
  if (!body.includes("StaffMessagesTab") && !body.includes("PortalMessagesTab")) return "";
  const rel = path.relative(path.join(SRC, fromDir), path.join(SRC, "features/messaging")).split(path.sep).join("/");
  const imps = [];
  if (body.includes("StaffMessagesTab")) imps.push(`import { StaffMessagesTab } from "${rel}/StaffMessagesTab.jsx";`);
  if (body.includes("PortalMessagesTab")) imps.push(`import { PortalMessagesTab } from "${rel}/PortalMessagesTab.jsx";`);
  if (body.includes("InboxView")) imps.push(`import { InboxView } from "${rel}/InboxView.jsx";`);
  return imps.join("\n");
}

function extractMoney() {
  let lines = readApp().split("\n");
  const moneyDir = path.join(SRC, "apps/staff/manager/money");
  fs.mkdirSync(moneyDir, { recursive: true });
  const preamble = buildPreamble(4);

  // invoice amount helpers as one module
  const helperRanges = [...MONEY_INTERNAL].map((n) =>
    findSymbolRangeExtended(lines, n),
  );
  const helperBody = helperRanges
    .map((r) => transformBody(lines.slice(r.start, r.end + 1).join("\n")))
    .join("\n\n");
  fs.writeFileSync(path.join(moneyDir, "invoiceAmounts.js"), helperBody + "\n");
  console.log("Wrote money/invoiceAmounts.js");

  for (const name of MONEY_NAMES) {
    if (MONEY_INTERNAL.has(name)) continue;
    const { start, end } = findSymbolRangeExtended(lines, name);
    const body = lines.slice(start, end + 1).join("\n");
    const extras = [
      buildMoneyExtraImports(body, name),
      crossCuttingImports(body, "apps/staff/manager/money"),
    ]
      .filter(Boolean)
      .join("\n");
    const importAmounts = body.match(/\b(subAmount|baseAmount|extraAmount|lineAmount|lineFullAmount)\(/)
      ? 'import { subAmount, baseAmount, extraAmount, lineAmount, lineFullAmount } from "./invoiceAmounts.js";\n'
      : "";
    const content =
      preamble + importAmounts + (extras ? extras + "\n" : "") + "\n" + transformBody(body) + "\n";
    fs.writeFileSync(path.join(moneyDir, `${name}.jsx`), content);
    console.log(`Wrote money/${name}.jsx`);
  }

  const removeList = MONEY_NAMES.map((name) => findSymbolRangeExtended(lines, name));
  lines = removeRanges(lines, removeList);
  writeApp(lines.join("\n"));
  console.log("Removed money symbols from App.jsx");
}

function extractMessaging() {
  let lines = readApp().split("\n");
  const msgDir = path.join(SRC, "features/messaging");
  fs.mkdirSync(msgDir, { recursive: true });
  const preamble = buildPreamble(3);

  for (const name of MESSAGING_NAMES) {
    const { start, end } = findSymbolRangeExtended(lines, name);
    const body = lines.slice(start, end + 1).join("\n");
    const extras = [
      buildMessagingExtraImports(body, name),
      crossCuttingImports(body, "features/messaging"),
      portalImports(body, "features/messaging"),
    ]
      .filter(Boolean)
      .join("\n");
    const content =
      preamble + (extras ? extras + "\n" : "") + "\n" + transformBody(body) + "\n";
    fs.writeFileSync(path.join(msgDir, `${name}.jsx`), content);
    console.log(`Wrote messaging/${name}.jsx`);
  }

  const removeList = MESSAGING_NAMES.map((name) => findSymbolRangeExtended(lines, name));
  lines = removeRanges(lines, removeList);
  writeApp(lines.join("\n"));
  console.log("Removed messaging symbols from App.jsx");
}

function extractShellBody(lines, spec) {
  if (spec.name === "BetaShell") {
    const betaStart = lines.findIndex((l) => l.includes("BETA_VIEW_LS_KEY"));
    const betaEnd = findSymbolRangeExtended(lines, "BetaShell").end;
    return lines.slice(betaStart, betaEnd + 1).join("\n");
  }
  const { start, end } = findSymbolRangeExtended(lines, spec.name);
  return lines.slice(start, end + 1).join("\n");
}

function extractShells() {
  let lines = readApp().split("\n");

  for (const spec of SHELL_SPECS) {
    const dir = path.join(SRC, spec.dir);
    fs.mkdirSync(dir, { recursive: true });
    const preamble = buildPreamble(spec.depth);
    const body = extractShellBody(lines, spec);
    const extras = [
      managerImports(body, spec.dir),
      cleanerImports(body, spec.dir),
      messagingImports(body, spec.dir),
      portalImports(body, spec.dir),
      spec.name === "BetaShell"
        ? `import { ManagerShell } from "./ManagerShell.jsx";\nimport { EmployeeApp } from "./cleaner/EmployeeApp.jsx";\nimport { PortalApp } from "../portal/PortalApp.jsx";`
        : "",
      spec.name === "ManagerShell"
        ? `import { PortalApp } from "../portal/PortalApp.jsx";`
        : "",
      spec.name === "StaffApp"
        ? `import { SignIn } from "./SignIn.jsx";\nimport { ConfigError } from "./ConfigError.jsx";\nimport { BetaShell } from "./BetaShell.jsx";\nimport { ManagerShell } from "./ManagerShell.jsx";\nimport { EmployeeApp } from "./cleaner/EmployeeApp.jsx";`
        : "",
      spec.name === "PortalDashboard"
        ? crossCuttingImports(body, spec.dir)
        : "",
    ]
      .filter(Boolean)
      .join("\n")
      .split("\n")
      .filter((l, i, arr) => l && arr.indexOf(l) === i)
      .join("\n");

    let transformed = transformBody(body);
    if (spec.name === "BetaShell") {
      transformed = transformed
        .replace(/^export function readBetaView/, "export function readBetaView")
        .replace(/^export function writeBetaView/, "export function writeBetaView")
        .replace(/^export function isBetaFeaturesEnabled/, "export function isBetaFeaturesEnabled");
    }

    const content = preamble + extras + "\n\n" + transformed + "\n";
    fs.writeFileSync(path.join(dir, `${spec.name}.jsx`), content);
    console.log(`Wrote ${spec.dir}/${spec.name}.jsx`);
  }

  const removeList = [];
  for (const spec of SHELL_SPECS) {
    if (spec.name === "BetaShell") {
      const betaStart = lines.findIndex((l) => l.includes("BETA_VIEW_LS_KEY"));
      const betaEnd = findSymbolRangeExtended(lines, "BetaShell").end;
      removeList.push({ start: betaStart, end: betaEnd });
    } else {
      removeList.push(findSymbolRangeExtended(lines, spec.name));
    }
  }
  // Remove orphaned OBVIOUS_PINS block
  try {
    const pinStart = lines.findIndex((l) => l.startsWith("const OBVIOUS_PINS"));
    if (pinStart >= 0) {
      let pinEnd = pinStart;
      while (pinEnd + 1 < lines.length && lines[pinEnd + 1].trim() !== "];" && !lines[pinEnd + 1].startsWith("// ==")) pinEnd++;
      while (pinEnd < lines.length && !lines[pinEnd].trim().endsWith("];")) pinEnd++;
      removeList.push({ start: pinStart, end: pinEnd });
    }
  } catch {}

  lines = removeRanges(lines, removeList);
  writeApp(lines.join("\n"));
  console.log("Removed shell symbols from App.jsx");
}

function writeThinApp() {
  const thin = `import React, { useState, useEffect } from "react";
import { TranslationProvider } from "./contexts/LocaleContext.jsx";
import { RootRouter } from "./apps/RootRouter.jsx";
import { StaffApp } from "./apps/staff/StaffApp.jsx";
import { PortalApp } from "./apps/portal/PortalApp.jsx";

// =================================================================
// Top-level App — hash routing + TranslationProvider wrapper only.
// =================================================================
export default function App() {
  const [route, setRoute] = useState(() => window.location.hash || "");

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || "");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const id = "tt-mobile-scale";
    if (document.getElementById(id)) return;
    const st = document.createElement("style");
    st.id = id;
    st.textContent = "@media (max-width: 640px){ html{ font-size: 14.5px; } }";
    document.head.appendChild(st);
  }, []);

  let inner;
  if (route.startsWith("#/portal") || route.startsWith("#portal")) {
    inner = <PortalApp />;
  } else if (route.startsWith("#/staff") || route.startsWith("#staff")) {
    inner = <StaffApp />;
  } else {
    inner = <RootRouter />;
  }
  return <TranslationProvider>{inner}</TranslationProvider>;
}
`;
  fs.writeFileSync(APP_PATH, thin);
  console.log("Wrote thin App.jsx");
}

function updateBridgeImports() {
  const replacements = [
    {
      from: /import \{ StaffApp \} from ['"]\.\.\/App\.jsx['"];/,
      to: 'import { StaffApp } from "./staff/StaffApp.jsx";',
      files: ["apps/RootRouter.jsx"],
    },
    {
      from: /import \{ StaffMessagesTab \} from ['"]\.\.\/\.\.\/\.\.\/App\.jsx['"];/,
      to: 'import { StaffMessagesTab } from "../../features/messaging/StaffMessagesTab.jsx";',
    },
    {
      from: /import \{ PortalMessagesTab \} from ['"]\.\.\/\.\.\/App\.jsx['"];/,
      to: 'import { PortalMessagesTab } from "../features/messaging/PortalMessagesTab.jsx";',
    },
    {
      from: /import \{ InboxView \} from ['"]\.\.\/\.\.\/\.\.\/\.\.\/App\.jsx['"];/,
      to: 'import { InboxView } from "../../../../features/messaging/InboxView.jsx";',
    },
    {
      from: /import \{ InvoiceDocument \} from ['"]\.\.\/\.\.\/App\.jsx['"];/,
      to: 'import { InvoiceDocument } from "../staff/manager/money/InvoiceDocument.jsx";',
    },
    {
      from: /import \{ DateRangePicker \} from ['"]\.\.\/\.\.\/\.\.\/\.\.\/App\.jsx['"];/,
      to: 'import { DateRangePicker } from "../../../../staff/manager/money/DateRangePicker.jsx";',
    },
    {
      from: /import \{ resolveItemLabel \} from ['"]\.\.\/\.\.\/\.\.\/App\.jsx['"];/,
      to: 'import { resolveItemLabel } from "../../../lib/pickerLabels.js";',
    },
  ];

  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!ent.name.endsWith(".jsx") && !ent.name.endsWith(".js")) continue;
      if (abs === APP_PATH) continue;
      let content = fs.readFileSync(abs, "utf8");
      let changed = false;
      for (const { from, to } of replacements) {
        if (from.test(content)) {
          content = content.replace(from, to);
          changed = true;
        }
      }
      // Add missing lib imports for files using helpers without import
      const libAdds = [];
      if (content.includes("generatePortalUserCode(") && !content.includes("generatePortalUserCode")) {
        libAdds.push('import { generatePortalUserCode } from "../../../../lib/portal.js";');
      }
      if (content.includes("generatePortalUserCode(") && !content.match(/import.*generatePortalUserCode/)) {
        const depth = path.relative(SRC, path.dirname(abs)).split(path.sep).length;
        const p = "../".repeat(depth) + "lib/portal.js";
        if (!content.includes("from \"" + p)) {
          content = `import { generatePortalUserCode } from "${p}";\n` + content;
          changed = true;
        }
      }
      if (content.includes("isoToLocalInput(") && !content.match(/import.*isoToLocalInput/)) {
        const depth = path.relative(SRC, path.dirname(abs)).split(path.sep).length;
        const p = "../".repeat(depth) + "lib/format.js";
        content = content.replace(
          /from "\.\.\/\.\.\/\.\.\/\.\.\/lib\/format\.js";/,
          (m) => m.replace("}", ", isoToLocalInput, localInputToISO }"),
        );
        if (!content.includes("isoToLocalInput")) {
          content = content.replace(
            /import \{([^}]*)\} from "\.\.\/\.\.\/\.\.\/\.\.\/lib\/format\.js";/,
            (m, syms) => {
              if (syms.includes("isoToLocalInput")) return m;
              return `import {${syms}, isoToLocalInput, localInputToISO } from "../../../../lib/format.js";`;
            },
          );
          changed = true;
        }
      }
      if (content.includes("shiftBillableAmount(") && !content.match(/import.*shiftBillableAmount/)) {
        content = content.replace(
          /import \{([^}]*)\} from "\.\.\/\.\.\/\.\.\/\.\.\/lib\/format\.js";/,
          (m, syms) => {
            if (syms.includes("shiftBillableAmount")) return m;
            return `import {${syms}, shiftBillableAmount } from "../../../../lib/format.js";`;
          },
        );
        changed = true;
      }
      if (content.includes("readPhotoTakenAt(") && !content.match(/import.*readPhotoTakenAt/)) {
        content = content.replace(
          /import \{([^}]*)\} from "\.\.\/\.\.\/\.\.\/lib\/photos\.js";/,
          (m, syms) => {
            if (syms.includes("readPhotoTakenAt")) return m;
            return `import {${syms}, readPhotoTakenAt } from "../../../lib/photos.js";`;
          },
        );
        changed = true;
      }
      if (content.includes("sharePhotos(") && !content.match(/import.*sharePhotos/)) {
        const depth = path.relative(SRC, path.dirname(abs)).split(path.sep).length;
        const p = "../".repeat(depth) + "lib/photos.js";
        content = content.replace(
          new RegExp(`import \\{([^}]*)\\} from "${p.replace(/\//g, "\\/")}";`),
          (m, syms) => {
            if (syms.includes("sharePhotos")) return m;
            return `import {${syms}, sharePhotos } from "${p}";`;
          },
        );
        changed = true;
      }
      if (
        content.includes("isBetaFeaturesEnabled(") &&
        !content.match(/import.*isBetaFeaturesEnabled/)
      ) {
        const relDir = path.relative(path.join(SRC, "apps/staff"), path.dirname(abs));
        const up = relDir ? "../".repeat(relDir.split(path.sep).length) : "./";
        const importLine = `import { isBetaFeaturesEnabled } from "${up}BetaShell.jsx";\n`;
        if (!content.includes(importLine.trim())) {
          content = importLine + content;
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(abs, content);
        console.log(`Updated imports in ${path.relative(ROOT, abs)}`);
      }
    }
  }
  walk(SRC);

  // RootRouter special case
  const rootRouter = path.join(SRC, "apps/RootRouter.jsx");
  let rr = fs.readFileSync(rootRouter, "utf8");
  rr = rr.replace(
    /import \{ StaffApp \} from ['"]\.\.\/App\.jsx['"];/,
    'import { StaffApp } from "./staff/StaffApp.jsx";',
  );
  rr = rr.replace(
    /\/\/ Bridge import — StaffApp moves to src\/apps\/staff\/StaffApp\.jsx in A5b\.\n/,
    "",
  );
  fs.writeFileSync(rootRouter, rr);
  console.log("Updated RootRouter.jsx");
}

function main() {
  extractLibOrphans();
  extractMoney();
  extractMessaging();
  extractShells();
  writeThinApp();
  updateBridgeImports();
  console.log("A10 + A5b extraction complete");
}

main();
