"use client";

import React from "react";

interface SkeletonProps {
  className?: string;
  rounded?: "none" | "sm" | "md" | "lg" | "full";
  width?: string;
  height?: string;
}

const roundedClasses = {
  none: "rounded-none",
  sm: "rounded",
  md: "rounded-xl",
  lg: "rounded-2xl",
  full: "rounded-full",
};

export function Skeleton({
  className = "",
  rounded = "md",
  width,
  height,
}: SkeletonProps) {
  return (
    <div
      className={[
        "animate-pulse bg-neutral-200",
        roundedClasses[rounded],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={"space-y-2 " + className} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          width={i === lines - 1 ? "67%" : "100%"}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={"bg-white rounded-2xl border border-neutral-200 p-4 space-y-3 " + className}
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10" rounded="full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

export default Skeleton;
