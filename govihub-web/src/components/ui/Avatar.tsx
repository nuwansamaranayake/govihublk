"use client";

import React from "react";
import Image from "next/image";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: AvatarSize;
  className?: string;
  alt?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-lg",
};

const sizePx: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const colorPalette = [
  "bg-green-200 text-green-800",
  "bg-amber-200 text-amber-800",
  "bg-blue-200 text-blue-800",
  "bg-purple-200 text-purple-800",
  "bg-pink-200 text-pink-800",
  "bg-teal-200 text-teal-800",
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return colorPalette[hash % colorPalette.length];
}

export function Avatar({ src, name = "", size = "md", className = "", alt }: AvatarProps) {
  const initials = name ? getInitials(name) : "?";
  const colorClass = name ? getColor(name) : "bg-neutral-200 text-neutral-500";
  const dim = sizePx[size];

  if (src) {
    return (
      <div
        className={"relative rounded-full overflow-hidden shrink-0 " + sizeClasses[size] + " " + className}
      >
        <Image
          src={src}
          alt={alt || name || "Avatar"}
          width={dim}
          height={dim}
          className="object-cover w-full h-full"
        />
      </div>
    );
  }

  return (
    <div
      className={[
        "rounded-full flex items-center justify-center font-semibold shrink-0 select-none",
        sizeClasses[size],
        colorClass,
        className,
      ].join(" ")}
      aria-label={name || "User avatar"}
    >
      {initials}
    </div>
  );
}

export default Avatar;
