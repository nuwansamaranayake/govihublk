"use client";

import { useTranslations, useLocale } from "next-intl";

export function MatchDisclaimer({ variant }: { variant: "short" | "full" }) {
  const t = useTranslations("matches");
  const locale = useLocale();

  return (
    <p className="text-xs text-neutral-500 leading-relaxed">
      {t(variant === "short" ? "disclaimer_short" : "disclaimer_full")}{" "}
      <a
        href={`/${locale}/terms`}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-neutral-700"
      >
        {t("disclaimer_link")}
      </a>
    </p>
  );
}

export default MatchDisclaimer;
