import React from "react";

export function ProgressBar({ steps, currentStep, complete = false, onStepClick }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="w-full">
      <div className="flex gap-1">
        {steps.map((label, i) => {
          const isPast = i < currentStep;
          const isCurrent = i === currentStep;
          const fillClass = complete
            ? "bg-emerald-500"
            : isPast
              ? "bg-amber-500"
              : isCurrent
                ? "bg-amber-300"
                : "bg-stone-200";
          const canClick = onStepClick && isPast;
          const Wrapper = canClick ? "button" : "div";
          const wrapperProps = canClick
            ? {
                onClick: () => onStepClick(i),
                className: "flex-1 group cursor-pointer",
                title: `Back to ${label}`,
              }
            : { className: "flex-1" };
          return (
            <Wrapper key={i} {...wrapperProps}>
              <div
                className={`h-1.5 rounded-full transition-colors ${fillClass} ${canClick ? "group-hover:opacity-80" : ""}`}
              />
            </Wrapper>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1">
        {steps.map((label, i) => {
          const isPast = i < currentStep;
          const isCurrent = i === currentStep;
          const textClass = complete
            ? "text-emerald-700 font-bold"
            : isPast
              ? "text-stone-700 font-medium"
              : isCurrent
                ? "text-stone-900 font-bold"
                : "text-stone-400";
          const canClick = onStepClick && isPast;
          const Wrapper = canClick ? "button" : "div";
          const wrapperProps = canClick
            ? {
                onClick: () => onStepClick(i),
                className: "flex-1 text-center cursor-pointer",
              }
            : { className: "flex-1 text-center" };
          return (
            <Wrapper key={i} {...wrapperProps}>
              <span
                className={`text-[9px] uppercase tracking-wider font-mono ${textClass}`}
              >
                {label}
              </span>
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}
