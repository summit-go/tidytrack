// Shared assignment read-model helpers (Phase B2 trivial consolidation).

/** PM-sourced assignments are hidden until approved. */
export function isPmApprovedAssignment(assignment) {
  if (!assignment) return false;
  return assignment.source !== 'pm' || assignment.pm_status === 'approved';
}

/** Target visible to cleaners/manager work views (not deleted, PM-approved if applicable). */
export function isVisibleAssignmentTarget(target) {
  if (!target?.assignment || target.assignment.deleted_at) return false;
  return isPmApprovedAssignment(target.assignment);
}

/** Stable key for grouping targets by assignment (not bedroom). */
export function assignmentKeyFromTarget(target) {
  return target.assignment_id || `${target.unit_id || ''}::${target.party_id || ''}`;
}

export const DOMINANT_STATUS_ORDER = [
  'in_progress',
  'paused',
  'blocked',
  'pending',
  'done',
];

/** Pick the dominant lifecycle status from a set of target statuses. */
export function dominantAssignmentStatus(statusSet) {
  return DOMINANT_STATUS_ORDER.find((s) => statusSet.has(s)) || 'pending';
}
