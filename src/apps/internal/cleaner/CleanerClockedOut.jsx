import React from "react";
import { Clock, LogOut, Eye, MessageSquare, User } from "lucide-react";
import { Header } from "../../../components/Header.jsx";
import { WhosWorkingNowModal } from "../../../domains/work/cleaner/WhosWorkingNowModal.jsx";
import { CleanerWorkList } from "../../../domains/work/cleaner/CleanerWorkList.jsx";
import { CleanerPropertiesList } from "./CleanerPropertiesList.jsx";
import { CleanerMoreExtras } from "./CleanerMoreExtras.jsx";
import { CleanerBottomNav } from "./CleanerBottomNav.jsx";

export function CleanerClockedOut({
  employee,
  cleanerTab,
  setCleanerTab,
  busy,
  whosWorkingOpen,
  setWhosWorkingOpen,
  signOutWithCleanup,
  startClockIn,
  startJob,
  onPickProperty,
  startViewOnly,
  setShowMessages,
  setShowChangePin,
}) {
  return (
          <div className="min-h-screen bg-stone-50 flex flex-col pb-24">
            <Header
              name={employee.name}
              onSignOut={signOutWithCleanup}
              role={employee.role}
              cleanerView
              employee={employee}
              onOpenMessages={() => setShowMessages(true)}
              onOpenWhosHere={() => setWhosWorkingOpen(true)}
            />
            {whosWorkingOpen && (
              <WhosWorkingNowModal
                employee={employee}
                onClose={() => setWhosWorkingOpen(false)}
              />
            )}
    
            {/* NOT CLOCKED IN. This is its own screen — it is NOT PropertyHub's
               Home tab, it just shares the same CleanerWorkList, which is why
               the two look alike. The Assignments / More tabs in PropertyHub are
               scoped to the property of the current shift, and there's no shift
               yet, so those tabs get property-independent content here. */}
            {cleanerTab === "home" && (
              <>
                <div className="px-1 pt-2">
                  <div className="px-4">
                    <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-1">
                      {new Date().toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                    <h2 className="text-3xl font-light text-stone-900 tracking-tight mb-1">
                      Your{" "}
                      <span className="font-serif italic text-amber-700">work</span>
                    </h2>
                  </div>
                  <CleanerWorkList
                    employee={employee}
                    currentPropertyId={null}
                    onStartJob={startJob}
                    onGoToBedroom={null}
                    onSwitchProperty={null}
                  />
                </div>
    
                <div className="flex-1 flex flex-col justify-center items-center px-6 pb-6">
                  <button
                    onClick={startClockIn}
                    disabled={busy}
                    className="w-full max-w-sm py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium flex items-center justify-center gap-2 active:scale-98 transition-transform disabled:opacity-50"
                  >
                    <Clock size={18} />
                    <span>Clock in without a job</span>
                  </button>
                </div>
              </>
            )}
    
            {/* Assignments, before a property is picked = where is the work.
               Tapping a property starts the clock-in flow there. */}
            {cleanerTab === "assignments" && (
              <div className="pt-4">
                <div className="px-4 mb-1">
                  <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
                    Where the work is
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Open jobs by property. Tap one to clock in there.
                  </p>
                </div>
                {/* Tapping a property clocks straight in there. It used to call
                   startClockIn, which reopened the generic picker and made you
                   choose the same property a second time. */}
                <CleanerPropertiesList
                  currentPropertyId={null}
                  employee={employee}
                  onOpenCurrent={startClockIn}
                  onSwitch={(p) => onPickProperty(p)}
                />
              </div>
            )}
    
            {cleanerTab === "more" && (
              <div className="px-4 pt-4 space-y-2">
                <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2">
                  Account &amp; settings
                </div>
                <CleanerMoreExtras employee={employee} />
                <button
                  onClick={() => setShowMessages(true)}
                  className="w-full px-4 py-3.5 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 text-left flex items-center gap-3 active:scale-98"
                >
                  <MessageSquare size={18} className="text-stone-700" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-stone-900">
                      Messages
                    </div>
                    <div className="text-xs text-stone-500">
                      Read and reply to the team
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setShowChangePin(true)}
                  className="w-full px-4 py-3.5 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 text-left flex items-center gap-3 active:scale-98"
                >
                  <User size={18} className="text-stone-700" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-stone-900">
                      Change PIN
                    </div>
                    <div className="text-xs text-stone-500">
                      Update your sign-in code
                    </div>
                  </div>
                </button>
                <button
                  onClick={startViewOnly}
                  disabled={busy}
                  className="w-full px-4 py-3.5 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 text-left flex items-center gap-3 active:scale-98 disabled:opacity-50"
                >
                  <Eye size={18} className="text-stone-700" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-stone-900">
                      Just look around
                    </div>
                    <div className="text-xs text-stone-500">
                      Browse without tracking time
                    </div>
                  </div>
                </button>
                <button
                  onClick={signOutWithCleanup}
                  className="w-full px-4 py-3.5 rounded-2xl bg-white border border-stone-200 hover:border-red-300 text-left flex items-center gap-3 active:scale-98"
                >
                  <LogOut size={18} className="text-red-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-red-600">Sign out</div>
                  </div>
                </button>
              </div>
            )}
    
            <CleanerBottomNav active={cleanerTab} onChange={setCleanerTab} />
          </div>
  );
}
