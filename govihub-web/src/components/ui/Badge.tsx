"use client";

import React from "react";

type BadgeColor =
  | "green"
  | "gold"
  | "blue"
  | "red"
  | "gray"
  | "orange"
  | "purple"
  | "darkgreen";

type BadgeSize = "sm" | "md";

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

const colorClasses: Record<BadgeColor, string> = {
  green: "bg-green-100 text-green-700 border border-green-200",
  gold: "bg-amber-100 text-amber-700 border border-amber-200",
  blue: "bg-blue-100 text-blue-700 border border-blue-200",
  red: "bg-red-100 text-red-700 border border-red-200",
  gray: "bg-neutral-100 text-neutral-600 border border-neutral-200",
  orange: "bg-orange-100 text-orange-700 border border-orange-200",
  purple: "bg-purple-100 text-purple-700 border border-purple-200",
  darkgreen: "bg-emerald-100 text-emerald-800 border border-emerald-200",
};

const dotColorClasses: Record<BadgeColor, string> = {
  green: "bg-green-500",
  gold: "bg-amber-500",
  blue: "bg-blue-500",
  red: "bg-red-500",
  gray: "bg-neutral-400",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
  darkgreen: "bg-emerald-600",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
};

export function Badge({
  children,
  color = "gray",
  size = "md",
  dot = false,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        colorClasses[color],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColorClasses[color]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

export default Badge;
