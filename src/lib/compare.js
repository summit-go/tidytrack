// Natural sort: '1-101' before '1-102' before '2-101' before '10-101'
// Splits the label into number/non-number chunks and compares chunk by chunk.
export function naturalCompare(a, b) {
  const ax = String(a).split(/(\d+)/).filter(Boolean);
  const bx = String(b).split(/(\d+)/).filter(Boolean);
  for (let i = 0; i < Math.max(ax.length, bx.length); i++) {
    if (ax[i] === undefined) return -1;
    if (bx[i] === undefined) return 1;
    const an = parseInt(ax[i], 10);
    const bn = parseInt(bx[i], 10);
    if (!isNaN(an) && !isNaN(bn)) {
      if (an !== bn) return an - bn;
    } else {
      const cmp = ax[i].localeCompare(bx[i]);
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

// Extract the building prefix from a unit label like "B3-205" → "B3"
// Falls back to first non-numeric prefix, or null if no match.
export function buildingFromLabel(label) {
  if (!label) return null;
  const s = String(label);
  const dash = s.match(/^([A-Za-z]+\d+)-/);
  if (dash) return dash[1];
  const letter = s.match(/^([A-Za-z]+)\d/);
  if (letter) return letter[1].toUpperCase();
  return null;
}

// Pull the floor number out of an apartment label. The first digit of
// the apartment portion is the floor (101 → 1, 204 → 2, 305 → 3).
// Returns null if no apartment number is detected.
export function floorFromLabel(label) {
  if (!label) return null;
  // Match the apartment number portion — everything after the building
  // prefix (e.g. "B1-101" → "101", or just "101" if no prefix).
  const m = String(label).match(/(\d{3,})/);
  if (!m) return null;
  return parseInt(m[1].charAt(0), 10);
}

// Resolve which BUILDING a unit belongs to. Two ways:
//   1. If the label carries a prefix (e.g. "B2-305"), use it directly.
//   2. Otherwise derive it from the cumulative numbering scheme — units
//      run 4-per-floor per building, so on any floor units 1–4 are
//      building 1, 5–8 are building 2, 9–12 are building 3, etc.
//      101–104 → B1, 105–108 → B2, 305–308 → B2 (top floor), and so on.
// BLOCK_SIZE is the units-per-floor-per-building (4 here). Returns a
// stable key string like "B1" so we can group/compare by building.
export const BUILDING_BLOCK_SIZE = 4;
export function buildingKey(label, blockSize = BUILDING_BLOCK_SIZE) {
  const prefixed = buildingFromLabel(label);
  if (prefixed) return prefixed;
  const m = String(label || '').match(/(\d{3,})/);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  const floor = parseInt(m[1].charAt(0), 10);
  const pos = num - floor * 100; // position across buildings on that floor
  if (pos < 1) return null;
  return 'B' + Math.ceil(pos / blockSize);
}
