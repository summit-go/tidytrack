import React from "react";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Bucket completed items by local calendar age (today / 1–3 days / 4+). */
export function bucketByAge(items) {
  const todayLocal = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  })();

  const buckets = { dayOf: [], last3: [], older: [] };
  items.forEach((t) => {
    const ts = t.completed_at ? new Date(t.completed_at).getTime() : 0;
    if (!ts) {
      buckets.older.push(t);
      return;
    }
    const completedLocal = (() => {
      const d = new Date(ts);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    })();
    const daysAgo = Math.round((todayLocal - completedLocal) / DAY_MS);
    if (daysAgo <= 0) buckets.dayOf.push(t);
    else if (daysAgo <= 3) buckets.last3.push(t);
    else buckets.older.push(t);
  });
  return buckets;
}

/**
 * Done / mine / recheck time-bucketing UI. Splits "Last 2 days" into
 * Today / Yesterday headers; otherwise renders a flat list.
 */
export function AssignmentDoneGroups({
  items,
  doneWindow,
  dateFrom,
  dateTo,
  countBedrooms,
  renderAssignmentList,
}) {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8 text-stone-400 text-xs border-2 border-dashed border-stone-200 rounded-2xl">
        Nothing matches these filters.
      </div>
    );
  }

  if (doneWindow === "recent" && !dateFrom && !dateTo) {
    const { dayOf, last3 } = bucketByAge(items);
    const yesterday = last3;
    return (
      <div className="space-y-3">
        {dayOf.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-emerald-700 mb-1.5 px-1">
              Today ({countBedrooms(dayOf)})
            </div>
            {renderAssignmentList(dayOf)}
          </div>
        )}
        {yesterday.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1.5 px-1">
              Yesterday ({countBedrooms(yesterday)})
            </div>
            {renderAssignmentList(yesterday)}
          </div>
        )}
      </div>
    );
  }

  return renderAssignmentList(items);
}
