"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  leftAction?: React.ReactNode;
  rightActions?: React.ReactNode;
  transparent?: boolean;
  className?: string;
}

export function TopBar({
  title,
  showBack = false,
  onBack,
  leftAction,
  rightActions,
  transparent = false,
  className = "",
}: TopBarProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <header
      className={[
        "sticky top-0 z-30 flex items-center justify-between h-14 px-4 gap-2",
        transparent
          ? "bg-transparent"
          : "bg-white border-b border-neutral-100 shadow-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Left slot */}
      <div className="flex items-center gap-2 min-w-[40px]">
        {!showBack && !leftAction && (
          <Image src="/images/logo-icon-sm.png" alt="GoviHub" width={28} height={28} className="rounded-md" />
        )}
        {showBack && (
          <button
            onClick={handleBack}
            className="p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 transition-colors -ml-2"
            aria-label="Go back"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {leftAction}
      </div>

      {/* Title */}
      {title && (
        <h1 className="flex-1 text-center text-base font-semibold text-neutral-900 truncate">
          {title}
        </h1>
      )}

      {/* Right slot */}
      <div className="flex items-center gap-1 min-w-[40px] justify-end">
        {rightActions}
      </div>
    </header>
  );
}

export default TopBar;
