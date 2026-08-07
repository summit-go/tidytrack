import { useState, useEffect } from "react";
import { Clock, ChevronRight, FileText } from "lucide-react";
import { supabase } from "../../../lib/supabase.js";
import { INVOICE_STATUS_STYLE } from "../../../lib/constants.js";
import { fmtInvoiceDate } from "../../../lib/format.js";
import { Splash } from "../../../components/Splash.jsx";

export function InvoiceList({ property, onOpen, onNew }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [needsInvoicing, setNeedsInvoicing] = useState(0);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("customer_id", property.id)
      .order("created_at", { ascending: false });
    setInvoices(data || []);

    // Flag jobs done over a week ago that still haven't been invoiced
    // (done targets with no invoiced_on and completed_at older than 7 days).
    try {
      const weekAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
      // Don't chase history: only flag work from this month onward.
      const mStart = (() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
      })();
      const { data: propUnits } = await supabase
        .from("units")
        .select("id")
        .eq("customer_id", property.id);
      const unitIds = (propUnits || []).map((u) => u.id);
      if (unitIds.length) {
        const { data: needRows, error } = await supabase
          .from("assignment_targets")
          .select(
            "assignment_id, unit_id, assignment:assignments!inner(deleted_at, active)",
          )
          .eq("status", "done")
          .is("invoiced_on", null)
          .in("unit_id", unitIds)
          .lt("completed_at", weekAgo)
          .gte("completed_at", mStart);
        if (!error) {
          const jobs = new Set();
          (needRows || []).forEach((t) => {
            if (t.assignment?.deleted_at || t.assignment?.active === false)
              return;
            jobs.add(t.assignment_id || t.unit_id);
          });
          setNeedsInvoicing(jobs.size);
        } else {
          setNeedsInvoicing(0);
        }
      }
    } catch {
      setNeedsInvoicing(0);
    }

    setLoading(false);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [property.id]);

  if (loading) return <Splash text="Loading invoices…" />;

  return (
    <div>
      {needsInvoicing > 0 && (
        <button
          onClick={onNew}
          className="w-full mb-3 p-3 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-3 text-left active:scale-98"
        >
          <div className="flex items-center gap-2.5">
            <Clock size={18} className="text-amber-700 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-amber-900">
                {needsInvoicing} {needsInvoicing === 1 ? "job" : "jobs"} need
                invoicing
              </div>
              <div className="text-xs text-amber-700 font-mono">
                Done over a week ago and not yet billed
              </div>
            </div>
          </div>
          <span className="text-xs font-medium text-amber-900 flex items-center gap-1 flex-shrink-0">
            Invoice now <ChevronRight size={14} />
          </span>
        </button>
      )}
      {invoices.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-stone-200 rounded-2xl">
          <div className="text-sm text-stone-500 mb-4">
            No saved invoices for {property.name} yet.
          </div>
          <button
            onClick={onNew}
            className="px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium inline-flex items-center gap-2"
          >
            <FileText size={15} /> Generate one
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((iv) => {
            const total = parseFloat(iv.total) || 0;
            return (
              <button
                key={iv.id}
                onClick={() => onOpen(iv.id)}
                className="w-full text-left p-4 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 transition-colors flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-stone-900">
                      #{iv.invoice_number || "—"}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${INVOICE_STATUS_STYLE[iv.status] || "bg-stone-100 text-stone-600"}`}
                    >
                      {iv.status}
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 font-mono mt-1">
                    {iv.title ? iv.title + " · " : ""}
                    {(iv.status === "sent" || iv.status === "paid") &&
                    iv.sent_at
                      ? `Sent ${fmtInvoiceDate(String(iv.sent_at).slice(0, 10))}`
                      : fmtInvoiceDate(iv.invoice_date)}
                  </div>
                  {iv.period_start && iv.period_end && (
                    <div className="text-[11px] text-stone-400 font-mono mt-0.5">
                      Covers {fmtInvoiceDate(iv.period_start)} –{" "}
                      {fmtInvoiceDate(iv.period_end)}
                    </div>
                  )}
                </div>
                <div className="text-right flex items-center gap-2">
                  <span className="font-mono text-sm text-stone-900">
                    ${total.toFixed(2)}
                  </span>
                  <ChevronRight size={16} className="text-stone-400" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
