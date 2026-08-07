// Build a compact display title from a unit + party (bedroom) label.
// Format: "<unit> - <party>"  e.g. "B1-103 - Bedroom 1".
export function buildTargetTitle(unitLabel, partyLabel) {
  const u = (unitLabel || "").trim();
  const p = (partyLabel || "").trim();
  if (!u && !p) return "";
  if (!p) return u;
  if (!u) return p;
  return `${u} - ${p}`;
}

// "2x2" / "1x1.5" apartment size label. Returns null when missing.
export function unitSizeLabel(unit) {
  if (!unit) return null;
  const { bedrooms: br, bathrooms: ba } = unit;
  if (br == null && ba == null) return null;
  const n = (v) => (v == null ? "?" : String(Number(v)));
  return `${n(br)}x${n(ba)}`;
}

// Abbreviate "Bedroom" -> "BR" in space-tight card labels.
export function shortenBedroom(label) {
  if (!label) return label;
  return String(label).replace(/\bBedroom\b/gi, "BR");
}

export function bathroomNumberForBedroom(partyLabel) {
  if (!partyLabel) return null;
  const m = String(partyLabel).match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n === 1 || n === 2) return 1;
  if (n === 3 || n === 4) return 2;
  return null;
}

export const partyDisplay = (label) => {
  const l = String(label || "").trim();
  return l.toLowerCase() === "main" ? "" : l;
};

export const unitPartyLabel = (unitLabel, partyLabel) => {
  const raw = String(unitLabel || "").trim();
  // Split building prefix from apartment: "B1-202" → ["B1","202"], also
  // handles "B10-237". If there's no dash, treat the whole thing as apt.
  let building = "",
    apt = raw;
  const dash = raw.indexOf("-");
  if (dash > 0) {
    building = raw.slice(0, dash);
    apt = raw.slice(dash + 1);
  }
  // Bedroom number from the party label ("Bedroom 3" / "BR 3" → "3").
  const pl = partyDisplay(partyLabel);
  const bnum = pl ? String(pl).match(/(\d+)/)?.[1] || "" : "";
  let out = building ? `(${building}) ${apt}` : apt;
  if (bnum) out += `:${bnum}`;
  else if (pl && !/^bedroom/i.test(pl)) out += ` · ${pl}`; // non-bedroom party (e.g. a named area)
  return out;
};
