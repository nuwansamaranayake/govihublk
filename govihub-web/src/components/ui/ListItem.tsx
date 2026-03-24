"use client";

import React from "react";
import Avatar from "./Avatar";

interface ListItemProps {
  title: string;
  subtitle?: string;
  avatarSrc?: string;
  avatarName?: string;
  leftIcon?: React.ReactNode;
  rightContent?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  badge?: React.ReactNode;
}

export function ListItem({
  title,
  subtitle,
  avatarSrc,
  avatarName,
  leftIcon,
  rightContent,
  onClick,
  className = "",
  badge,
}: ListItemProps) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      className={[
        "flex items-center gap-3 w-full text-left px-4 py-3",
        "bg-white",
        onClick ? "hover:bg-neutral-50 active:bg-neutral-100 cursor-pointer transition-colors" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Left: avatar or icon */}
      {(avatarSrc != null || avatarName) && (
        <Avatar src={avatarSrc} name={avatarName} size="md" />
      )}
      {!avatarSrc && !avatarName && leftIcon && (
        <span className="shrink-0 text-neutral-400">{leftIcon}</span>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-neutral-900 truncate">{title}</p>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs text-neutral-500 truncate mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Right */}
      {rightContent && (
        <div className="shrink-0 flex items-center">{rightContent}</div>
      )}
    </Tag>
  );
}

export default ListItem;
