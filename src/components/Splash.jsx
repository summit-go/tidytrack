import React from "react";

export function Splash({ text }) {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400 text-sm">
      {text}
    </div>
  );
}
