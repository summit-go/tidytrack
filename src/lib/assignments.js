// Shared assignment read-model helpers (Phase B2 trivial consolidation; Phase C1 queries).

import { supabase, fetchAllPages } from './supabase.js';
import { localTodayStart, assignmentDueRank } from './format.js';
import { naturalCompare } from './compare.js';

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

/** Minimal select for tab-badge counts at a property. */
export const ASSIGNMENT_TARGET_COUNT_SELECT =
  'status, completed_by, completed_at, unit_id, party_id, assignment_id, recheck_passed_at, assignment:assignments!inner(customer_id, active, source, pm_status, deleted_at)';

/** Full select for cleaner assignment tab cards. */
export const ASSIGNMENT_TARGET_FULL_SELECT =
  '*, assignment:assignments!inner(id, title, notes, file_url, file_kind, customer_id, active, source, pm_status, approved_at, deleted_at, extracted_text, spanish_translation, translation_status, assignment_type, scheduled_date, sheet_type, template_set_id, bathroom_variant, general_variant, created_at), unit:units(id, label), party:parties(id, label), starter:employees!started_by(id, name), completer:employees!completed_by(id, name), assignedTo:employees!assigned_to(id, name)';

/** Open (non-done/blocked) targets for suggested-tab bedroom cards. */
export const ASSIGNMENT_TARGET_OPEN_SELECT =
  '*, assignment:assignments!inner(id, title, notes, file_url, file_kind, customer_id, active, source, pm_status, deleted_at, assignment_type, template_set_id, sheet_type, general_variant, bathroom_variant, scheduled_date, created_at), unit:units(id, label), party:parties(id, label), starter:employees!started_by(name), completer:employees!completed_by(name), assignedTo:employees!assigned_to(id, name)';

/** App-wide open targets for manager AssignmentsTab job cards. */
export const ASSIGNMENT_TARGET_MANAGER_OPEN_SELECT =
  'id, status, priority, unit_id, party_id, template_section, unit:units(label, bedrooms, bathrooms), party:parties(label), assignment:assignments!inner(id, title, customer_id, active, deleted_at, scheduled_date, assignment_type, took_longer)';

/** Paginated assignment targets for one active property. */
export async function fetchPropertyAssignmentTargets(
  propertyId,
  select = ASSIGNMENT_TARGET_FULL_SELECT,
) {
  if (!propertyId) return { data: [], error: null };
  return fetchAllPages((from, to) =>
    supabase
      .from('assignment_targets')
      .select(select)
      .eq('assignment.customer_id', propertyId)
      .eq('assignment.active', true)
      .is('assignment.deleted_at', null)
      .order('id', { ascending: true })
      .range(from, to),
  );
}

/** Paginated open targets at one property (excludes done/blocked). */
export async function fetchOpenTargetsAtProperty(
  propertyId,
  select = ASSIGNMENT_TARGET_OPEN_SELECT,
) {
  if (!propertyId) return { data: [], error: null };
  return fetchAllPages((from, to) =>
    supabase
      .from('assignment_targets')
      .select(select)
      .not('status', 'in', '(done,blocked)')
      .eq('assignment.customer_id', propertyId)
      .eq('assignment.active', true)
      .is('assignment.deleted_at', null)
      .order('id', { ascending: true })
      .range(from, to),
  );
}

/** Paginated app-wide open targets for manager AssignmentsTab. */
export async function fetchOpenAssignmentTargets(
  select = ASSIGNMENT_TARGET_MANAGER_OPEN_SELECT,
) {
  return fetchAllPages((from, to) =>
    supabase
      .from('assignment_targets')
      .select(select)
      .not('status', 'in', '(done,blocked)')
      .order('id', { ascending: true })
      .range(from, to),
  );
}

/** PM-approved, active targets at a property. */
export function filterVisiblePropertyTargets(data, propertyId) {
  return (data || []).filter(
    (t) =>
      t.assignment?.customer_id === propertyId &&
      t.assignment?.active !== false &&
      !t.assignment?.deleted_at &&
      isPmApprovedAssignment(t.assignment),
  );
}

/** Dominant lifecycle status per assignment_id. */
export function buildDominantStatusByAssignment(targets) {
  const statusesByAsgn = new Map();
  (targets || []).forEach((t) => {
    const k = assignmentKeyFromTarget(t);
    if (!statusesByAsgn.has(k)) statusesByAsgn.set(k, new Set());
    statusesByAsgn.get(k).add(t.status);
  });
  const dominantByAsgn = new Map();
  statusesByAsgn.forEach((statusSet, k) => {
    dominantByAsgn.set(k, dominantAssignmentStatus(statusSet));
  });
  return dominantByAsgn;
}

/** Narrow property targets to the active status tab. */
export function filterTargetsForStatusTab(
  allRelevant,
  dominantByAsgn,
  statusFilter,
  employeeId,
) {
  const isMineOrRecheck =
    statusFilter === 'mine' || statusFilter === 'recheck_passed';
  const isDoneTab = statusFilter === 'done' || isMineOrRecheck;

  let filtered;
  if (isDoneTab) {
    filtered = allRelevant.filter(
      (t) => t.status === 'done' || t.status === 'blocked',
    );
  } else {
    filtered = allRelevant.filter(
      (t) => dominantByAsgn.get(assignmentKeyFromTarget(t)) === statusFilter,
    );
  }
  if (statusFilter === 'mine') {
    const todayStart = localTodayStart();
    filtered = filtered.filter(
      (t) =>
        t.completed_by &&
        employeeId &&
        t.completed_by === employeeId &&
        t.completed_at &&
        new Date(t.completed_at) >= todayStart,
    );
  }
  if (statusFilter === 'recheck_passed') {
    filtered = filtered.filter((t) => t.recheck_passed_at);
  }
  return filtered;
}

/** Sort targets for the active status tab (matches AssignmentTabContent). */
export function sortTargetsForStatusTab(filtered, statusFilter, employeeId) {
  const result = [...filtered];
  if (statusFilter === 'done') {
    result.sort(
      (a, b) =>
        naturalCompare(a.unit?.label || '', b.unit?.label || '') ||
        naturalCompare(a.party?.label || '', b.party?.label || ''),
    );
  } else if (statusFilter === 'paused') {
    result.sort((a, b) => {
      const ap = a.priority ? 1 : 0;
      const bp = b.priority ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const aMine = employeeId && a.started_by === employeeId ? 0 : 1;
      const bMine = employeeId && b.started_by === employeeId ? 0 : 1;
      if (aMine !== bMine) return aMine - bMine;
      return (
        naturalCompare(a.unit?.label || '', b.unit?.label || '') ||
        naturalCompare(a.party?.label || '', b.party?.label || '')
      );
    });
  } else {
    result.sort((a, b) => {
      const da = a.assignment?.scheduled_date || '';
      const db = b.assignment?.scheduled_date || '';
      const ra = assignmentDueRank(da || null);
      const rb = assignmentDueRank(db || null);
      if (ra !== rb) return ra - rb;
      if (da !== db) return da.localeCompare(db);
      const ap = a.priority ? 1 : 0;
      const bp = b.priority ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return (
        naturalCompare(a.unit?.label || '', b.unit?.label || '') ||
        naturalCompare(a.party?.label || '', b.party?.label || '')
      );
    });
  }
  return result;
}

/**
 * Tab-badge counts keyed by dominant assignment status.
 * Matches AssignmentsPanel / AssignmentTabContent dominant-status semantics.
 */
export function computeAssignmentStatusCounts(filtered, employeeId) {
  const statusesByAsgn = new Map();
  filtered.forEach((t) => {
    const k = assignmentKeyFromTarget(t);
    if (!statusesByAsgn.has(k)) statusesByAsgn.set(k, new Set());
    statusesByAsgn.get(k).add(t.status);
  });
  const sets = {
    pending: new Set(),
    paused: new Set(),
    in_progress: new Set(),
    done: new Set(),
    blocked: new Set(),
    mine: new Set(),
    recheck_passed: new Set(),
  };
  statusesByAsgn.forEach((statusSet, k) => {
    const dom = dominantAssignmentStatus(statusSet);
    if (sets[dom]) sets[dom].add(k);
  });
  const todayStart = localTodayStart();
  filtered.forEach((t) => {
    if (t.recheck_passed_at) sets.recheck_passed.add(assignmentKeyFromTarget(t));
    if (
      t.completed_by &&
      employeeId &&
      t.completed_by === employeeId &&
      t.completed_at
    ) {
      const ca = new Date(t.completed_at);
      if (ca >= todayStart) sets.mine.add(assignmentKeyFromTarget(t));
    }
  });
  return {
    pending: sets.pending.size,
    paused: sets.paused.size,
    in_progress: sets.in_progress.size,
    done: sets.done.size,
    blocked: sets.blocked.size,
    mine: sets.mine.size,
    recheck_passed: sets.recheck_passed.size,
  };
}
