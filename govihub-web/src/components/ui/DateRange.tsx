"use client";

import React from "react";

interface DateRangeProps {
  start: string | Date;
  end?: string | Date;
  format?: "short" | "long";
  className?: string;
  showIcon?: boolean;
}

function formatDate(date: string | Date, format: "short" | "long"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (format === "short") {
    return d.toLocaleDateString("en-LK", { day: "numeric", month: "short" });
  }
  return d.toLocaleDateString("en-LK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function DateRange({
  start,
  end,
  format = "short",
  className = "",
  showIcon = true,
}: DateRangeProps) {
  return (
    <span className={"inline-flex items-center gap-1.5 text-sm text-neutral-600 " + className}>
      {showIcon && (
        <svg
          className="w-4 h-4 text-neutral-400 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      )}
      <time dateTime={new Date(start).toISOString()}>{formatDate(start, format)}</time>
      {end && (
        <>
          <span className="text-neutral-400" aria-hidden="true">
            &ndash;
          </span>
          <time dateTime={new Date(end).toISOString()}>{formatDate(end, format)}</time>
        </>
      )}
    </span>
  );
}

export default DateRange;
