"use client";

import React from "react";

interface CardProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  image?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function Card({
  children,
  header,
  footer,
  image,
  className = "",
  onClick,
  hoverable = false,
  padding = "md",
}: CardProps) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      className={[
        "bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden",
        "flex flex-col w-full text-left",
        hoverable || onClick
          ? "transition-shadow hover:shadow-md active:shadow-sm cursor-pointer"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {image && <div className="w-full">{image}</div>}
      {header && (
        <div className={`border-b border-neutral-100 ${paddingClasses[padding]}`}>
          {header}
        </div>
      )}
      <div className={`flex-1 ${paddingClasses[padding]}`}>{children}</div>
      {footer && (
        <div className={`border-t border-neutral-100 ${paddingClasses[padding]}`}>
          {footer}
        </div>
      )}
    </Tag>
  );
}

export default Card;
