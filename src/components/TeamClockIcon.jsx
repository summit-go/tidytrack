import React from "react";
import { Users, Clock } from "lucide-react";

export function TeamClockIcon({ size = 18 }) {
  return (
    <span
      className="relative inline-flex"
      style={{ width: size, height: size }}
    >
      <Users size={size} />
      <span
        className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center ring-1 ring-current bg-white"
        style={{ width: size * 0.64, height: size * 0.64 }}
      >
        <Clock
          size={size * 0.48}
          className="text-stone-900"
          strokeWidth={2.5}
        />
      </span>
    </span>
  );
}
