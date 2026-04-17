"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { HelpPanel } from "./HelpPanel";

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  leftAction?: React.ReactNode;
  rightActions?: React.ReactNode;
  transparent?: boolean;
  className?: string;
  helpKey?: string;
}

export function TopBar({
  title,
  showBack = false,
  onBack,
  leftAction,
  rightActions,
  transparent = false,
  className = "",
  helpKey,
}: TopBarProps) {
  const router = useRouter();
  const params = useParams();
  const locale = ((params?.locale as string) || "en") as "en" | "si";
  const t = useTranslations("brand");
  const [showHelp, setShowHelp] = useState(false);

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
          <div className="flex items-center gap-2">
            <Image src="/icons/icon-192x192.png" alt="GoviHub Spices" width={28} height={28} className="rounded-md" />
            {!title && (
              <div className="leading-tight">
                <div className="text-sm font-semibold text-[#1e4a1f]">GoviHub</div>
                <div className="text-[10px] font-semibold tracking-wide uppercase text-[#c28a1f]">
                  {t("sectorSpices")}
                </div>
              </div>
            )}
          </div>
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
        {helpKey && (
          <button
            onClick={() => setShowHelp(true)}
            className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold hover:bg-green-200 transition-colors"
            aria-label="Help"
          >
            ?
          </button>
        )}
        {rightActions}
      </div>

      {/* Help panel */}
      {showHelp && helpKey && (
        <HelpPanel
          pageKey={helpKey}
          locale={locale}
          onClose={() => setShowHelp(false)}
        />
      )}
    </header>
  );
}

export default TopBar;
