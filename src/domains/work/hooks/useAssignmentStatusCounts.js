import { useState, useEffect, useCallback } from 'react';
import {
  fetchPropertyAssignmentTargets,
  computeAssignmentStatusCounts,
  isVisibleAssignmentTarget,
  ASSIGNMENT_TARGET_COUNT_SELECT,
} from '../../../lib/assignments.js';
import { useAssignmentSync } from '../../../hooks/useAssignmentSync.js';

const EMPTY_COUNTS = {
  pending: 0,
  paused: 0,
  in_progress: 0,
  done: 0,
  blocked: 0,
  mine: 0,
  recheck_passed: 0,
};

/**
 * Dominant-status tab badge counts for cleaner AssignmentsPanel.
 * Reloads on propertyId/refreshKey and on assignment realtime sync.
 */
export function useAssignmentStatusCounts({
  propertyId,
  employeeId,
  refreshKey,
  syncChannelId = 'asgn-panel-counts',
}) {
  const [counts, setCounts] = useState(EMPTY_COUNTS);

  const loadCounts = useCallback(async () => {
    if (!propertyId) {
      setCounts(EMPTY_COUNTS);
      return;
    }
    const { data, error } = await fetchPropertyAssignmentTargets(
      propertyId,
      ASSIGNMENT_TARGET_COUNT_SELECT,
    );
    if (error) return;
    const filtered = (data || []).filter(isVisibleAssignmentTarget);
    setCounts(computeAssignmentStatusCounts(filtered, employeeId));
  }, [propertyId, employeeId]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts, refreshKey]);

  useAssignmentSync(loadCounts, syncChannelId);

  return { counts, reload: loadCounts };
}
