import React, { useState } from "react";
import {
  FileText,
  Check,
  DollarSign,
  ClipboardList,
} from "lucide-react";
import { ScreenId } from "../../../components/ScreenId.jsx";
import { InvoiceView } from "../invoices/InvoiceView.jsx";
import { InvoicePaymentsReport } from "../invoices/InvoicePaymentsReport.jsx";
import { ExportView } from "../payroll/ExportView.jsx";
import { ProfitReportView } from "../reporting/ProfitReportView.jsx";
import { CleaningsReportView } from "../../work/assignments/CleaningsReportView.jsx";

export function MoneyView({ employee, onSignOut, onOpenMessages, onLogoClick }) {
  const [subTab, setSubTab] = useState("invoices"); // 'invoices' | 'payroll' | 'reports' | 'profit'

  const ChildView =
    subTab === "invoices"
      ? InvoiceView
      : subTab === "payments"
        ? InvoicePaymentsReport
        : subTab === "payroll"
          ? ExportView
          : subTab === "profit"
            ? ProfitReportView
            : CleaningsReportView;
  return (
    <div>
      <ScreenId id="OW-MONEY" />
      <ChildView
        employee={employee}
        onSignOut={onSignOut}
        onOpenMessages={onOpenMessages}
        onLogoClick={onLogoClick}
        topToggle={
          <div className="px-5 pt-4">
            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl">
              <button
                onClick={() => setSubTab("invoices")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${subTab === "invoices" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                <FileText size={13} /> Invoices
              </button>
              <button
                onClick={() => setSubTab("payments")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${subTab === "payments" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                <Check size={13} /> Payments
              </button>
              <button
                onClick={() => setSubTab("payroll")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${subTab === "payroll" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                <DollarSign size={13} /> Payroll
              </button>
              <button
                onClick={() => setSubTab("reports")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${subTab === "reports" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                <ClipboardList size={13} /> Cleanings
              </button>
              <button
                onClick={() => setSubTab("profit")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${subTab === "profit" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                <DollarSign size={13} /> Profit
              </button>
            </div>
          </div>
        }
      />
    </div>
  );
}
