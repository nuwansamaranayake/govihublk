"use client";

import React from "react";

interface QuantityDisplayProps {
  quantity: number;
  unit?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

const sizeClasses = {
  sm: { num: "text-base font-semibold", unit: "text-xs", label: "text-xs" },
  md: { num: "text-lg font-semibold", unit: "text-sm", label: "text-xs" },
  lg: { num: "text-2xl font-bold", unit: "text-base", label: "text-sm" },
};

export function QuantityDisplay({
  quantity,
  unit = "kg",
  size = "md",
  className = "",
  label,
}: QuantityDisplayProps) {
  const classes = sizeClasses[size];
  const formatted = quantity.toLocaleString("en-LK");

  return (
    <span className={"inline-flex flex-col " + className}>
      {label && (
        <span className={classes.label + " text-neutral-500 leading-none mb-0.5"}>
          {label}
        </span>
      )}
      <span className="inline-flex items-baseline gap-1">
        <span className={classes.num + " text-neutral-900"}>{formatted}</span>
        <span className={classes.unit + " text-neutral-500"}>{unit}</span>
      </span>
    </span>
  );
}

export default QuantityDisplay;
