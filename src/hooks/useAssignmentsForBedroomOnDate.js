import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { isPmApprovedAssignment } from "../lib/assignments.js";

// =================================================================
// useAssignmentsForBedroomOnDate — find assignments tied to a bedroom
// on a given date. Used by WorkBlockAssignmentLink and BedroomHistoryView.
//
// Matching strategy (date-aware):
//   1) Targets where the assignment's scheduled_date matches the date,
//      AND the target's unit/party (or null+null for property-wide) match
//   2) If no exact-date matches, fall back to the most recent assignment
//      at this bedroom that was active on or before this date
// Returns: { sameDayTargets, fallbackTarget, loading }
// =================================================================
export function useAssignmentsForBedroomOnDate({
  propertyId,
  unitId,
  partyId,
  dateISO,
}) {
  const [state, setState] = useState({
    sameDayTargets: [],
    fallbackTarget: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    if (!propertyId || !dateISO) {
      setState({ sameDayTargets: [], fallbackTarget: null, loading: false });
      return;
    }
    (async () => {
      // The date as YYYY-MM-DD (local). dateISO may be a full timestamp.
      const d = new Date(dateISO);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dayKey = `${yyyy}-${mm}-${dd}`;

      // Build the bedroom filter: bedroom-specific OR property-wide
      let q = supabase
        .from("assignment_targets")
        .select(
          "*, assignment:assignments!inner(id, title, notes, file_url, file_kind, customer_id, active, source, pm_status, deleted_at, assignment_type, scheduled_date, created_at)",
        )
        .or(
          unitId && partyId
            ? `and(unit_id.eq.${unitId},party_id.eq.${partyId}),and(unit_id.is.null,party_id.is.null)`
            : `unit_id.is.null,party_id.is.null`,
        );
      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        console.warn("[useAssignmentsForBedroomOnDate]", error);
        setState({ sameDayTargets: [], fallbackTarget: null, loading: false });
        return;
      }
      const all = (data || []).filter(
        (t) =>
          t.assignment?.customer_id === propertyId &&
          t.assignment?.active &&
          !t.assignment?.deleted_at &&
          isPmApprovedAssignment(t.assignment),
      );

      // Same-day match: scheduled_date matches, OR scheduled_date is null
      // but created_at is on this day (we treat created_at as a proxy for the date)
      const sameDay = all.filter((t) => {
        if (t.assignment?.scheduled_date) {
          return t.assignment.scheduled_date === dayKey;
        }
        // Fall back to created_at date if no scheduled_date
        const createdISO = t.assignment?.created_at;
        if (!createdISO) return false;
        const c = new Date(createdISO);
        const cKey = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${String(c.getDate()).padStart(2, "0")}`;
        return cKey === dayKey;
      });

      let fallback = null;
      if (sameDay.length === 0 && all.length > 0) {
        // Pick the most recent target by scheduled_date (or created_at)
        const sorted = [...all].sort((a, b) => {
          const aKey =
            a.assignment?.scheduled_date || a.assignment?.created_at || "";
          const bKey =
            b.assignment?.scheduled_date || b.assignment?.created_at || "";
          return bKey.localeCompare(aKey);
        });
        fallback = sorted[0];
      }

      setState({
        sameDayTargets: sameDay,
        fallbackTarget: fallback,
        loading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId, unitId, partyId, dateISO]);

  return state;
}
