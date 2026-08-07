import { useState, useEffect, useCallback } from 'react';
import {
  fetchOpenWorkBlocksAtProperty,
  buildWhosHereLookup,
} from '../../../lib/workBlocks.js';
import { useAssignmentSync } from '../../../hooks/useAssignmentSync.js';

/**
 * Open work blocks at a property, keyed for assignment-card "who's here" chips.
 * Returns Map with keys `a:${assignmentId}` and legacy `p:${partyId}`.
 */
export function useOpenWorkBlocksAtProperty({
  propertyId,
  excludeEmployeeId,
  syncChannelId = 'asgn-tab-whoshere',
}) {
  const [whosHereByParty, setWhosHereByParty] = useState(new Map());

  const reload = useCallback(async () => {
    if (!propertyId) {
      setWhosHereByParty(new Map());
      return;
    }
    const { data, error } = await fetchOpenWorkBlocksAtProperty(propertyId);
    if (error) return;
    setWhosHereByParty(
      buildWhosHereLookup(data, { propertyId, excludeEmployeeId }),
    );
  }, [propertyId, excludeEmployeeId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useAssignmentSync(reload, syncChannelId);

  return whosHereByParty;
}
