#!/usr/bin/env node
/**
 * Shared helpers for A4 extraction.
 * Top-level functions in App.jsx start at column 0; end at the line before
 * the next top-level declaration (handles multiline param destructuring).
 */

export function stripStrings(line) {
  return line
    .replace(/`(?:[^`\\]|\\.)*`/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, '""')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

const TOP_LEVEL =
  /^(async )?function \w+\(|^const \w+ =|^export default function /;

export function findSymbolRange(lines, name, kind = "function") {
  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (kind === "const" && new RegExp(`^const ${name}\\s*=`).test(line)) {
      startLine = i;
      break;
    }
    if (kind === "function" && new RegExp(`^function ${name}\\(`).test(line)) {
      startLine = i;
      break;
    }
  }
  if (startLine === -1) throw new Error(`Symbol not found: ${name}`);

  if (kind === "const") {
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
