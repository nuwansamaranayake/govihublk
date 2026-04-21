"use client";

import React from "react";
import { formatDateSafe } from "@/lib/utils";

interface DateRangeProps {
  start: string | Date;
  end?: string | Date;
  format?: "short" | "long";
  className?: string;
  showIcon?: boolean;
}

function toDateStr(date: string | Date): string {
  if (typeof date === "string") return date;
  // For Date objects, extract YYYY-MM-DD without timezone shift
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DateRange({
  start,
  end,
  format = "short",
  className = "",
  showIcon = true,
}: DateRangeProps) {
  const startStr = toDateStr(start);
  const endStr = end ? toDateStr(end) : null;

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
      <time dateTime={startStr.split("T")[0]}>{formatDateSafe(startStr, format)}</time>
      {endStr && (
        <>
          <span className="text-neutral-400" aria-hidden="true">
            &ndash;
          </span>
          <time dateTime={endStr.split("T")[0]}>{formatDateSafe(endStr, format)}</time>
        </>
      )}
    </span>
  );
}

export default DateRange;
