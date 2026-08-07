import { useState, useEffect } from "react";
import { FileText, ChevronRight } from "lucide-react";
import { supabase } from "../../../lib/supabase.js";
import { fmtMoney } from "../../../lib/format.js";
import { InvoiceDocument } from "../shared/InvoiceDocument.jsx";

export function PortalInvoicesTab({ property }) {
  const [invoices, setInvoices] = useState(null);
  const [viewId, setViewId] = useState(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "id, invoice_number, title, created_at, invoice_date, due_date, sent_at, total, status",
      )
      .eq("customer_id", property.id)
      .in("status", ["sent", "paid"])
      .order("sent_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[portal invoices] load failed", error);
      setInvoices([]);
      return;
    }
    setInvoices(data || []);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [property.id]);

  const fmtDay = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  if (viewId) {
    return (
      <InvoiceDocument
        invoiceId={viewId}
        readOnly
        onBack={() => setViewId(null)}
      />
    );
  }

  if (invoices === null) {
    return (
      <div className="px-5 py-10 text-center text-stone-400 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="px-5 pt-4 pb-28">
      <div className="mb-4">
        <h2 className="font-serif text-2xl text-stone-900 mb-1">Invoices</h2>
        <p className="text-sm text-stone-600">
          Invoices from Summit Clean for {property.name}. Tap one to view or
          download.
        </p>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-2xl bg-stone-50 border border-stone-200 p-8 text-center">
          <FileText size={22} className="inline text-stone-300 mb-2" />
          <div className="text-sm text-stone-500">No invoices yet.</div>
          <div className="text-[11px] text-stone-400 font-mono mt-1">
            They'll show up here once they're sent to you.
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {invoices.map((inv) => {
            const paid = inv.status === "paid";
            return (
              <button
                key={inv.id}
                onClick={() => setViewId(inv.id)}
                className="w-full text-left rounded-2xl bg-white border border-stone-200 p-4 hover:border-stone-400 active:scale-[0.99] transition-all flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-lg text-stone-900">
                      {inv.invoice_number
                        ? `#${inv.invoice_number}`
                        : inv.title || "Invoice"}
                    </span>
                    <span
                      className={`text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-full font-bold ${
                        paid
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-blue-100 text-blue-800 border border-blue-200"
                      }`}
                    >
                      {paid ? "Paid" : "Received"}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 font-mono mt-1">
                    Sent {fmtDay(inv.sent_at || inv.created_at)}
                    {inv.due_date && ` · due ${fmtDay(inv.due_date)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-mono text-lg text-stone-900 tabular-nums">
                    {inv.total != null ? fmtMoney(Number(inv.total)) : "—"}
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
