// Open work-block queries and presence lookup (Phase C1).

import { supabase, fetchAllPages } from './supabase.js';

export const OPEN_WORK_BLOCK_SELECT =
  'id, party_id, assignment_id, main_section, shift:shifts!inner(customer_id, employee:employees(id, name))';

/** Paginated open work blocks scoped to one property. */
export async function fetchOpenWorkBlocksAtProperty(propertyId) {
  if (!propertyId) return { data: [], error: null };
  return fetchAllPages((from, to) =>
    supabase
      .from('work_blocks')
      .select(OPEN_WORK_BLOCK_SELECT)
      .is('end_time', null)
      .eq('shift.customer_id', propertyId)
      .order('id', { ascending: true })
      .range(from, to),
  );
}

/**
 * Build lookup for "who's here" chips on assignment cards.
 * Keys: `a:${assignmentId}` and legacy fallback `p:${partyId}`.
 */
export function buildWhosHereLookup(blocks, { propertyId, excludeEmployeeId } = {}) {
  const m = new Map();
  const push = (key, entry) => {
    if (!key) return;
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(entry);
  };
  (blocks || []).forEach((b) => {
    if (propertyId && b.shift?.customer_id !== propertyId) return;
    if (excludeEmployeeId && b.shift?.employee?.id === excludeEmployeeId) return;
    const entry = {
      name: b.shift?.employee?.name || '?',
      workBlockId: b.id,
      mainSection: b.main_section,
    };
    if (b.assignment_id) push(`a:${b.assignment_id}`, entry);
    push(`p:${b.party_id}`, entry);
  });
  return m;
}

/** Party-keyed "who's here" for suggested-tab bedroom cards. */
export function buildWhosHereByParty(blocks, { propertyId, excludeEmployeeId } = {}) {
  const m = new Map();
  (blocks || []).forEach((b) => {
    if (propertyId && b.shift?.customer_id !== propertyId) return;
    if (excludeEmployeeId && b.shift?.employee?.id === excludeEmployeeId) return;
    if (!b.party_id) return;
    if (!m.has(b.party_id)) m.set(b.party_id, []);
    m.get(b.party_id).push({
      name: b.shift?.employee?.name || '?',
      workBlockId: b.id,
      mainSection: b.main_section,
    });
  });
  return m;
}
