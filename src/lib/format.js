export const fmtTime = (ms) => {
  if (!ms || ms < 0) return '0:00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};
export const fmtTimeShort = (ms) => {
  if (!ms || ms < 0) return '0m';
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
export const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '$0.00';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
export const fmtDate = (ts) => new Date(ts).toLocaleDateString('en-US', { month:'short', day:'numeric' });
export const fmtDateLong = (ts) => new Date(ts).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
export const fmtDateWithDay = (ts) => new Date(ts).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });

// Format a 'YYYY-MM-DD' due date parsed in LOCAL time (avoids the
// UTC-midnight shift that makes date-only strings render a day early).
export const fmtDueDate = (key) => {
  if (!key) return '';
  const d = new Date(String(key).slice(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// Due-date helpers for assignments. scheduled_date is 'YYYY-MM-DD'.
export const localTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// 'overdue' | 'today' | 'upcoming' | null
export const assignmentDueKind = (scheduledDate) => {
  if (!scheduledDate) return null;
  const today = localTodayKey();
  if (scheduledDate < today) return 'overdue';
  if (scheduledDate === today) return 'today';
  return 'upcoming';
};
// Sort rank: overdue first, then today, then undated, then upcoming.
// Sort bucket for a due date. Anything WITH a date outranks anything
// without one, so scheduled work rises to the top; undated work falls to
// the bottom and keeps its natural (building) order. Note upcoming is a
// single bucket on purpose — callers must tie-break on the actual date,
// or every future date compares equal and the sort silently falls
// through to building order.
export const assignmentDueRank = (scheduledDate) => {
  const k = assignmentDueKind(scheduledDate);
  if (k === 'overdue') return 0;
  if (k === 'today') return 1;
  if (!k) return 3;  // no date → last
  return 2;          // upcoming
};
export const fmtClock = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });

// Time-of-day greeting helper. Returns "Good morning", "Good afternoon",
// or "Good evening" based on the current hour in the user's local time.
export const greetingForTime = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

// Compute billable milliseconds for a shift:
//   raw clocked-in time − idle_seconds + manual_adjustment_seconds
// Falls back to raw duration for shifts without these fields.
export const shiftBillableMs = (shift) => {
  if (!shift?.start_time) return 0;
  const start = new Date(shift.start_time);
  const actualEnd = shift.end_time ? new Date(shift.end_time) : new Date();
  let end = actualEnd;
  // We never work past 10pm, so anything beyond 10pm of the start day is a
  // forgotten clock-out — cap it there. Only applies when the shift STARTED
  // before 10pm, so a genuine late shift (e.g. 10:10pm–10:39pm) is untouched.
  // Catches both still-running shifts AND completed ones with a bad end time
  // (like a clock-out at 12:11am the next day showing 33 hours).
  const cap10pm = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 22, 0, 0, 0);
  if (start < cap10pm && actualEnd > cap10pm) end = cap10pm;
  const rawMs = end - start;
  const idleSec = shift.idle_seconds || 0;
  const adjSec = shift.manual_adjustment_seconds || 0;
  return Math.max(0, rawMs - idleSec * 1000 + adjSec * 1000);
};
export const shiftBillableHours = (shift) => shiftBillableMs(shift) / (1000 * 60 * 60);

export const localDayKey = (ts) => {
  const d = new Date(ts);
  // Real ISO date in LOCAL time: "2026-07-20". The old version used
  // getMonth() (0-indexed) unpadded, so July became "6" and the DB read it as
  // June — which broke flat pay (saved to the wrong month) and day matching.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function fmtInvoiceDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Helpers — local-time YYYY-MM-DD (avoids UTC midnight bugs)
export const toDateKey = (d) => {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
};

export function shiftBillableAmount(s, showMoney) {
  if (!showMoney || !s.end_time) return 0;
  if (s.customer?.property_type === "multi_unit") {
    return (s.work_blocks || []).reduce((sum, b) => {
      if (!b.end_time) return sum;
      const h = (new Date(b.end_time) - new Date(b.start_time)) / 1000 / 3600;
      return (
        sum + h * (b.bill_rate_at_work || s.customer?.bill_rate_hourly || 0)
      );
    }, 0);
  }
  if (s.bill_rate_at_work) return shiftBillableHours(s) * s.bill_rate_at_work;
  return 0;
}

export function isoToLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToISO(local) {
  if (!local) return null;
  // new Date('YYYY-MM-DDTHH:MM') is interpreted as local time
  return new Date(local).toISOString();
}
