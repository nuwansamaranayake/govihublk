"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import BottomNav, { BottomNavItem } from "@/components/ui/BottomNav";
import TopBar from "@/components/ui/TopBar";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="w-6 h-6"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

function ListingsIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="w-6 h-6"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {active ? (
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      )}
    </svg>
  );
}

function MatchIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="w-6 h-6"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {active ? (
        <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      )}
    </svg>
  );
}

function DiagnosisIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="w-6 h-6"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {active ? (
        <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
        />
      )}
    </svg>
  );
}

function MoreIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="w-6 h-6"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}

export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const base = `/${locale}/farmer`;

  const navItems: BottomNavItem[] = [
    { href: base + "/dashboard", label: t("home"), icon: (a) => <HomeIcon active={a} /> },
    { href: base + "/listings", label: t("listings"), icon: (a) => <ListingsIcon active={a} /> },
    { href: base + "/matches", label: t("matches"), icon: (a) => <MatchIcon active={a} /> },
    { href: base + "/diagnosis", label: t("diagnosis"), icon: (a) => <DiagnosisIcon active={a} /> },
    { href: base + "/more", label: "More", icon: (a) => <MoreIcon active={a} /> },
  ];

  return (
    <div className="flex flex-col min-h-dvh bg-neutral-50">
      <TopBar
        leftAction={
          <span className="text-base font-bold text-primary-600">GoviHub</span>
        }
        rightActions={
          <span className="text-xs font-semibold text-accent-600 bg-accent-50 px-2 py-0.5 rounded-full border border-accent-200">
            Farmer
          </span>
        }
      />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav items={navItems} />
    </div>
  );
}
