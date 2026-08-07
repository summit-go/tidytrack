#!/usr/bin/env node
/**
 * Phase B2: wire trivial read-model consolidations into consumers.
 * Run once from tidytrack/: node scripts/apply-b2-consolidation.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..', 'src');

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(jsx|js)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

let changed = 0;

for (const file of walk(srcRoot)) {
  if (file.includes('lib/assignments.js')) continue;
  let text = fs.readFileSync(file, 'utf8');
  const orig = text;

  text = text.replace(
    /\(t\)\s*=>\s*\n?\s*!t\.assignment\?\.deleted_at\s*&&\s*\n?\s*\(t\.assignment\?\.source\s*!==\s*"pm"\s*\|\|\s*\n?\s*t\.assignment\?\.pm_status\s*===\s*"approved"\)/g,
    'isVisibleAssignmentTarget',
  );
  text = text.replace(
    /\(t\)\s*=>\s*\n?\s*!t\.assignment\?\.deleted_at\s*&&\s*\(t\.assignment\?\.source\s*!==\s*"pm"\s*\|\|\s*t\.assignment\?\.pm_status\s*===\s*"approved"\)/g,
    'isVisibleAssignmentTarget',
  );
  text = text.replace(
    /\(t\)\s*=>\s*\n?\s*\(t\.assignment\?\.source\s*!==\s*"pm"\s*\|\|\s*\n?\s*t\.assignment\?\.pm_status\s*===\s*"approved"\)/g,
    'isVisibleAssignmentTarget',
  );
  text = text.replace(
    /\(t\.assignment\?\.source\s*!==\s*"pm"\s*\|\|\s*\n?\s*t\.assignment\?\.pm_status\s*===\s*"approved"\)\s*&&/g,
    'isVisibleAssignmentTarget(t) &&',
  );
  text = text.replace(
    /\(t\.assignment\?\.source !== "pm" \|\|\s*\n?\s*t\.assignment\?\.pm_status === "approved"\)/g,
    'isPmApprovedAssignment(t.assignment)',
  );
  text = text.replace(
    /!a\.allDone && a\.active && \(a\.source !== "pm" \|\| a\.pm_status === "approved"\)/g,
    '!a.allDone && a.active && isPmApprovedAssignment(a)',
  );
  text = text.replace(
    /await supabase\s*\n?\s*\.from\("assignments"\)\s*\n?\s*\.update\(\{\s*scheduled_date:\s*date(\s*\|\|\s*null)?\s*\}\)\s*\n?\s*\.eq\("id",\s*(\w+)\)/g,
    'await updateAssignmentScheduledDate($2, date)',
  );
  text = text.replace(
    /\n\s*const unitNumberFromLabel = \(label\) => \{[\s\S]*?\};\n/g,
    '\n',
  );

  if (text.includes('statusesByAsgn') && text.includes('dominantOrder.find')) {
    text = text.replace(
      /\n\s*const dominantOrder = \[\s*\n\s*"in_progress",[\s\S]*?"done",\s*\n\s*\];\s*\n/g,
      '\n',
    );
    text = text.replace(
      /\n\s*const asgnKey = \(t\) =>\s*\n\s*t\.assignment_id \|\| `\$\{t\.unit_id \|\| ""\}::\$\{t\.party_id \|\| ""\}`;\s*\n/g,
      '\n',
    );
    text = text.replace(
      /dominantOrder\.find\(\(s\) => statusSet\.has\(s\)\) \|\| "pending"/g,
      'dominantAssignmentStatus(statusSet)',
    );
    text = text.replace(
      /const winner = dominantOrder\.find\(\(s\) => statusSet\.has\(s\)\) \|\| "pending"/g,
      'const winner = dominantAssignmentStatus(statusSet)',
    );
    text = text.replace(/\basgnKey\(/g, 'assignmentKeyFromTarget(');
  }

  text = text.replace(
    /const (todayStart|start) = new Date\(\);\s*\n\s*\1\.setHours\(0, 0, 0, 0\);\s*\n(\s*const startIso = \1\.toISOString\(\);)?/g,
    (match, name, isoLine) => (isoLine ? 'const startIso = localTodayStartISO();' : 'const todayStart = localTodayStart();'),
  );

  if (text === orig) continue;

  const relToLib = path.relative(path.dirname(file), path.join(srcRoot, 'lib')).replace(/\\/g, '/');
  const libPrefix = relToLib.startsWith('.') ? relToLib : `./${relToLib}`;

  const needsAssignments =
    text.includes('isVisibleAssignmentTarget') ||
    text.includes('isPmApprovedAssignment') ||
    text.includes('assignmentKeyFromTarget') ||
    text.includes('dominantAssignmentStatus');

  if (needsAssignments && !text.includes('lib/assignments.js')) {
    const imports = [];
    if (text.includes('isVisibleAssignmentTarget')) imports.push('isVisibleAssignmentTarget');
    if (text.includes('isPmApprovedAssignment')) imports.push('isPmApprovedAssignment');
    if (text.includes('assignmentKeyFromTarget')) imports.push('assignmentKeyFromTarget');
    if (text.includes('dominantAssignmentStatus')) imports.push('dominantAssignmentStatus');
    const imp = `import { ${[...new Set(imports)].join(', ')} } from "${libPrefix}/assignments.js";\n`;
    text = text.replace(/(from ["'][^"']*\/compare\.js["'];?\n)/, `$1${imp}`);
  }

  if (text.includes('updateAssignmentScheduledDate') && !text.includes('updateAssignmentScheduledDate,')) {
    text = text.replace(
      /(deleteMessagePhoto,\n)(} from ["'][^"']*\/supabase\.js["'];)/,
      '$1  updateAssignmentScheduledDate,\n$2',
    );
  }

  if ((text.includes('localTodayStartISO') || text.includes('localTodayStart(')) && !text.includes('localTodayStart,')) {
    text = text.replace(/(localTodayKey,\n)/, '$1  localTodayStart,\n  localTodayStartISO,\n');
  }

  if (text.includes('unitNumberFromLabel(') && !text.includes('unitNumberFromLabel,')) {
    text = text.replace(
      /(BUILDING_BLOCK_SIZE,\n)(} from ["'][^"']*\/compare\.js["'];)/,
      '$1  unitNumberFromLabel,\n$2',
    );
    text = text.replace(
      /(buildingKey,\n)(} from ["'][^"']*\/compare\.js["'];)/,
      '$1  unitNumberFromLabel,\n$2',
    );
  }

  fs.writeFileSync(file, text);
  changed++;
  console.log('updated', path.relative(srcRoot, file));
}

console.log(`\n${changed} files updated`);
