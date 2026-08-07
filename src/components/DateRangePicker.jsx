import React, { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

export function DateRangePicker({ start, end, onChange }) {
  const [open, setOpen] = useState(false);
  const initDate = start ? new Date(start + "T00:00:00") : new Date();
  const [view, setView] = useState(
    new Date(initDate.getFullYear(), initDate.getMonth(), 1),
  );

  const toIso = (d) => {
    const y = d.getFullYear(),
      m = String(d.getMonth() + 1).padStart(2, "0"),
      day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const fmt = (iso) =>
    iso
      ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "";
  const fmtFull = (iso) =>
    iso
      ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";
  const label =
    start && end
      ? `${fmt(start)} – ${fmtFull(end)}`
      : start
        ? `${fmt(start)} – pick end date`
        : "Pick date range";

  const clickDay = (iso) => {
    if (!start || (start && end)) {
      onChange(iso, "");
      return;
    }
    if (iso < start) {
      onChange(iso, start);
      setOpen(false);
    } else {
      onChange(start, iso);
      setOpen(false);
    }
  };

  const today = new Date();
  const todayIso = toIso(today);
  const thisMonthStart = toIso(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const thisMonthEnd = toIso(
    new Date(today.getFullYear(), today.getMonth() + 1, 0),
  );
  const lastMonthStart = toIso(
    new Date(today.getFullYear(), today.getMonth() - 1, 1),
  );
  const lastMonthEnd = toIso(
    new Date(today.getFullYear(), today.getMonth(), 0),
  );
  const last30 = toIso(new Date(Date.now() - 29 * 86400000));
  const setPreset = (s, e) => {
    onChange(s, e);
    setOpen(false);
  };

  const year = view.getFullYear(),
    month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-left flex items-center justify-between hover:border-stone-400"
      >
        <span
          className={`text-sm ${start ? "text-stone-900" : "text-stone-400"}`}
        >
          {label}
        </span>
        <Calendar size={16} className="text-stone-400" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
          />
          <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-auto bg-white rounded-2xl border border-stone-200 shadow-xl p-3">
            <div className="flex gap-1 mb-3 flex-wrap">
              <button
                onClick={() => setPreset(thisMonthStart, thisMonthEnd)}
                className="text-[11px] px-2 py-1 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200"
              >
                This month
              </button>
              <button
                onClick={() => setPreset(lastMonthStart, lastMonthEnd)}
                className="text-[11px] px-2 py-1 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200"
              >
                Last month
              </button>
              <button
                onClick={() => setPreset(last30, todayIso)}
                className="text-[11px] px-2 py-1 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200"
              >
                Last 30 days
              </button>
            </div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setView(new Date(year, month - 1, 1))}
                className="p-1.5 rounded-lg hover:bg-stone-100"
              >
                <ChevronLeft size={16} className="text-stone-600" />
              </button>
              <span className="text-sm font-medium text-stone-800">
                {view.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button
                onClick={() => setView(new Date(year, month + 1, 1))}
                className="p-1.5 rounded-lg hover:bg-stone-100"
              >
                <ChevronRight size={16} className="text-stone-600" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div
                  key={i}
                  className="text-center text-[10px] font-mono text-stone-400"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const iso = toIso(d);
                const st = iso === start,
                  en = iso === end,
                  rng = start && end && iso > start && iso < end;
                const isToday = iso === todayIso;
                return (
                  <button
                    key={i}
                    onClick={() => clickDay(iso)}
                    className={`h-9 text-xs rounded-lg flex items-center justify-center ${
                      st || en
                        ? "bg-stone-900 text-white font-medium"
                        : rng
                          ? "bg-amber-100 text-amber-900"
                          : isToday
                            ? "text-stone-900 font-bold ring-1 ring-stone-300"
                            : "text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between items-center mt-3 pt-2 border-t border-stone-100">
              <span className="text-[11px] font-mono text-stone-400">
                {start
                  ? end
                    ? `${fmt(start)} – ${fmt(end)}`
                    : `${fmt(start)} – pick end`
                  : "pick a start date"}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-xs px-3 py-1.5 rounded-lg bg-stone-900 text-white"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
