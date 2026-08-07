import { ArrowLeft, Printer } from "lucide-react";
import { fmtDateLong, fmtMoney } from "../../../lib/format.js";

export function InvoicePreview({ invoice, showZeros, setShowZeros, onBack, onPrint }) {
  const { property, units, grandTotal, totalHours, start, end } = invoice;
  return (
    <div className="pb-24 bg-stone-50">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .invoice-page { max-width: 100% !important; box-shadow: none !important; border: none !important; }
        }
      `}</style>
      <div className="no-print flex items-center justify-between gap-3 px-5 py-4 border-b border-stone-200 bg-white sticky top-0 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-stone-700 text-sm"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-mono text-stone-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showZeros}
              onChange={(e) => setShowZeros(e.target.checked)}
              className="w-4 h-4 rounded accent-stone-900"
            />
            Show $0
          </label>
          <button
            onClick={onPrint}
            className="ml-2 px-4 py-2 rounded-full bg-stone-900 text-stone-50 text-sm font-medium flex items-center gap-2"
          >
            <Printer size={14} /> Print / PDF
          </button>
        </div>
      </div>
      <div className="invoice-page max-w-3xl mx-auto bg-white border border-stone-200 my-6 mx-4 sm:mx-auto p-8 sm:p-12 rounded-2xl shadow-sm">
        <div className="flex items-start justify-between mb-8 pb-8 border-b border-stone-200">
          <div>
            <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">
              Invoice
            </div>
            <h1 className="font-serif text-3xl text-stone-900 mb-1">
              {property.name}
            </h1>
            {property.address && (
              <div className="text-sm text-stone-600">{property.address}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">
              Period
            </div>
            <div className="font-mono text-sm text-stone-900">
              {fmtDateLong(start)}
            </div>
            <div className="font-mono text-sm text-stone-900">
              to {fmtDateLong(end)}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-8 p-4 bg-stone-50 rounded-xl">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">
              Total hours
            </div>
            <div className="font-serif text-2xl text-stone-900">
              {totalHours.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">
              Rate
            </div>
            <div className="font-serif text-2xl text-stone-900">
              {fmtMoney(property.bill_rate_hourly)}/hr
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">
              Amount due
            </div>
            <div className="font-serif text-2xl text-amber-700">
              {fmtMoney(grandTotal)}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          {units.map((unit) => {
            const visibleParties = unit.parties.filter(
              (p) => showZeros || p.hasWork,
            );
            const unitTotal = unit.parties.reduce(
              (sum, p) => sum + p.amount,
              0,
            );
            const unitHours = unit.parties.reduce((sum, p) => sum + p.hours, 0);
            if (visibleParties.length === 0 && !showZeros) return null;
            return (
              <div key={unit.id}>
                <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-stone-200">
                  <h3 className="font-serif text-xl text-stone-900">
                    {unit.label}
                  </h3>
                  <div className="font-mono text-sm text-stone-700">
                    {unitHours.toFixed(2)} hrs · {fmtMoney(unitTotal)}
                  </div>
                </div>
                {visibleParties.length === 0 ? (
                  <div className="text-sm text-stone-400 italic py-2">
                    No work this period.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider font-mono text-stone-500 text-left">
                        <th className="font-normal pb-2">Bedroom</th>
                        <th className="font-normal pb-2 text-right">Hours</th>
                        <th className="font-normal pb-2 text-right">Rate</th>
                        <th className="font-normal pb-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleParties.map((party) => (
                        <tr
                          key={party.id}
                          className={`border-t border-stone-100 ${!party.hasWork ? "text-stone-400" : ""}`}
                        >
                          <td className="py-2.5">
                            <div className="font-medium">{party.label}</div>
                            {party.full_name && (
                              <div className="text-xs text-stone-500">
                                {party.full_name}
                              </div>
                            )}
                            {party.blocks?.length > 0 && (
                              <div className="text-[10px] text-stone-500 font-mono mt-0.5">
                                {party.blocks.length} block
                                {party.blocks.length === 1 ? "" : "s"} ·{" "}
                                {[
                                  ...new Set(
                                    party.blocks
                                      .map((b) => b.shift?.employee?.name)
                                      .filter(Boolean),
                                  ),
                                ].join(", ")}
                              </div>
                            )}
                            {party.blocks?.[0]?.work_notes && (
                              <div className="text-[10px] text-stone-500 italic mt-0.5">
                                "{party.blocks[0].work_notes}"
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 text-right font-mono">
                            {party.hours.toFixed(2)}
                          </td>
                          <td className="py-2.5 text-right font-mono">
                            {fmtMoney(property.bill_rate_hourly)}
                          </td>
                          <td className="py-2.5 text-right font-mono font-medium">
                            {fmtMoney(party.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-8 pt-6 border-t-2 border-stone-900">
          <div className="flex items-baseline justify-between">
            <div className="font-serif text-xl text-stone-900">Total due</div>
            <div className="font-serif text-3xl text-stone-900">
              {fmtMoney(grandTotal)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
