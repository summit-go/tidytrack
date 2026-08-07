import React from "react";
import { ChevronRight } from "lucide-react";

// Landing page shown when someone hits the root URL and hasn't logged in before.
// Two big buttons: staff (PIN sign-in) or property manager (access code sign-in).
export function LandingPage({ onPickStaff, onPickPortal }) {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Dark brand header band — tightened so content fits on small phones */}
      <div className="flex flex-col items-center py-5 sm:py-8 bg-stone-900">
        <img
          src="https://bbaynvqnbkjyqhzhhypr.supabase.co/storage/v1/object/public/brand/unnamed%20(2).png"
          alt="Summit Clean"
          className="w-28 sm:w-40 h-auto mx-auto"
        />
      </div>

      <div className="flex-1 flex flex-col justify-center items-center px-6 max-w-sm mx-auto w-full py-4 sm:py-8">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.25em] font-mono text-stone-500">
            Welcome
          </p>
          <h2 className="font-serif text-2xl mt-2 text-stone-900">
            Who are you?
          </h2>
        </div>

        <div className="w-full space-y-3">
          <button
            onClick={onPickStaff}
            style={{ touchAction: "manipulation" }}
            className="w-full p-5 rounded-2xl bg-stone-900 text-stone-50 text-left active:scale-98 transition-transform"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-serif text-xl">Summit Clean team</div>
                <div className="text-xs text-stone-300 font-mono mt-0.5">
                  Cleaners, managers, owners
                </div>
              </div>
              <ChevronRight size={20} className="text-stone-300" />
            </div>
          </button>

          <button
            onClick={onPickPortal}
            style={{ touchAction: "manipulation" }}
            className="w-full p-5 rounded-2xl bg-white border-2 border-stone-300 text-stone-900 text-left active:scale-98 transition-transform hover:border-stone-900"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-serif text-xl">Property manager</div>
                <div className="text-xs text-stone-500 font-mono mt-0.5">
                  View cleanings & send photos
                </div>
              </div>
              <ChevronRight size={20} className="text-stone-400" />
            </div>
          </button>
        </div>
      </div>

      <div className="text-center pb-6">
        <div className="text-xs font-mono text-stone-400">
          Summit Clean · Cleaning operations
        </div>
      </div>
    </div>
  );
}
