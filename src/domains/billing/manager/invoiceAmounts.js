export function subAmount(s) {
  return s.mode === "time"
    ? ((parseFloat(s.rate) || 0) * (parseFloat(s.minutes) || 0)) / 60
    : parseFloat(s.amount) || 0;
}

export function baseAmount(l) {
  if (l.overrideMode === "time") {
    return (
      ((parseFloat(l.overrideRate) || 0) *
        (parseFloat(l.overrideMinutes) || 0)) /
      60
    );
  }
  if (l.amountOverride !== "" && l.amountOverride != null)
    return parseFloat(l.amountOverride) || 0;
  return (l.subsections || [])
    .filter((s) => s.included)
    .reduce((sum, s) => sum + subAmount(s), 0);
}

export function extraAmount(l) {
  if (!l.extraOn) return 0;
  return l.extraMode === "time"
    ? ((parseFloat(l.extraRate) || 0) * (parseFloat(l.extraMinutes) || 0)) / 60
    : parseFloat(l.extraAmount) || 0;
}

export function lineAmount(l) {
  // Non-billable = the owner is eating this one (comp, redo, courtesy). It
  // still shows in the editor and still gets stamped invoiced so reporting
  // knows the work was accounted for, but it adds nothing to what the
  // property is charged and it's hidden from the printed invoice.
  if (l.nonBillable) return 0;
  return baseAmount(l) + extraAmount(l);
}

export function lineFullAmount(l) {
  return baseAmount(l) + extraAmount(l);
}
