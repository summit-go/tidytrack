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
