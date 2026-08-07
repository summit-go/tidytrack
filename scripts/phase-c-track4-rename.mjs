#!/usr/bin/env node
/**
 * Phase C Track 4 — bulk rename manager → lead in src/.
 * Skips Property Manager strings, SupplyChecklistManager, and script/history paths.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, "../src");

const SKIP_FILES = new Set([
  "SupplyChecklistManager.jsx",
]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(jsx?|tsx?)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function patchFile(filePath) {
  if (SKIP_FILES.has(path.basename(filePath))) return false;
  let s = fs.readFileSync(filePath, "utf8");
  const orig = s;

  // Import rename (unused preamble imports across extracted files)
  s = s.replace(/\bisManager\b/g, "isLead");

  // Path updates after git mv
  s = s.replace(/apps\/internal\/manager\//g, "apps/internal/lead/");
  s = s.replace(/billing\/manager\//g, "billing/lead/");
  s = s.replace(/ManagerShell\.jsx/g, "LeadShell.jsx");
  s = s.replace(/\bManagerShell\b/g, "LeadShell");
  s = s.replace(/ManagerDashboard\.jsx/g, "LeadDashboard.jsx");
  s = s.replace(/\bManagerDashboard\b/g, "LeadDashboard");

  // Role checks — employee object
  s = s.replace(
    /(\w+)\?\.role === "owner" \|\| \1\?\.role === "manager"/g,
    "isLead($1)",
  );
  s = s.replace(
    /(\w+)\.role === "owner" \|\| \1\.role === "manager"/g,
    "isLead($1)",
  );
  s = s.replace(/(\w+)\?\.role === "manager"/g, "isLeadOnly($1)");
  s = s.replace(/(\w+)\.role === "manager"/g, "isLeadOnly($1)");

  // Role string variable (Header, SpanishTranslationPanel viewerRole, etc.)
  s = s.replace(
    /(\w+) === "owner" \|\| \1 === "manager"/g,
    "isLeadOrOwnerRole($1)",
  );
  s = s.replace(/(\w+) !== "owner" && \1 !== "manager"/g, "!isLeadOrOwnerRole($1)");
  s = s.replace(/(\w+) === "manager"/g, "isLeadRole($1)");

  // PostgREST role filters
  s = s.replace(
    /\.in\("role", \["employee", "manager"\]\)/g,
    '.in("role", FIELD_STAFF_ROLES)',
  );

  // UI suffix labels
  s = s.replace(/ \? " \(manager\)" : ""/g, ' ? " (lead)" : ""');

  // localStorage preview key cleanup prefix
  s = s.replace(
    /tidytrack_page_manager_preview_/g,
    "tidytrack_page_lead_preview_",
  );

  // Page persistence keys in LeadShell
  s = s.replace(/`manager_tab_/g, "`lead_tab_");
  s = s.replace(/`manager_preview_cleaner_/g, "`lead_preview_cleaner_");
  s = s.replace(/`manager_mode_/g, "`lead_mode_");
  s = s.replace(/`manager_preview_pm_/g, "`lead_preview_pm_");

  // EmployeeForm role literals (canonical write value)
  s = s.replace(/setRole\("manager"\)/g, 'setRole(ROLE_LEAD)');
  s = s.replace(/r === "manager"/g, "isLeadRole(r)");
  s = s.replace(/role === "manager"/g, "isLeadRole(role)");

  if (s === orig) return false;

  // Ensure permissions imports include new symbols when helpers are referenced
  const needs = [];
  if (/\bisLead\(/.test(s)) needs.push("isLead");
  if (/\bisLeadOnly\(/.test(s)) needs.push("isLeadOnly");
  if (/\bisLeadRole\(/.test(s)) needs.push("isLeadRole");
  if (/\bisLeadOrOwnerRole\(/.test(s)) needs.push("isLeadOrOwnerRole");
  if (/\bnormalizeRole\(/.test(s)) needs.push("normalizeRole");
  if (/\broleLabel\(/.test(s)) needs.push("roleLabel");
  if (/\bROLE_LEAD\b/.test(s)) needs.push("ROLE_LEAD");
  if (/\bROLE_OWNER\b/.test(s)) needs.push("ROLE_OWNER");
  if (/\bROLE_EMPLOYEE\b/.test(s)) needs.push("ROLE_EMPLOYEE");
  if (/\bFIELD_STAFF_ROLES\b/.test(s)) needs.push("FIELD_STAFF_ROLES");
  if (/\bmigrateLeadPersistenceKeys\b/.test(s)) needs.push("migrateLeadPersistenceKeys");

  if (needs.length) {
    const permImportRe =
      /import\s*\{([^}]+)\}\s*from\s*["']([^"']*permissions\.js)["'];?/;
    const m = s.match(permImportRe);
    if (m) {
      const existing = m[1].split(",").map((x) => x.trim()).filter(Boolean);
      const merged = [...new Set([...existing, ...needs])].sort();
      s = s.replace(
        permImportRe,
        `import { ${merged.join(", ")} } from "${m[2]}";`,
      );
    }
  }

  fs.writeFileSync(filePath, s);
  return true;
}

let n = 0;
for (const f of walk(srcRoot)) {
  if (patchFile(f)) {
    n++;
    console.log("patched", path.relative(srcRoot, f));
  }
}
console.log(`Done — ${n} files patched.`);
