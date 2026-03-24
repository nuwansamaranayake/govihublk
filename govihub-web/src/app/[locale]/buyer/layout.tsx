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

function DemandsIcon({ active }: { active: boolean }) {
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
        <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
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

function MarketIcon({ active }: { active: boolean }) {
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
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      )}
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const base = `/${locale}/buyer`;

  const navItems: BottomNavItem[] = [
    { href: base + "/dashboard", label: t("home"), icon: (a) => <HomeIcon active={a} /> },
    { href: base + "/demands", label: t("demands"), icon: (a) => <DemandsIcon active={a} /> },
    { href: base + "/matches", label: t("matches"), icon: (a) => <MatchIcon active={a} /> },
    { href: base + "/marketplace", label: t("marketplace"), icon: (a) => <MarketIcon active={a} /> },
    { href: base + "/more", label: "More", icon: () => <MoreIcon /> },
  ];

  return (
    <div className="flex flex-col min-h-dvh bg-neutral-50">
      <TopBar
        leftAction={
          <span className="text-base font-bold text-primary-600">GoviHub</span>
        }
        rightActions={
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
            Buyer
          </span>
        }
      />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav items={navItems} />
    </div>
  );
}
