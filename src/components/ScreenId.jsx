import React from "react";
import { APP_VERSION } from "../lib/constants.js";

export function ScreenId({ id }) {
  return (
    <div className="fixed top-1 left-1/2 -translate-x-1/2 z-[60] pointer-events-none select-none print:hidden flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-stone-900/90 border border-amber-400/50 shadow-lg">
      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-300 leading-none">
        {id}
      </span>
      <span className="text-[9px] font-mono text-stone-400 leading-none">
        v{APP_VERSION}
      </span>
    </div>
  );
}
