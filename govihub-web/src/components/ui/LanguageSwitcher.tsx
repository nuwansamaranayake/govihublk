"use client";

import React, { useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "si", label: "සිං" },
  { code: "ta", label: "தமி" },
] as const;

type Locale = (typeof LOCALES)[number]["code"];

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className = "" }: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const switchLocale = (newLocale: Locale) => {
    if (newLocale === locale) return;
    // Replace current locale prefix with new one
    const segments = pathname.split("/");
    segments[1] = newLocale;
    const newPath = segments.join("/");
    startTransition(() => {
      router.replace(newPath);
    });
  };

  return (
    <div
      className={"inline-flex rounded-xl border border-neutral-200 bg-neutral-50 p-0.5 " + className}
      role="group"
      aria-label="Language switcher"
    >
      {LOCALES.map((loc) => {
        const isActive = loc.code === locale;
        return (
          <button
            key={loc.code}
            onClick={() => switchLocale(loc.code)}
            disabled={isPending}
            aria-pressed={isActive}
            className={[
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
              isActive
                ? "bg-primary-500 text-white shadow-sm"
                : "text-neutral-500 hover:text-neutral-700",
              isPending ? "opacity-50 cursor-wait" : "cursor-pointer",
            ].join(" ")}
          >
            {loc.label}
          </button>
        );
      })}
    </div>
  );
}

export default LanguageSwitcher;
