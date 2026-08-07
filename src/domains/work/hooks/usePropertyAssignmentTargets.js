import { useState, useEffect, useCallback } from 'react';
import {
  fetchPropertyAssignmentTargets,
  filterVisiblePropertyTargets,
  buildDominantStatusByAssignment,
  filterTargetsForStatusTab,
  sortTargetsForStatusTab,
} from '../../../lib/assignments.js';
import { useAssignmentSync } from '../../../hooks/useAssignmentSync.js';

/**
 * Paginated property assignment targets for cleaner AssignmentTabContent.
 * Handles dominant-status tab filtering, sorting, and realtime reload.
 */
export function usePropertyAssignmentTargets({
  propertyId,
  statusFilter,
  employeeId,
  syncChannelId = 'asgn-tab',
}) {
  const [targets, setTargets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    if (!propertyId) {
      setTargets([]);
      setLoaded(true);
      return;
    }
    const { data, error } = await fetchPropertyAssignmentTargets(propertyId);
    if (error) {
      console.error('[Assignments] load error:', error);
      setLoadError(error.message);
      setTargets([]);
      setLoaded(true);
      return;
    }
    const allRelevant = filterVisiblePropertyTargets(data, propertyId);
    const dominantByAsgn = buildDominantStatusByAssignment(allRelevant);
    let filtered = filterTargetsForStatusTab(
      allRelevant,
      dominantByAsgn,
      statusFilter,
      employeeId,
    );
    filtered = sortTargetsForStatusTab(filtered, statusFilter, employeeId);
    setTargets(filtered);
    setLoaded(true);
  }, [propertyId, statusFilter, employeeId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useAssignmentSync(reload, syncChannelId);

  return { targets, setTargets, loaded, loadError, reload };
}
