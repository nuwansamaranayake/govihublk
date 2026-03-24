"use client";

import React from "react";

interface PriceTagProps {
  price: number;
  unit?: string;
  currency?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  highlight?: boolean;
}

const sizeClasses = {
  sm: { price: "text-base font-bold", meta: "text-xs" },
  md: { price: "text-lg font-bold", meta: "text-sm" },
  lg: { price: "text-2xl font-bold", meta: "text-sm" },
};

export function PriceTag({
  price,
  unit,
  currency = "Rs.",
  size = "md",
  className = "",
  highlight = false,
}: PriceTagProps) {
  const { price: priceClass, meta: metaClass } = sizeClasses[size];
  const formattedPrice = price.toLocaleString("en-LK");

  return (
    <span
      className={[
        "inline-flex items-baseline gap-1",
        highlight ? "text-accent-600" : "text-neutral-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className={metaClass + " text-neutral-500"}>{currency}</span>
      <span className={priceClass}>{formattedPrice}</span>
      {unit && (
        <span className={metaClass + " text-neutral-500"}>{"/" + unit}</span>
      )}
    </span>
  );
}

export default PriceTag;
